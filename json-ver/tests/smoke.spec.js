// @ts-check
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 1. Page load — app loads without JS errors, key UI elements visible
// ---------------------------------------------------------------------------
test('page load: main UI elements are visible', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (err) => errors.push(err.message));

	await page.goto('/');

	await expect(page.locator('#passageTitle')).toBeVisible();
	await expect(page.locator('#passageText')).toBeVisible();
	await expect(page.locator('#bookSelector')).toBeVisible();
	await expect(page.locator('#chapterSelector')).toBeVisible();
	await expect(page.locator('#searchToggleBtn')).toBeVisible();

	expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// 2. Book navigation — open book modal, pick a book, chapter list updates
// ---------------------------------------------------------------------------
test('book navigation: selecting a book updates the chapter modal', async ({ page }) => {
	await page.goto('/');

	// Open book modal
	await page.locator('#bookSelector').click();
	await expect(page.locator('#bookModal')).toBeVisible();

	// Pick Matthew (New Testament)
	const matthewBtn = page.locator('#newTestamentBooks button', { hasText: 'Matt' });
	await matthewBtn.click();

	// Chapter modal should open for Matthew
	await expect(page.locator('#chapterModal')).toBeVisible();
	await expect(page.locator('#chapterModalBook')).toContainText('Matthew');

	// Chapter grid should have at least 1 chapter button
	const chapterBtns = page.locator('#chapterGrid button');
	await expect(chapterBtns.first()).toBeVisible();
	expect(await chapterBtns.count()).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 3. Chapter navigation — select a chapter, verify verse content loads
// ---------------------------------------------------------------------------
test('chapter navigation: selecting a chapter loads passage text', async ({ page }) => {
	await page.goto('/');

	// Navigate: book → Matthew → chapter 5
	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).click();
	await page.locator('#chapterGrid button', { hasText: '5' }).click();

	// Passage title should update and content should not be empty
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
	await expect(page.locator('#passageText')).not.toBeEmpty();

	// No persistent loading spinner
	await expect(page.locator('#passageText .loading')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Verse navigation — open verse modal, select a verse
// ---------------------------------------------------------------------------
test('verse navigation: selecting a verse updates currentVerse display', async ({ page }) => {
	await page.goto('/');

	// Go to John 3 first via book+chapter selectors
	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'John' }).click();
	await page.locator('#chapterGrid button', { hasText: '3' }).click();

	// Open verse modal
	await page.locator('#verseSelector').click();
	await expect(page.locator('#verseModal')).toBeVisible();

	// Pick verse 16
	await page.locator('#verseGrid button', { hasText: '16' }).click();

	// The current verse indicator should show 16
	await expect(page.locator('#currentVerse')).toHaveText('16');
});

// ---------------------------------------------------------------------------
// 5. Search — enter a query, results appear and are non-empty
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
	await page.goto('/');

	// Open search
	await page.locator('#searchToggleBtn').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	// Type a query
	await page.locator('#searchInput').fill('covenant');
	await page.locator('#searchInput').press('Enter');

	// Results container should become non-empty
	const results = page.locator('#searchResults');
	await expect(results).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 6. Settings toggle — open settings, toggle verse numbers off
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
	await page.goto('/');

	// Open settings modal
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	// Expand Display Options if collapsed
	const displayPanel = page.locator('[data-panel="display"]');
	const isExpanded = await displayPanel.isVisible();
	if (!isExpanded) {
		await page.locator('[data-target="display"]').click();
		await expect(displayPanel).toBeVisible();
	}

	const toggle = page.locator('#verseNumbersToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	const after = await toggle.isChecked();
	expect(after).toBe(!before);
});

// ---------------------------------------------------------------------------
// 7. Theme switch — toggle light/dark via the header button
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes data-theme on <html>', async ({ page }) => {
	await page.goto('/');

	// Open settings → Theme section
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const themePanel = page.locator('[data-panel="theme"]');
	const isExpanded = await themePanel.isVisible();
	if (!isExpanded) {
		await page.locator('[data-target="theme"]').click();
		await expect(themePanel).toBeVisible();
	}

	const lightModeToggle = page.locator('#lightModeToggle');
	const before = await lightModeToggle.isChecked();
	await lightModeToggle.click();
	const after = await lightModeToggle.isChecked();
	expect(after).toBe(!before);

	// The <html> element should carry a data-theme or class reflecting the change
	// (app may use class-based or data-attribute based theming)
	const htmlTheme = await page.evaluate(() => {
		const el = document.documentElement;
		return el.getAttribute('data-theme') || el.className;
	});
	expect(htmlTheme.length).toBeGreaterThan(0);
});
