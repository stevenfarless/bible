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
// Helper — makes the nav chrome visible so #prevChapter / #nextChapter can
// be clicked. Bypasses the showChrome() guard by setting chromeHidden and
// removing chrome-hidden directly, so scroll events that ran between
// waitForPassage and this call cannot leave the chrome hidden.
// ---------------------------------------------------------------------------
async function showChrome(page) {
        await page.evaluate(() => {
                document.body.classList.add('chrome-no-transition');
                if (window._bibleApp) {
                        window._bibleApp.chromeHidden = false;
                        document.body.classList.remove('chrome-hidden');
                }
        });
        await page.waitForSelector('#nextChapter', { state: 'visible', timeout: 5000 });
        await page.evaluate(() => document.body.classList.remove('chrome-no-transition'));
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
// Helper — switches translation via the translation modal and waits for the
// passage to reload in the new translation.
// Items have no data attribute; the translation ID is the text content of
// the .translation-modal-item__name span inside each list item.
// ---------------------------------------------------------------------------
async function switchTranslation(page, translationId) {
        await page.locator('#translationSelectorBtn').click();
        await expect(page.locator('#translationModal')).toBeVisible();
        await page.waitForFunction(
                () => document.querySelectorAll('.translation-modal-item').length > 0,
                { timeout: 10000 }
        );
        await page
                .locator('.translation-modal-item')
                .filter({ has: page.locator('.translation-modal-item__name', { hasText: translationId }) })
                .click();
        await expect(page.locator('#translationModal')).not.toHaveClass(/active/);
        await waitForPassage(page);
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


test('book selector: testament filters toggle sections from canon data', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        const modalContent = page.locator('#bookModal .modal-content');
        await expect.poll(() => modalContent.evaluate((element) => element.style.height)).not.toBe('');
        const initialBookModalHeight = await modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        );

        const oldSection = page.locator('.book-category[data-testament="Old Testament"]');
        const newSection = page.locator('.book-category[data-testament="New Testament"]');
        const deuterocanonSection = page.locator('.book-category[data-testament="Deuterocanon"]');
        const oldFilter = page.getByRole('button', { name: 'Old Testament' });
        const newFilter = page.getByRole('button', { name: 'New Testament' });
        const apocryphaFilter = page.getByRole('button', { name: 'Apocrypha' });

        await expect(page.locator('.book-testament-filter')).toHaveCount(2);
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
        await expect(page.locator('#bookModal .modal-content > .book-testament-filters')).toHaveCount(1);
        await expect(page.locator('#bookModal .modal-body > .book-testament-filters')).toHaveCount(0);
        await expect(apocryphaFilter).toHaveCount(0);
        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeVisible();

        await newFilter.click();

        await expect(oldSection).toBeHidden();
        await expect(newSection).toBeVisible();
        await expect(newFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(newFilter).toHaveClass(/book-testament-filter--active/);
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);

        await oldFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeHidden();
        await expect(oldFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(newFilter).toHaveAttribute('aria-pressed', 'false');

        await oldFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeVisible();
        await expect(oldFilter).toHaveAttribute('aria-pressed', 'false');

        await page.evaluate(async () => {
                const app = window._bibleApp;
                app.bibleBooks = {
                        'Old Testament': app.bibleBooks['Old Testament'],
                        Deuterocanon: { Tobit: 14 },
                        'New Testament': app.bibleBooks['New Testament'],
                };

                const { populateBookModal } = await import('./modals.js');
                populateBookModal(app);
        });

        await expect(page.locator('.book-testament-filter')).toHaveCount(3);
        await expect(apocryphaFilter).toBeVisible();
        await expect(deuterocanonSection).toBeVisible();

        await apocryphaFilter.click();

        await expect(oldSection).toBeHidden();
        await expect(newSection).toBeHidden();
        await expect(deuterocanonSection).toBeVisible();
        await expect(apocryphaFilter).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);

        await apocryphaFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(deuterocanonSection).toBeVisible();
        await expect(newSection).toBeVisible();
        await expect(apocryphaFilter).toHaveAttribute('aria-pressed', 'false');
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
// 6. Translation — switching translation reloads passage in new translation
// Translation is switched via the nav header translation button which opens
// the translation modal populated from RTDB / local index.
// ---------------------------------------------------------------------------
test('translation: switching translation reloads passage in new translation', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        // Open the translation modal from the nav header
        await page.locator('#translationSelectorBtn').click();
        await expect(page.locator('#translationModal')).toBeVisible();

        // Wait for the list to be populated
        await page.waitForFunction(
                () => document.querySelectorAll('.translation-modal-item').length > 0,
                { timeout: 10000 }
        );

        // Pick any item that isn't the currently active one
        const current = await page.locator('#currentTranslation').textContent();
        const next = page.locator('.translation-modal-item').filter({ hasNotText: current.trim() }).first();
        await next.click();

        // Modal closes and nav badge updates
        await expect(page.locator('#translationModal')).not.toHaveClass(/active/);
        await expect(page.locator('#currentTranslation')).not.toContainText(current.trim(), { timeout: 10000 });
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

        await openSettingsSection(page, 'appearance');

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

        await openSettingsSection(page, 'appearance');

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

        await openSettingsSection(page, 'appearance');

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

        await openSettingsSection(page, 'appearance');

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
// 16. Theme switch — 3-way Appearance select (system / light / dark)
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await openSettingsSection(page, 'appearance');

        const select = page.locator('#lightModeSelect');
        await expect(select).toBeVisible();

        const current = await select.inputValue();
        // Pick a value different from current to guarantee a state change.
        const next = current === 'light' ? 'dark' : 'light';
        await select.selectOption(next);

        await expect(select).toHaveValue(next);

        const bodyClass = await page.evaluate(() => document.body.className);
        if (next === 'light') {
                expect(bodyClass).toMatch(/light/);
        } else {
                expect(bodyClass).not.toMatch(/light/);
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

// ---------------------------------------------------------------------------
// 19. Dynamic book picker — fallback: translation without meta.json keeps
//     the 66-book picker with both OT and NT sections non-empty.
// ---------------------------------------------------------------------------
test('dynamic book picker: translation without meta.json uses 66-book fallback', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        // KJV has no meta.json — switching to it (or staying on it) exercises fallback.
        await page.evaluate(() => window._bibleApp.changeTranslation('KJV'));
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        const otBooks = page.locator('#oldTestamentBooks button');
        const ntBooks = page.locator('#newTestamentBooks button');
        await expect(otBooks.first()).toBeVisible();
        await expect(ntBooks.first()).toBeVisible();
        expect(await otBooks.count()).toBeGreaterThan(0);
        expect(await ntBooks.count()).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 20. Dynamic book picker — switching to ASV fires _rebuildBibleBooks and
//     the debug log confirms it ran with the correct book count.
//     Uses changeTranslation() directly rather than the modal UI because
//     the goal is verifying the rebuild path, not re-testing modal interaction
//     (covered by test 6).
// ---------------------------------------------------------------------------
test('dynamic book picker: switching to ASV fires _rebuildBibleBooks', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));
        await waitForPassage(page);

        const report = await page.evaluate(() => window._buildDebugReport());
        expect(report).toContain('_rebuildBibleBooks: 66 books');
});

// ---------------------------------------------------------------------------
// 21. Dynamic book picker — book modal re-renders in place when translation
//     is switched while the modal is already open.
// ---------------------------------------------------------------------------
test('dynamic book picker: book modal re-renders while open on translation switch', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        // Open the book modal first.
        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        // Switch translation programmatically while modal stays open.
        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));

        // Modal should still be visible and still contain book buttons.
        await expect(page.locator('#bookModal')).toBeVisible();
        await expect(page.locator('#bookModal .book-category button').first()).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 22. Dynamic book picker — book-not-in-canon guard redirects to Genesis 1.
// ---------------------------------------------------------------------------
test('dynamic book picker: book not in canon redirects to Genesis 1', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        // Shrink the canon to only Genesis then try to load Revelation.
        await page.evaluate(async () => {
                window._bibleApp.bibleBooks = { 'Old Testament': { Genesis: 50 } };
                await window._bibleApp.loadPassage('Revelation', 1);
        });

        await expect(page.locator('#passageTitle')).toContainText('Genesis 1', { timeout: 10000 });

        const report = await page.evaluate(() => window._buildDebugReport());
        expect(report).toContain('not in canon');
});

