from pathlib import Path


def replace_once(path, old, new, label):
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'events.js',
    """        verseSelectionTarget.addEventListener('click', (event) => {\n            const verse = event.target.closest('.verse');\n            if (!verse && app.state.selectedVerse != null) {\n                app.state.selectedVerse = null;\n                app.applyVerseGlow();\n            return;\n}\n\nif (!verse) return;\n            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;\n\n            event.preventDefault();\n            event.stopPropagation();\n\n            if (app.state.verseSelectionGesture === 'tap') selectVerse(verse);\n        }, true);\n""",
    """        verseSelectionTarget.addEventListener('click', (event) => {\n            const verse = event.target.closest('.verse');\n\n            if (!verse) {\n                if (app.state.selectedVerse != null) {\n                    app.state.selectedVerse = null;\n                    app.applyVerseGlow();\n                }\n                return;\n            }\n\n            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;\n\n            event.preventDefault();\n            event.stopPropagation();\n\n            if (app.state.verseSelectionGesture === 'tap') {\n                selectVerse(verse);\n            }\n        }, true);\n""",
    'repair verse click handler',
)

settings_path = Path('settings.js')
settings_text = settings_path.read_text()

if "verseSelectionGesture: 'hold'," not in settings_text:
    old = "    readingFont:         'gentium',\n"
    new = "    readingFont:         'gentium',\n    verseSelectionGesture: 'hold',\n"
    count = settings_text.count(old)
    if count != 1:
        raise SystemExit(f'gesture default insertion: expected 1 match, found {count}')
    settings_text = settings_text.replace(old, new, 1)

load_block = """    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }\n    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }\n"""
load_replacement = """    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }\n    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }\n\n    try {\n        const storedGesture = localStorage.getItem('verseSelectionGesture');\n        app.state.verseSelectionGesture = storedGesture === 'tap'\n            ? 'tap'\n            : DEFAULTS.verseSelectionGesture;\n    } catch (_) {\n        app.state.verseSelectionGesture = DEFAULTS.verseSelectionGesture;\n    }\n"""

if "const storedGesture = localStorage.getItem('verseSelectionGesture');" not in settings_text:
    count = settings_text.count(load_block)
    if count != 1:
        raise SystemExit(f'gesture load insertion: expected 1 match, found {count}')
    settings_text = settings_text.replace(load_block, load_replacement, 1)

settings_path.write_text(settings_text)
