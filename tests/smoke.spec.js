// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                try { localStorage.setItem('syncPromptDismissedV1', '1'); } catch (_) {}
        });
});

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
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await page.locator('#chapterGrid button', { hasText: '1' }).first().click();
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

test('settings: font size change updates passage font size', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#fontSizeSlider').fill('24');
        await expect(page.locator('#passageText')).toHaveCSS('font-size', '24px');
});

test('settings: color theme selector applies theme to body', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        await page.locator('#themeSelector').selectOption('onyx');
        await expect(page.locator('body')).toHaveClass(/onyx-theme/);
});

test('theme switch: toggling light mode changes body class', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);
        await openSettingsSection(page, 'appearance');

        const select = page.locator('#lightModeSelect');
        const initial = await select.inputValue();
        await select.selectOption(initial === 'light' ? 'dark' : 'light');
        await expect(page.locator('body')).toHaveClass(initial === 'light' ? /^(?!.*light-mode)/ : /light-mode/);
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

        await page.route('**/translations/ASV/meta.json', route => route.abort());

        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));
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

test('sync prompt: responds to desktop and mobile layouts', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/');
        await waitForApp(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                document.getElementById('syncPrompt').hidden = false;
        });

        const prompt = page.locator('#syncPrompt');
        await expect(prompt).toBeVisible();

        const desktopLayout = await page.evaluate(() => {
                const account = document.getElementById('userBtn').getBoundingClientRect();
                const panel = document.getElementById('syncPrompt').getBoundingClientRect();
                return {
                        accountBottom: account.bottom,
                        accountRight: account.right,
                        panelTop: panel.top,
                        panelRight: panel.right,
                };
        });

        expect(desktopLayout.panelTop).toBeGreaterThanOrEqual(desktopLayout.accountBottom);
        expect(Math.abs(desktopLayout.panelRight - desktopLayout.accountRight)).toBeLessThanOrEqual(2);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => {
                const panel = document.getElementById('syncPrompt').getBoundingClientRect();
                return Math.round(window.innerHeight - panel.bottom);
        })).toBe(0);

        await page.locator('#syncPromptSignIn').click();
        await expect(prompt).toBeHidden();
        await expect(page.locator('#loginModal')).toBeVisible();
});

test('sync prompt: dismissal persists locally', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await waitForApp(page);

        await page.evaluate(() => {
                localStorage.removeItem('syncPromptDismissedV1');
                document.getElementById('syncPrompt').hidden = false;
        });

        const prompt = page.locator('#syncPrompt');
        await expect(prompt).toBeVisible();
        await page.locator('#syncPromptDismiss').click();
        await expect(prompt).toBeHidden();
        await expect.poll(() => page.evaluate(
                () => localStorage.getItem('syncPromptDismissedV1')
        )).toBe('1');
});
