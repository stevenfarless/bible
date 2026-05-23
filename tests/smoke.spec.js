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
	await expect(page.locator('#searchToggle')).toBeVisible();

	expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// 2. Book navigation — open book modal, pick a book, passage updates
// Book buttons render abbreviations (e.g. "Matt"), not full names.
// Selecting a book loads passage directly — it does NOT open a chapter modal.
// ---------------------------------------------------------------------------
test('book navigation: selecting a book loads its first chapter', async ({ page }) => {
	await page.goto('/');

	// Open book modal
	await page.locator('#bookSelector').click();
	await expect(page.locator('#bookModal')).toBeVisible();

	// Pick Matthew — rendered as "Matt"
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();

	// Book modal should close and passage title should update to Matthew 1
	await expect(page.locator('#bookModal')).not.toHaveClass(/active/);
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');
	await expect(page.locator('#passageText')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 3. Chapter navigation — open chapter modal, pick a chapter, content loads
// ---------------------------------------------------------------------------
test('chapter navigation: selecting a chapter loads passage text', async ({ page }) => {
	await page.goto('/');

	// First navigate to Matthew via book modal
	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');

	// Now open the chapter modal and select chapter 5
	await page.locator('#chapterSelector').click();
	await expect(page.locator('#chapterModal')).toBeVisible();
	await page.locator('#chapterGrid button', { hasText: '5' }).first().click();

	// Passage should update to Matthew 5, no lingering loading spinner
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
	await expect(page.locator('#passageText')).not.toBeEmpty();
	await expect(page.locator('#passageText .loading')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Verse navigation — open verse modal, select a verse, modal closes
// Note: scrollToVerse scrolls and applies glow; #currentVerse is reset to
// "1" on each loadPassage so we verify the modal closes, not the span value.
// ---------------------------------------------------------------------------
test('verse navigation: selecting a verse closes the verse modal', async ({ page }) => {
	await page.goto('/');

	// Navigate to John 3 (book button text is 'John')
	await page.locator('#bookSelector').click();
	// Use exact match to avoid matching '1 John', '2 John', '3 John'
	await page.locator('#newTestamentBooks button').filter({ hasText: /^John$/ }).click();
	await expect(page.locator('#passageTitle')).toContainText('John 1');

	// Go to chapter 3
	await page.locator('#chapterSelector').click();
	await expect(page.locator('#chapterModal')).toBeVisible();
	await page.locator('#chapterGrid button', { hasText: '3' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('John 3');

	// Open verse modal and pick verse 16
	await page.locator('#verseSelector').click();
	await expect(page.locator('#verseModal')).toBeVisible();
	await page.locator('#verseGrid button', { hasText: '16' }).first().click();

	// Modal should close after verse selection
	await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// 5. Search — enter a keyword, results container becomes non-empty
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
	await page.goto('/');

	// Open search
	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	// Type a query and wait for async results (up to 10 s for network)
	await page.locator('#searchInput').fill('covenant');
	await page.locator('#searchInput').press('Enter');

	const results = page.locator('#searchResults');
	await expect(results).not.toBeEmpty({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 6. Settings toggle — toggling verse numbers checkbox flips its checked state
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
	await page.goto('/');

	// Open settings modal
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	// Expand Display accordion section if not already open
	// Accordion sections have .accordion-header children with the section label
	const displayHeader = page.locator('.accordion-header').filter({ hasText: 'Display' });
	const displayContent = displayHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-content")]');
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
// 7. Theme switch — toggling light mode adds/removes 'light-mode' on <body>
// The app uses document.body.classList.toggle('light-mode', ...) — not
// data-theme on <html>.
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
	await page.goto('/');

	// Open settings and expand Theme accordion
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const themeHeader = page.locator('.accordion-header').filter({ hasText: 'Theme' });
	const themeContent = themeHeader.locator('xpath=following-sibling::div[contains(@class,"accordion-content")]');
	if (!(await themeContent.isVisible())) {
		await themeHeader.click();
		await expect(themeContent).toBeVisible();
	}

	const lightToggle = page.locator('#lightModeToggle');
	const before = await lightToggle.isChecked();

	await lightToggle.click();
	await expect(lightToggle).toBeChecked({ checked: !before });

	// Verify body reflects the change via 'light-mode' class
	const bodyHasLightMode = await page.evaluate(
		() => document.body.classList.contains('light-mode')
	);
	expect(bodyHasLightMode).toBe(!before);
});
