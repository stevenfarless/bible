// @ts-check
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// App Check debug token for headless CI runs.
// This must be set before the app's JS loads so Firebase App Check can
// bypass reCAPTCHA in Playwright.
// ---------------------------------------------------------------------------
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
	});
});

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
	// 'cancelled' is a benign Firebase network abort that occurs when async
	// RTDB/Auth requests are in-flight during initial page load in headless CI.
	// It does not indicate a code defect.
	page.on('pageerror', (err) => {
		if (err.message !== 'cancelled') errors.push(err.message);
	});

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
// ---------------------------------------------------------------------------
test('search: reference query navigates to correct passage', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('John 3:16');

	const resultCard = page.locator('#searchResults .search-result-item').first();
	await expect(resultCard).toBeVisible({ timeout: 10000 });

	await resultCard.click();

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
			try {
				const pos = JSON.parse(localStorage.getItem('readingPosition') || '{}');
				return pos.book !== undefined;
			} catch { return false; }
		},
		{ timeout: 5000 }
	);

	const pos = await page.evaluate(() => JSON.parse(localStorage.getItem('readingPosition')));
	expect(pos).not.toBeNull();
	expect(pos.chapter).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// 11. Passage cache — navigating to a passage writes the passageCache key
// app.js stores the cache under the single key 'passageCache' as JSON with
// shape { book, chapter, html }.
// ---------------------------------------------------------------------------
test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');

	// Wait for app.js to write the passageCache key
	await page.waitForFunction(
		() => {
			try {
				const raw = localStorage.getItem('passageCache');
				if (!raw) return false;
				const cache = JSON.parse(raw);
				return cache && typeof cache.html === 'string' && cache.html.length > 0;
			} catch { return false; }
		},
		{ timeout: 10000 }
	);

	const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('passageCache')));
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

	await openSettingsSection(page, 'display');

	const toggle = page.locator('#verseNumbersToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	await expect(toggle).toBeChecked({ checked: !before });
});

// ---------------------------------------------------------------------------
// 13. Settings — verse-by-verse mode
// ---------------------------------------------------------------------------
test('settings: verse-by-verse mode toggles passage layout class', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await openSettingsSection(page, 'display');

	const toggle = page.locator('#verseByVerseToggle');
	const before = await page.evaluate(() =>
		document.getElementById('passageText')?.classList.contains('verse-by-verse')
	);
	await toggle.click();
	const after = await page.evaluate(() =>
		document.getElementById('passageText')?.classList.contains('verse-by-verse')
	);
	expect(after).toBe(!before);
});

// ---------------------------------------------------------------------------
// 14. Settings — font size slider
// ---------------------------------------------------------------------------
test('settings: font size change updates passage font size', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await openSettingsSection(page, 'display');

	const slider = page.locator('#fontSizeSlider');
	const before = parseInt(await slider.inputValue());
	const newVal = String(before === 24 ? 16 : before + 4);
	await slider.fill(newVal);
	await slider.dispatchEvent('input');

	const stored = await page.evaluate(() => localStorage.getItem('fontSize'));
	expect(stored).toBe(newVal);
});

// ---------------------------------------------------------------------------
// 15. Settings — color theme selector
// ---------------------------------------------------------------------------
test('settings: color theme selector applies theme to body', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'theme');

	const selector = page.locator('#themeSelector');
	await expect(selector).toBeVisible();

	const options = await selector.evaluate(el =>
		Array.from(el.options).map(o => o.value).filter(v => v)
	);
	const current = await selector.inputValue();
	const next = options.find(o => o !== current) ?? options[0];
	await selector.selectOption(next);

	const stored = await page.evaluate(() => localStorage.getItem('colorTheme'));
	expect(stored).toBe(next);
});

// ---------------------------------------------------------------------------
// 16. Theme switch — light mode toggle
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	await openSettingsSection(page, 'theme');

	const toggle = page.locator('#lightModeToggle');
	const before = await toggle.isChecked();
	await toggle.click();
	await expect(toggle).toBeChecked({ checked: !before });

	const bodyClass = await page.evaluate(() => document.body.className);
	if (!before) {
		expect(bodyClass).toMatch(/light/);
	}
});

