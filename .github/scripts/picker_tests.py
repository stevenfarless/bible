from pathlib import Path

PATH = Path('tests/smoke.spec.js')


def read():
    return PATH.read_text(encoding='utf-8')


def write(text):
    PATH.write_text(text.rstrip() + '\n', encoding='utf-8')


def replace_test(text, title, next_title, body):
    if body in text:
        return text

    start = text.find(f"test('{title}'")
    if start == -1:
        raise SystemExit(f'test not found: {title}')

    end = text.find(f"\ntest('{next_title}'", start)
    if end == -1:
        raise SystemExit(f'next test not found after {title}: {next_title}')

    return text[:start] + body.rstrip() + '\n' + text[end:]


REFERENCE_FLOW_TEST = r'''test('reference picker: book, chapter, verse flow supports verse and close', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const picker = page.locator('#referencePickerModal');
        const pickerTitle = page.locator('#referencePickerTitle');
        const pickerSubtitle = page.locator('#referencePickerSubtitle');
        const pickerView = page.locator('#referencePickerView');

        await page.locator('#bookSelector').click();
        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Book');

        await page.locator('.book-category[data-testament="New Testament"] .book-item', { hasText: 'John' }).first().click();

        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Chapter');
        await expect(pickerSubtitle).toHaveText('John');

        await pickerView.locator('.chapter-item', { hasText: '3' }).first().click();

        await expect(page.locator('#passageTitle')).toContainText('John 3');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Verse');
        await expect(pickerSubtitle).toHaveText('John 3');

        await pickerView.locator('.chapter-item', { hasText: '16' }).first().click();

        await expect(picker).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('16');

        await page.locator('#bookSelector').click();
        await page.locator('.book-category[data-testament="New Testament"] .book-item', { hasText: 'Matt' }).first().click();
        await expect(pickerTitle).toHaveText('Chapter');
        await pickerView.locator('.chapter-item', { hasText: '2' }).first().click();

        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Verse');
        await expect(pickerSubtitle).toHaveText('Matthew 2');

        await page.locator('#closeReferencePickerModal').click();

        await expect(picker).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Matthew 2');
        await expect(page.locator('#currentVerse')).toHaveText('1');
});'''

FILTER_TEST = r'''test('book selector: testament filters toggle sections from canon data', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#referencePickerModal')).toBeVisible();

        const oldSection = page.locator('.book-category[data-testament="Old Testament"]');
        const newSection = page.locator('.book-category[data-testament="New Testament"]');
        const deuterocanonSection = page.locator('.book-category[data-testament="Deuterocanon"]');
        const oldFilter = page.getByRole('button', { name: 'Old Testament' });
        const newFilter = page.getByRole('button', { name: 'New Testament' });
        const apocryphaFilter = page.getByRole('button', { name: 'Apocrypha' });

        await expect(page.locator('.book-testament-filter')).toHaveCount(2);
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
        await expect(page.locator('#referencePickerModal .modal-content > .book-testament-filters')).toHaveCount(1);
        await expect(page.locator('#referencePickerModal .modal-body > .book-testament-filters')).toHaveCount(0);
        await expect(apocryphaFilter).toHaveCount(0);
        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeVisible();

        await newFilter.click();

        await expect(oldSection).toBeHidden();
        await expect(newSection).toBeVisible();
        await expect(newFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(newFilter).toHaveClass(/book-testament-filter--active/);

        await oldFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeHidden();
        await expect(oldFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(oldFilter).toHaveClass(/book-testament-filter--active/);

        await oldFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(newSection).toBeVisible();
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
        await expect(deuterocanonSection).toHaveCount(0);
});'''

CHAPTER_TEST = r'''test('chapter navigation: selecting a chapter opens verse picker and close keeps chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const picker = page.locator('#referencePickerModal');
        const pickerTitle = page.locator('#referencePickerTitle');
        const pickerView = page.locator('#referencePickerView');

        await page.locator('#chapterSelector').click();
        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Chapter');
        await pickerView.locator('.chapter-item', { hasText: '2' }).first().click();

        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        await expect(page.locator('#passageText')).not.toBeEmpty();
        await expect(picker).toBeVisible();
        await expect(pickerTitle).toHaveText('Verse');

        await page.locator('#closeReferencePickerModal').click();

        await expect(picker).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
});'''

VERSE_TEST = r'''test('verse navigation: selecting a verse closes the reference picker', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const picker = page.locator('#referencePickerModal');
        const pickerView = page.locator('#referencePickerView');

        await page.locator('#verseSelector').click();
        await expect(picker).toBeVisible();
        await expect(page.locator('#referencePickerTitle')).toHaveText('Verse');
        await pickerView.locator('.chapter-item', { hasText: '2' }).first().click();

        await expect(picker).not.toHaveClass(/active/);
        await expect(page.locator('#currentVerse')).toHaveText('2');
});'''

