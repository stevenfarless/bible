// @ts-check
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper — waits until the BibleApp has attached its event listeners.
// app.js sets data-app-ready on <body> immediately after
// attachEventListeners() + initializeAccordion() complete, before the
// Firebase auth callback resolves. This is the earliest point at which
// clicking any button will have an effect.
// ---------------------------------------------------------------------------
async function waitForApp(page) {
	await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Helper — waits until the initial passage load has settled.
// data-app-ready fires before the RTDB fetch completes on a cache miss.
// Interacting with the book/chapter modal before the fetch finishes causes
// the RTDB response to overwrite the selection. Wait for the loading
// indicator to clear and passageTitle to contain text before proceeding.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helper — opens the settings modal and expands the named accordion section.
// Avoids repeating the same accordion-open preamble in every settings test.
// ---------------------------------------------------------------------------
async function openSettingsSection(page, sectionLabel) {
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const header = page.locator('.accordion-header').filter({ hasText: sectionLabel });
	const panel = header.locator('xpath=following-sibling::div[contains(@class,"accordion-panel")]');
	if (!(await panel.isVisible())) {
		await header.click();
		await expect(panel).toBeVisible();
	}
}

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
	await waitForPassage(page);

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
	await waitForPassage(page);

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
	await waitForPassage(page);

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
// 5. Chapter buttons — prev/next navigate correctly
// ---------------------------------------------------------------------------
test('chapter buttons: prev and next navigate correctly', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Navigate to Matthew 5
	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');
	await page.locator('#chapterSelector').click();
	await page.locator('#chapterGrid button', { hasText: '5' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');

	// Next chapter
	await page.locator('#nextChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 6');

	// Previous chapter
	await page.locator('#prevChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
});

// ---------------------------------------------------------------------------
// 6. Translation — switching translation reloads passage in new translation
// #translationSelector lives inside the Display accordion in settings modal.
// ---------------------------------------------------------------------------
test('translation: switching translation reloads passage in new translation', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Open settings and expand Display accordion so #translationSelector is visible
	await openSettingsSection(page, 'Display');

	const selector = page.locator('#translationSelector');
	await expect(selector).toBeVisible();

	// Pick KJV if not already selected, otherwise pick ASV
	const current = await selector.inputValue();
	const next = current === 'kjv' ? 'asv' : 'kjv';
	await selector.selectOption(next);

	// Close settings and confirm translation label updated
	await page.locator('#closeSettingsModal').click();
	await expect(page.locator('#currentTranslation')).toContainText(next.toUpperCase());
});

// ---------------------------------------------------------------------------
// 7. Search — enter a keyword, results container becomes non-empty
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

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
// 8. Search — reference query navigates to correct passage
// ---------------------------------------------------------------------------
test('search: reference query navigates to correct passage', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('John 3:16');
	await page.locator('#searchInput').press('Enter');

	await expect(page.locator('#passageTitle')).toContainText('John 3', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 9. Search — closing search clears input and hides panel
// ---------------------------------------------------------------------------
test('search: closing search clears input and hides panel', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();
	await page.locator('#searchInput').fill('grace');

	await page.locator('#closeSearch').click();
	await expect(page.locator('#searchContainer')).not.toBeVisible();
	await expect(page.locator('#searchInput')).toHaveValue('');
});

// ---------------------------------------------------------------------------
// 10. Reading position — localStorage updated after chapter navigation
// ---------------------------------------------------------------------------
test('reading position: localStorage updated after chapter navigation', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#nextChapter').click();
	await page.waitForFunction(
		() => {
			const pos = localStorage.getItem('readingPosition');
			if (!pos) return false;
			try { JSON.parse(pos); return true; } catch { return false; }
		},
		{ timeout: 5000 }
	);

	const raw = await page.evaluate(() => localStorage.getItem('readingPosition'));
	const pos = JSON.parse(raw);
	expect(pos).toHaveProperty('book');
	expect(pos).toHaveProperty('chapter');
});

// ---------------------------------------------------------------------------
// 11. Passage cache — navigating back to a visited passage writes cache
// ---------------------------------------------------------------------------
test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#nextChapter').click();
	await expect(page.locator('#passageTitle')).not.toBeEmpty();

	await page.locator('#prevChapter').click();
	await expect(page.locator('#passageTitle')).not.toBeEmpty();

	const cacheKeys = await page.evaluate(() =>
		Object.keys(localStorage).filter((k) => k.startsWith('passage_'))
	);
	expect(cacheKeys.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 12. Settings — toggling verse numbers checkbox changes its state
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'Display');

	const toggle = page.locator('#verseNumbersToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	await expect(toggle).toBeChecked({ checked: !before });
});

// ---------------------------------------------------------------------------
// 13. Settings — verse-by-verse mode toggles passage layout class
// ---------------------------------------------------------------------------
test('settings: verse-by-verse mode toggles passage layout class', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await openSettingsSection(page, 'Display');

	const toggle = page.locator('#verseByVerseToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	await expect(toggle).toBeChecked({ checked: !before });

	const hasClass = await page.evaluate(() =>
		document.getElementById('passageText')?.classList.contains('verse-by-verse')
	);
	expect(hasClass).toBe(!before);
});

// ---------------------------------------------------------------------------
// 14. Settings — font size change updates passage font size
// ---------------------------------------------------------------------------
test('settings: font size change updates passage font size', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'Display');

	const slider = page.locator('#fontSizeSlider');
	await slider.fill('24');
	await slider.dispatchEvent('input');

	const fontSize = await page.evaluate(() =>
		document.getElementById('passageText')?.style.fontSize
	);
	expect(fontSize).toBe('24px');
});

