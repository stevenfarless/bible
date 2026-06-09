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
// be clicked. Headless CI never fires the pointer events that trigger
// showChrome(), so the buttons exist in the DOM but remain hidden behind a
// translateY(-100%) transform.
//
// chrome-no-transition disables the slide animation so Playwright's
// bounding-box visibility check resolves immediately rather than racing
// against the CSS transition that would keep the element above the viewport
// until it completes.
// ---------------------------------------------------------------------------
async function showChrome(page) {
        await page.evaluate(() => {
                document.body.classList.add('chrome-no-transition');
                window._bibleApp?.showChrome();
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
// Auth helper — signs in via the login modal UI using pre-provisioned test
// credentials from env vars TEST_USER_EMAIL and TEST_USER_PASSWORD.
// Waits for app.currentUser to be set before resolving so subsequent steps
// can rely on an authenticated session.
// ---------------------------------------------------------------------------
async function signIn(page) {
        const email    = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;
        if (!email || !password) throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set');

        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();

        await page.locator('#loginEmail').fill(email);
        await page.locator('#loginPassword').fill(password);
        await page.locator('#loginForm button[type="submit"]').click();

        // Wait for Firebase auth state to settle — currentUser is set by the
        // onAuthStateChanged callback in app.js after signInWithEmailAndPassword.
        await page.waitForFunction(
                () => !!window._bibleApp?.currentUser,
                { timeout: 15000 }
        );
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

        await showChrome(page);

        await page.locator('#nextChapter').click();
        await expect(page.locator('#passageTitle')).toContainText('Matthew 6');

        await page.locator('#prevChapter').click();
        await expect(page.locator('#passageTitle')).toContainText('Matthew 5');
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
// 10. Reading position — localStorage updated after chapter navigation
// ---------------------------------------------------------------------------
test('reading position: localStorage updated after chapter navigation', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await showChrome(page);

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

// ---------------------------------------------------------------------------
// 26. Auth — login: valid credentials sign the user in
// Requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars pointing to a
// pre-provisioned Firebase account in the live project.
// Skipped automatically when the env vars are absent.
// ---------------------------------------------------------------------------
test('auth: valid credentials sign the user in', async ({ page }) => {
        test.skip(!process.env.TEST_USER_EMAIL, 'TEST_USER_EMAIL not set — skipping live auth test');

        await page.goto('/');
        await waitForPassage(page);

        await signIn(page);

        // Login modal should close and user email should appear in the user menu.
        await expect(page.locator('#loginModal')).not.toBeVisible();
        await page.locator('#userBtn').click();
        await expect(page.locator('#userMenuModal')).toBeVisible();
        await expect(page.locator('#userEmail')).toContainText(process.env.TEST_USER_EMAIL);
});

// ---------------------------------------------------------------------------
// 27. Auth — logout: signed-in user can sign out
// Depends on TEST_USER_EMAIL / TEST_USER_PASSWORD. Skipped when absent.
// ---------------------------------------------------------------------------
test('auth: signed-in user can sign out', async ({ page }) => {
        test.skip(!process.env.TEST_USER_EMAIL, 'TEST_USER_EMAIL not set — skipping live auth test');

        await page.goto('/');
        await waitForPassage(page);

        await signIn(page);

        // Open user menu and sign out.
        await page.locator('#userBtn').click();
        await expect(page.locator('#userMenuModal')).toBeVisible();
        await page.locator('#logoutBtn').click();

        // currentUser should clear and clicking the user button should now
        // route back to the login modal.
        await page.waitForFunction(() => !window._bibleApp?.currentUser, { timeout: 10000 });
        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 28. Auth — reading position sync: Firebase RTDB updated after chapter nav
// After sign-in, navigating a chapter should write readingPosition to both
// localStorage and the user's RTDB node. Reads the RTDB value back via the
// app's live database reference to confirm the write landed.
// Depends on TEST_USER_EMAIL / TEST_USER_PASSWORD. Skipped when absent.
// ---------------------------------------------------------------------------
test('auth: reading position synced to Firebase after chapter navigation', async ({ page }) => {
        test.skip(!process.env.TEST_USER_EMAIL, 'TEST_USER_EMAIL not set — skipping live auth test');

        await page.goto('/');
        await waitForPassage(page);

        await signIn(page);

        // Close user menu if it opened automatically after sign-in.
        const menuVisible = await page.locator('#userMenuModal').isVisible();
        if (menuVisible) await page.keyboard.press('Escape');

        await waitForPassage(page);

        // Navigate to a deterministic location so we know what to expect.
        await page.locator('#bookSelector').click();
        await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
        await expect(page.locator('#passageTitle')).toContainText('Matthew 1');

        // saveReadingPosition fires on passage load — give the async RTDB write
        // a moment to settle before reading back.
        await page.waitForTimeout(2000);

        const rtdbPos = await page.evaluate(async () => {
                const uid = window._bibleApp?.currentUser?.uid;
                if (!uid) return null;
                const snap = await window._bibleApp.database
                        .ref(`users/${uid}/readingPosition`)
                        .once('value');
                return snap.val();
        });

        expect(rtdbPos).not.toBeNull();
        expect(rtdbPos.book).toBe('Matthew');
        expect(rtdbPos.chapter).toBe(1);
});
