from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text.rstrip() + '\n', encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(label + ' anchor not found')
    return text.replace(old, new, 1)


def replace_if_missing(text, marker, old, new, label):
    if marker in text:
        return text
    return replace_once(text, old, new, label)


def replace_between(text, start, end, new, label):
    start_index = text.find(start)
    if start_index == -1:
        raise SystemExit(label + ' start anchor not found')
    end_index = text.find(end, start_index)
    if end_index == -1:
        raise SystemExit(label + ' end anchor not found')
    return text[:start_index] + new + text[end_index:]


index = read('index.html')
index = replace_if_missing(
    index,
    'id="referencePickerSubtitle"',
    '''                <button id="referencePickerBack" class="reference-picker-back" type="button" hidden aria-label="Back">
                    Back
                </button>
                <h2 id="referencePickerTitle" tabindex="-1">Choose Book</h2>
                <button class="close-btn close-control" id="closeReferencePickerModal" aria-label="Close" type="button">''',
    '''                <button id="referencePickerBack" class="reference-picker-back" type="button" hidden aria-label="Back">
                    ‹ Back
                </button>
                <div class="reference-picker-heading">
                    <h2 id="referencePickerTitle">Book</h2>
                    <p id="referencePickerSubtitle" class="reference-picker-subtitle" hidden></p>
                </div>
                <button class="close-btn close-control" id="closeReferencePickerModal" aria-label="Close" type="button">''',
    'reference picker header html',
)
write('index.html', index)


ui = read('ui.js')
ui = replace_if_missing(
    ui,
    '"referencePickerSubtitle"',
    '''    "referencePickerTitle",
    "referencePickerFilters",''',
    '''    "referencePickerTitle",
    "referencePickerSubtitle",
    "referencePickerFilters",''',
    'ui subtitle required id',
)
ui = replace_if_missing(
    ui,
    'app.referencePickerSubtitle = document.getElementById("referencePickerSubtitle");',
    '''    app.referencePickerTitle = document.getElementById("referencePickerTitle");
    app.referencePickerBack = document.getElementById("referencePickerBack");''',
    '''    app.referencePickerTitle = document.getElementById("referencePickerTitle");
    app.referencePickerSubtitle = document.getElementById("referencePickerSubtitle");
    app.referencePickerBack = document.getElementById("referencePickerBack");''',
    'ui subtitle cache',
)
write('ui.js', ui)


HEADER_FUNCTION = '''function _updateReferencePickerHeader(app) {
    const draft = app.referencePickerDraft;
    if (!draft || !app.referencePickerTitle || !app.referencePickerSubtitle) return;

    const view = draft.view;
    const book = draft.book || app.state.currentBook;
    const chapter = draft.chapter || app.state.currentChapter;

    let title = 'Book';
    let subtitle = '';

    if (view === 'chapter') {
        title = 'Chapter';
        subtitle = app.getDisplayName(book);
    } else if (view === 'verse') {
        title = 'Verse';
        subtitle = app.getDisplayName(book) + ' ' + chapter;
    }

    app.referencePickerTitle.textContent = title;
    app.referencePickerSubtitle.textContent = subtitle;
    app.referencePickerSubtitle.hidden = subtitle === '';

    const canGoBack =
        (view === 'chapter' && draft.entryView === 'book') ||
        (view === 'verse' && draft.entryView !== 'verse');

    if (app.referencePickerBack) app.referencePickerBack.hidden = !canGoBack;
}'''

FOCUS_FUNCTION = '''function _focusReferencePicker(app) {
    requestAnimationFrame(() => {
        if (!app.referencePickerModal?.classList.contains('active')) return;

        const activeItem = app.referencePickerView?.querySelector('.picker-item--active');
        const firstButton = app.referencePickerView?.querySelector('button');

        (activeItem || firstButton || app.referencePickerModal)
            ?.focus({ preventScroll: true });
    });
}'''

VERSE_GO_BLOCK = '''    const actions = document.createElement('div');
    actions.className = 'picker-actions';

    const goButton = document.createElement('button');
    goButton.className = 'primary-btn';
    goButton.type = 'button';
    goButton.textContent = 'Go';
    goButton.setAttribute('aria-label', 'Go to selected chapter without choosing a verse');
    goButton.addEventListener('click', () => {
        app._dbgUserAction?.('picker go: ' + app.state.currentBook + ' ' + app.state.currentChapter);
        app.referencePickerDraft = null;
        closeReferencePicker(app);
    });

    actions.appendChild(goButton);
    view.appendChild(actions);

'''