PASSAGE_CACHE_TEST = r'''test('passage cache: navigating back to a visited passage writes cache', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        const picker = page.locator('#referencePickerModal');
        const pickerView = page.locator('#referencePickerView');

        await page.locator('#chapterSelector').click();
        await pickerView.locator('.chapter-item', { hasText: '2' }).first().click();
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        await expect(picker).toBeVisible();
        await page.locator('#closeReferencePickerModal').click();
        await waitForPassage(page);

        await page.locator('#chapterSelector').click();
        await pickerView.locator('.chapter-item', { hasText: '1' }).first().click();
        await expect(page.locator('#passageTitle')).toContainText('Genesis 1');
        await expect(picker).toBeVisible();
        await page.locator('#closeReferencePickerModal').click();
        await waitForPassage(page);

        const cache = await page.evaluate(() => localStorage.getItem('passageCache'));
        expect(cache).toBeTruthy();
});'''

FALLBACK_TEST = r'''test('dynamic book picker: translation without meta.json uses 66-book fallback', async ({ page }) => {
        await page.route('**/translations/KJV/meta.json', route => route.fulfill({ status: 404, body: '' }));
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('.book-category[data-testament="Old Testament"] .book-item')).toHaveCount(39);
        await expect(page.locator('.book-category[data-testament="New Testament"] .book-item')).toHaveCount(27);
});'''

RERENDER_TEST = r'''test('dynamic book picker: book modal re-renders while open on translation switch', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#referencePickerModal')).toBeVisible();
        await page.evaluate(() => window._bibleApp.changeTranslation('ASV'));
        await page.waitForTimeout(500);

        await expect(page.locator('.book-category[data-testament="Old Testament"] .book-item')).toHaveCount(39);
        await expect(page.locator('.book-category[data-testament="New Testament"] .book-item')).toHaveCount(27);
});'''

META_ERROR_TEST = r'''test('dynamic book picker: meta.json network error falls back gracefully', async ({ page }) => {
        const errors = collectPageErrors(page);

        await page.route('**/translations/BSB/meta.json', route => route.abort());

        await page.goto('/');
        await waitForPassage(page);

        await page.evaluate(() => window._bibleApp.changeTranslation('BSB'));
        await waitForPassage(page);

        expect(errors).toHaveLength(0);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#referencePickerModal')).toBeVisible();
        const otBooks = page.locator('.book-category[data-testament="Old Testament"] .book-item');
        const ntBooks = page.locator('.book-category[data-testament="New Testament"] .book-item');
        expect(await otBooks.count()).toBeGreaterThan(0);
        expect(await ntBooks.count()).toBeGreaterThan(0);
});'''

text = read()
text = replace_test(text, 'reference picker: book, chapter, verse flow supports verse and Go', 'book selector: testament filters toggle sections from canon data', REFERENCE_FLOW_TEST)
text = replace_test(text, 'book selector: testament filters toggle sections from canon data', 'chapter navigation: selecting a chapter opens verse picker and Go keeps chapter', FILTER_TEST)
text = replace_test(text, 'chapter navigation: selecting a chapter opens verse picker and Go keeps chapter', 'verse navigation: selecting a verse closes the verse modal', CHAPTER_TEST)
text = replace_test(text, 'verse navigation: selecting a verse closes the verse modal', 'translation: switching translation reloads passage in new translation', VERSE_TEST)
text = replace_test(text, 'passage cache: navigating back to a visited passage writes cache', 'settings: toggling verse numbers checkbox changes its state', PASSAGE_CACHE_TEST)
text = replace_test(text, 'dynamic book picker: translation without meta.json uses 66-book fallback', 'dynamic book picker: switching to BSB fires _rebuildBibleBooks', FALLBACK_TEST)
text = replace_test(text, 'dynamic book picker: book modal re-renders while open on translation switch', 'dynamic book picker: book not in canon redirects to Genesis 1', RERENDER_TEST)
text = replace_test(text, 'dynamic book picker: meta.json network error falls back gracefully', 'auth: unauthenticated user button opens login modal', META_ERROR_TEST)

for stale in ['#bookModal', '#chapterModal', '#verseModal', '#oldTestamentBooks', '#newTestamentBooks', '#chapterGrid', '#verseGrid', '#verseGoButton']:
    if stale in text:
        raise SystemExit(f'stale picker selector remains: {stale}')

if '#referencePickerModal' not in text or '#referencePickerView' not in text:
    raise SystemExit('unified picker selectors were not inserted')

write(text)
print('picker smoke tests migrated')
