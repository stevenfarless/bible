from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


index_path = Path("index.html")
modals_path = Path("modals.js")
events_path = Path("events.js")
components_path = Path("css/components.css")
modal_css_path = Path("css/modals.css")

index = index_path.read_text(encoding="utf-8")
modals = modals_path.read_text(encoding="utf-8")
events = events_path.read_text(encoding="utf-8")
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

index = button_pattern.sub(convert_button, index)

old_close_bindings = """    app.closeSettingsModal?.addEventListener('click', () => app.closeModal(app.settingsModal));
    app.closeReferencesModal?.addEventListener('click', () => app.closeModal(app.referencesModal));
    app.closeTranslationModal?.addEventListener('click', () => app.closeModal(app.translationModal));
"""
new_close_bindings = """    app.closeSettingsModal?.addEventListener('click', () => app.closeModal(app.settingsModal));
    app.closeLoginModal?.addEventListener('click', () => app.closeModal(app.loginModal));
    app.closeSignupModal?.addEventListener('click', () => app.closeModal(app.signupModal));
    app.closeUserMenuModal?.addEventListener('click', () => app.closeModal(app.userMenuModal));
    app.closeReferencesModal?.addEventListener('click', () => app.closeModal(app.referencesModal));
    app.closeTranslationModal?.addEventListener('click', () => app.closeModal(app.translationModal));
"""
if "app.closeUserMenuModal?.addEventListener('click'" not in events:
    events = replace_once(
        events,
        old_close_bindings,
        new_close_bindings,
        "auth modal close button bindings",
    )

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

required_close_ids = [
    "closeLoginModal",
    "closeSignupModal",
    "closeUserMenuModal",
]
missing_close_controls = [
    close_id for close_id in required_close_ids
    if close_id in index and "close-control" not in index[index.find(close_id):index.find(close_id) + 180]
]
if missing_close_controls:
    raise SystemExit(f"Missing close-control class near: {', '.join(missing_close_controls)}")

required_event_bindings = [
    "app.closeLoginModal?.addEventListener('click', () => app.closeModal(app.loginModal));",
    "app.closeSignupModal?.addEventListener('click', () => app.closeModal(app.signupModal));",
    "app.closeUserMenuModal?.addEventListener('click', () => app.closeModal(app.userMenuModal));",
]
missing_bindings = [binding for binding in required_event_bindings if binding not in events]
if missing_bindings:
    raise SystemExit(f"Missing auth close bindings: {missing_bindings}")

index_path.write_text(index, encoding="utf-8")
modals_path.write_text(modals, encoding="utf-8")
events_path.write_text(events, encoding="utf-8")
components_path.write_text(components, encoding="utf-8")
modal_css_path.write_text(modal_css, encoding="utf-8")

print("Standardized close controls.")
