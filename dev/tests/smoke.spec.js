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
// The accordion toggles 'active' on the parent .accordion-section element;
// panels are visible when the section has that class.
// ---------------------------------------------------------------------------
async function openSettingsSection(page, sectionDataValue) {
	await page.locator('#settingsBtn').click();
	await expect(page.locator('#settingsModal')).toBeVisible();

	const section = page.locator(`.accordion-section[data-section="${sectionDataValue}"]`);
	const isActive = await section.evaluate(el => el.classList.contains('active'));
	if (!isActive) {
		await section.locator('.accordion-header').click();
		await expect(section).toHaveClass(/active/);
	}
	await expect(section.locator('.accordion-panel')).toBeVisible();
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
// ---------------------------------------------------------------------------
test('book navigation: selecting a book loads its first chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await expect(page.locator('#bookModal')).toBeVisible();

	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();

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

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');

	await page.locator('#chapterSelector').click();
	await expect(page.locator('#chapterModal')).toBeVisible();
	await page.locator('#chapterGrid button', { hasText: '5' }).first().click();

	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
	await expect(page.locator('#passageText')).not.toBeEmpty();
	await expect(page.locator('#passageText .loading')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Verse navigation — open verse modal, select a verse, modal closes
// ---------------------------------------------------------------------------
test('verse navigation: selecting a verse closes the verse modal', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button').filter({ hasText: /^John$/ }).click();
	await expect(page.locator('#passageTitle')).toContainText('John 1');

	await page.locator('#chapterSelector').click();
	await expect(page.locator('#chapterModal')).toBeVisible();
	await page.locator('#chapterGrid button', { hasText: '3' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('John 3');

	await page.locator('#verseSelector').click();
	await expect(page.locator('#verseModal')).toBeVisible();
	await page.locator('#verseGrid button', { hasText: '16' }).first().click();

	await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
});

// ---------------------------------------------------------------------------
// 5. Chapter buttons — prev/next navigate correctly
// ---------------------------------------------------------------------------
test('chapter buttons: prev and next navigate correctly', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');
	await page.locator('#chapterSelector').click();
	await page.locator('#chapterGrid button', { hasText: '5' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');

	await page.locator('#nextChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 6');

	await page.locator('#prevChapter').click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
});

// ---------------------------------------------------------------------------
// 6. Translation — switching translation reloads passage in new translation
// #translationSelector is inside the Display accordion and its options are
// populated asynchronously from RTDB via _loadTranslationRegistry().
// Option values are uppercase IDs (e.g. 'KJV', 'BSB').
// ---------------------------------------------------------------------------
test('translation: switching translation reloads passage in new translation', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Open settings and expand the Display accordion
	await openSettingsSection(page, 'display');

	const selector = page.locator('#translationSelector');

	// Wait for options to be populated by _loadTranslationRegistry()
	await page.waitForFunction(
		() => document.getElementById('translationSelector')?.options.length > 0,
		{ timeout: 10000 }
	);
	await expect(selector).toBeVisible();

	// Pick BSB if KJV is selected, otherwise pick KJV
	const current = await selector.inputValue();
	const next = current === 'KJV' ? 'BSB' : 'KJV';
	await selector.selectOption(next);

	// Close settings and confirm the nav badge updated
	await page.locator('#closeSettingsModal').click();
	await expect(page.locator('#currentTranslation')).toContainText(next, { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 7. Search — enter a keyword, results container becomes non-empty
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('covenant');
	await page.locator('#searchInput').press('Enter');

	const results = page.locator('#searchResults');
	await expect(results).not.toBeEmpty({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 8. Search — reference query navigates to correct passage
//
// handlePassageReference() (search.js) fetches a preview via bibleApi and
// renders a single .search-result-item card — it does NOT call loadPassage
// itself. The Enter key activates the first selected result item via
// activateSelectedSearchResult → item.click(), which then calls
// loadPassageFromReference → loadPassage.
//
// Strategy: fill the input, wait for the result card to appear (confirming
// the 300 ms debounce + RTDB fetch completed), then click the card and wait
// for the passage title to update.
// ---------------------------------------------------------------------------
test('search: reference query navigates to correct passage', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('John 3:16');

	// Wait for handlePassageReference to render the result card
	const resultCard = page.locator('#searchResults .search-result-item').first();
	await expect(resultCard).toBeVisible({ timeout: 10000 });

	// Click the card — this triggers loadPassageFromReference → loadPassage
	await resultCard.click();

	// Wait for the passage to finish loading
	await page.waitForFunction(
		() => {
			const title = document.getElementById('passageTitle');
			const loading = document.querySelector('#passageText .loading');
			return !loading && title?.textContent?.includes('John 3');
		},
		{ timeout: 15000 }
	);
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
// 11. Passage cache — navigating to a new passage writes to passageCache
// app.js uses a single localStorage key 'passageCache' (not 'passage_*').
// After navigation the cache entry's book/chapter should match the new passage.
// ---------------------------------------------------------------------------
test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	const titleBefore = await page.locator('#passageTitle').textContent();

	await page.locator('#nextChapter').click();
	// Wait for the title to change, confirming loadPassage ran and wrote the cache
	await expect(page.locator('#passageTitle')).not.toHaveText(titleBefore, { timeout: 10000 });

	const raw = await page.evaluate(() => localStorage.getItem('passageCache'));
	expect(raw).not.toBeNull();
	const cache = JSON.parse(raw);
	expect(cache).toHaveProperty('book');
	expect(cache).toHaveProperty('chapter');
	expect(cache).toHaveProperty('html');
});

// ---------------------------------------------------------------------------
// 12. Settings — toggling verse numbers checkbox changes its state
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'display');

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

	await openSettingsSection(page, 'display');

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

	await openSettingsSection(page, 'display');

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
// #themeSelector is inside the Theme accordion. Options: dracula, steel, onyx, parchment.
// ---------------------------------------------------------------------------
test('settings: color theme selector applies theme to body', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'theme');

	const selector = page.locator('#themeSelector');
	await expect(selector).toBeVisible();

	const current = await selector.inputValue();
	const next = current === 'dracula' ? 'steel' : 'dracula';
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

	await openSettingsSection(page, 'theme');

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
//
// copyPassage() (app.js) calls navigator.clipboard.writeText(...).
// navigator.clipboard.readText() returns empty in headless Chromium even with
// clipboard-read permission because the page lacks document focus inside
// page.evaluate(). page.evaluate() after goto() also cannot override
// ClipboardAPI.writeText — the native property descriptor is non-writable.
//
// Fix: addInitScript installs the mock before any page JS runs, and
// Object.defineProperty forces the override on the non-configurable descriptor.
// The stub captures the written text in window.__clipboardText; the toast
// confirms the Promise resolved before we read it back.
// ---------------------------------------------------------------------------
test('copy passage: clipboard receives book/chapter content', async ({ page }) => {
	// Must be registered before goto() so it runs before BibleApp initialises.
	await page.addInitScript(() => {
		window.__clipboardText = '';
		Object.defineProperty(navigator.clipboard, 'writeText', {
			configurable: true,
			value: (text) => {
				window.__clipboardText = text;
				return Promise.resolve();
			},
		});
	});

	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#copyBtn').click();

	// Toast confirms the .then() callback ran (Promise resolved)
	await expect(page.locator('#toast')).toHaveClass(/show/, { timeout: 5000 });

	const clip = await page.evaluate(() => window.__clipboardText);
	expect(clip.length).toBeGreaterThan(0);
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

	await page.keyboard.press('ArrowRight');
	const mid = await page.locator('#currentChapter').textContent();

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#currentChapter')).not.toHaveText(mid, { timeout: 5000 });
});
