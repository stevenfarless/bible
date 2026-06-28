from pathlib import Path

path = Path('modals.js')
text = path.read_text(encoding='utf-8')


def apply(marker, old, new, label):
    global text
    if marker in text:
        return
    if old not in text:
        raise SystemExit(label + ' anchor not found')
    text = text.replace(old, new, 1)


apply(
    'picker opened: book',
    "export function openBookModal(app) {\n    const content = app.bookModal?.querySelector('.modal-content');",
    "export function openBookModal(app) {\n    app._dbgUserAction?.('picker opened: book');\n    app._dbgEvent?.('picker opened: book');\n\n    const content = app.bookModal?.querySelector('.modal-content');",
    'book picker open',
)

apply(
    'picker selected book:',
    "        button.addEventListener('click', () => {\n            app.referencePickerDraft = { book, chapter: 1 };",
    "        button.addEventListener('click', () => {\n            app._dbgUserAction?.('picker selected book: ' + book);\n            app._dbgEvent?.('picker selected book: ' + book + ' -> chapter picker');\n            app.referencePickerDraft = { book, chapter: 1 };",
    'book picker selection',
)

apply(
    'picker opened: chapter for',
    "export function openChapterModal(app) {\n    populateChapterModal(app);",
    "export function openChapterModal(app) {\n    const book = app.referencePickerDraft?.book || app.state.currentBook;\n    app._dbgUserAction?.('picker opened: chapter for ' + book);\n    app._dbgEvent?.('picker opened: chapter for ' + book);\n\n    populateChapterModal(app);",
    'chapter picker open',
)

apply(
    'picker selected chapter:',
    "        btn.addEventListener('click', async () => {\n            const book = app.referencePickerDraft?.book || app.state.currentBook;\n\n            app.referencePickerDraft = { book, chapter: i };",
    "        btn.addEventListener('click', async () => {\n            const book = app.referencePickerDraft?.book || app.state.currentBook;\n            app._dbgUserAction?.('picker selected chapter: ' + book + ' ' + i);\n            app._dbgEvent?.('picker navigation: loading ' + book + ' ' + i + ' from chapter picker');\n\n            app.referencePickerDraft = { book, chapter: i };",
    'chapter picker selection',
)

apply(
    'picker opened: verse for',
    "export function openVerseModal(app) {\n    populateVerseModal(app);",
    "export function openVerseModal(app) {\n    app._dbgUserAction?.('picker opened: verse for ' + app.state.currentBook + ' ' + app.state.currentChapter);\n    app._dbgEvent?.('picker opened: verse for ' + app.state.currentBook + ' ' + app.state.currentChapter);\n\n    populateVerseModal(app);",
    'verse picker open',
)

apply(
    'picker selected verse:',
    "        btn.addEventListener('click', () => {\n            app.referencePickerDraft = null;",
    "        btn.addEventListener('click', () => {\n            app._dbgUserAction?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);\n            app._dbgEvent?.('picker selected verse: ' + app.state.currentBook + ' ' + app.state.currentChapter + ':' + i);\n            app.referencePickerDraft = null;",
    'verse picker selection',
)

path.write_text(text, encoding='utf-8')
