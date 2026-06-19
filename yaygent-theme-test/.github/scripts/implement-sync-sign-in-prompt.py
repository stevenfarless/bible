#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def path_for(relative: str) -> Path:
    return ROOT / relative


def read(relative: str) -> str:
    return path_for(relative).read_text(encoding="utf-8")


def write(relative: str, text: str) -> None:
    path_for(relative).write_text(text, encoding="utf-8")


def replace_once(relative: str, old: str, new: str) -> None:
    text = read(relative)

    if new and new in text:
        print(f"Already applied: {relative}")
        return

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected one replacement anchor in {relative}, found {count}: {old[:120]!r}"
        )

    write(relative, text.replace(old, new, 1))


def remove_once(relative: str, old: str) -> None:
    text = read(relative)

    if old not in text:
        print(f"Already removed: {relative}")
        return

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected one removal anchor in {relative}, found {count}: {old[:120]!r}"
        )

    write(relative, text.replace(old, "", 1))


def insert_before_once(relative: str, marker: str, content: str, sentinel: str) -> None:
    text = read(relative)

    if sentinel in text:
        print(f"Already inserted: {relative}")
        return

    count = text.count(marker)
    if count != 1:
        raise SystemExit(
            f"Expected one insertion marker in {relative}, found {count}: {marker!r}"
        )

    write(relative, text.replace(marker, content + marker, 1))


def replace_region(
    relative: str,
    start_marker: str,
    end_marker: str,
    replacement: str,
    sentinel: str,
) -> None:
    text = read(relative)

    if sentinel in text:
        print(f"Already replaced region: {relative}")
        return

    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"Start marker not found in {relative}: {start_marker!r}")

    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"End marker not found in {relative}: {end_marker!r}")

    write(relative, text[:start] + replacement + text[end:])


def write_new_file(relative: str, content: str) -> None:
    path = path_for(relative)
    normalized = content.rstrip() + "\n"

    if path.exists():
        current = path.read_text(encoding="utf-8")
        if current != normalized:
            raise SystemExit(
                f"{relative} already exists with unexpected content; refusing to overwrite it"
            )
        print(f"Already present: {relative}")
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(normalized, encoding="utf-8")


SYNC_PROMPT_MODULE = r"""// sync-prompt.js
// Owns the persistent sign-in prompt state and storage behavior.

export const SYNC_PROMPT_DISMISSED_KEY = 'syncPromptDismissedV1';

function getLocalStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch (_) {
        return null;
    }
}

function isSyncPromptComplete(storage = getLocalStorage()) {
    try {
        return storage?.getItem(SYNC_PROMPT_DISMISSED_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function persistSyncPromptCompletion(storage = getLocalStorage()) {
    try {
        storage?.setItem(SYNC_PROMPT_DISMISSED_KEY, '1');
        return true;
    } catch (_) {
        return false;
    }
}

export function hideSyncPrompt(app) {
    if (!app?.syncPrompt) return false;
    app.syncPrompt.hidden = true;
    return true;
}

export function maybeShowSyncPrompt(app, storage = getLocalStorage()) {
    if (!app?.syncPrompt) return false;

    if (app.currentUser || isSyncPromptComplete(storage)) {
        hideSyncPrompt(app);
        return false;
    }

    app.syncPrompt.hidden = false;
    return true;
}

export function dismissSyncPrompt(app, storage = getLocalStorage()) {
    persistSyncPromptCompletion(storage);
    return hideSyncPrompt(app);
}

export function completeSyncPrompt(app, storage = getLocalStorage()) {
    persistSyncPromptCompletion(storage);
    return hideSyncPrompt(app);
}

export function openSyncPromptLogin(app) {
    hideSyncPrompt(app);

    if (!app?.loginModal || typeof app.openModal !== 'function') {
        return false;
    }

    app.openModal(app.loginModal);
    return true;
}
"""

