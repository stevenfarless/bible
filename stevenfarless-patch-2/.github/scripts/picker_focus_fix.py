from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text.rstrip() + '\n', encoding='utf-8')


def replace_between(text, start, end, new, label):
    start_index = text.find(start)
    if start_index == -1:
        raise SystemExit(label + ' start anchor not found')
    end_index = text.find(end, start_index)
    if end_index == -1:
        raise SystemExit(label + ' end anchor not found')
    return text[:start_index] + new + text[end_index:]


FOCUS_FUNCTION = '''function _focusReferencePicker(app) {
    requestAnimationFrame(() => {
        if (!app.referencePickerModal?.classList.contains('active')) return;
        app.referencePickerModal.focus({ preventScroll: true });
    });
}'''

modals = read('modals.js')
if 'app.referencePickerModal.focus({ preventScroll: true });' not in modals:
    modals = replace_between(
        modals,
        'function _focusReferencePicker(app) {',
        '\n\nfunction _transitionReferencePickerView(app, renderNextView',
        FOCUS_FUNCTION,
        'reference picker shell focus',
    )
write('modals.js', modals)

css = read('css/modals.css')
css = re.sub(
    r'\.reference-picker-go \{\n    width: 100%;\n\}',
    '''.reference-picker-go {
    width: auto;
    margin-inline: auto;
    padding: 0.35rem 0.75rem;
    border-color: transparent;
}''',
    css,
    count=1,
)
css = re.sub(
    r'\.picker-item--active \{\n    border-color: var\(--primary-color\);\n    box-shadow: inset 0 0 0 1px var\(--primary-color\);\n    color: var\(--primary-color\);\n\}',
    '''.picker-item--active {
    background-color: var(--bg-raised);
    border-color: var(--primary-color);
    box-shadow: inset 0 0 0 1px var(--primary-color);
    color: var(--primary-color);
}''',
    css,
    count=1,
)
focus_suppression = '''
.reference-picker-view .book-item:focus:not(:focus-visible),
.reference-picker-view .chapter-item:focus:not(:focus-visible) {
    outline: none;
}
'''
if '.reference-picker-view .book-item:focus:not(:focus-visible)' not in css:
    css = css.replace(
        '\n.reference-picker-empty {',
        focus_suppression + '\n.reference-picker-empty {',
        1,
    )
if 'app.referencePickerModal.focus({ preventScroll: true });' not in modals:
    raise SystemExit('focus replacement failed')
if 'background-color: var(--bg-raised);' not in css:
    raise SystemExit('active picker style replacement failed')
if '.reference-picker-view .book-item:focus:not(:focus-visible)' not in css:
    raise SystemExit('focus suppression insertion failed')
write('css/modals.css', css)

print('picker focus fix script complete')
