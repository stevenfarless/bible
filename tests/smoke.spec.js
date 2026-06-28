// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

                try {
                        const syncPromptTest =
                                new URLSearchParams(location.search).has('syncPromptTest');

                        if (syncPromptTest) {
                                localStorage.removeItem('syncPromptDismissedV1');
                        } else {
                                localStorage.setItem('syncPromptDismissedV1', '1');
                        }
                } catch (_) { }
        });
});

async function waitForApp(page) {
        await page.waitForSelector('body[data-app-ready]', { timeout: 10000 });
}

async function waitForAuthState(page) {
        await page.waitForFunction(
                () => window._bibleApp?.authStateResolved === true,
                null,
                { timeout: 10000 }
        );
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

test('reference picker: book, chapter, verse flow supports verse and Go', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        await page.locator('#newTestamentBooks button', { hasText: 'John' }).first().click();

        await expect(page.locator('#bookModal')).not.toHaveClass(/active/);
        await expect(page.locator('#chapterModal')).toBeVisible();
        await expect(page.locator('#chapterModalBook')).toHaveText('John');

        await page.locator('#chapterGrid button', { hasText: '3' }).first().click();

        await expect(page.locator('#chapterModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('John 3');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGrid button', { hasText: '16' }).first().click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('16');

        await page.locator('#bookSelector').click();
        await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGoButton').click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(page.locator('#currentVerse')).toHaveText('1');
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

test('chapter navigation: selecting a chapter opens verse picker and Go keeps chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await expect(page.locator('#chapterModal')).toBeVisible();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#chapterModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(page.locator('#verseModal')).toBeVisible();

        await page.locator('#verseGoButton').click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
});

test('verse navigation: selecting a verse closes the verse modal', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#verseSelector').click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGrid button', { hasText: '2' }).first().click();

        await expect(page.locator('#verseModal')).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('2');
});

test('translation: switching translation reloads passage in new translation', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await switchTranslation(page, 'BSB');

        await expect(page.locator('#currentTranslation')).toHaveText('BSB');
        await expect(page.locator('#passageText')).not.toBeEmpty();
});

test('search: entering a keyword returns results', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('beginning');
        await page.waitForTimeout(700);

        await expect(page.locator('#searchResults')).not.toBeEmpty();
});

test('search: mobile results keep the final book visible after scroll', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('love');

        await expect(
                page.locator('.search-book-heading[data-book="Revelation"]')
        ).toBeAttached({ timeout: 15000 });

        await page.locator(
                '.search-expand-collapse-btn[data-action="collapse"]'
        ).click();
        await page.locator(
                '.search-group-heading[data-testament="Old Testament"]'
        ).click();
        await page.locator(
                '.search-group-heading[data-testament="New Testament"]'
        ).click();

        const results = page.locator('#searchResults');
        await results.evaluate((element) => {
                element.scrollTop = element.scrollHeight;
        });
        await page.waitForTimeout(200);

        const layout = await page.evaluate(() => {
                const container = document.getElementById('searchContainer');
                const results = document.getElementById('searchResults');
                const finalBook = document.querySelector(
                        '.search-book-heading[data-book="Revelation"]'
                );

                if (!container || !results || !finalBook) {
                        throw new Error('Search layout elements were not found');
                }

                const containerRect = container.getBoundingClientRect();
                const resultsRect = results.getBoundingClientRect();
                const finalBookRect = finalBook.getBoundingClientRect();

                return {
                        containerBottom: containerRect.bottom,
                        resultsBottom: resultsRect.bottom,
                        finalBookBottom: finalBookRect.bottom,
                        resultsClientHeight: results.clientHeight,
                        resultsScrollHeight: results.scrollHeight,
                        scrollTop: results.scrollTop,
                };
        });

        expect(layout.resultsBottom).toBeLessThanOrEqual(layout.containerBottom + 1);
        expect(layout.finalBookBottom).toBeLessThanOrEqual(layout.containerBottom + 1);
        expect(layout.resultsClientHeight).toBeGreaterThan(0);
        expect(layout.resultsScrollHeight).toBeGreaterThan(layout.resultsClientHeight);
        expect(layout.scrollTop + layout.resultsClientHeight).toBeGreaterThanOrEqual(
                layout.resultsScrollHeight - 1
        );
});

test('search: reference query navigates to correct passage', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('John 3:16');
        await page.waitForTimeout(700);
        await page.locator('#searchInput').press('Enter');

        await expect(page.locator('#passageTitle')).toContainText('John 3');
        await expect(page.locator('#currentVerse')).toHaveText('16');
});

