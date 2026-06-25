from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old = """        this.chromeScrollAnchorY  = window.scrollY || 0;
        this.chromeLastY          = window.scrollY || 0;
"""

new = """        this.chromeScrollAnchorY  = 0;
        this.chromeLastY          = 0;
"""

if new in text:
    print('Phase 10 startup scroll measurement deferral is already present.')
elif old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
else:
    raise SystemExit('Expected startup scroll measurement lines were not found in app.js.')
