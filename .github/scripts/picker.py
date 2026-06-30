from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(label + ' anchor not found')
    return text.replace(old, new, 1)


def replace_if_missing(text, marker, old, new, label):
    if marker in text:
        return text
    return replace_once(text, old, new, label)


def replace_between_if_missing(text, marker, start, end, new, label):
    if marker in text:
        return text
    start_index = text.find(start)
    if start_index == -1:
        raise SystemExit(label + ' start anchor not found')
    end_index = text.find(end, start_index)
    if end_index == -1:
        raise SystemExit(label + ' end anchor not found')
    return text[:start_index] + new + text[end_index:]


def replace_regex_if_missing(text, marker, pattern, new, label):
    if marker in text:
        return text
    text, count = re.subn(pattern, new, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(label + ' anchor not found')
    return text


REFERENCE_PICKER_HTML = '''    <div id="referencePickerModal" class="modal reference-picker-modal" role="dialog" aria-modal="true"
        aria-labelledby="referencePickerTitle" aria-hidden="true" inert>
        <div class="modal-content">
            <div class="modal-header reference-picker-header">
                <button id="referencePickerBack" class="reference-picker-back" type="button" hidden aria-label="Back">
                    Back
                </button>
                <h2 id="referencePickerTitle" tabindex="-1">Choose Book</h2>
                <button class="close-btn close-control" id="closeReferencePickerModal" aria-label="Close" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M7 7L17 17M17 7L7 17"></path>
                    </svg>
                </button>
            </div>
            <div id="referencePickerFilters" class="book-testament-filters" role="group"
                aria-label="Filter books by testament" hidden></div>
            <div class="modal-body reference-picker-body">
                <div id="referencePickerView" class="reference-picker-view"></div>
            </div>
        </div>
    </div>

'''

index = read('index.html')
index = replace_between_if_missing(
    index,
    'id="referencePickerModal"',
    '    <div id="bookModal"',
    '    <div id="translationModal"',
    REFERENCE_PICKER_HTML,
    'reference picker html',
)
write('index.html', index)


ui = read('ui.js')
ui = replace_if_missing(
    ui,
    '"referencePickerModal"',
    '''    "bookModal",
    "chapterModal",
    "verseModal",
    "settingsModal",
    "loginModal",
    "signupModal",
    "userMenuModal",
    "closeBookModal",
    "closeChapterModal",
    "closeVerseModal",
    "closeSettingsModal",
    "closeLoginModal",
    "closeSignupModal",
    "closeUserMenuModal",
    "oldTestamentBooks",
    "newTestamentBooks",
    "chapterModalBook",
    "chapterGrid",
    "verseModalBook",
    "verseGrid",
    "verseGoButton",''',
    '''    "referencePickerModal",
    "closeReferencePickerModal",
    "referencePickerBack",
    "referencePickerTitle",
    "referencePickerFilters",
    "referencePickerView",
    "settingsModal",
    "loginModal",
    "signupModal",
    "userMenuModal",
    "closeSettingsModal",
    "closeLoginModal",
    "closeSignupModal",
    "closeUserMenuModal",''',
    'ui required ids',
)
ui = replace_if_missing(
    ui,
    'app.referencePickerModal = document.getElementById("referencePickerModal");',
    '''    // Modals
    app.bookModal = document.getElementById("bookModal");
    app.chapterModal = document.getElementById("chapterModal");
    app.verseModal = document.getElementById("verseModal");
    app.settingsModal = document.getElementById("settingsModal");
    app.loginModal = document.getElementById("loginModal");
    app.signupModal = document.getElementById("signupModal");
    app.userMenuModal = document.getElementById("userMenuModal");

    // Modal close buttons
    app.closeBookModal = document.getElementById("closeBookModal");
    app.closeChapterModal = document.getElementById("closeChapterModal");
    app.closeVerseModal = document.getElementById("closeVerseModal");
    app.closeSettingsModal = document.getElementById("closeSettingsModal");
    app.closeLoginModal = document.getElementById("closeLoginModal");
    app.closeSignupModal = document.getElementById("closeSignupModal");
    app.closeUserMenuModal = document.getElementById("closeUserMenuModal");

    // Modal content
    app.oldTestamentBooks = document.getElementById("oldTestamentBooks");
    app.newTestamentBooks = document.getElementById("newTestamentBooks");
    app.chapterModalBook = document.getElementById("chapterModalBook");
    app.chapterGrid = document.getElementById("chapterGrid");
    app.verseModalBook = document.getElementById("verseModalBook");
    app.verseGrid = document.getElementById("verseGrid");
    app.verseGoButton = document.getElementById("verseGoButton");''',
    '''    // Modals
    app.referencePickerModal = document.getElementById("referencePickerModal");
    app.referencePickerTitle = document.getElementById("referencePickerTitle");
    app.referencePickerBack = document.getElementById("referencePickerBack");
    app.referencePickerFilters = document.getElementById("referencePickerFilters");
    app.referencePickerView = document.getElementById("referencePickerView");
    app.settingsModal = document.getElementById("settingsModal");
    app.loginModal = document.getElementById("loginModal");
    app.signupModal = document.getElementById("signupModal");
    app.userMenuModal = document.getElementById("userMenuModal");

    // Modal close buttons
    app.closeReferencePickerModal = document.getElementById("closeReferencePickerModal");
    app.closeSettingsModal = document.getElementById("closeSettingsModal");
    app.closeLoginModal = document.getElementById("closeLoginModal");
    app.closeSignupModal = document.getElementById("closeSignupModal");
    app.closeUserMenuModal = document.getElementById("closeUserMenuModal");''',
    'ui modal cache',
)
write('ui.js', ui)


MODALS_REFERENCE_PICKER = '''// ── Reference picker modal ───────────────────────────────────────────────────

const BOOK_TESTAMENT_FILTERS = [
    { testament: 'Old Testament', label: 'Old Testament' },
    { testament: 'Deuterocanon', label: 'Apocrypha' },
    { testament: 'New Testament', label: 'New Testament' },
];

function _referencePickerScrollElement(app) {
    return app.referencePickerView?.closest('.modal-body') || app.referencePickerView;
}

function _rememberReferencePickerScroll(app) {
    const draft = app.referencePickerDraft;
    const scrollElement = _referencePickerScrollElement(app);
    if (!draft || !scrollElement) return;
    draft.viewScroll = draft.viewScroll || {};
    draft.viewScroll[draft.view] = scrollElement.scrollTop || 0;
}

function _restoreReferencePickerScroll(app) {
    const draft = app.referencePickerDraft;
    const scrollElement = _referencePickerScrollElement(app);
    if (!draft || !scrollElement) return;
    scrollElement.scrollTop = draft.viewScroll?.[draft.view] || 0;
}

function _setReferencePickerFiltersVisible(app, visible) {
    if (!app.referencePickerFilters) return;
    app.referencePickerFilters.hidden = !visible;
    if (!visible) app.referencePickerFilters.innerHTML = '';
}

function _updateReferencePickerHeader(app) {
    const draft = app.referencePickerDraft;
    if (!draft || !app.referencePickerTitle) return;

    const view = draft.view;
    const book = draft.book || app.state.currentBook;
    const chapter = draft.chapter || app.state.currentChapter;

    if (view === 'book') {
        app.referencePickerTitle.textContent = 'Choose Book';
    } else if (view === 'chapter') {
        app.referencePickerTitle.textContent = 'Choose Chapter in ' + app.getDisplayName(book);
    } else {
        app.referencePickerTitle.textContent = 'Choose Verse in ' + app.getDisplayName(book) + ' ' + chapter;
    }

    const canGoBack =
        (view === 'chapter' && draft.entryView === 'book') ||
        (view === 'verse' && draft.entryView !== 'verse');

    if (app.referencePickerBack) app.referencePickerBack.hidden = !canGoBack;
}

function _focusReferencePickerTitle(app) {
    requestAnimationFrame(() => {
        if (!app.referencePickerModal?.classList.contains('active')) return;
        app.referencePickerTitle?.focus({ preventScroll: true });
    });
}

function _transitionReferencePickerView(app, renderNextView, { animate = true, direction = 'forward' } = {}) {
    const modal = app.referencePickerModal;
    const content = modal?.querySelector('.modal-content');
    const view = app.referencePickerView;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!content || !view || !animate || reduceMotion) {
        renderNextView();
        _restoreReferencePickerScroll(app);
        _focusReferencePickerTitle(app);
        return;
    }

    const startHeight = content.getBoundingClientRect().height;
    content.style.height = `${startHeight}px`;
    content.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        renderNextView();
        _restoreReferencePickerScroll(app);

        const endHeight = content.scrollHeight;
        view.classList.add(direction === 'back'
            ? 'reference-picker-view--enter-back'
            : 'reference-picker-view--enter-forward');
        content.style.height = `${endHeight}px`;

        requestAnimationFrame(() => {
            view.classList.remove('reference-picker-view--enter-forward', 'reference-picker-view--enter-back');
        });
    });

    content.addEventListener('transitionend', () => {
        content.style.height = '';
        content.style.overflow = '';
        _focusReferencePickerTitle(app);
    }, { once: true });
}

function _renderReferencePickerView(app, view, { animate = true, direction = 'forward' } = {}) {
    const draft = app.referencePickerDraft;
    if (!draft || !app.referencePickerView) return;

    const previousView = draft.view;
    _rememberReferencePickerScroll(app);
    draft.view = view;

    if (previousView && previousView !== view) {
        app._dbgEvent?.('picker view changed: ' + previousView + ' -> ' + view);
    }

    _transitionReferencePickerView(app, () => {
        _updateReferencePickerHeader(app);
        if (view === 'book') _renderBookPickerView(app);
        if (view === 'chapter') _renderChapterPickerView(app);
        if (view === 'verse') _renderVersePickerView(app);
    }, { animate, direction });
}

export function openReferencePicker(app, options = {}) {
    const view = options.view || 'book';
    app.referencePickerDraft = {
        entryView: view,
        view,
        book: options.book || app.state.currentBook,
        chapter: options.chapter || app.state.currentChapter,
        viewScroll: { book: 0, chapter: 0, verse: 0 },
    };

    app._dbgUserAction?.('picker opened: ' + view);
    app._dbgEvent?.('picker opened: ' + view);

    _renderReferencePickerView(app, view, { animate: false });
    openModal(app, app.referencePickerModal);
}

export function closeReferencePicker(app) {
    app.referencePickerDraft = null;
    closeModal(app, app.referencePickerModal);
}

export function goBackReferencePicker(app) {
    const draft = app.referencePickerDraft;
    if (!draft) return;

    if (draft.view === 'verse' && draft.entryView !== 'verse') {
        _renderReferencePickerView(app, 'chapter', { animate: true, direction: 'back' });
        return;
    }

    if (draft.view === 'chapter' && draft.entryView === 'book') {
        _renderReferencePickerView(app, 'book', { animate: true, direction: 'back' });
        return;
    }

    closeReferencePicker(app);
}

export function openBookModal(app) {
    openReferencePicker(app, { view: 'book' });
}

export function openChapterModal(app) {
    openReferencePicker(app, {
        view: 'chapter',
        book: app.state.currentBook,
        chapter: app.state.currentChapter,
    });
}

export function openVerseModal(app) {
    openReferencePicker(app, {
        view: 'verse',
        book: app.state.currentBook,
        chapter: app.state.currentChapter,
    });
}

export function populateBookModal(app) {
    if (!app.referencePickerDraft) return;
    _renderReferencePickerView(app, 'book', { animate: false });
}

export function populateChapterModal(app) {
    if (!app.referencePickerDraft) return;
    _renderReferencePickerView(app, 'chapter', { animate: false });
}

export function populateVerseModal(app) {
    if (!app.referencePickerDraft) return;
    _renderReferencePickerView(app, 'verse', { animate: false });
}

function _renderBookPickerView(app) {
    const modalBody = app.referencePickerView;
    const filterBar = app.referencePickerFilters;
    if (!modalBody || !filterBar) return;

    modalBody.className = 'reference-picker-view reference-picker-view--book';
    modalBody.innerHTML = '';
    filterBar.innerHTML = '';
    _setReferencePickerFiltersVisible(app, true);
    modalBody.classList.remove('book-testament-filter-active');

    const sections = new Map();
    const filterButtons = new Map();
    let activeTestament = null;

    const applyFilter = (testament) => {
        activeTestament = activeTestament === testament ? null : testament;

        for (const [sectionTestament, section] of sections) {
            section.hidden = activeTestament !== null && sectionTestament !== activeTestament;
        }

        for (const [buttonTestament, button] of filterButtons) {
            const isActive = buttonTestament === activeTestament;
            button.classList.toggle('book-testament-filter--active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        }

        modalBody.classList.toggle('book-testament-filter-active', activeTestament !== null);
        const scrollElement = _referencePickerScrollElement(app);
        if (scrollElement) scrollElement.scrollTop = 0;
    };

    for (const { testament, label } of BOOK_TESTAMENT_FILTERS) {
        const books = app.bibleBooks[testament];
        if (!books || Object.keys(books).length === 0) continue;

        const button = document.createElement('button');
        button.className = 'book-testament-filter';
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => applyFilter(testament));

        filterButtons.set(testament, button);
        filterBar.appendChild(button);
    }

    const createBookButton = (book) => {
        const button = document.createElement('button');
        button.className = 'book-item';
        button.type = 'button';
        button.textContent = app.bookAbbreviations[book] || book;
        button.classList.toggle('picker-item--active', book === app.state.currentBook);
        button.addEventListener('click', () => {
            app._dbgUserAction?.('picker selected book: ' + book);
            app._dbgEvent?.('picker selected book: ' + book + ' -> chapter picker');
            app.referencePickerDraft.book = book;
            app.referencePickerDraft.chapter = 1;
            app.state.selectedVerse = null;
            _renderReferencePickerView(app, 'chapter', { animate: true, direction: 'forward' });
        });
        return button;
    };

    for (const [testament, books] of Object.entries(app.bibleBooks)) {
        const section = document.createElement('div');
        section.className = 'book-category';
        section.dataset.testament = testament;

        const heading = document.createElement('h3');
        heading.textContent = testament === 'Deuterocanon'
            ? 'Apocrypha / Deuterocanon'
            : testament;

        if (testament === 'Deuterocanon') {
            const infoButton = document.createElement('button');
            infoButton.className = 'deuterocanon-info-btn';
            infoButton.type = 'button';
            infoButton.setAttribute('aria-label', 'About the Deuterocanon');
            infoButton.textContent = '?';
            infoButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openDeuterocanonInfoModal(app);
            });
            heading.appendChild(infoButton);
        }
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'book-grid';

        for (const book of Object.keys(books)) {
            grid.appendChild(createBookButton(book));
        }

        section.appendChild(grid);
        sections.set(testament, section);
        modalBody.appendChild(section);
    }
}

function _renderChapterPickerView(app) {
    const view = app.referencePickerView;
    const draft = app.referencePickerDraft;
    if (!view || !draft) return;

    _setReferencePickerFiltersVisible(app, false);
    view.className = 'reference-picker-view reference-picker-view--chapter';
    view.innerHTML = '';

    const book = draft.book || app.state.currentBook;
    const chapterCount = app.getChapterCount(book);
    const grid = document.createElement('div');
    grid.className = 'chapter-grid';

    for (let i = 1; i <= chapterCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.type = 'button';
        btn.textContent = i;
        btn.classList.toggle(
            'picker-item--active',
            book === app.state.currentBook && i === app.state.currentChapter
        );
        btn.addEventListener('click', async () => {
            app._dbgUserAction?.('picker selected chapter: ' + book + ' ' + i);
            app._dbgEvent?.('picker navigation: loading ' + book + ' ' + i + ' from chapter picker');
            draft.book = book;
            draft.chapter = i;
            app.state.selectedVerse = null;
            await app.loadPassage(book, i, false, 'chapter-picker');
            _renderReferencePickerView(app, 'verse', { animate: true, direction: 'forward' });
        });
        grid.appendChild(btn);
    }

    view.appendChild(grid);
}

function _renderVersePickerView(app) {
    const view = app.referencePickerView;
    const draft = app.referencePickerDraft;
    if (!view || !draft) return;

    _setReferencePickerFiltersVisible(app, false);
    view.className = 'reference-picker-view reference-picker-view--verse';
    view.innerHTML = '';

    const actions = document.createElement('div');
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

    const grid = document.createElement('div');
    grid.className = 'chapter-grid';
    const verseCount = getCurrentVerseCount(app);

    if (verseCount === 0) {
        const empty = document.createElement('p');
        empty.className = 'reference-picker-empty';
        empty.textContent = 'No verses found in current passage';
        view.appendChild(empty);
        return;
    }

    const activeVerse = app.state.selectedVerse || parseInt(app.currentVerseSpan?.textContent || '1', 10) || 1;

    for (let i = 1; i <= verseCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.type = 'button';
        btn.textContent = i;
        btn.classList.toggle('picker-item--active', i === activeVerse);
        btn.addEventListener('click', () => {
            app._dbgUserAction?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);
            app._dbgEvent?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);
            app.referencePickerDraft = null;
            app.scrollToVerse(i);
            closeReferencePicker(app);
        });
        grid.appendChild(btn);
    }

    view.appendChild(grid);
}

// ── Deuterocanon info modal ───────────────────────────────────────────────────

export function openDeuterocanonInfoModal(app) {
    const modal = document.getElementById('deuterocanonInfoModal');
    if (modal) {
        openModal(app, modal);
    } else {
        console.error('[DeutModal] element #deuterocanonInfoModal not found in DOM');
    }
}

export function getCurrentVerseCount(app) {
    return app.passageText.querySelectorAll('.verse-num').length;
}

'''

modals = read('modals.js')
modals = replace_between_if_missing(
    modals,
    'openReferencePicker(app',
    '// ── Book modal',
    '// ── Translation modal',
    MODALS_REFERENCE_PICKER,
    'reference picker modal module',
)
write('modals.js', modals)


app = read('app.js')
app = replace_if_missing(
    app,
    'closeReferencePicker, goBackReferencePicker',
    '''    openModal, closeModal,
    openBookModal, populateBookModal,
    openChapterModal, populateChapterModal,
    openVerseModal, populateVerseModal,
    openTranslationModal, populateTranslationModal,''',
    '''    openModal, closeModal,
    openBookModal, populateBookModal,
    openChapterModal, populateChapterModal,
    openVerseModal, populateVerseModal,
    closeReferencePicker, goBackReferencePicker,
    openTranslationModal, populateTranslationModal,''',
    'app modal imports',
)
app = replace_if_missing(
    app,
    'this.referencePickerModal?.classList.contains',
    '''        if (this.bookModal?.classList.contains('active')) {
            populateBookModal(this);
        }''',
    '''        if (
            this.referencePickerModal?.classList.contains('active') &&
            this.referencePickerDraft?.view === 'book'
        ) {
            populateBookModal(this);
        }''',
    'rebuild reference picker refresh',
)
app = replace_if_missing(
    app,
    'closeReferencePicker() { closeReferencePicker(this); }',
    '''    closeModal(modal) { closeModal(this, modal); }
    openBookModal() { openBookModal(this); }''',
    '''    closeModal(modal) { closeModal(this, modal); }
    closeReferencePicker() { closeReferencePicker(this); }
    goBackReferencePicker() { goBackReferencePicker(this); }
    openBookModal() { openBookModal(this); }''',
    'reference picker wrappers',
)
write('app.js', app)


events = read('events.js')
events = replace_if_missing(
    events,
    'app.loadPassage = async (book, chapter, restoreScroll = false, source = \'unspecified\')',
    '''    app.loadPassage = async (book, chapter, restoreScroll = false) => {
        const books = app.getAllBooks();
        const activeBook = app.state.currentBook;

        if (activeBook && !books.includes(activeBook)) {
            app._dbgEvent?.(`loadPassage: "${activeBook}" not in canon — redirecting to Genesis 1`);
            return loadPassage('Genesis', 1, restoreScroll);
        }

        return loadPassage(book, chapter, restoreScroll);
    };''',
    '''    app.loadPassage = async (book, chapter, restoreScroll = false, source = 'unspecified') => {
        const books = app.getAllBooks();
        const activeBook = app.state.currentBook;

        if (activeBook && !books.includes(activeBook)) {
            app._dbgEvent?.(`loadPassage: "${activeBook}" not in canon, redirecting to Genesis 1`);
            return loadPassage('Genesis', 1, restoreScroll, source);
        }

        return loadPassage(book, chapter, restoreScroll, source);
    };''',
    'canon fallback loadPassage source',
)
events = replace_if_missing(
    events,
    'app.referencePickerModal,',
    '''    [
        app.bookModal, app.chapterModal, app.verseModal,
        app.settingsModal, app.loginModal,
        app.signupModal, app.userMenuModal, app.referencesModal,
        app.translationModal, app.translationSyncModal,
        app.deuterocanonInfoModal,
    ].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (e) => { if (e.target === modal) app.closeModal(modal); });
    });''',
    '''    [
        app.referencePickerModal,
        app.settingsModal, app.loginModal,
        app.signupModal, app.userMenuModal, app.referencesModal,
        app.translationModal, app.translationSyncModal,
        app.deuterocanonInfoModal,
    ].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target !== modal) return;
            if (modal === app.referencePickerModal) app.closeReferencePicker();
            else app.closeModal(modal);
        });
    });''',
    'modal outside close list',
)
events = replace_if_missing(
    events,
    'app.closeReferencePickerModal?.addEventListener',
    '''    app.settingsBtn?.addEventListener('click', openSettings);
    app.closeVerseModal?.addEventListener('click', () => app.closeModal(app.verseModal));
    app.verseGoButton?.addEventListener('click', () => {
        app.referencePickerDraft = null;
        app.closeModal(app.verseModal);
    });
    app.closeBookModal?.addEventListener('click', () => app.closeModal(app.bookModal));
    app.closeDeuterocanonInfoModal?.addEventListener('click', () => app.closeModal(app.deuterocanonInfoModal));
    app.closeChapterModal?.addEventListener('click', () => app.closeModal(app.chapterModal));''',
    '''    app.settingsBtn?.addEventListener('click', openSettings);
    app.closeReferencePickerModal?.addEventListener('click', () => app.closeReferencePicker());
    app.referencePickerBack?.addEventListener('click', () => app.goBackReferencePicker());
    app.closeDeuterocanonInfoModal?.addEventListener('click', () => app.closeModal(app.deuterocanonInfoModal));''',
    'reference picker close events',
)
events = replace_regex_if_missing(
    events,
    'function normalizeModalMarkup() {\n    document.querySelectorAll',
    r"function normalizeModalMarkup\(\) \{\n    const bookContent = document\.querySelector\('#bookModal \.modal-content'\);\n    const bookBody = document\.querySelector\('#bookModal \.modal-body'\);\n    const filterBar = document\.querySelector\('#bookModal \.book-testament-filters'\);\n\n    if \(bookContent && bookBody && filterBar && filterBar\.parentElement !== bookContent\) \{\n        bookContent\.insertBefore\(filterBar, bookBody\);\n    \}\n\n    document\.querySelectorAll",
    "function normalizeModalMarkup() {\n    document.querySelectorAll",
    'remove obsolete book modal markup normalization',
)
write('events.js', events)


css = read('css/modals.css')
REFERENCE_PICKER_CSS = '''

/* Reference picker */
.reference-picker-modal .modal-content {
    transition: height 180ms ease;
}

.reference-picker-header {
    gap: var(--spacing-sm);
}

.reference-picker-header h2 {
    flex: 1;
}

.reference-picker-back {
    border: 1px solid var(--border-neutral);
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-secondary);
    padding: 0.35rem 0.55rem;
    font: inherit;
}

.reference-picker-back[hidden] {
    display: none;
}

.reference-picker-body {
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

.reference-picker-empty {
    color: var(--text-secondary);
    padding: 20px;
    text-align: center;
}

.picker-item--active {
    border-color: var(--primary-color);
    color: var(--primary-color);
}

@media (prefers-reduced-motion: reduce) {
    .reference-picker-modal .modal-content,
    .reference-picker-view {
        transition: none;
    }
}
'''
if 'Reference picker */' not in css:
    css = css.rstrip() + REFERENCE_PICKER_CSS + '\n'
write('css/modals.css', css)

print('picker workflow script complete')
