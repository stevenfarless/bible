from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


index_path = Path("index.html")
modals_path = Path("modals.js")
components_path = Path("css/components.css")
modal_css_path = Path("css/modals.css")

index = index_path.read_text(encoding="utf-8")
modals = modals_path.read_text(encoding="utf-8")
components = components_path.read_text(encoding="utf-8")
modal_css = modal_css_path.read_text(encoding="utf-8")

svg = '''<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7L17 17M17 7L7 17"></path>
</svg>'''


def convert_button(match: re.Match[str]) -> str:
    attrs = match.group("attrs")
    class_match = re.search(r'class="([^"]*)"', attrs)
    if class_match:
        classes = class_match.group(1).split()
        if "close-control" not in classes:
            classes.append("close-control")
        attrs = (
            attrs[: class_match.start()]
            + f'class="{" ".join(classes)}"'
            + attrs[class_match.end() :]
        )
    else:
        attrs += ' class="close-control"'
    if not re.search(r'\btype=', attrs):
        attrs += ' type="button"'
    return f"<button{attrs}>\n{svg}\n</button>"


button_pattern = re.compile(
    r'<button(?P<attrs>[^>]*)>\s*(?:&#xD7;|&times;|×)\s*</button>',
    re.IGNORECASE,
)

original_index = index
index = button_pattern.sub(convert_button, index)

if index == original_index and 'class="close-control"' not in index:
    raise SystemExit("No typographic close controls were found in index.html.")

if ".close-control {" not in components:
    components += '''

.close-control {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    flex: 0 0 44px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 12px;
    color: var(--text-muted);
    background: transparent;
    appearance: none;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
}

.close-control svg {
    width: 25px;
    height: 25px;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
}

@media (hover: hover) {
    .close-control:hover {
        color: var(--text-body);
        background: color-mix(in srgb, currentColor 8%, transparent);
    }
}

.close-control:active {
    color: var(--text-body);
    background: color-mix(in srgb, currentColor 13%, transparent);
    transform: scale(0.96);
}

.close-control:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
    .close-control:active {
        transform: none;
    }
}
'''

if ".modal-header .close-control" not in modal_css:
    modal_css += '''

.modal-header .close-control {
    margin-left: auto;
}
'''

remaining = button_pattern.findall(index)
if remaining:
    raise SystemExit("One or more typographic close controls remain after replacement.")

index_path.write_text(index, encoding="utf-8")
modals_path.write_text(modals, encoding="utf-8")
components_path.write_text(components, encoding="utf-8")
modal_css_path.write_text(modal_css, encoding="utf-8")

print("Standardized close controls.")
