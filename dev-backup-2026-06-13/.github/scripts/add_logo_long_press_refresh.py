from pathlib import Path

path = Path('app.js')
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    """// Read readingPosition from localStorage without mutating app state.
// Returns { book, chapter } or null.
function _readSavedPosition() {
""",
    """async function hardRefreshApp() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.replace(url.toString());
}

function initLogoLongPressRefresh() {
    const logo = document.querySelector('.logo');
    if (!logo) return;

    const HOLD_MS = 1000;
    const MOVE_LIMIT = 12;

    let holdTimer = null;
    let startX = 0;
    let startY = 0;
    let activated = false;

    const cancel = () => {
        clearTimeout(holdTimer);
        holdTimer = null;
    };

    logo.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        activated = false;

        cancel();
        holdTimer = setTimeout(async () => {
            activated = true;
            navigator.vibrate?.(30);
            await hardRefreshApp();
        }, HOLD_MS);
    }, { passive: true });

    logo.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        const movedX = Math.abs(touch.clientX - startX);
        const movedY = Math.abs(touch.clientY - startY);

        if (movedX > MOVE_LIMIT || movedY > MOVE_LIMIT) cancel();
    }, { passive: true });

    logo.addEventListener('touchend', (event) => {
        cancel();

        if (activated) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, { passive: false });

    logo.addEventListener('touchcancel', cancel, { passive: true });
}

// Read readingPosition from localStorage without mutating app state.
// Returns { book, chapter } or null.
function _readSavedPosition() {
""",
    'long-press refresh functions',
)

replace_once(
    """            initDebugTrigger(this);
""",
    """            initDebugTrigger(this);
            initLogoLongPressRefresh();
""",
    'long-press initialization',
)

path.write_text(text)