test('search: closing search clears input and hides panel', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#searchToggle').click();
        await page.locator('#searchInput').fill('test');
        await page.locator('#closeSearch').click();

        await expect(page.locator('#searchContainer')).not.toHaveClass(/active/);
        await expect(page.locator('#searchInput')).toHaveValue('');
});

test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '2' }).first().click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGoButton').click();
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '1' }).first().click();
        await expect(page.locator('#verseModal')).toBeVisible();
        await page.locator('#verseGoButton').click();
        await waitForPassage(page);

        const cache = await page.evaluate(() => localStorage.getItem('passageCache'));
        expect(cache).toBeTruthy();
});

test('settings: toggling verse numbers checkbox changes its state', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const checkbox = page.locator('#verseNumbersToggle');
        const initial = await checkbox.isChecked();
        await checkbox.click();
        expect(await checkbox.isChecked()).toBe(!initial);
});

test('settings: verse-by-verse mode toggles passage layout class', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const checkbox = page.locator('#verseByVerseToggle');
        const initial = await checkbox.isChecked();
        await checkbox.click();
        await expect(page.locator('#passageText')).toHaveClass(initial ? /^(?!.*verse-by-verse)/ : /verse-by-verse/);
});

test('settings: font size buttons update passage font size', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.evaluate(() => {
                window._bibleApp.state.fontSize = 22;
                localStorage.setItem('fontSize', '22');
                window._bibleApp.applySettings();
        });

        await expect(page.locator('#fontSizeValue')).toHaveText('22');

        await page.locator('#fontSizeIncrease').click();

        await expect(page.locator('#fontSizeValue')).toHaveText('23');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '23px');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('fontSize'))).toBe('23');

        await page.locator('#fontSizeDecrease').click();

        await expect(page.locator('#fontSizeValue')).toHaveText('22');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '22px');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('fontSize'))).toBe('22');
});

test('settings: color theme selector applies theme to body', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#themeSelector').selectOption('onyx');
        await expect(page.locator('body')).toHaveClass(/onyx-theme/);
});

test('theme switch: segmented appearance control changes body class', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('label[for="lm-light"]').click();
        await expect(page.locator('#lm-light')).toBeChecked();
        await expect(page.locator('body')).toHaveClass(/light-mode/);
        await expect.poll(() => page.evaluate(() => localStorage.getItem('lightMode'))).toBe('light');

        await page.locator('label[for="lm-dark"]').click();
        await expect(page.locator('#lm-dark')).toBeChecked();
        await expect(page.locator('body')).not.toHaveClass(/light-mode/);
        await expect.poll(() => page.evaluate(() => localStorage.getItem('lightMode'))).toBe('dark');

        await page.locator('label[for="lm-system"]').click();
        await expect(page.locator('#lm-system')).toBeChecked();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('lightMode'))).toBe('system');
});

test('keyboard: ArrowRight advances to next chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.keyboard.press('ArrowRight');
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
});

test('keyboard: ArrowLeft goes to previous chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.loadPassage('Genesis', 2));
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');

        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('#passageTitle')).toContainText('Genesis 1');
});

test('dynamic book picker: translation without meta.json uses 66-book fallback', async ({ page }) => {
        await page.route('**/translations/KJV/meta.json', route => route.fulfill({ status: 404, body: '' }));
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#oldTestamentBooks button')).toHaveCount(39);
        await expect(page.locator('#newTestamentBooks button')).toHaveCount(27);
});

test('dynamic book picker: switching to BSB fires _rebuildBibleBooks', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await switchTranslation(page, 'BSB');

        const report = await page.evaluate(() => window._buildDebugReport());
        expect(report).toContain('_rebuildBibleBooks');
});

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

test('dynamic book picker: meta.json network error falls back gracefully', async ({ page }) => {
        const errors = collectPageErrors(page);

        await page.route('**/translations/BSB/meta.json', route => route.abort());

        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.changeTranslation('BSB'));
        await waitForPassage(page);

        expect(errors).toHaveLength(0);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();
        const otBooks = page.locator('#oldTestamentBooks button');
        const ntBooks = page.locator('#newTestamentBooks button');
        expect(await otBooks.count()).toBeGreaterThan(0);
        expect(await ntBooks.count()).toBeGreaterThan(0);
});

test('auth: unauthenticated user button opens login modal', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.locator('#userBtn').click();
        await expect(page.locator('#loginModal')).toBeVisible();
});