UNIT_TEST = r"""import { describe, expect, it, vi } from 'vitest';
import {
    SYNC_PROMPT_DISMISSED_KEY,
    completeSyncPrompt,
    dismissSyncPrompt,
    maybeShowSyncPrompt,
    openSyncPromptLogin,
} from '../../sync-prompt.js';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: vi.fn((key) => values.get(key) ?? null),
        setItem: vi.fn((key, value) => values.set(key, String(value))),
    };
}

function createApp() {
    return {
        currentUser: null,
        syncPrompt: { hidden: true },
        loginModal: { id: 'loginModal' },
        openModal: vi.fn(),
    };
}

describe('sync sign-in prompt', () => {
    it('shows for a signed-out user without a completion flag', () => {
        const app = createApp();
        const storage = createStorage();

        expect(maybeShowSyncPrompt(app, storage)).toBe(true);
        expect(app.syncPrompt.hidden).toBe(false);
    });

    it('persists dismissal and hides the prompt', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;
        const storage = createStorage();

        expect(dismissSyncPrompt(app, storage)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(SYNC_PROMPT_DISMISSED_KEY, '1');
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('does not show after dismissal has been stored', () => {
        const app = createApp();
        const storage = createStorage({ [SYNC_PROMPT_DISMISSED_KEY]: '1' });

        expect(maybeShowSyncPrompt(app, storage)).toBe(false);
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('completes and hides the prompt for an authenticated user', () => {
        const app = createApp();
        app.currentUser = { uid: 'user-1' };
        app.syncPrompt.hidden = false;
        const storage = createStorage();

        expect(completeSyncPrompt(app, storage)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(SYNC_PROMPT_DISMISSED_KEY, '1');
        expect(app.syncPrompt.hidden).toBe(true);
    });

    it('opens login without permanently dismissing the prompt', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;

        expect(openSyncPromptLogin(app)).toBe(true);
        expect(app.syncPrompt.hidden).toBe(true);
        expect(app.openModal).toHaveBeenCalledWith(app.loginModal);
    });

    it('continues safely when storage is unavailable', () => {
        const app = createApp();
        app.syncPrompt.hidden = false;
        const storage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
        };

        expect(() => maybeShowSyncPrompt(app, storage)).not.toThrow();
        expect(() => dismissSyncPrompt(app, storage)).not.toThrow();
        expect(app.syncPrompt.hidden).toBe(true);
    });
});
"""

SYNC_PROMPT_MARKUP = """\t<aside
\t\tid="syncPrompt"
\t\tclass="sync-prompt"
\t\taria-labelledby="syncPromptTitle"
\t\taria-describedby="syncPromptDescription"
\t\thidden
\t>
\t\t<div class="sync-prompt-header">
\t\t\t<h2 id="syncPromptTitle">Sync your reading</h2>
\t\t\t<button
\t\t\t\tid="syncPromptDismiss"
\t\t\t\tclass="sync-prompt-dismiss"
\t\t\t\ttype="button"
\t\t\t\taria-label="Dismiss sign-in prompt"
\t\t\t>&times;</button>
\t\t</div>
\t\t<p id="syncPromptDescription">
\t\t\tSign in to keep your reading position and settings synchronized across devices.
\t\t</p>
\t\t<button id="syncPromptSignIn" class="primary-btn" type="button">Sign in</button>
\t</aside>

"""

SYNC_PROMPT_CSS = """/* Sync sign-in prompt */
.sync-prompt {
    position: fixed;
    top: calc(var(--header-height) + var(--spacing-sm));
    right: max(
        var(--spacing-lg),
        calc((100vw - var(--max-width)) / 2 + var(--spacing-lg))
    );
    z-index: 500;
    display: grid;
    width: min(22rem, calc(100vw - var(--spacing-lg) - var(--spacing-lg)));
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background-color: var(--bg-card);
    border: 1px solid var(--border-neutral);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    color: var(--text-body);
}

.sync-prompt[hidden] {
    display: none;
}

.sync-prompt-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
}

.sync-prompt h2 {
    margin: 0;
    color: var(--primary-color);
    font-size: 1.05rem;
    line-height: 1.3;
}

.sync-prompt p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
}

.sync-prompt .primary-btn {
    justify-self: start;
}

.sync-prompt-dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: var(--text-muted);
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    touch-action: manipulation;
}

.sync-prompt-dismiss:hover {
    background-color: var(--bg-raised);
    color: var(--text-body);
}

.sync-prompt-dismiss:focus-visible,
.sync-prompt .primary-btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

@media (min-width: 769px) {
    body.chrome-hidden .sync-prompt:not([hidden]) {
        opacity: 0;
        pointer-events: none;
    }
}

"""

