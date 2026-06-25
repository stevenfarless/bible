from pathlib import Path
import re


INSTALL_PROMPT_HTML = '''\t<div id="installPrompt" class="install-prompt" role="dialog" aria-modal="true" aria-labelledby="installPromptTitle" aria-hidden="true" hidden>
\t\t<div class="install-prompt__sheet">
\t\t\t<div class="install-prompt__handle" aria-hidden="true"></div>
\t\t\t<h2 id="installPromptTitle">Install Lege Lux?</h2>
\t\t\t<p class="install-prompt__body">Open Lege Lux from your home screen, load faster, and keep your Bible reader available offline.</p>
\t\t\t<ul class="install-prompt__benefits">
\t\t\t\t<li>Home screen access</li>
\t\t\t\t<li>Standalone app window</li>
\t\t\t\t<li>Offline reading support</li>
\t\t\t</ul>
\t\t\t<div id="iosInstallSteps" class="install-prompt__ios" hidden>
\t\t\t\t<p>On iPhone, install manually:</p>
\t\t\t\t<ol>
\t\t\t\t\t<li>Tap Share</li>
\t\t\t\t\t<li>Tap Add to Home Screen</li>
\t\t\t\t\t<li>Tap Add</li>
\t\t\t\t</ol>
\t\t\t</div>
\t\t\t<div class="install-prompt__actions">
\t\t\t\t<button id="installPromptInstall" class="primary-btn" type="button">Install</button>
\t\t\t\t<button id="installPromptLater" class="secondary-btn" type="button">Not now</button>
\t\t\t</div>
\t\t</div>
\t</div>'''


INSTALL_PROMPT_CSS = '''/* PWA install prompt */
.install-prompt[hidden] {
    display: none !important;
}

.install-prompt {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
    background: rgba(0, 0, 0, 0.36);
}

.install-prompt__sheet {
    width: min(100%, 28rem);
    padding: var(--spacing-lg);
    background: var(--bg-raised);
    color: var(--text-body);
    border: 1px solid var(--border-neutral);
    border-radius: 20px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35);
}

.install-prompt__handle {
    width: 3rem;
    height: 0.25rem;
    margin: 0 auto var(--spacing-md);
    border-radius: 999px;
    background: currentColor;
    opacity: 0.24;
}

.install-prompt h2 {
    margin: 0 0 var(--spacing-sm);
    color: var(--text-heading);
    font-size: 1.25rem;
    line-height: 1.25;
}

.install-prompt__body {
    margin: 0 0 var(--spacing-md);
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.5;
}

.install-prompt__benefits,
.install-prompt__ios ol {
    margin: 0 0 var(--spacing-lg);
    padding-left: 1.25rem;
    color: var(--text-body);
    font-size: 0.9rem;
    line-height: 1.5;
}

.install-prompt__ios {
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--bg-card);
    border: 1px solid var(--border-neutral);
    border-radius: var(--border-radius);
}

.install-prompt__ios[hidden] {
    display: none;
}

.install-prompt__ios p {
    margin: 0 0 var(--spacing-sm);
    color: var(--text-body);
    font-weight: 600;
}

.install-prompt__ios ol {
    margin-bottom: 0;
}

.install-prompt__actions {
    display: flex;
    gap: var(--spacing-sm);
}

.install-prompt__actions button {
    flex: 1 1 0;
    min-height: 44px;
    touch-action: manipulation;
}

@media (min-width: 720px) {
    .install-prompt {
        align-items: flex-end;
        justify-content: flex-end;
        padding: 24px;
    }

    .install-prompt__sheet {
        max-width: 420px;
    }
}
'''


