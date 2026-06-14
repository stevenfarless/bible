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

function collectPageErrors(page) {
        const errors = [];
        page.on('pageerror', (err) => {
                if (err.message === 'cancelled') return;
                const location = err.stack?.split('\n').find(line => line.includes('http://localhost'));
                errors.push(location ? `${err.message} ${location.trim()}` : err.message);
        });
        return errors;
}

// ---------------------------------------------------------------------------
// 1. Page load — app loads without JS errors, key UI elements visible
// ---------------------------------------------------------------------------
test('page load: main UI elements are visible', async ({ page }) => {
        const errors = collectPageErrors(page);

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
        await expect(oldFilter).toHaveClass(/book-testament-filter--active/);
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);

        await oldFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeVisible();
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);
        await expect(deuterocanonSection).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 4. Chapter navigation — open chapter modal, select chapter
// ---------------------------------------------------------------------------
test('chapter navigation: selecting a chapter loads passage text', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await expect(page.locator('#chapterModal')).toBeVisible();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#chapterModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        await expect(page.locator('#passageText')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 5. Verse navigation — open verse modal, select verse
// ---------------------------------------------------------------------------
test('verse navigation: selecting a verse closes the verse modal', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#verseSelector').click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('2');
});

// ---------------------------------------------------------------------------
// 6. Translation switching
// ---------------------------------------------------------------------------
test('translation: switching translation reloads passage in new translation', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await switchTranslation(page, 'ASV');

        await expect(page.locator('#currentTranslation')).toHaveText('ASV');
        await expect(page.locator('#passageText')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 7. Keyword search
// ---------------------------------------------------------------------------
test('search: entering a keyword returns results', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('beginning');
        await page.waitForTimeout(700);

        await expect(page.locator('#searchResults')).not.toBeEmpty();
});

// ---------------------------------------------------------------------------
// 8. Reference search
// ---------------------------------------------------------------------------
test('search: reference query navigates to correct passage', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('John 3:16');
        await page.locator('#searchInput').press('Enter');

        await expect(page.locator('#passageTitle')).toContainText('John 3');
        await expect(page.locator('#currentVerse')).toHaveText('16');
});

// ---------------------------------------------------------------------------
// 9. Closing search
// ---------------------------------------------------------------------------
test('search: closing search clears input and hides panel', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('test');
        await page.locator('#closeSearch').click();

        await expect(page.locator('#searchContainer')).not.toHaveClass(/active/);
        await expect(page.locator('#searchInput')).toHaveValue('');
});

// ---------------------------------------------------------------------------
// 10. Passage cache
// ---------------------------------------------------------------------------
test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '1' }).first().click();
        await waitForPassage(page);

        const cache = await page.evaluate(() => localStorage.getItem('passageCache'));
        expect(cache).toBeTruthy();
});

// ---------------------------------------------------------------------------
// 11. Verse numbers setting
// ---------------------------------------------------------------------------
test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const checkbox = page.locator('#verseNumbersToggle');
        const initial = await checkbox.isChecked();
        await checkbox.click();
        expect(await checkbox.isChecked()).toBe(!initial);
});

// ---------------------------------------------------------------------------
// 12. Verse-by-verse setting
// ---------------------------------------------------------------------------
test('settings: verse-by-verse mode toggles passage layout class', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const checkbox = page.locator('#verseByVerseToggle');
        const initial = await checkbox.isChecked();
        await checkbox.click();
        await expect(page.locator('#passageText')).toHaveClass(initial ? /^(?!.*verse-by-verse)/ : /verse-by-verse/);
});

// ---------------------------------------------------------------------------
// 13. Font size
// ---------------------------------------------------------------------------
test('settings: font size change updates passage font size', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#fontSizeSlider').fill('24');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '24px');
});

// ---------------------------------------------------------------------------
// 14. Color theme
// ---------------------------------------------------------------------------
test('settings: color theme selector applies theme to body', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#themeSelector').selectOption('onyx');
        await expect(page.locator('body')).toHaveClass(/onyx-theme/);
});

// ---------------------------------------------------------------------------
// 15. Light mode
// ---------------------------------------------------------------------------
test('theme switch: toggling light mode changes body class', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const select = page.locator('#lightModeSelect');
        const initial = await select.inputValue();
        await select.selectOption(initial === 'light' ? 'dark' : 'light');
        await expect(page.locator('body')).toHaveClass(initial === 'light' ? /^(?!.*light-mode)/ : /light-mode/);
});

// ---------------------------------------------------------------------------
// 16. Keyboard next chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowRight advances to next chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await showChrome(page);

        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
});

// ---------------------------------------------------------------------------
// 17. Keyboard previous chapter
// ---------------------------------------------------------------------------
test('keyboard: ArrowLeft goes to previous chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.loadPassage('Genesis', 2));
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');

        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('#passageTitle')).toContainText('Genesis 1');
});

// ---------------------------------------------------------------------------
// 18. Static fallback without meta
// ---------------------------------------------------------------------------
test('dynamic book picker: translation without meta.json uses 66-book fallback', async ({ page }) => {
        await page.route('**/translations/KJV/meta.json', route => route.fulfill({ status: 404, body: '' }));
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#oldTestamentBooks button')).toHaveCount(39);
        await expect(page.locator('#newTestamentBooks button')).toHaveCount(27);
});

// ---------------------------------------------------------------------------
// 19. Translation change triggers rebuild
// ---------------------------------------------------------------------------
test('dynamic book picker: switching to ASV fires _rebuildBibleBooks', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await switchTranslation(page, 'ASV');

        const report = await page.evaluate(() => window._buildDebugReport());
        expect(report).toContain('_rebuildBibleBooks');
});

// ---------------------------------------------------------------------------
// 20. Open book modal rerenders after translation switch
// ---------------------------------------------------------------------------
test('dynamic book picker: book modal re-renders while open on translation switch', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();
        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));
        await page.waitForTimeout(500);

        await expect(page.locator('#oldTestamentBooks button')).toHaveCount(39);
        await expect(page.locator('#newTestamentBooks button')).toHaveCount(27);
});

// ---------------------------------------------------------------------------
// 21. Invalid book redirects to Genesis 1
// ---------------------------------------------------------------------------
test('dynamic book picker: book not in canon redirects to Genesis 1', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(async () => {
                window._bibleApp.state.currentBook = 'Tobit';
                window._bibleApp.state.currentChapter = 1;
                window._bibleApp._rebuildBibleBooks(null);
                await window._bibleApp.loadPassage('Revelation', 1);
        });

        await expect(page.locator('#passageTitle')).toContainText('Genesis 1', { timeout: 10000 });

        const report = await page.evaluate(() => window._buildDebugReport());
        expect(report).toContain('not in canon');
});

// ---------------------------------------------------------------------------
// 22. Dynamic book picker — network error fetching meta.json falls back to
//     the static 66-book structure without throwing a JS error.
// ---------------------------------------------------------------------------
test('dynamic book picker: meta.json network error falls back gracefully', async ({ page }) => {
        const errors = collectPageErrors(page);

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
// 23. Auth login modal
// ---------------------------------------------------------------------------
test('auth: unauthenticated user button opens login modal', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 24. Signup validation
// ---------------------------------------------------------------------------
test('auth: signup with short password shows validation toast', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.locator('#userBtn').click();
        await page.locator('#showSignup').click();
        await page.locator('#signupEmail').fill('test@example.com');
        await page.locator('#signupPassword').fill('123');
        await page.locator('#signupSubmit').click();

        await expect(page.locator('#toast')).toHaveClass(/show/);
});