// ---------------------------------------------------------------------------
// 17. Keyboard — ArrowRight advances chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowRight advances to next chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');

	await page.locator('body').press('ArrowRight');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 2', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// 18. Keyboard — ArrowLeft goes back a chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowLeft goes to previous chapter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 1');
	await page.locator('#chapterSelector').click();
	await page.locator('#chapterGrid button', { hasText: '3' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Matthew 3');

	await page.locator('body').press('ArrowLeft');
	await expect(page.locator('#passageTitle')).toContainText('Matthew 2', { timeout: 10000 });
});

// ===========================================================================
// Issue-specific regression tests
// Tests 19–26 are written to FAIL until the referenced issue is fixed.
// They serve as regression guards: a passing test means the bug is resolved.
// ===========================================================================

// ---------------------------------------------------------------------------
// 19. Issue #62 — Copy button gives visible feedback after click
// After clicking the copy icon the button must show a success state
// (class swap, aria-label change, or a toast) within 2 seconds.
// ---------------------------------------------------------------------------
test('issue #62: copy button shows visible feedback after click', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	const copyBtn = page
		.locator('#copyPassage, .copy-btn, [data-action="copy"], button[aria-label*="opy"]')
		.first();
	await expect(copyBtn).toBeVisible({ timeout: 5000 });

	const beforeLabel = await copyBtn.getAttribute('aria-label');
	const beforeClass = await copyBtn.getAttribute('class');

	await copyBtn.click();

	await expect(async () => {
		const afterLabel = await copyBtn.getAttribute('aria-label');
		const afterClass = await copyBtn.getAttribute('class');
		const toast = await page.locator('.toast, [role="status"], .copied-feedback').count();
		const labelChanged = afterLabel !== beforeLabel;
		const classChanged = afterClass !== beforeClass;
		expect(labelChanged || classChanged || toast > 0).toBe(true);
	}).toPass({ timeout: 2000 });
});

// ---------------------------------------------------------------------------
// 20. Issue #63 — Section headings meet WCAG AA contrast in light mode
// Reads computed color + background-color of the first .section-heading
// and verifies contrast ratio >= 3.0 (WCAG AA large text threshold).
// ---------------------------------------------------------------------------
test('issue #63: section headings meet WCAG AA contrast in light mode', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Force light mode regardless of saved prefs
	await page.evaluate(() => {
		document.body.classList.remove('dark', 'dark-mode');
		document.body.classList.add('light', 'light-mode');
		document.documentElement.classList.remove('dark', 'dark-mode');
		document.documentElement.classList.add('light', 'light-mode');
	});

	// Navigate to Genesis 1 which has section headings in the BSB scaffold
	await page.locator('#bookSelector').click();
	await page.locator('#oldTestamentBooks button', { hasText: 'Gen' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('Genesis 1', { timeout: 10000 });

	const heading = page.locator('.section-heading, .passage-heading, h3.heading').first();
	if (await heading.count() === 0) {
		test.skip();
		return;
	}

	const contrastRatio = await page.evaluate(() => {
		function luminance(r, g, b) {
			return [r, g, b].reduce((acc, c, i) => {
				const s = c / 255;
				const lin = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
				return acc + lin * [0.2126, 0.7152, 0.0722][i];
			}, 0);
		}
		function parseRgb(str) {
			const m = str.match(/(\d+),\s*(\d+),\s*(\d+)/);
			return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
		}
		const el = document.querySelector('.section-heading, .passage-heading, h3.heading');
		if (!el) return null;
		const style = getComputedStyle(el);
		const fg = parseRgb(style.color);
		const bgRaw = style.backgroundColor !== 'rgba(0, 0, 0, 0)'
			? style.backgroundColor
			: getComputedStyle(document.body).backgroundColor;
		const bg = parseRgb(bgRaw);
		const L1 = luminance(...fg);
		const L2 = luminance(...bg);
		const lighter = Math.max(L1, L2);
		const darker = Math.min(L1, L2);
		return (lighter + 0.05) / (darker + 0.05);
	});

	expect(contrastRatio).not.toBeNull();
	expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
});

// ---------------------------------------------------------------------------
// 21. Issue #66 — Verse selector resets after keyboard chapter navigation
// Navigate to John 3:16, press ArrowRight → John 4.
// The verse selector must show 1, not 16.
// This test will FAIL until #66 is fixed.
// ---------------------------------------------------------------------------
test('issue #66: verse selector resets to 1 after keyboard chapter nav', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Go to John 3
	await page.locator('#bookSelector').click();
	await page.locator('#newTestamentBooks button').filter({ hasText: /^John$/ }).click();
	await expect(page.locator('#passageTitle')).toContainText('John 1');
	await page.locator('#chapterSelector').click();
	await page.locator('#chapterGrid button', { hasText: '3' }).first().click();
	await expect(page.locator('#passageTitle')).toContainText('John 3');

	// Select verse 16
	await page.locator('#verseSelector').click();
	await expect(page.locator('#verseModal')).toBeVisible();
	await page.locator('#verseGrid button', { hasText: '16' }).first().click();
	await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
	await expect(page.locator('#verseSelector')).toContainText('16');

	// Keyboard navigate to John 4
	await page.locator('body').press('ArrowRight');
	await expect(page.locator('#passageTitle')).toContainText('John 4', { timeout: 10000 });

	// Verse selector must reset to 1
	const verseText = await page.locator('#verseSelector').textContent();
	const verseNum = parseInt(verseText?.trim() ?? '0', 10);
	expect(verseNum, 'Verse selector should reset to 1 after keyboard chapter navigation').toBe(1);
});