INSTALL_PROMPT_JS = '''const DISMISSED_UNTIL_KEY = 'installPromptDismissedUntilV1';
const INSTALLED_KEY = 'installPromptInstalledV1';

const DISMISS_DAYS = 30;
const SHOW_DELAY_MS = 2500;
const MODAL_RETRY_MS = 1500;

let deferredInstallPrompt = null;
let promptShownThisSession = false;
let initialized = false;
let showTimer = null;
let lastFocusedElement = null;

function now() {
    return Date.now();
}

function getStoredNumber(key, fallback = 0) {
    try {
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) ? value : fallback;
    } catch (_) {
        return fallback;
    }
}

function getStoredValue(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
}

function setStoredValue(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
}

function markReady() {
    document.body.setAttribute('data-install-prompt-ready', 'true');
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

function isIosSafari() {
    const ua = window.navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIos && isSafari;
}

function isDismissed() {
    return getStoredNumber(DISMISSED_UNTIL_KEY) > now();
}

function dismissForCooldown() {
    setStoredValue(DISMISSED_UNTIL_KEY, now() + DISMISS_DAYS * 24 * 60 * 60 * 1000);
}

function hasInstallPath() {
    return Boolean(deferredInstallPrompt) || isIosSafari();
}

function hasBlockingUi() {
    return Boolean(
        document.querySelector('.modal.active') ||
        document.querySelector('.search-container.active')
    );
}

function shouldShowPrompt() {
    if (promptShownThisSession) return false;
    if (isStandalone()) return false;
    if (getStoredValue(INSTALLED_KEY) === 'true') return false;
    if (isDismissed()) return false;
    return hasInstallPath();
}

function getElements() {
    return {
        prompt: document.getElementById('installPrompt'),
        install: document.getElementById('installPromptInstall'),
        later: document.getElementById('installPromptLater'),
        iosSteps: document.getElementById('iosInstallSteps'),
    };
}

function hidePrompt() {
    const { prompt } = getElements();
    if (!prompt) return;

    prompt.hidden = true;
    prompt.setAttribute('aria-hidden', 'true');

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus({ preventScroll: true });
    }
    lastFocusedElement = null;
}

function showPrompt() {
    showTimer = null;
    if (!shouldShowPrompt()) return;

    if (hasBlockingUi()) {
        schedulePrompt(MODAL_RETRY_MS);
        return;
    }

    const { prompt, install, iosSteps } = getElements();
    if (!prompt || !install || !iosSteps) return;

    const ios = isIosSafari();
    promptShownThisSession = true;
    lastFocusedElement = document.activeElement;

    iosSteps.hidden = !ios;
    install.textContent = ios ? 'Got it' : 'Install';

    prompt.hidden = false;
    prompt.setAttribute('aria-hidden', 'false');
    install.focus({ preventScroll: true });
}

function schedulePrompt(delay = SHOW_DELAY_MS) {
    if (showTimer) return;
    showTimer = window.setTimeout(showPrompt, delay);
}

async function installApp() {
    if (isIosSafari()) {
        dismissForCooldown();
        hidePrompt();
        return;
    }

    if (!deferredInstallPrompt) return;

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;

    try {
        promptEvent.prompt();
        const result = await promptEvent.userChoice;

        if (result?.outcome === 'accepted') {
            setStoredValue(INSTALLED_KEY, 'true');
        } else {
            dismissForCooldown();
        }
    } finally {
        hidePrompt();
    }
}

function dismissPrompt() {
    dismissForCooldown();
    hidePrompt();
}

function wireDomEvents() {
    const { prompt, install, later } = getElements();

    install?.addEventListener('click', installApp);
    later?.addEventListener('click', dismissPrompt);

    prompt?.addEventListener('click', (event) => {
        if (event.target === prompt) dismissPrompt();
    });

    document.addEventListener('keydown', (event) => {
        const { prompt } = getElements();
        if (event.key === 'Escape' && prompt && !prompt.hidden) dismissPrompt();
    });
}

export function initInstallPrompt() {
    if (initialized) return;
    initialized = true;

    if (isStandalone()) {
        setStoredValue(INSTALLED_KEY, 'true');
        markReady();
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        schedulePrompt();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        setStoredValue(INSTALLED_KEY, 'true');
        hidePrompt();
    });

    wireDomEvents();
    markReady();

    if (isIosSafari()) schedulePrompt();
}
'''


