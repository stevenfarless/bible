from pathlib import Path

path = Path('modals.js')
text = path.read_text(encoding='utf-8')
old = "export function openBookModal(app) {\n    const content = app.bookModal?.querySelector('.modal-content');"
new = "export function openBookModal(app) {\n    app._dbgUserAction?.('picker opened: book');\n    app._dbgEvent?.('picker opened: book');\n\n    const content = app.bookModal?.querySelector('.modal-content');"
if 'picker opened: book' not in text:
    if old not in text:
        raise SystemExit('book picker anchor not found')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