test('auth: signup with short password shows validation toast', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.locator('#userBtn').click();
        await page.locator('#showSignupLink').click();
        await page.locator('#signupEmail').fill('test@example.com');
        await page.locator('#signupPassword').fill('123');
        await page.locator('#signupSubmit').click();

        await expect(page.locator('#toast')).toHaveClass(/show/);
});

test('sync prompt: remains hidden during signed-out startup', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        expect(await page.evaluate(
                () => window._bibleApp.currentUser
        )).toBeNull();

        await expect(page.locator('#syncPrompt')).toBeHidden();
        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);
});

test('sync prompt: appears when a signed-out user opens settings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();

        const settings = page.locator('#settingsModal');
        const prompt = page.locator('#syncPrompt');

        await expect(settings).toHaveClass(/active/);
        await expect(prompt).toBeVisible();
        await expect(page.locator('#settingsModal #syncPrompt')).toHaveCount(1);

        expect(await page.locator('#settingsModal .modal-body').evaluate(
                element => element.scrollTop
        )).toBe(0);
});

test('sync prompt: remains hidden when a signed-in user opens settings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = {
                        uid: 'test-user',
                        email: 'test@example.com',
                };
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();

        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: remains hidden before authentication resolves', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = false;
        });

        await page.locator('#settingsBtn').click();

        await expect(page.locator('#settingsModal')).toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: dismissal persists across settings openings', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.locator('#syncPromptDismiss').click();
        await expect(page.locator('#syncPrompt')).toBeHidden();

        await expect.poll(() => page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBe('1');

        await page.locator('#closeSettingsModal').click();
        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeHidden();
});

test('sync prompt: closing settings does not persist dismissal', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.locator('#settingsModal')).not.toHaveClass(/active/);
        await expect(page.locator('#syncPrompt')).toBeHidden();

        expect(await page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBeNull();

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();
});

test('sync prompt: sign in opens login without persisting dismissal', async ({ page }) => {
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        await page.locator('#syncPromptSignIn').click();

        await expect(page.locator('#syncPrompt')).toBeHidden();
        await expect(page.locator('#loginModal')).toHaveClass(/active/);

        expect(await page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBeNull();
});

test('sync prompt: stays inside settings on desktop and mobile', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/?syncPromptTest=1');
        await waitForApp(page);
        await waitForAuthState(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                window._bibleApp.currentUser = null;
                window._bibleApp.authStateResolved = true;
        });

        await page.locator('#settingsBtn').click();
        await expect(page.locator('#syncPrompt')).toBeVisible();

        const readLayout = () => page.evaluate(() => {
                const settings = document.getElementById('settingsModal');
                const body = settings.querySelector('.modal-body');
                const prompt = document.getElementById('syncPrompt');
                const close = document.getElementById('closeSettingsModal');

                const bodyRect = body.getBoundingClientRect();
                const promptRect = prompt.getBoundingClientRect();
                const closeRect = close.getBoundingClientRect();

                const overlapsClose =
                        promptRect.left < closeRect.right &&
                        promptRect.right > closeRect.left &&
                        promptRect.top < closeRect.bottom &&
                        promptRect.bottom > closeRect.top;

                return {
                        position: getComputedStyle(prompt).position,
                        insideSettings: settings.contains(prompt),
                        horizontallyContained:
                                promptRect.left >= bodyRect.left - 1 &&
                                promptRect.right <= bodyRect.right + 1,
                        overlapsClose,
                };
        });

        const desktop = await readLayout();

        expect(desktop.position).toBe('static');
        expect(desktop.insideSettings).toBe(true);
        expect(desktop.horizontallyContained).toBe(true);
        expect(desktop.overlapsClose).toBe(false);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('#syncPrompt')).toBeVisible();

        const mobile = await readLayout();

        expect(mobile.position).toBe('static');
        expect(mobile.insideSettings).toBe(true);
        expect(mobile.horizontallyContained).toBe(true);
        expect(mobile.overlapsClose).toBe(false);
});

test('translation sync: offers KJV and BSB without starting a download', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        const nkjvRequests = [];
        page.on('request', (request) => {
                if (request.url().includes('/translations/NKJV/')) {
                        nkjvRequests.push(request.url());
                }
        });

        await page.evaluate(() => {
                window._bibleApp.preferredTranslation = 'NKJV';
                window._bibleApp.pendingPreferredTranslation = 'NKJV';
                window._bibleApp.missingSyncedTranslations = ['NKJV'];
                window._bibleApp.maybeShowTranslationSyncModal({ force: true });
        });

        await expect(page.locator('#translationSyncModal')).toHaveClass(/active/);
        await expect(page.locator('#translationSyncUseKJV')).toBeVisible();
        await expect(page.locator('#translationSyncUseBSB')).toBeVisible();
        await expect(page.locator('#translationSyncDownload')).toBeVisible();
        expect(nkjvRequests).toHaveLength(0);
});

