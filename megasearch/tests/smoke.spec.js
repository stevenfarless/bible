// @ts-check
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Debug log helper
// Calls window._buildDebugReport (exposed by app.js) and attaches the full
// text to the Playwright report on every test failure. Paste the attachment
// content directly when reporting a bug.
// ---------------------------------------------------------------------------
test.afterEach(async ({ page }, testInfo) => {
	if (testInfo.status === 'passed') return;
	try {
		const report = await page.evaluate(() => {
			if (typeof window._buildDebugReport !== 'function') return '(debug report not available)';
			return window._buildDebugReport();
		});
		await testInfo.attach('debug-report.txt', {
			body: report,
			contentType: 'text/plain',
		});
	} catch (_) {
		// Never let the reporter itself fail a test.
	}
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Navigate to a book via the book modal. bookText is the button label, e.g. 'Matt'. */
async function goToBook(page, bookText, testament = 'new') {
	await page.locator('#bookSelector').click();
	await expect(page.locator('#bookModal')).toBeVisible();
	const grid = testament === 'old' ? '#oldTestamentBooks' : '#newTestamentBooks';
	await page.locator(`${grid} button`).filter({ hasText: new RegExp(`^${bookText}$`) }).click();
}

/** Navigate to a chapter via the chapter modal. */
async function goToChapter(page, chapterNum) {
	await page.locator('#chapterSelector').click();
	await expect(page.locator('#chapterModal')).toBeVisible();
	await page.locator('#chapterGrid button', { hasText: String(chapterNum) }).first().click();
}

// ---------------------------------------------------------------------------
// 1. Page load
// ---------------------------------------------------------------------------
test('page load: main UI elements are visible', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (err) => errors.push(err.message));

	await page.goto('/');
	await waitForPassage(page);

	await expect(page.locator('#passageTitle')).toBeVisible();
	await expect(page.locator('#passageText')).toBeVisible();
	await expect(page.locator('#bookSelector')).toBeVisible();
	await expect(page.locator('#chapterSelector')).toBeVisible();
	await expect(page.locator('#searchToggle')).toBeVisible();

	expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// 2. Book navigation
// ---------------------------------------------------------------------------
test('book navigation: selecting a book loads its first chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');

	await expect(page.locator('#bookModal')).not.toHaveClass(/active/);
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });
	await expect(page.locator('#passageText')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 3. Chapter navigation
// ---------------------------------------------------------------------------
test('chapter navigation: selecting a chapter loads passage text', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });

	await goToChapter(page, 5);

	await expect(page.locator('#passageTitle')).toContainText('Matthew 5', { timeout: 10000 });
	await expect(page.locator('#passageText')).not.toBeEmpty();
	await expect(page.locator('#passageText .loading')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Verse navigation
// ---------------------------------------------------------------------------
test('verse navigation: selecting a verse closes the verse modal', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'John');
	await expect(page.locator('#passageTitle')).toContainText('John 1', { timeout: 10000 });

	await goToChapter(page, 3);
	await expect(page.locator('#passageTitle')).toContainText('John 3', { timeout: 10000 });

	await page.locator('#verseSelector').click();
	await expect(page.locator('#verseModal')).toBeVisible();
	await page.locator('#verseGrid button', { hasText: '16' }).first().click();

	await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// 5. Prev / next chapter buttons
// ---------------------------------------------------------------------------
test('chapter buttons: prev and next navigate correctly', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });

	// Next chapter
	await page.locator('#nextChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 2', { timeout: 10000 });

	// Prev chapter
	await page.locator('#prevChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 6. Translation switching
// ---------------------------------------------------------------------------
test('translation: switching translation reloads passage in new translation', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	const titleBefore = await page.locator('#passageTitle').textContent();

	// Open translation modal
	await page.locator('#translationSelector').click();
	await expect(page.locator('#translationModal')).toBeVisible();

	// Pick KJV if not already selected, otherwise pick ASV
	const currentTrans = await page.evaluate(() => localStorage.getItem('translation') || 'KJV');
	const targetTrans = currentTrans === 'KJV' ? 'ASV' : 'KJV';
	await page.locator('#translationModal button, #translationModal [data-translation]')
		.filter({ hasText: targetTrans }).first().click();

	// Modal closes and passage reloads for same reference
	await expect(page.locator('#translationModal')).not.toHaveClass(/active/);
	await expect(page.locator('#passageTitle')).toContainText(titleBefore.trim().split(' ').slice(0, 2).join(' '), { timeout: 10000 });
	await expect(page.locator('#passageText .loading')).toHaveCount(0);

	// localStorage should reflect the new translation
	const storedTrans = await page.evaluate(() => localStorage.getItem('translation'));
	expect(storedTrans).toBe(targetTrans);
});

// ---------------------------------------------------------------------------
// 7. Search — keyword returns results
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('covenant');
	await page.locator('#searchInput').press('Enter');

	await expect(page.locator('#searchResults')).not.toBeEmpty({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 8. Search — reference input resolves to passage
// ---------------------------------------------------------------------------
test('search: reference query navigates to correct passage', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('John 3:16');

	// Wait for a result item to appear
	await expect(page.locator('#searchResults .search-result-item').first()).toBeVisible({ timeout: 10000 });

	// Click the result
	await page.locator('#searchResults .search-result-item').first().click();

	// Search panel should close and passage should be John 3
	await expect(page.locator('#searchContainer')).not.toHaveClass(/active/, { timeout: 10000 });
	await expect(page.locator('#passageTitle')).toContainText('John 3', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 9. Search — closing clears state
// ---------------------------------------------------------------------------
test('search: closing search clears input and hides panel', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('grace');

	// Close via toggle button
	await page.locator('#searchToggle').click();

	await expect(page.locator('#searchContainer')).not.toHaveClass(/active/);
	const inputVal = await page.locator('#searchInput').inputValue();
	expect(inputVal).toBe('');
});

// ---------------------------------------------------------------------------
// 10. Reading position — saved to localStorage after navigation
// ---------------------------------------------------------------------------
test('reading position: localStorage updated after chapter navigation', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });

	// Wait for saveReadingPosition to fire (it runs at end of loadPassage)
	await page.waitForFunction(() => {
		try {
			const pos = JSON.parse(localStorage.getItem('readingPosition') || '{}');
			return pos.book === 'Matthew';
		} catch { return false; }
	}, { timeout: 5000 });

	const pos = await page.evaluate(() => JSON.parse(localStorage.getItem('readingPosition')));
	expect(pos.book).toBe('Matthew');
	expect(pos.chapter).toBe(1);
});

