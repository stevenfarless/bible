from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


events = Path("events.js")
text = events.read_text()

old_light = """    document.getElementById('lightModeSelect')?.addEventListener('change', async (e) => {
        const mode = e.target.value;
        app.state.lightMode = mode;
        localStorage.setItem('lightMode', mode);
        setLightMode(app, mode);
        applyLightMode(app);

        if (app.currentUser) {
            await app.database
                .ref(`users/${app.currentUser.uid}/settings/lightMode`)
                .set(mode);
        }
    });
"""
new_light = """    document.getElementById('lightModeSelect')?.addEventListener('change', (event) => {
        app._dbgUserAction?.(`changeAppearance: ${event.currentTarget.value}`);
        setLightMode(app, event.currentTarget.value);
    });
"""
text = replace_once(text, old_light, new_light, "appearance handler")

old_click = """        verseSelectionTarget.addEventListener('click', (event) => {
            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;

            const verse = event.target.closest('.verse');
            if (!verse) return;

            event.preventDefault();

            if (app.state.verseSelectionGesture === 'tap') {
                selectVerse(verse);
            }
        });
"""
new_click = """        verseSelectionTarget.addEventListener('click', (event) => {
            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;

            const verse = event.target.closest('.verse');
            if (!verse) return;

            event.preventDefault();

            if (app.state.verseSelectionGesture === 'tap') {
                selectVerse(verse);
                return;
            }

            if (app.state.selectedVerse != null) {
                clearSelectedVerse();
            }
        });
"""
text = replace_once(text, old_click, new_click, "verse click handler")

old_outside = """        document.addEventListener('pointerdown', (event) => {
            if (app.state.selectedVerse == null) return;
            if (event.target.closest('.verse, .selected-verse-glow, .verse-tools-tray, .verse-tools-trigger')) return;
            clearSelectedVerse();
        });
"""
new_outside = """        document.addEventListener('pointerdown', (event) => {
            if (app.state.selectedVerse == null) return;
            if (event.target.closest('.selected-verse-glow, .verse-tools-tray, .verse-tools-trigger')) return;
            clearSelectedVerse();
        });
"""
text = replace_once(text, old_outside, new_outside, "outside deselect handler")
events.write_text(text)

css = Path("css/interactions.css")
styles = css.read_text()
old_verse = """.verse {
    touch-action: manipulation;
    cursor: pointer;
}
"""
new_verse = """.verse {
    touch-action: manipulation;
    cursor: pointer;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}
"""
styles = replace_once(styles, old_verse, new_verse, "verse interaction rule")
css.write_text(styles)