INSTALL_PROMPT_TEST = '''// @ts-check
import { test, expect } from '@playwright/test';

const DISMISSED_UNTIL_KEY = 'installPromptDismissedUntilV1';
const INSTALLED_KEY = 'installPromptInstalledV1';

async function waitForApp(page) {
    await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

async function waitForPassage(page) {
    await waitForApp(page);
    await page.waitForFunction(
        () => {
            const title = document.getElementById('passageTitle');
            const loading = document.querySelector('#passageText .loading');
            return title?.textContent?.trim().length > 0 && !loading;
        },
        { timeout: 10000 }
    );
}

async function waitForInstallPromptReady(page) {
    await page.waitForSelector('body[data-install-prompt-ready="true"]', { timeout: 10000 });
}

async function fireBeforeInstallPrompt(page, outcome = 'accepted') {
    await page.evaluate((choice) => {
        const event = new Event('beforeinstallprompt');
        event.preventDefault = () => {};
        event.prompt = () => { window.__installPromptWasPrompted = true; };
        event.userChoice = Promise.resolve({ outcome: choice, platform: 'web' });
        window.dispatchEvent(event);
    }, outcome);
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        try { localStorage.setItem('syncPromptDismissedV1', '1'); } catch (_) {}
    });
});

test('install prompt stays hidden without an install path', async ({ page }) => {
    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await page.waitForTimeout(3000);

    await expect(page.locator('#installPrompt')).toBeHidden();
});

test('install prompt shows benefits after the browser install event delay', async ({ page }) => {
    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await fireBeforeInstallPrompt(page);

    const prompt = page.locator('#installPrompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(prompt).toContainText('Install Lege Lux?');
    await expect(prompt).toContainText('Home screen access');
    await expect(prompt).toContainText('Standalone app window');
    await expect(prompt).toContainText('Offline reading support');
});

test('install prompt button invokes the browser install prompt', async ({ page }) => {
    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await fireBeforeInstallPrompt(page, 'accepted');

    await expect(page.locator('#installPrompt')).toBeVisible({ timeout: 5000 });
    await page.locator('#installPromptInstall').click();

    await expect.poll(() => page.evaluate(() => window.__installPromptWasPrompted === true)).toBe(true);
    await expect(page.locator('#installPrompt')).toBeHidden();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), INSTALLED_KEY)).toBe('true');
});

test('install prompt dismissal stores a cooldown', async ({ page }) => {
    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await fireBeforeInstallPrompt(page, 'dismissed');

    await expect(page.locator('#installPrompt')).toBeVisible({ timeout: 5000 });
    await page.locator('#installPromptLater').click();

    await expect(page.locator('#installPrompt')).toBeHidden();
    await expect.poll(() => page.evaluate(key => Number(localStorage.getItem(key) || 0) > Date.now(), DISMISSED_UNTIL_KEY)).toBe(true);
});

test('install prompt is suppressed in standalone display mode', async ({ page }) => {
    await page.addInitScript(() => {
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => {
            if (query === '(display-mode: standalone)') {
                return {
                    matches: true,
                    media: query,
                    onchange: null,
                    addListener() {},
                    removeListener() {},
                    addEventListener() {},
                    removeEventListener() {},
                    dispatchEvent() { return false; },
                };
            }
            return originalMatchMedia(query);
        };
    });

    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3000);

    await expect(page.locator('#installPrompt')).toBeHidden();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), INSTALLED_KEY)).toBe('true');
});

test('iOS Safari path shows Add to Home Screen instructions after the delay', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgent', {
            get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        });
        Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    });

    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);

    const prompt = page.locator('#installPrompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#iosInstallSteps')).toBeVisible();
    await expect(prompt).toContainText('Tap Share');
    await expect(prompt).toContainText('Tap Add to Home Screen');
});
'''


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def write(path, text):
    path.write_text(text)