test('translation sync: BSB fallback keeps the synced preference', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.evaluate(() => {
                window._bibleApp.preferredTranslation = 'NKJV';
                window._bibleApp.pendingPreferredTranslation = 'NKJV';
                window._bibleApp.missingSyncedTranslations = ['NKJV'];
                window._bibleApp.maybeShowTranslationSyncModal({ force: true });
        });

        await page.locator('#translationSyncUseBSB').click();
        await expect(page.locator('#translationSyncModal')).not.toHaveClass(/active/);

        await expect.poll(() => page.evaluate(() => ({
                active: window._bibleApp.state.translation,
                preferred: window._bibleApp.preferredTranslation,
        }))).toEqual({ active: 'BSB', preferred: 'NKJV' });
});

test('modal focus: closing login does not leave focus in an aria-hidden modal', async ({ page }) => {
        await page.goto('/');
        await waitForApp(page);

        await page.locator('#userBtn').click();
        await page.locator('#loginPassword').focus();
        await page.locator('#closeLoginModal').click();

        await expect(page.locator('#loginModal')).not.toHaveClass(/active/);

        expect(await page.evaluate(() => {
                const active = document.activeElement;
                return Boolean(active?.closest?.('[aria-hidden="true"]'));
        })).toBe(false);
});

test('auth restoration: delayed remote position cannot overwrite local navigation', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const result = await page.evaluate(async () => {
                const app = window._bibleApp;
                let releaseRemote;
                const gate = new Promise(resolve => { releaseRemote = resolve; });

                app._authRestorePositionBaseline = {
                        book: 'Genesis',
                        chapter: 1,
                        scrollY: 0,
                };
                app.currentUser = { uid: 'position-test' };
                app.database = {
                        ref() {
                                return {
                                        async once() {
                                                await gate;
                                                return {
                                                        val: () => ({
                                                                book: 'Genesis',
                                                                chapter: 1,
                                                                scrollY: 0,
                                                        }),
                                                };
                                        },
                                };
                        },
                };

                const restoration = app._loadSavedPositionIfChanged();
                app.state.currentChapter = 2;
                releaseRemote();
                await restoration;

                return {
                        chapter: app.state.currentChapter,
                        events: app._dbg.events.map(event => event.msg),
                };
        });

        expect(result.chapter).toBe(2);
        expect(result.events).toContain(
                'auth restoration: discarded remote position changed during read'
        );
});

test('cold startup: passage space stays reserved until the first passage renders', async ({ page }) => {
        let releasePassage;
        const passageGate = new Promise(resolve => { releasePassage = resolve; });

        await page.addInitScript(() => {
                localStorage.removeItem('passageCache');
                localStorage.removeItem('readingPosition');
                localStorage.setItem('translation', 'KJV');
                localStorage.setItem('preferredTranslation', 'KJV');
        });

        await page.route('**/translations/KJV/Genesis.json', async route => {
                await passageGate;
                await route.continue();
        });

        const navigation = page.goto('/');
        await page.waitForSelector('#passageText');
        await page.waitForFunction(() => (
                document.body.classList.contains('initializing') === false
        ));

        const loadingState = await page.evaluate(() => ({
                ready: document.body.classList.contains('passage-ready'),
                minHeight: parseFloat(getComputedStyle(
                        document.getElementById('passageText')
                ).minHeight),
                placeholder: Boolean(document.querySelector(
                        '.passage-loading-placeholder'
                )),
        }));

        expect(loadingState.ready).toBe(false);
        expect(loadingState.placeholder).toBe(true);
        expect(loadingState.minHeight).toBeGreaterThan(300);

        releasePassage();
        await navigation;
        await waitForPassage(page);
        await expect.poll(() => page.evaluate(() => (
                document.body.classList.contains('passage-ready')
        ))).toBe(true);
        await expect(page.locator('.passage-loading-placeholder')).toHaveCount(0);
});

