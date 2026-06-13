// @ts-check
import { test, expect } from '@playwright/test';

const readingFonts = {
    gentium: 'Gentium Book Plus',
    andika: 'Andika',
    ubuntu: 'Ubuntu',
    opendyslexic3: 'OpenDyslexic3',
    'ia-quattro': 'iA Writer Quattro S',
    adwaitasans: 'Adwaita Sans',
};

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    });
});

test('installed build opens offline with every bundled theme and font', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });

    await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller) return;

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Service worker did not control the page.')), 30000);
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                clearTimeout(timeout);
                resolve(undefined);
            }, { once: true });
        });
    });

    const cacheAudit = await page.evaluate(async () => {
        const response = await fetch('./offline-assets.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Offline manifest returned ${response.status}.`);
        const manifest = await response.json();
        const buildId = document.querySelector('meta[name="build-id"]')?.content;
        const cacheName = buildId ? `bible-${buildId}` : null;
        if (!cacheName || !(await caches.keys()).includes(cacheName)) {
            throw new Error(`Expected service-worker cache is missing: ${cacheName || 'unknown build'}.`);
        }

        const cache = await caches.open(cacheName);
        const missing = [];
        for (const asset of manifest) {
            if (!(await cache.match(asset, { ignoreSearch: true }))) missing.push(asset);
        }
        return { cacheName, count: manifest.length, missing };
    });

    expect(cacheAudit.count).toBeGreaterThan(150);
    expect(cacheAudit.missing).toEqual([]);
    expect(['object', 'function']).toContain(await page.evaluate(() => typeof window.marked));

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('body[data-app-ready="true"]', { timeout: 30000 });
    await expect(page.locator('#passageTitle')).toBeVisible();
    await expect(page.locator('#passageText')).not.toBeEmpty();

    const requiredFetches = await page.evaluate(async () => {
        const urls = [
            './css/app.min.css',
            './translations/KJV/Genesis.json',
            './translations/BSB/Genesis.json',
            './fonts/GentiumBookPlus-Regular.woff2',
            './fonts/Andika-Regular.woff2',
            './fonts/OpenDyslexic3-Regular.woff2',
            './fonts/Ubuntu-Regular.woff2',
            './fonts/iAWriterQuattroS-Regular.woff2',
            './fonts/AdwaitaSans-Regular.woff2',
            './vendor/marked/marked.min.js',
        ];
        return Promise.all(urls.map(async url => {
            try {
                const response = await fetch(url);
                return { url, status: response.status };
            } catch (error) {
                return { url, status: 0, error: String(error) };
            }
        }));
    });
    expect(requiredFetches.filter(result => result.status !== 200)).toEqual([]);

    const themeValues = await page.locator('#themeSelector option').evaluateAll(options =>
        options.map(option => option.value)
    );
    for (const theme of themeValues) {
        await page.evaluate(value => {
            const selector = document.getElementById('themeSelector');
            if (!(selector instanceof HTMLSelectElement)) throw new Error('Theme selector is missing.');
            selector.value = value;
            selector.dispatchEvent(new Event('input', { bubbles: true }));
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }, theme);
        await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme}-theme(?:\\s|$)`));
    }

    for (const [value, family] of Object.entries(readingFonts)) {
        await page.evaluate(fontValue => {
            const selector = document.getElementById('readingFontSelector');
            if (!(selector instanceof HTMLSelectElement)) throw new Error('Reading font selector is missing.');
            selector.value = fontValue;
            selector.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
        const loadedFaces = await page.evaluate(async fontFamily => {
            const faces = await document.fonts.load(`16px "${fontFamily}"`, 'Bible');
            return faces.length;
        }, family);
        expect(loadedFaces, `${family} should load offline`).toBeGreaterThan(0);
    }

    const geekFaces = await page.evaluate(async () => {
        const faces = await document.fonts.load('16px "IBM_CGAThin-2y"', 'Bible');
        return faces.length;
    });
    expect(geekFaces).toBeGreaterThan(0);
});
