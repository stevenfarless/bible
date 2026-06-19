#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


def read(path_name):
    return Path(path_name).read_text(encoding='utf-8')


def write(path_name, text):
    Path(path_name).write_text(text, encoding='utf-8')


def replace_once(path_name, old, new):
    text = read(path_name)

    if new in text:
        print(f'Already applied: {path_name}')
        return

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f'Expected one replacement anchor in {path_name}, found {count}'
        )

    write(path_name, text.replace(old, new, 1))


def remove_once(path_name, old):
    text = read(path_name)

    if old not in text:
        print(f'Already removed: {path_name}')
        return

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f'Expected one removal anchor in {path_name}, found {count}'
        )

    write(path_name, text.replace(old, '', 1))


def replace_region(path_name, start_marker, end_marker, replacement, sentinel):
    text = read(path_name)

    if sentinel in text:
        print(f'Already replaced region: {path_name}')
        return

    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(
            f'Start marker not found in {path_name}: {start_marker!r}'
        )

    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(
            f'End marker not found in {path_name}: {end_marker!r}'
        )

    write(path_name, text[:start] + replacement + text[end:])


settings_prompt = '''\t\t\t<div class="modal-body">
\t\t\t\t<aside
\t\t\t\t\tid="syncPrompt"
\t\t\t\t\tclass="sync-prompt"
\t\t\t\t\taria-labelledby="syncPromptTitle"
\t\t\t\t\taria-describedby="syncPromptDescription"
\t\t\t\t\thidden
\t\t\t\t>
\t\t\t\t\t<div class="sync-prompt-header">
\t\t\t\t\t\t<h3 id="syncPromptTitle">Sync your reading</h3>
\t\t\t\t\t\t<button
\t\t\t\t\t\t\tid="syncPromptDismiss"
\t\t\t\t\t\t\tclass="sync-prompt-dismiss"
\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\taria-label="Dismiss sign-in prompt"
\t\t\t\t\t\t>&times;</button>
\t\t\t\t\t</div>
\t\t\t\t\t<p id="syncPromptDescription">
\t\t\t\t\t\tSign in to keep your reading position and settings synchronized across devices.
\t\t\t\t\t</p>
\t\t\t\t\t<button id="syncPromptSignIn" class="primary-btn" type="button">Sign in</button>
\t\t\t\t</aside>

\t\t\t\t<div class="accordion-section active" data-section="appearance">'''

replace_once(
    'index.html',
    '''\t\t\t<div class="modal-body">
\t\t\t\t<div class="accordion-section active" data-section="appearance">''',
    settings_prompt,
)

remove_once(
    'index.html',
    '''\t<aside
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

''',
)

replace_once(
    'app.js',
    '''        this.auth     = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
        this._copyrightMap = {};''',
    '''        this.auth     = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
        this.authStateResolved = !this.auth || !this.database;
        this._copyrightMap = {};''',
)

replace_once(
    'app.js',
    '''                this.auth.onAuthStateChanged(async (user) => {
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
                });''',
    '''                this.auth.onAuthStateChanged(async (user) => {
                    this._dbg.t_auth_state = ms();
                    this.authStateResolved = true;

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
                        this.hideSyncPrompt();

                        if (this.settingsModal?.classList.contains('active')) {
                            const promptShown = this.maybeShowSyncPrompt();

                            if (promptShown) {
                                const settingsBody =
                                    this.settingsModal.querySelector('.modal-body');

                                if (settingsBody) settingsBody.scrollTop = 0;
                            }
                        }
                    }
                });''',
)

replace_once(
    'events.js',
    "    app.settingsBtn?.addEventListener('click',        () => app.openModal(app.settingsModal));",
    '''    const openSettings = () => {
        app.hideSyncPrompt();
        app.openModal(app.settingsModal);

        const canOfferSync = Boolean(
            app.auth &&
            app.database &&
            app.authStateResolved &&
            !app.currentUser
        );

        if (!canOfferSync) return;

        const promptShown = app.maybeShowSyncPrompt();

        if (promptShown) {
            const settingsBody =
                app.settingsModal?.querySelector('.modal-body');

            if (settingsBody) settingsBody.scrollTop = 0;
        }
    };

    app.settingsBtn?.addEventListener('click', openSettings);''',
)

replace_once(
    'modals.js',
    '''export function closeModal(app, modal) {
    if (!modal || !modal.classList.contains('active')) return;
    if (modal.classList.contains('closing')) return;

    if (modal === app.translationModal) {''',
    '''export function closeModal(app, modal) {
    if (!modal || !modal.classList.contains('active')) return;
    if (modal.classList.contains('closing')) return;

    if (modal === app.settingsModal) {
        app.hideSyncPrompt?.();
    }

    if (modal === app.translationModal) {''',
)