MOBILE_SYNC_PROMPT_CSS = """
    .sync-prompt {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;
        width: 100%;
        max-height: min(70dvh, 32rem);
        overflow-y: auto;
        padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom));
        border-right: 0;
        border-bottom: 0;
        border-left: 0;
        border-radius: 16px 16px 0 0;
    }
"""

SMOKE_TESTS = r"""

test('sync prompt: responds to desktop and mobile layouts', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/');
        await waitForApp(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                document.getElementById('syncPrompt').hidden = false;
        });

        const prompt = page.locator('#syncPrompt');
        await expect(prompt).toBeVisible();

        const desktopLayout = await page.evaluate(() => {
                const account = document.getElementById('userBtn').getBoundingClientRect();
                const panel = document.getElementById('syncPrompt').getBoundingClientRect();
                return {
                        accountBottom: account.bottom,
                        accountRight: account.right,
                        panelTop: panel.top,
                        panelRight: panel.right,
                };
        });

        expect(desktopLayout.panelTop).toBeGreaterThanOrEqual(desktopLayout.accountBottom);
        expect(Math.abs(desktopLayout.panelRight - desktopLayout.accountRight)).toBeLessThanOrEqual(2);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => {
                const panel = document.getElementById('syncPrompt').getBoundingClientRect();
                return Math.round(window.innerHeight - panel.bottom);
        })).toBe(0);

        await page.locator('#syncPromptSignIn').click();
        await expect(prompt).toBeHidden();
        await expect(page.locator('#loginModal')).toBeVisible();
});

test('sync prompt: dismissal persists locally', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await waitForApp(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                document.getElementById('syncPrompt').hidden = false;
        });

        const prompt = page.locator('#syncPrompt');
        await expect(prompt).toBeVisible();
        await page.locator('#syncPromptDismiss').click();
        await expect(prompt).toBeHidden();
        await expect.poll(() => page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBe('1');
});
"""

NEW_AUTH_BLOCK = """            if (this.auth && this.database) {
                await this.auth.ready;
                this.auth.onAuthStateChanged(async (user) => {
                    this._dbg.t_auth_state = ms();
                    if (user) {
                        this._dbg.authStateUser = user.email;
                        this._dbgEvent(`auth: signed in as ${user.email}`);
                        this.currentUser = user;
                        this.completeSyncPrompt();
                        await withTimeout(this.loadUserData(), 5000);
                        this._dbg.t_user_data_loaded = ms();
                        this.applySettings();
                        const bookBefore = this.state.currentBook;
                        const chBefore   = this.state.currentChapter;
                        await this._loadSavedPositionIfChanged();
                        this._dbg.t_firebase_position_end = ms();
                        this._dbg.firebasePositionChanged =
                            this.state.currentBook !== bookBefore || this.state.currentChapter !== chBefore;
                        if (this._dbg.firebasePositionChanged) {
                            this._dbgEvent(`Firebase position changed: ${bookBefore} → ${this.state.currentBook} ${this.state.currentChapter}`);
                        }
                    } else {
                        this._dbg.authStateUser = 'signed out';
                        this._dbgEvent('auth: signed out');
                        this.currentUser = null;
                        this.maybeShowSyncPrompt();
                    }
                });
            }"""


