// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

		try {
			localStorage.setItem('syncPromptDismissedV1', '1');
		} catch (_) {}
	});
});

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

test('startup: Vespers does not load Geek95 CSS', async ({ page }) => {
	const geekRequests = [];

	await page.addInitScript(() => {
		try { localStorage.setItem('colorTheme', 'vespers'); } catch (_) {}
	});

	await page.route('**/css/geek95.css*', route => {
		geekRequests.push(route.request().url());
		return route.continue();
	});

	await page.goto('/');
	await waitForPassage(page);
	await page.waitForTimeout(100);

	expect(geekRequests).toHaveLength(0);
});

test('startup: restored Geek theme loads Geek95 CSS', async ({ page }) => {
	const geekRequests = [];

	await page.addInitScript(() => {
		try { localStorage.setItem('colorTheme', 'geek'); } catch (_) {}
	});

	await page.route('**/css/geek95.css*', route => {
		geekRequests.push(route.request().url());
		return route.continue();
	});

	await page.goto('/');
	await waitForPassage(page);

	await expect.poll(() => geekRequests.length).toBe(1);
});