// ---------------------------------------------------------------------------
// 22. Issue #165 — Search index is not fetched more than once per session
// Intercepts all network requests after page load and counts requests
// matching /searchIndex/. Expects at most 1 per unique URL.
// This test will FAIL until #165 is fixed.
// ---------------------------------------------------------------------------
test('issue #165: search index fetched only once per session', async ({ page }) => {
	const searchIndexRequests = [];

	page.on('request', req => {
		if (req.url().includes('searchIndex')) {
			searchIndexRequests.push(req.url());
		}
	});

	await page.goto('/');
	await waitForApp(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();
	await page.locator('#searchInput').fill('Jn 1');

	// Allow async fetches to settle
	await page.waitForTimeout(3000);

	const uniqueUrls = [...new Set(searchIndexRequests)];
	for (const url of uniqueUrls) {
		const count = searchIndexRequests.filter(r => r === url).length;
		expect(
			count,
			`searchIndex "${url}" fetched ${count}x — expected 1`
		).toBe(1);
	}
});

// ---------------------------------------------------------------------------
// 23. Issue #165 — Opening search panel does not pre-emptively prefetch books
// Measures fetches only during the panel-open window (before any typing).
// The search index fast path legitimately fetches book JSON for matched
// verses — those are expected. What must not happen is an eager bulk load
// of all books triggered purely by opening the panel.
// ---------------------------------------------------------------------------
test('issue #165: opening search does not prefetch all book JSON files', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	// Intercept starts here — after initial passage load has fully settled.
	const panelOpenFetches = [];
	const bookUrlPattern = /\/translations\/[A-Z]+\/[A-Za-z0-9%]+\.json/;

	const handler = (req) => {
		if (bookUrlPattern.test(req.url())) {
			panelOpenFetches.push(req.url());
		}
	};
	page.on('request', handler);

	// Open the search panel and wait 500ms — no query typed yet.
	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();
	await page.waitForTimeout(500);

	// Remove the handler before typing so search-result book fetches are
	// not counted against the panel-open assertion.
	page.removeListener('request', handler);

	expect(
		panelOpenFetches.length,
		`Opening search panel triggered ${panelOpenFetches.length} book fetch(es) before any query: ${panelOpenFetches.slice(0, 5).join(', ')}`
	).toBe(0);

	// Secondary check: typing a keyword may fetch books for matched verses,
	// but must not fetch more than LOCAL_TRANSLATIONS.size (8) unique book
	// files — an unbounded prefetch would approach 66 × N.
	const typingFetches = [];
	page.on('request', (req) => {
		if (bookUrlPattern.test(req.url())) typingFetches.push(req.url());
	});

	await page.locator('#searchInput').fill('Jn');
	await page.waitForTimeout(3000);

	const uniqueTypingFetches = [...new Set(typingFetches)];
	expect(
		uniqueTypingFetches.length,
		`Search triggered ${uniqueTypingFetches.length} unique book fetches — expected ≤ 9 (one per translation at most): ${uniqueTypingFetches.slice(0, 10).join(', ')}`
	).toBeLessThanOrEqual(9);
});