def apply() -> None:
    write_new_file("sync-prompt.js", SYNC_PROMPT_MODULE)
    write_new_file("tests/unit/sync-prompt.test.js", UNIT_TEST)

    replace_once(
        "config/firebase-config.js",
        """// Try IndexedDB first (most robust), fall back to localStorage, then
// sessionStorage. This prevents sign-out on every reload when Edge/Safari
// tracking prevention blocks cross-origin storage access.
setPersistence(_auth, indexedDBLocalPersistence).catch(() =>
    setPersistence(_auth, browserLocalPersistence).catch(() =>
        setPersistence(_auth, browserSessionPersistence)
    )
);""",
        """// Try IndexedDB first (most robust), fall back to localStorage, then
// sessionStorage. Expose completion so auth-state consumers do not infer
// readiness from timing or show signed-out UI before persistence settles.
const authPersistenceReady = setPersistence(_auth, indexedDBLocalPersistence)
    .catch(() => setPersistence(_auth, browserLocalPersistence))
    .catch(() => setPersistence(_auth, browserSessionPersistence))
    .catch((error) => {
        console.warn('Firebase auth persistence unavailable', error);
    });""",
    )

    replace_once(
        "config/firebase-config.js",
        """const authShim = {
    onAuthStateChanged: (cb)           => onAuthStateChanged(_auth, cb),""",
        """const authShim = {
    ready: authPersistenceReady,
    onAuthStateChanged: (cb)           => onAuthStateChanged(_auth, cb),""",
    )

    replace_once(
        "index.html",
        '\t<link rel="modulepreload" href="auth.js" />\n',
        '\t<link rel="modulepreload" href="auth.js" />\n\t<link rel="modulepreload" href="sync-prompt.js" />\n',
    )
    insert_before_once(
        "index.html",
        '\t<div id="toast" class="toast" role="status" aria-live="polite"></div>\n',
        SYNC_PROMPT_MARKUP,
        'id="syncPrompt"',
    )

    replace_once(
        "ui.js",
        "\t'toast',\n",
        "\t'syncPrompt', 'syncPromptDismiss', 'syncPromptSignIn',\n\t'toast',\n",
    )
    replace_once(
        "ui.js",
        """\t// Toast
\tapp.toast = document.getElementById('toast');""",
        """\t// Persistent sync prompt
\tapp.syncPrompt = document.getElementById('syncPrompt');
\tapp.syncPromptDismiss = document.getElementById('syncPromptDismiss');
\tapp.syncPromptSignIn = document.getElementById('syncPromptSignIn');

\t// Toast
\tapp.toast = document.getElementById('toast');""",
    )

    remove_once(
        "auth.js",
        """export function checkApiKey(app) {
    setTimeout(() => {
        app.showToast('Sign in to sync your reading position across devices.');
    }, 500);
}

""",
    )

    replace_once(
        "app.js",
        """import {
    loadSavedPositionIfChanged, loadSavedReadingPosition, saveReadingPosition,
    checkApiKey, handleUserButtonClick, handleLogin, handleSignup, handleLogout, loadUserData,
} from './auth.js';""",
        """import {
    loadSavedPositionIfChanged, loadSavedReadingPosition, saveReadingPosition,
    handleUserButtonClick, handleLogin, handleSignup, handleLogout, loadUserData,
} from './auth.js';
import {
    maybeShowSyncPrompt, hideSyncPrompt, dismissSyncPrompt,
    completeSyncPrompt, openSyncPromptLogin,
} from './sync-prompt.js';""",
    )

    replace_region(
        "app.js",
        """            if (this.auth && this.database) {
                let _authResolved = false;""",
        "\n        } catch (err) {",
        NEW_AUTH_BLOCK,
        "                await this.auth.ready;",
    )

    replace_once(
        "app.js",
        """    checkApiKey() { checkApiKey(this); }

""",
        """    maybeShowSyncPrompt() { return maybeShowSyncPrompt(this); }
    hideSyncPrompt()      { return hideSyncPrompt(this); }
    dismissSyncPrompt()   { return dismissSyncPrompt(this); }
    completeSyncPrompt()  { return completeSyncPrompt(this); }
    openSyncPromptLogin() { return openSyncPromptLogin(this); }

""",
    )

    replace_once(
        "events.js",
        "    document.getElementById('userBtn')?.addEventListener('click', () => app.handleUserButtonClick());\n",
        """    document.getElementById('userBtn')?.addEventListener('click', () => {
        app.hideSyncPrompt();
        app.handleUserButtonClick();
    });
    app.syncPromptDismiss?.addEventListener('click', () => app.dismissSyncPrompt());
    app.syncPromptSignIn?.addEventListener('click', () => app.openSyncPromptLogin());
""",
    )

    insert_before_once(
        "css/components.css",
        "/* User Info */\n",
        SYNC_PROMPT_CSS,
        ".sync-prompt[hidden]",
    )

    replace_once(
        "css/utilities.css",
        """    .search-container.active {
        max-height: calc(100dvh - var(--chrome-height));
    }
}""",
        """    .search-container.active {
        max-height: calc(100dvh - var(--chrome-height));
    }
""" + MOBILE_SYNC_PROMPT_CSS + "}",
    )

    replace_once(
        "sw.js",
        "  './auth.js',\n",
        "  './auth.js',\n  './sync-prompt.js',\n",
    )

    replace_once(
        "tests/smoke.spec.js",
        """        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        });""",
        """        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                try { localStorage.setItem('syncPromptDismissedV1', '1'); } catch (_) {}
        });""",
    )

    smoke = read("tests/smoke.spec.js")
    if "test('sync prompt: responds to desktop and mobile layouts'" not in smoke:
        write("tests/smoke.spec.js", smoke.rstrip() + SMOKE_TESTS.rstrip() + "\n")
    else:
        print("Already present: sync prompt smoke tests")