prompt_css = '''/* Sync sign-in prompt */
.sync-prompt {
    position: static;
    display: grid;
    width: 100%;
    gap: var(--spacing-md);
    margin: 0 0 var(--spacing-lg);
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

.sync-prompt h3 {
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

'''

replace_region(
    'css/components.css',
    '/* Sync sign-in prompt */\n',
    '/* User Info */\n',
    prompt_css,
    '.sync-prompt {\n    position: static;\n',
)

remove_once(
    'css/utilities.css',
    '''    .sync-prompt {
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
''',
)

replace_once(
    'tests/smoke.spec.js',
    '''test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                try { localStorage.setItem('syncPromptDismissedV1', '1'); } catch (_) {}
        });
});''',
    '''test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

                try {
                        const syncPromptTest =
                                new URLSearchParams(location.search).has('syncPromptTest');

                        if (syncPromptTest) {
                                localStorage.removeItem('syncPromptDismissedV1');
                        } else {
                                localStorage.setItem('syncPromptDismissedV1', '1');
                        }
                } catch (_) {}
        });
});''',
)

replace_once(
    'tests/smoke.spec.js',
    '''async function waitForApp(page) {
        await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

async function waitForPassage(page) {''',
    '''async function waitForApp(page) {
        await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

async function waitForAuthState(page) {
        await page.waitForFunction(
                () => window._bibleApp?.authStateResolved === true,
                null,
                { timeout: 10000 }
        );
}

async function waitForPassage(page) {''',
)

old_sync_tests = '''test('sync prompt: responds to desktop and mobile layouts', async ({ page }) => {
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
'''

new_sync_tests = '''test('sync prompt: remains hidden during signed-out startup', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        expect(await page.evaluate(
                () => window._bibleApp.currentUser
        )).toBeNull();

        await expect(page.locator('#syncPrompt')).toBeHidden();
        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);
});

test('sync prompt: appears when a signed-out user opens settings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();

        const settings = page.locator('#settingsModal');
        const prompt = page.locator('#syncPrompt');

        await expect(settings).toHaveClass(/active/);
        await expect(prompt).toBeVisible();
        await expect(page.locator('#settingsModal #syncPrompt')).toHaveCount(1);

        expect(await page.locator('#settingsModal .modal-body').evaluate(
                element => element.scrollTop
        )).toBe(0);
});

test('sync prompt: remains hidden when a signed-in user opens settings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = {
                        uid: 'test-user',
                        email: 'test@example.com',
                };
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();

        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: remains hidden before authentication resolves', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = false;
        });

        await page.locator('#settingsBtn').click();

        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: dismissal persists across settings openings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.locator('#syncPromptDismiss').click();
        await expect(page.locator('#syncPrompt')).toBeHidden();

        await expect.poll(() => page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBe('1');

        await page.locator('#closeSettingsModal').click();
        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: closing settings does not persist dismissal', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();

        expect(await page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBeNull();

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();
});

test('sync prompt: sign in opens login without persisting dismissal', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.locator('#syncPromptSignIn').click();

        await expect(page.locator('#syncPrompt')).toBeHidden();
        await expect(page.locator('#loginModal')).toHaveClass(/active/);

        expect(await page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBeNull();
});

test('sync prompt: stays inside settings on desktop and mobile', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        const readLayout = () => page.evaluate(() => {
                const settings = document.getElementById('settingsModal');
                const body = settings.querySelector('.modal-body');
                const prompt = document.getElementById('syncPrompt');
                const close = document.getElementById('closeSettingsModal');

                const bodyRect = body.getBoundingClientRect();
                const promptRect = prompt.getBoundingClientRect();
                const closeRect = close.getBoundingClientRect();

                const overlapsClose =
                        promptRect.left < closeRect.right &&
                        promptRect.right > closeRect.left &&
                        promptRect.top < closeRect.bottom &&
                        promptRect.bottom > closeRect.top;

                return {
                        position: getComputedStyle(prompt).position,
                        insideSettings: settings.contains(prompt),
                        horizontallyContained:
                                promptRect.left >= bodyRect.left - 1 &&
                                promptRect.right <= bodyRect.right + 1,
                        overlapsClose,
                };
        });

        const desktop = await readLayout();

        expect(desktop.position).toBe('static');
        expect(desktop.insideSettings).toBe(true);
        expect(desktop.horizontallyContained).toBe(true);
        expect(desktop.overlapsClose).toBe(false);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('#syncPrompt')).toBeVisible();

        const mobile = await readLayout();

        expect(mobile.position).toBe('static');
        expect(mobile.insideSettings).toBe(true);
        expect(mobile.horizontallyContained).toBe(true);
        expect(mobile.overlapsClose).toBe(false);
});
'''

replace_once(
    'tests/smoke.spec.js',
    old_sync_tests,
    new_sync_tests,
)