// ---------------------------------------------------------------------------
// 23. Dynamic book picker — network error fetching meta.json falls back to
//     the static 66-book structure without throwing a JS error.
// ---------------------------------------------------------------------------
test('dynamic book picker: meta.json network error falls back gracefully', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => {
                if (err.message !== 'cancelled') errors.push(err.message);
        });

        // Abort any request for ASV meta.json to simulate a network failure.
        await page.route('**/translations/ASV/meta.json', route => route.abort());

        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));
        await waitForPassage(page);

        // No JS errors should have been thrown.
        expect(errors).toHaveLength(0);

        // Book modal should still show the full 66-book static fallback.
        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();
        const otBooks = page.locator('#oldTestamentBooks button');
        const ntBooks = page.locator('#newTestamentBooks button');
        expect(await otBooks.count()).toBeGreaterThan(0);
        expect(await ntBooks.count()).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 24. Auth — unauthenticated: clicking user button opens login modal
// No credentials needed — this tests the routing logic in handleUserButtonClick.
// ---------------------------------------------------------------------------
test('auth: unauthenticated user button opens login modal', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        // Ensure no user is signed in before clicking.
        const isSignedIn = await page.evaluate(() => !!window._bibleApp?.currentUser);
        if (isSignedIn) {
                await page.evaluate(() => window._bibleApp.auth.signOut());
                await page.waitForFunction(() => !window._bibleApp?.currentUser, { timeout: 10000 });
        }

        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 25. Auth — signup validation: short password shows toast without network call
// Exercises the client-side guard in handleSignup before Firebase is touched.
// ---------------------------------------------------------------------------
test('auth: signup with short password shows validation toast', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        // Navigate to signup modal — open login first, then switch.
        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();
        await page.locator('#showSignupLink').click();
        await expect(page.locator('#signupModal')).toBeVisible();

        await page.locator('#signupEmail').fill('test@example.com');
        await page.locator('#signupPassword').fill('abc');
        await page.locator('#signupSubmit').click();

        // app.js surfaces validation failures via showToast — the toast element
        // should appear with the expected message.
        await expect(page.locator('#toast, .toast, [role="status"]')).toContainText(
                'at least 6 characters',
                { timeout: 5000 }
        );
});
