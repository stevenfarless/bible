// @ts-check
import { test, expect } from '@playwright/test';

const DISMISSED_UNTIL_KEY = 'installPromptDismissedUntilV1';
const INSTALLED_KEY = 'installPromptInstalledV1';
const VISIT_COUNT_KEY = 'installPromptVisitCountV1';

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
    await page.waitForFunction(
        key => localStorage.getItem(key) !== null,
        VISIT_COUNT_KEY,
        { timeout: 10000 }
    );
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

test('install prompt waits until a repeat visit qualifies', async ({ page }) => {
    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3000);

    await expect(page.locator('#installPrompt')).toBeHidden();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), VISIT_COUNT_KEY)).toBe('1');
});

test('install prompt shows benefits after beforeinstallprompt on repeat visits', async ({ page }) => {
    await page.addInitScript(key => {
        try { localStorage.setItem(key, '1'); } catch (_) {}
    }, VISIT_COUNT_KEY);

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
    await page.addInitScript(key => {
        try { localStorage.setItem(key, '1'); } catch (_) {}
    }, VISIT_COUNT_KEY);

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
    await page.addInitScript(key => {
        try { localStorage.setItem(key, '1'); } catch (_) {}
    }, VISIT_COUNT_KEY);

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
    await page.addInitScript((visitKey) => {
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
        try { localStorage.setItem(visitKey, '1'); } catch (_) {}
    }, VISIT_COUNT_KEY);

    await page.goto('/');
    await waitForPassage(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3000);

    await expect(page.locator('#installPrompt')).toBeHidden();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), INSTALLED_KEY)).toBe('true');
});

test('iOS Safari path shows Add to Home Screen instructions', async ({ page }) => {
    await page.addInitScript(visitKey => {
        Object.defineProperty(navigator, 'userAgent', {
            get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        });
        Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        try { localStorage.setItem(visitKey, '1'); } catch (_) {}
    }, VISIT_COUNT_KEY);

    await page.goto('/');
    await waitForPassage(page);
    await waitForInstallPromptReady(page);

    const prompt = page.locator('#installPrompt');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#iosInstallSteps')).toBeVisible();
    await expect(prompt).toContainText('Tap Share');
    await expect(prompt).toContainText('Tap Add to Home Screen');
});