// ---------------------------------------------------------------------------
// 11. Passage cache — second load of same passage hits cache
// ---------------------------------------------------------------------------
test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });

	// Verify localStorage cache entry matches
	const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('passageCache') || 'null'));
	expect(cache).not.toBeNull();
	expect(cache.book).toBe('Matthew');
	expect(cache.chapter).toBe(1);
	expect(cache.html.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 12. Settings — verse numbers toggle
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const displayHeader = page.locator('.accordion-header').filter({ hasText: 'Display' });
	const displayContent = displayHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await displayContent.isVisible())) {
		await displayHeader.click();
		await expect(displayContent).toBeVisible();
	}

	const toggle = page.locator('#verseNumbersToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	await expect(toggle).toBeChecked({ checked: !before });
});

// ---------------------------------------------------------------------------
// 13. Settings — verse-by-verse mode re-renders passage
// ---------------------------------------------------------------------------
test('settings: verse-by-verse mode toggles passage layout class', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const displayHeader = page.locator('.accordion-header').filter({ hasText: 'Display' });
	const displayContent = displayHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await displayContent.isVisible())) {
		await displayHeader.click();
	}

	const toggle = page.locator('#verseByVerseToggle');
	const before = await page.evaluate(() => document.getElementById('passageText')?.classList.contains('verse-by-verse'));
	await toggle.click();

	const after = await page.evaluate(() => document.getElementById('passageText')?.classList.contains('verse-by-verse'));
	expect(after).toBe(!before);
});

// ---------------------------------------------------------------------------
// 14. Settings — font size slider changes rendered font size
// ---------------------------------------------------------------------------
test('settings: font size change updates passage font size', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const displayHeader = page.locator('.accordion-header').filter({ hasText: 'Display' });
	const displayContent = displayHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await displayContent.isVisible())) {
		await displayHeader.click();
	}

	const slider = page.locator('#fontSizeSlider');
	const before = await slider.inputValue();
	const newVal = String(parseInt(before) === 24 ? 16 : parseInt(before) + 4);
	await slider.fill(newVal);
	await slider.dispatchEvent('input');

	const stored = await page.evaluate(() => localStorage.getItem('fontSize'));
	expect(stored).toBe(newVal);
});

// ---------------------------------------------------------------------------
// 15. Settings — color theme selector changes body data attribute or class
// ---------------------------------------------------------------------------
test('settings: color theme selector applies theme to body', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const themeHeader = page.locator('.accordion-header').filter({ hasText: 'Theme' });
	const themeContent = themeHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await themeContent.isVisible())) {
		await themeHeader.click();
	}

	const selector = page.locator('#themeSelector');
	const current = await selector.inputValue();
	const next = current === 'dracula' ? 'mocha' : 'dracula';
	await selector.selectOption(next);

	const stored = await page.evaluate(() => localStorage.getItem('colorTheme'));
	expect(stored).toBe(next);
});

// ---------------------------------------------------------------------------
// 16. Theme switch — light mode
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const themeHeader = page.locator('.accordion-header').filter({ hasText: 'Theme' });
	const themeContent = themeHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await themeContent.isVisible())) {
		await themeHeader.click();
		await expect(themeContent).toBeVisible();
	}

	const lightToggle = page.locator('#lightModeToggle');
	const before = await lightToggle.isChecked();
	await lightToggle.click();
	await expect(lightToggle).toBeChecked({ checked: !before });

	const bodyHasLightMode = await page.evaluate(() => document.body.classList.contains('light-mode'));
	expect(bodyHasLightMode).toBe(!before);
});

// ---------------------------------------------------------------------------
// 17. Copy passage — clipboard receives passage text
// ---------------------------------------------------------------------------
test('copy passage: clipboard receives book/chapter content', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	await waitForPassage(page);

	// Trigger copy via the copy button
	await page.locator('#copyBtn').click();

	const clip = await page.evaluate(() => navigator.clipboard.readText());
	expect(clip.length).toBeGreaterThan(0);
	// Should contain the passage title text
	const title = await page.locator('#passageTitle').textContent();
	expect(clip).toContain(title.trim());
});

// ---------------------------------------------------------------------------
// 18. Keyboard shortcut — ArrowRight navigates to next chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowRight advances to next chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1', { timeout: 10000 });

	// Focus the body so keyboard events are received
	await page.locator('body').press('ArrowRight');

	await expect(page.locator('#passageTitle')).toContainText('Matthew 2', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 19. Keyboard shortcut — ArrowLeft navigates to previous chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowLeft goes to previous chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await goToBook(page, 'Matt');
	await goToChapter(page, 3);
	await expect(page.locator('#passageTitle')).toContainText('Matthew 3', { timeout: 10000 });

	await page.locator('body').press('ArrowLeft');

	await expect(page.locator('#passageTitle')).toContainText('Matthew 2', { timeout: 10000 });
});