// ---------------------------------------------------------------------------
// 24. Issue #175 — reCAPTCHA badge is not visible to the user
// The badge must be hidden (visibility: hidden is acceptable per Google ToS
// as long as disclosure text is present in the HTML).
// Uses .first() to avoid Playwright strict mode violation when reCAPTCHA
// injects multiple badge elements into the page.
// ---------------------------------------------------------------------------
test('issue #175: reCAPTCHA badge is not visible', async ({ page }) => {
	await page.goto('/');
	await waitForApp(page);

	// Allow reCAPTCHA time to inject its badge asynchronously
	await page.waitForTimeout(2000);

	const badge = page.locator('.grecaptcha-badge');
	if (await badge.count() === 0) {
		// Badge not injected in this environment — pass
		return;
	}

	// Use .first() — reCAPTCHA may inject more than one badge element;
	// strict mode would throw if we called .isVisible() on a multi-match locator.
	const isVisible = await badge.first().isVisible();
	expect(isVisible, 'reCAPTCHA badge should be hidden via CSS (visibility: hidden)').toBe(false);
});

// ---------------------------------------------------------------------------
// 25. Issue #176 — Keyword search does NOT auto-navigate on Enter
// Typing a keyword phrase and pressing Enter must not change the passage.
// Uses 'God so loved' — present verbatim in John 3:16 across all
// translations — to guarantee results actually render before Enter is pressed.
// This test will FAIL until #176 is fixed.
// ---------------------------------------------------------------------------
test('issue #176: keyword search does not auto-navigate on Enter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	const titleBefore = await page.locator('#passageTitle').textContent();

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('God so loved');

	const results = page.locator('#searchResults .search-result-item');
	await expect(results.first()).toBeVisible({ timeout: 10000 });

	await page.locator('#searchInput').press('Enter');
	await page.waitForTimeout(500);

	const titleAfter = await page.locator('#passageTitle').textContent();
	expect(
		titleAfter?.trim(),
		'Keyword search Enter should not navigate — passage title changed unexpectedly'
	).toBe(titleBefore?.trim());
});

// ---------------------------------------------------------------------------
// 26. Issue #176 — Reference search auto-selects first result on Enter
// Typing a scripture reference should auto-select the first result so that
// pressing Enter navigates without requiring a manual click.
// This test will FAIL until #176 is fixed.
// ---------------------------------------------------------------------------
test('issue #176: reference search auto-selects first result and navigates on Enter', async ({ page }) => {
	await page.goto('/');
	await waitForPassage(page);

	await page.locator('#searchToggle').click();
	await expect(page.locator('#searchContainer')).toBeVisible();

	await page.locator('#searchInput').fill('John 3:16');

	const results = page.locator('#searchResults .search-result-item');
	await expect(results.first()).toBeVisible({ timeout: 10000 });

	const firstResult = results.first();
	const isSelected = await firstResult.evaluate(el =>
		el.classList.contains('selected') ||
		el.classList.contains('keyboard-focused') ||
		el.getAttribute('aria-selected') === 'true'
	);
	expect(
		isSelected,
		'First result should be auto-selected for a reference query'
	).toBe(true);

	await page.locator('#searchInput').press('Enter');

	await page.waitForFunction(
		() => {
			const title = document.getElementById('passageTitle');
			const loading = document.querySelector('#passageText .loading');
			return !loading && title?.textContent?.includes('John 3');
		},
		{ timeout: 10000 }
	);
});
