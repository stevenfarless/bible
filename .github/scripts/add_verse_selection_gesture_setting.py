from pathlib import Path


def replace_once(path, old, new, label):
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'index.html',
    """\t\t\t\t\t\t\t<div class=\"setting-item\">\n\t\t\t\t\t\t\t\t<label class=\"checkbox-label\">\n\t\t\t\t\t\t\t\t\t<input type=\"checkbox\" id=\"chapterArrowsToggle\" />\n\t\t\t\t\t\t\t\t\t<span>Show chapter arrows</span>\n\t\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t</div>\n""",
    """\t\t\t\t\t\t\t<div class=\"setting-item\">\n\t\t\t\t\t\t\t\t<label for=\"verseSelectionGestureSelect\">Verse selection gesture</label>\n\t\t\t\t\t\t\t\t<select id=\"verseSelectionGestureSelect\" class=\"input-field\">\n\t\t\t\t\t\t\t\t\t<option value=\"hold\">Tap and hold</option>\n\t\t\t\t\t\t\t\t\t<option value=\"tap\">Single tap</option>\n\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t\t<small class=\"help-text\">Choose how verses are selected.</small>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t<div class=\"setting-item\">\n\t\t\t\t\t\t\t\t<label class=\"checkbox-label\">\n\t\t\t\t\t\t\t\t\t<input type=\"checkbox\" id=\"chapterArrowsToggle\" />\n\t\t\t\t\t\t\t\t\t<span>Show chapter arrows</span>\n\t\t\t\t\t\t\t\t</label>\n\t\t\t\t\t\t\t</div>\n""",
    'settings gesture control',
)

replace_once(
    'ui.js',
    """\t'crossReferencesToggle', 'verseByVerseToggle', 'chapterArrowsToggle',\n""",
    """\t'crossReferencesToggle', 'verseByVerseToggle', 'chapterArrowsToggle',\n\t'verseSelectionGestureSelect',\n""",
    'required gesture control id',
)

replace_once(
    'ui.js',
    """\tapp.chapterArrowsToggle = document.getElementById('chapterArrowsToggle');\n""",
    """\tapp.chapterArrowsToggle = document.getElementById('chapterArrowsToggle');\n\tapp.verseSelectionGestureSelect = document.getElementById('verseSelectionGestureSelect');\n""",
    'cache gesture control',
)

replace_once(
    'settings.js',
    """    readingFont:         'gentium',\n""",
    """    readingFont:         'gentium',\n    verseSelectionGesture: 'hold',\n""",
    'gesture default',
)

replace_once(
    'settings.js',
    """    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }\n    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }\n""",
    """    try { app.state.readingFont = localStorage.getItem('readingFont') || DEFAULTS.readingFont; }\n    catch (_) { app.state.readingFont = DEFAULTS.readingFont; }\n\n    try {\n        const storedGesture = localStorage.getItem('verseSelectionGesture');\n        app.state.verseSelectionGesture = storedGesture === 'tap' ? 'tap' : DEFAULTS.verseSelectionGesture;\n    } catch (_) {\n        app.state.verseSelectionGesture = DEFAULTS.verseSelectionGesture;\n    }\n""",
    'load gesture setting',
)

replace_once(
    'settings.js',
    """    const readingFont = app.state.readingFont || DEFAULTS.readingFont;\n    applyReadingFont(app, readingFont);\n""",
    """    const readingFont = app.state.readingFont || DEFAULTS.readingFont;\n    applyReadingFont(app, readingFont);\n\n    if (app.verseSelectionGestureSelect) {\n        app.verseSelectionGestureSelect.value = app.state.verseSelectionGesture || DEFAULTS.verseSelectionGesture;\n    }\n""",
    'apply gesture setting',
)