def update_index():
    path = Path('index.html')
    text = path.read_text()

    if 'id="installPrompt"' in text:
        print('Install prompt markup is already present.')
        return

    if 'id="installBanner"' in text:
        start = text.find('\n    <div id="installBanner"')
        if start == -1:
            start = text.find('\n\t<div id="installBanner"')
        require(start != -1, 'Could not find installBanner block start in index.html.')
        toast = text.find('\n\t<div id="toast"', start)
        require(toast != -1, 'Could not find toast block after installBanner in index.html.')
        text = text[:start] + '\n' + INSTALL_PROMPT_HTML + '\n' + text[toast:]
        write(path, text)
        return

    toast = text.find('\n\t<div id="toast"')
    require(toast != -1, 'Could not find toast insertion point in index.html.')
    text = text[:toast] + '\n' + INSTALL_PROMPT_HTML + '\n' + text[toast:]
    write(path, text)


def update_components_css():
    path = Path('css/components.css')
    text = path.read_text()

    if '/* PWA install prompt */' in text:
        print('Install prompt CSS is already present.')
        return

    marker = '/* PWA install banner */'
    if marker in text:
        start = text.index(marker)
        text = text[:start].rstrip() + '\n\n' + INSTALL_PROMPT_CSS
    else:
        text = text.rstrip() + '\n\n' + INSTALL_PROMPT_CSS

    write(path, text)


def update_app_js():
    path = Path('app.js')
    text = path.read_text()

    text = re.sub(
        r'\n/\* PWA Install Prompt \*/.*?\n/\* Service Worker & Update Toast \*/',
        '\n/* Service Worker & Update Toast */',
        text,
        count=1,
        flags=re.S,
    )

    if "import('./install-prompt.js')" not in text:
        old = """            this._startBackgroundAuthRestoration();

            void withTimeout(this.loadSyncedTranslationLibrary(), 5000, null)
"""
        new = """            void import('./install-prompt.js')
                .then(({ initInstallPrompt }) => initInstallPrompt(this))
                .catch((error) => {
                    console.warn('Install prompt unavailable:', error);
                    this._dbgEvent(`install prompt unavailable: ${error.message}`);
                });

            this._startBackgroundAuthRestoration();

            void withTimeout(this.loadSyncedTranslationLibrary(), 5000, null)
"""
        require(old in text, 'Could not find app init install prompt insertion point in app.js.')
        text = text.replace(old, new, 1)

    write(path, text)


def update_service_worker():
    path = Path('sw.js')
    text = path.read_text()

    if "'./install-prompt.js'," not in text:
        old = "  './app.js',\n  './bible-api.js',\n"
        new = "  './app.js',\n  './install-prompt.js',\n  './bible-api.js',\n"
        require(old in text, 'Could not find app.js app-shell entry in sw.js.')
        text = text.replace(old, new, 1)
        write(path, text)


def update_playwright_config():
    path = Path('playwright.config.js')
    text = path.read_text()

    if "'**/tests/install-prompt.spec.js'" not in text:
        old = """\t\t'**/tests/smoke.spec.js',
\t\t'**/tests/about-release.spec.js',
"""
        new = """\t\t'**/tests/smoke.spec.js',
\t\t'**/tests/about-release.spec.js',
\t\t'**/tests/install-prompt.spec.js',
"""
        require(old in text, 'Could not find Playwright testMatch block.')
        text = text.replace(old, new, 1)
        write(path, text)


def write_install_prompt_module():
    write(Path('install-prompt.js'), INSTALL_PROMPT_JS)


def write_tests():
    write(Path('tests/install-prompt.spec.js'), INSTALL_PROMPT_TEST)


update_index()
update_components_css()
update_app_js()
update_service_worker()
update_playwright_config()
write_install_prompt_module()
write_tests()
