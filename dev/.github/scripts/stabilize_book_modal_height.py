from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


modals_path = Path("modals.js")
tests_path = Path("tests/smoke.spec.js")
modals = modals_path.read_text(encoding="utf-8")
tests = tests_path.read_text(encoding="utf-8")

modals_marker = "content.style.height = `${content.offsetHeight}px`;"
tests_marker = "const initialBookModalHeight = await modalContent.evaluate"

if modals_marker in modals and tests_marker in tests:
    print("Book modal height stabilization is already installed.")
    raise SystemExit(0)

if (modals_marker in modals) != (tests_marker in tests):
    raise SystemExit("Partial book modal height stabilization detected; aborting without changes.")

old_open = """export function openBookModal(app) {
    populateBookModal(app);
    openModal(app, app.bookModal);
}
"""
new_open = """export function openBookModal(app) {
    const content = app.bookModal?.querySelector('.modal-content');
    if (content) content.style.height = '';

    populateBookModal(app);
    openModal(app, app.bookModal);

    requestAnimationFrame(() => {
        if (!content || !app.bookModal?.classList.contains('active')) return;
        content.style.height = `${content.offsetHeight}px`;
    });
}
"""
modals = replace_once(modals, old_open, new_open, "book modal open function")

old_test_setup = """test('book selector: testament filters toggle sections from canon data', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        const oldSection = page.locator('.book-category[data-testament=\"Old Testament\"]');
"""
new_test_setup = """test('book selector: testament filters toggle sections from canon data', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        const modalContent = page.locator('#bookModal .modal-content');
        await expect.poll(() => modalContent.evaluate((element) => element.style.height)).not.toBe('');
        const initialBookModalHeight = await modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        );

        const oldSection = page.locator('.book-category[data-testament=\"Old Testament\"]');
"""
tests = replace_once(tests, old_test_setup, new_test_setup, "testament filter test setup")

old_new_filter_assertion = """        await expect(newFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(newFilter).toHaveClass(/book-testament-filter--active/);

        await oldFilter.click();
"""
new_new_filter_assertion = """        await expect(newFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(newFilter).toHaveClass(/book-testament-filter--active/);
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);

        await oldFilter.click();
"""
tests = replace_once(
    tests,
    old_new_filter_assertion,
    new_new_filter_assertion,
    "New Testament filter height assertion anchor",
)

old_apocrypha_assertion = """        await expect(deuterocanonSection).toBeVisible();
        await expect(apocryphaFilter).toHaveAttribute('aria-pressed', 'true');

        await apocryphaFilter.click();
"""
new_apocrypha_assertion = """        await expect(deuterocanonSection).toBeVisible();
        await expect(apocryphaFilter).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => modalContent.evaluate(
                (element) => Math.round(element.getBoundingClientRect().height)
        )).toBe(initialBookModalHeight);

        await apocryphaFilter.click();
"""
tests = replace_once(
    tests,
    old_apocrypha_assertion,
    new_apocrypha_assertion,
    "Apocrypha filter height assertion anchor",
)

modals_path.write_text(modals, encoding="utf-8")
tests_path.write_text(tests, encoding="utf-8")

print("Stabilized the book modal at its initial all-books height.")