// ---------------------------------------------------------------------------
// 15. Settings — color theme selector applies theme to body
// #themeSelector lives inside the Theme accordion in settings modal.
// ---------------------------------------------------------------------------
test('settings: color theme selector applies theme to body', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	// Open settings and expand Theme accordion so #themeSelector is visible
	await openSettingsSection(page, 'Theme');

	const selector = page.locator('#themeSelector');
	await expect(selector).toBeVisible();

	const current = await selector.inputValue();
	const next = current === 'dracula' ? 'mocha' : 'dracula';
	await selector.selectOption(next);

	const stored = await page.evaluate(() => localStorage.getItem('colorTheme'));
	expect(stored).toBe(next);
});

// ---------------------------------------------------------------------------
// 16. Theme switch — toggling light mode adds/removes 'light-mode' on <body>
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'Theme');

	const lightToggle = page.locator('#lightModeToggle');
	const before = await lightToggle.isChecked();

	await lightToggle.click();
	await expect(lightToggle).toBeChecked({ checked: !before });

	const bodyHasLightMode = await page.evaluate(
		() => document.body.classList.contains('light-mode')
	);
	expect(bodyHasLightMode).toBe(!before);
});

// ---------------------------------------------------------------------------
// 17. Copy passage — clipboard receives book/chapter content
// Requires clipboard-read/write permissions (set in playwright.config.js).
// ---------------------------------------------------------------------------
test('copy passage: clipboard receives book/chapter content', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#copyBtn').click();

	const clip = await page.evaluate(() => navigator.clipboard.readText());
	expect(clip.length).toBeGreaterThan(0);
	// Should contain the passage title text
	const title = await page.locator('#passageTitle').textContent();
	expect(clip).toContain(title.trim());
});

// ---------------------------------------------------------------------------
// 18. Keyboard — ArrowRight advances to next chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowRight advances to next chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	const before = await page.locator('#currentChapter').textContent();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#currentChapter')).not.toHaveText(before, { timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 19. Keyboard — ArrowLeft goes to previous chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowLeft goes to previous chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Advance first so we have somewhere to go back to
	await page.keyboard.press('ArrowRight');
	const mid = await page.locator('#currentChapter').textContent();

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#currentChapter')).not.toHaveText(mid, { timeout: 5000 });
});