CHAPTER_GO_BLOCK = '''
    const actions = document.createElement('div');
    actions.className = 'picker-actions picker-actions--footer';

    const goButton = document.createElement('button');
    goButton.className = 'secondary-btn reference-picker-go';
    goButton.type = 'button';
    goButton.textContent = 'Go to chapter';
    goButton.addEventListener('click', async () => {
        const targetBook = draft.book || app.state.currentBook;
        const targetChapter = draft.chapter || app.state.currentChapter;

        app._dbgUserAction?.('picker go: ' + targetBook + ' ' + targetChapter);
        await app.loadPassage(targetBook, targetChapter, false, 'chapter-picker-go');
        closeReferencePicker(app);
    });

    actions.appendChild(goButton);
    view.appendChild(actions);
'''

modals = read('modals.js')
if "let title = 'Book';" not in modals:
    modals = replace_between(
        modals,
        'function _updateReferencePickerHeader(app) {',
        '\n\nfunction _focusReferencePickerTitle(app) {',
        HEADER_FUNCTION,
        'reference picker header function',
    )
if '_focusReferencePickerTitle' in modals:
    modals = replace_between(
        modals,
        'function _focusReferencePickerTitle(app) {',
        '\n\nfunction _transitionReferencePickerView(app, renderNextView',
        FOCUS_FUNCTION,
        'reference picker focus function',
    )
    modals = modals.replace('_focusReferencePickerTitle(app)', '_focusReferencePicker(app)')
if VERSE_GO_BLOCK in modals:
    modals = modals.replace(VERSE_GO_BLOCK, '', 1)
if 'reference-picker-go' not in modals:
    modals = replace_once(
        modals,
        '    view.appendChild(grid);\n}\n\nfunction _renderVersePickerView(app) {',
        '    view.appendChild(grid);\n' + CHAPTER_GO_BLOCK + '}\n\nfunction _renderVersePickerView(app) {',
        'chapter picker go button',
    )
write('modals.js', modals)


REFINED_REFERENCE_PICKER_CSS = '''/* Reference picker */
.reference-picker-modal .modal-content {
    transition: height 180ms ease;
}

.reference-picker-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    gap: 0.5rem;
    padding: 0.75rem 0.75rem 0.5rem;
}

.reference-picker-heading {
    min-width: 0;
}

.reference-picker-heading h2 {
    margin: 0;
    color: var(--primary-color);
    font-size: 1.1rem;
    line-height: 1.2;
}

.reference-picker-subtitle {
    margin: 0.15rem 0 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.2;
}

.reference-picker-back {
    align-self: start;
    border: 1px solid var(--border-neutral);
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-secondary);
    padding: 0.35rem 0.5rem;
    font: inherit;
    font-size: 0.85rem;
    line-height: 1.2;
}

.reference-picker-back[hidden] {
    display: none;
}

.reference-picker-modal .book-testament-filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 0.4rem;
    padding: 0 0.75rem 0.75rem;
}

.reference-picker-modal .book-testament-filter {
    min-width: 0;
    justify-content: center;
    text-align: center;
    white-space: nowrap;
}

.reference-picker-body {
    padding: 0.75rem 1rem 1rem;
    overflow: hidden auto;
}

.reference-picker-view {
    transition:
        opacity 140ms ease,
        transform 140ms ease;
}

.reference-picker-view--enter-forward {
    opacity: 0;
    transform: translateX(10px);
}

.reference-picker-view--enter-back {
    opacity: 0;
    transform: translateX(-10px);
}

.reference-picker-view--chapter .chapter-grid,
.reference-picker-view--verse .chapter-grid {
    gap: 0.5rem;
}

.reference-picker-view--chapter .chapter-item,
.reference-picker-view--verse .chapter-item {
    min-height: 3rem;
}

.picker-actions--footer {
    margin-top: 0.75rem;
}

.reference-picker-go {
    width: 100%;
}

.reference-picker-empty {
    color: var(--text-secondary);
    padding: 20px;
    text-align: center;
}

.picker-item--active {
    border-color: var(--primary-color);
    box-shadow: inset 0 0 0 1px var(--primary-color);
    color: var(--primary-color);
}

@media (prefers-reduced-motion: reduce) {
    .reference-picker-modal .modal-content,
    .reference-picker-view {
        transition: none;
    }
}'''

css = read('css/modals.css')
css, count = re.subn(
    r'/\* Reference picker \*/.*\Z',
    REFINED_REFERENCE_PICKER_CSS,
    css,
    count=1,
    flags=re.S,
)
if count != 1 or 'reference-picker-heading' not in css:
    raise SystemExit('reference picker css replacement failed')
write('css/modals.css', css)

print('picker layout fix script complete')
