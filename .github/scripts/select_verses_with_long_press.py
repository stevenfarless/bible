from pathlib import Path

path = Path('events.js')
lines = path.read_text().splitlines()

start = next((i for i, line in enumerate(lines) if "const verseClickTarget = document.getElementById('swipeViewport') ?? app.passageText;" in line), None)
if start is None:
    raise SystemExit('events.js: verseClickTarget declaration not found')

end = None
for i in range(start, len(lines)):
    if lines[i].strip() == '});' and i > start:
        end = i
        break
if end is None:
    raise SystemExit('events.js: verseClickTarget listener end not found')

replacement = [
"    const versePressTarget = document.getElementById('swipeViewport') ?? app.passageText;",
"",
"    if (versePressTarget) {",
"        const HOLD_MS = 500;",
"        const MOVE_LIMIT = 12;",
"",
"        let holdTimer = null;",
"        let pointerId = null;",
"        let startX = 0;",
"        let startY = 0;",
"        let pressedVerse = null;",
"        let activated = false;",
"",
"        const cancelVersePress = () => {",
"            clearTimeout(holdTimer);",
"            holdTimer = null;",
"            pointerId = null;",
"            pressedVerse = null;",
"        };",
"",
"        versePressTarget.addEventListener('pointerdown', (event) => {",
"            if (event.pointerType === 'mouse' && event.button !== 0) return;",
"",
"            const verse = event.target.closest('.verse');",
"            if (!verse) return;",
"            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;",
"",
"            cancelVersePress();",
"",
"            pointerId = event.pointerId;",
"            startX = event.clientX;",
"            startY = event.clientY;",
"            pressedVerse = verse;",
"            activated = false;",
"",
"            holdTimer = setTimeout(() => {",
"                const num = parseInt(pressedVerse?.dataset.verse, 10);",
"                if (!num) return;",
"",
"                activated = true;",
"                navigator.vibrate?.(20);",
"",
"                if (app.state.selectedVerse === num) {",
"                    app.state.selectedVerse = null;",
"                    app.applyVerseGlow();",
"                } else {",
"                    app.scrollToVerse(num);",
"                }",
"            }, HOLD_MS);",
"        });",
"",
"        versePressTarget.addEventListener('pointermove', (event) => {",
"            if (event.pointerId !== pointerId) return;",
"",
"            const movedX = Math.abs(event.clientX - startX);",
"            const movedY = Math.abs(event.clientY - startY);",
"",
"            if (movedX > MOVE_LIMIT || movedY > MOVE_LIMIT) {",
"                cancelVersePress();",
"            }",
"        });",
"",
"        const finishVersePress = (event) => {",
"            if (event.pointerId !== pointerId) return;",
"",
"            if (activated) {",
"                event.preventDefault();",
"                event.stopPropagation();",
"            }",
"",
"            cancelVersePress();",
"        };",
"",
"        versePressTarget.addEventListener('pointerup', finishVersePress);",
"        versePressTarget.addEventListener('pointercancel', finishVersePress);",
"",
"        versePressTarget.addEventListener('contextmenu', (event) => {",
"            if (event.target.closest('.verse')) event.preventDefault();",
"        });",
"    }",
]

path.write_text('\n'.join(lines[:start] + replacement + lines[end + 1:]) + '\n')