replace_once(
    'events.js',
    """    const versePressTarget = document.getElementById('swipeViewport') ?? app.passageText;\n\n    if (versePressTarget) {\n        const HOLD_MS = 500;\n        const MOVE_LIMIT = 12;\n\n        let holdTimer = null;\n        let pointerId = null;\n        let startX = 0;\n        let startY = 0;\n        let pressedVerse = null;\n        let activated = false;\n\n        const cancelVersePress = () => {\n            clearTimeout(holdTimer);\n            holdTimer = null;\n            pointerId = null;\n            pressedVerse = null;\n        };\n\n        versePressTarget.addEventListener('pointerdown', (event) => {\n            if (event.pointerType === 'mouse' && event.button !== 0) return;\n\n            const verse = event.target.closest('.verse');\n            if (!verse) return;\n            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;\n\n            cancelVersePress();\n\n            pointerId = event.pointerId;\n            startX = event.clientX;\n            startY = event.clientY;\n            pressedVerse = verse;\n            activated = false;\n\n            holdTimer = setTimeout(() => {\n                const num = parseInt(pressedVerse?.dataset.verse, 10);\n                if (!num) return;\n\n                activated = true;\n                navigator.vibrate?.(20);\n\n                if (app.state.selectedVerse === num) {\n                    app.state.selectedVerse = null;\n                    app.applyVerseGlow();\n                } else {\n                    app.scrollToVerse(num);\n                }\n            }, HOLD_MS);\n        });\n\n        versePressTarget.addEventListener('pointermove', (event) => {\n            if (event.pointerId !== pointerId) return;\n\n            const movedX = Math.abs(event.clientX - startX);\n            const movedY = Math.abs(event.clientY - startY);\n\n            if (movedX > MOVE_LIMIT || movedY > MOVE_LIMIT) {\n                cancelVersePress();\n            }\n        });\n\n        const finishVersePress = (event) => {\n            if (event.pointerId !== pointerId) return;\n\n            if (activated) {\n                event.preventDefault();\n                event.stopPropagation();\n            }\n\n            cancelVersePress();\n        };\n\n        versePressTarget.addEventListener('pointerup', finishVersePress);\n        versePressTarget.addEventListener('pointercancel', finishVersePress);\n\n        versePressTarget.addEventListener('contextmenu', (event) => {\n            if (event.target.closest('.verse')) event.preventDefault();\n        });\n    }\n""",
    """    const verseSelectionTarget = document.getElementById('swipeViewport') ?? app.passageText;\n\n    if (verseSelectionTarget) {\n        const HOLD_MS = 500;\n        const MOVE_LIMIT = 12;\n\n        let holdTimer = null;\n        let pointerId = null;\n        let startX = 0;\n        let startY = 0;\n        let pressedVerse = null;\n        let holdActivated = false;\n\n        const selectVerse = (verse) => {\n            const num = parseInt(verse?.dataset.verse, 10);\n            if (!num) return;\n\n            if (app.state.selectedVerse === num) {\n                app.state.selectedVerse = null;\n                app.applyVerseGlow();\n            } else {\n                app.scrollToVerse(num);\n            }\n        };\n\n        const cancelVersePress = () => {\n            clearTimeout(holdTimer);\n            holdTimer = null;\n            pointerId = null;\n            pressedVerse = null;\n        };\n\n        verseSelectionTarget.addEventListener('pointerdown', (event) => {\n            if (app.state.verseSelectionGesture !== 'hold') return;\n            if (event.pointerType === 'mouse' && event.button !== 0) return;\n\n            const verse = event.target.closest('.verse');\n            if (!verse) return;\n            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;\n\n            cancelVersePress();\n\n            pointerId = event.pointerId;\n            startX = event.clientX;\n            startY = event.clientY;\n            pressedVerse = verse;\n            holdActivated = false;\n\n            holdTimer = setTimeout(() => {\n                if (!pressedVerse) return;\n                holdActivated = true;\n                navigator.vibrate?.(20);\n                selectVerse(pressedVerse);\n            }, HOLD_MS);\n        });\n\n        verseSelectionTarget.addEventListener('pointermove', (event) => {\n            if (event.pointerId !== pointerId) return;\n\n            const movedX = Math.abs(event.clientX - startX);\n            const movedY = Math.abs(event.clientY - startY);\n\n            if (movedX > MOVE_LIMIT || movedY > MOVE_LIMIT) cancelVersePress();\n        });\n\n        const finishVersePress = (event) => {\n            if (event.pointerId !== pointerId) return;\n\n            if (holdActivated) {\n                event.preventDefault();\n                event.stopPropagation();\n            }\n\n            cancelVersePress();\n        };\n\n        verseSelectionTarget.addEventListener('pointerup', finishVersePress);\n        verseSelectionTarget.addEventListener('pointercancel', finishVersePress);\n\n        verseSelectionTarget.addEventListener('click', (event) => {\n            const verse = event.target.closest('.verse');\n            if (!verse) return;\n            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;\n\n            event.preventDefault();\n            event.stopPropagation();\n\n            if (app.state.verseSelectionGesture === 'tap') selectVerse(verse);\n        }, true);\n\n        verseSelectionTarget.addEventListener('contextmenu', (event) => {\n            if (event.target.closest('.verse')) event.preventDefault();\n        });\n    }\n""",
    'gesture-aware verse selection',
)

replace_once(
    'events.js',
    """    const readingFontSelector = document.getElementById('readingFontSelector');\n""",
    """    app.verseSelectionGestureSelect?.addEventListener('change', async (event) => {\n        const gesture = event.currentTarget.value === 'tap' ? 'tap' : 'hold';\n        app.state.verseSelectionGesture = gesture;\n        localStorage.setItem('verseSelectionGesture', gesture);\n\n        if (app.currentUser) {\n            await app.database\n                .ref(`users/${app.currentUser.uid}/settings/verseSelectionGesture`)\n                .set(gesture);\n        }\n    });\n\n    const readingFontSelector = document.getElementById('readingFontSelector');\n""",
    'gesture setting listener',
)

replace_once(
    'app.js',
    """        'fontSize', 'readingFont',\n        'showVerseNumbers', 'coloredVerseNumbers', 'showHeadings',\n""",
    """        'fontSize', 'readingFont', 'verseSelectionGesture',\n        'showVerseNumbers', 'coloredVerseNumbers', 'showHeadings',\n""",
    'debug localStorage gesture key',
)

replace_once(
    'app.js',
    """        readingFont:         app?.state?.readingFont,\n        showVerseNumbers:    app?.state?.showVerseNumbers,\n""",
    """        readingFont:         app?.state?.readingFont,\n        verseSelectionGesture: app?.state?.verseSelectionGesture,\n        showVerseNumbers:    app?.state?.showVerseNumbers,\n""",
    'debug diff gesture state',
)

replace_once(
    'app.js',
    """        `  readingFont: ${app?.state?.readingFont}`,\n        `  showVerseNumbers: ${app?.state?.showVerseNumbers}`,\n""",
    """        `  readingFont: ${app?.state?.readingFont}`,\n        `  verseSelectionGesture: ${app?.state?.verseSelectionGesture}`,\n        `  showVerseNumbers: ${app?.state?.showVerseNumbers}`,\n""",
    'debug app state gesture line',
)

replace_once(
    'app.js',
    """                readingFont:         this.state.readingFont,\n                showVerseNumbers:    this.state.showVerseNumbers,\n""",
    """                readingFont:         this.state.readingFont,\n                verseSelectionGesture: this.state.verseSelectionGesture,\n                showVerseNumbers:    this.state.showVerseNumbers,\n""",
    'startup snapshot gesture state',
)