def validate() -> None:
    required = {
        "sync-prompt.js": [
            "export const SYNC_PROMPT_DISMISSED_KEY = 'syncPromptDismissedV1';",
            "export function maybeShowSyncPrompt(app, storage = getLocalStorage())",
            "export function dismissSyncPrompt(app, storage = getLocalStorage())",
            "export function completeSyncPrompt(app, storage = getLocalStorage())",
            "export function openSyncPromptLogin(app)",
        ],
        "config/firebase-config.js": [
            "const authPersistenceReady = setPersistence",
            "ready: authPersistenceReady,",
        ],
        "index.html": [
            'href="sync-prompt.js"',
            'id="syncPrompt"',
            'id="syncPromptDismiss"',
            'id="syncPromptSignIn"',
        ],
        "ui.js": [
            "'syncPrompt', 'syncPromptDismiss', 'syncPromptSignIn'",
            "app.syncPrompt = document.getElementById('syncPrompt');",
        ],
        "app.js": [
            "from './sync-prompt.js';",
            "await this.auth.ready;",
            "this.completeSyncPrompt();",
            "this.maybeShowSyncPrompt();",
            "openSyncPromptLogin() { return openSyncPromptLogin(this); }",
        ],
        "events.js": [
            "app.hideSyncPrompt();",
            "app.syncPromptDismiss?.addEventListener('click'",
            "app.syncPromptSignIn?.addEventListener('click'",
        ],
        "css/components.css": [
            ".sync-prompt {",
            ".sync-prompt[hidden] {",
            ".sync-prompt-dismiss:focus-visible,",
        ],
        "css/utilities.css": [
            "padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom));",
            "border-radius: 16px 16px 0 0;",
        ],
        "sw.js": ["'./sync-prompt.js',"],
        "tests/unit/sync-prompt.test.js": [
            "describe('sync sign-in prompt'",
            "continues safely when storage is unavailable",
        ],
        "tests/smoke.spec.js": [
            "test('sync prompt: responds to desktop and mobile layouts'",
            "test('sync prompt: dismissal persists locally'",
        ],
    }

    for relative, snippets in required.items():
        text = read(relative)
        for snippet in snippets:
            if snippet not in text:
                raise SystemExit(f"Missing from {relative}: {snippet}")

    forbidden = {
        "auth.js": [
            "export function checkApiKey(app)",
            "Sign in to sync your reading position across devices.",
        ],
        "app.js": [
            "checkApiKey,",
            "checkApiKey() {",
            "let _authResolved = false;",
        ],
    }

    for relative, snippets in forbidden.items():
        text = read(relative)
        for snippet in snippets:
            if snippet in text:
                raise SystemExit(f"Stale implementation remains in {relative}: {snippet}")

    index = read("index.html")
    for identifier in ("syncPrompt", "syncPromptDismiss", "syncPromptSignIn"):
        count = index.count(f'id="{identifier}"')
        if count != 1:
            raise SystemExit(f"Expected one #{identifier} in index.html, found {count}")

    if index.count('href="sync-prompt.js"') != 1:
        raise SystemExit("Expected one sync-prompt.js modulepreload")

    if read("sw.js").count("'./sync-prompt.js',") != 1:
        raise SystemExit("Expected one sync-prompt.js service-worker entry")


if __name__ == "__main__":
    apply()
    validate()
    print("Sync sign-in prompt implementation applied and validated.")