test('about: GitHub release checks wait for browser idle time after settings opens', async ({ page }) => {
        const releaseRequests = [];

        await page.addInitScript(() => {
                window.__idleCallbacks = [];
                window.requestIdleCallback = (callback) => {
                        window.__idleCallbacks.push(callback);
                        return window.__idleCallbacks.length;
                };
        });

        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases/latest', async route => {
                releaseRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                                tag_name: 'v-test',
                                body: '',
                        }),
                });
        });

        await page.route('https://api.github.com/repos/stevenfarless/lege-lux/releases?per_page=10', async route => {
                releaseRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: '[]',
                });
        });

        await page.goto('/');
        await waitForPassage(page);

        expect(releaseRequests).toHaveLength(0);

        await page.click('#settingsBtn');

        expect(releaseRequests).toHaveLength(0);

        await page.evaluate(() => {
                for (const callback of window.__idleCallbacks.splice(0)) {
                        callback({ didTimeout: false, timeRemaining: () => 50 });
                }
        });

        await expect.poll(() => releaseRequests.length).toBe(2);
        expect(releaseRequests[0]).toContain('/releases/latest');
        expect(releaseRequests[1]).toContain('/releases?per_page=10');
});

test('about: marked loads only after delayed release metadata', async ({ page }) => {
        const markedRequests = [];

        await page.addInitScript(() => {
                window.__idleCallbacks = [];
                window.requestIdleCallback = (callback) => {
                        window.__idleCallbacks.push(callback);
                        return window.__idleCallbacks.length;
                };
        });

        await page.route(
                'https://api.github.com/repos/stevenfarless/lege-lux/releases/latest',
                route => route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                                tag_name: 'v-test',
                                body: '**Test release notes**',
                        }),
                })
        );

        await page.route(
                'https://api.github.com/repos/stevenfarless/lege-lux/releases?per_page=10',
                route => route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: '[]',
                })
        );

        await page.route('**/marked@9/marked.min.js', async route => {
                markedRequests.push(route.request().url());
                await route.fulfill({
                        status: 200,
                        contentType: 'text/javascript',
                        body: `
                                window.marked = {
                                        parse(value) {
                                                return '<strong>' + value + '</strong>';
                                        }
                                };
                        `,
                });
        });

        await page.goto('/');
        await waitForPassage(page);

        expect(markedRequests).toHaveLength(0);

        await page.click('#settingsBtn');

        expect(markedRequests).toHaveLength(0);

        await page.evaluate(() => {
                for (const callback of window.__idleCallbacks.splice(0)) {
                        callback({ didTimeout: false, timeRemaining: () => 50 });
                }
        });

        await expect.poll(() => markedRequests.length).toBe(1);
        await expect(page.locator('#whatsNewContent')).toContainText(
                'Test release notes'
        );
});

test('startup: visible monospace UI avoids loading iA Writer Mono', async ({ page }) => {
        const monoFontRequests = [];

        page.on('request', request => {
                if (request.url().includes('iAWriterMonoS-Regular.woff')) {
                        monoFontRequests.push(request.url());
                }
        });

        await page.goto('/');
        await waitForPassage(page);

        const families = await page.evaluate(() => ({
                build: getComputedStyle(
                        document.getElementById('build-info')
                ).fontFamily,
                chapter: getComputedStyle(
                        document.getElementById('currentChapter')
                ).fontFamily,
                verse: getComputedStyle(
                        document.getElementById('currentVerse')
                ).fontFamily,
                translation: getComputedStyle(
                        document.getElementById('currentTranslation')
                ).fontFamily,
        }));

        expect(families.build).toContain('ui-monospace');
        expect(families.chapter).toContain('ui-monospace');
        expect(families.verse).toContain('ui-monospace');
        expect(families.translation).toContain('ui-monospace');
        expect(monoFontRequests).toHaveLength(0);
});

test('accessibility: copyright text meets WCAG AA contrast', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const ratio = await page.locator('#copyright').evaluate(element => {
                const parseRgb = value => {
                        const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
                        if (!channels || channels.length !== 3) {
                                throw new Error(`Unsupported color: ${value}`);
                        }
                        return channels;
                };

                const luminance = channels => {
                        const linear = channels.map(channel => {
                                const value = channel / 255;
                                return value <= 0.04045
                                        ? value / 12.92
                                        : ((value + 0.055) / 1.055) ** 2.4;
                        });
                        return (
                                0.2126 * linear[0]
                                + 0.7152 * linear[1]
                                + 0.0722 * linear[2]
                        );
                };

                const foreground = parseRgb(getComputedStyle(element).color);
                const container = element.closest('.passage-container');
                const background = parseRgb(
                        getComputedStyle(container).backgroundColor
                );
                const lighter = Math.max(
                        luminance(foreground),
                        luminance(background)
                );
                const darker = Math.min(
                        luminance(foreground),
                        luminance(background)
                );

                return (lighter + 0.05) / (darker + 0.05);
        });

        expect(ratio).toBeGreaterThanOrEqual(4.5);
});
