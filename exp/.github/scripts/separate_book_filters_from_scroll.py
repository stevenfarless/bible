from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


index_path = Path("index.html")
modals_path = Path("modals.js")
components_path = Path("css/components.css")
tests_path = Path("tests/smoke.spec.js")

index = index_path.read_text(encoding="utf-8")
modals = modals_path.read_text(encoding="utf-8")
components = components_path.read_text(encoding="utf-8")
tests = tests_path.read_text(encoding="utf-8")

marker = 'id="bookTestamentFilters"'
if marker in index:
    print("Book filters are already separated from the scrollable body.")
    raise SystemExit(0)

old_index = """\t\t\t<div class=\"modal-header\">\n\t\t\t\t<h2>Select a Book</h2>\n\t\t\t\t<button class=\"close-btn\" id=\"closeBookModal\" aria-label=\"Close\">&#xD7;</button>\n\t\t\t</div>\n\t\t\t<div class=\"modal-body\">\n"""
new_index = """\t\t\t<div class=\"modal-header\">\n\t\t\t\t<h2>Select a Book</h2>\n\t\t\t\t<button class=\"close-btn\" id=\"closeBookModal\" aria-label=\"Close\">&#xD7;</button>\n\t\t\t</div>\n\t\t\t<div\n\t\t\t\tid=\"bookTestamentFilters\"\n\t\t\t\tclass=\"book-testament-filters\"\n\t\t\t\trole=\"group\"\n\t\t\t\taria-label=\"Filter books by testament\"\n\t\t\t></div>\n\t\t\t<div class=\"modal-body\">\n"""
index = replace_once(index, old_index, new_index, "book modal header/body boundary")

old_start = """export function populateBookModal(app) {
    const modalBody = app.bookModal?.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = '';
    modalBody.classList.remove('book-testament-filter-active');

    const sections = new Map();
    const filterButtons = new Map();
    let activeTestament = null;

    const filterBar = document.createElement('div');
    filterBar.className = 'book-testament-filters';
    filterBar.setAttribute('role', 'group');
    filterBar.setAttribute('aria-label', 'Filter books by testament');
"""
new_start = """export function populateBookModal(app) {
    const modalBody = app.bookModal?.querySelector('.modal-body');
    const filterBar = app.bookModal?.querySelector('.book-testament-filters');
    if (!modalBody || !filterBar) return;

    modalBody.innerHTML = '';
    filterBar.innerHTML = '';
    modalBody.classList.remove('book-testament-filter-active');

    const sections = new Map();
    const filterButtons = new Map();
    let activeTestament = null;
"""
modals = replace_once(modals, old_start, new_start, "book modal population setup")

modals = replace_once(
    modals,
    """    modalBody.appendChild(filterBar);

    const createBookButton = (book) => {
""",
    """    const createBookButton = (book) => {
""",
    "filter bar append into modal body",
)

old_css_start = components.index("/* Book & Chapter Selectors */")
old_css_end = components.index(".book-grid {", old_css_start)
new_css = """/* Book & Chapter Selectors */
#bookModal .book-testament-filters {
    flex-shrink: 0;
    display: flex;
    align-items: stretch;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-neutral);
}

#bookModal .modal-body {
    padding: 0 var(--spacing-lg) var(--spacing-lg);
}

.book-testament-filter {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    min-width: 0;
    height: 48px;
    padding: var(--spacing-sm);
    background-color: var(--bg-raised);
    border: 1px solid var(--border-neutral);
    border-radius: var(--border-radius);
    color: var(--text-body);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
    cursor: pointer;
    touch-action: manipulation;
    transition:
        background-color var(--transition-fast),
        border-color var(--transition-fast),
        color var(--transition-fast);
}

.book-testament-filter:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
}

.book-testament-filter--active,
.book-testament-filter--active:hover {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--bg-base);
}

.book-testament-filter:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.book-category {
    margin-bottom: var(--spacing-xl);
}

.book-category:first-child {
    padding-top: var(--spacing-lg);
}

.book-category h4 {
    position: relative;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--section-heading-color);
    margin: 0 0 var(--spacing-md);
    padding: var(--spacing-sm) 0;
    background-color: var(--bg-card);
    border-bottom: 2px solid var(--border-neutral);
}

#bookModal .modal-body:not(.book-testament-filter-active) .book-category h4 {
    position: sticky;
    top: 0;
    z-index: 2;
}

"""
components = components[:old_css_start] + new_css + components[old_css_end:]

old_test_anchor = """        await expect(page.locator('.book-testament-filter')).toHaveCount(2);
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
"""
new_test_anchor = """        await expect(page.locator('.book-testament-filter')).toHaveCount(2);
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
        await expect(page.locator('#bookModal .modal-content > .book-testament-filters')).toHaveCount(1);
        await expect(page.locator('#bookModal .modal-body > .book-testament-filters')).toHaveCount(0);
"""
tests = replace_once(tests, old_test_anchor, new_test_anchor, "book filter layout test anchor")

index_path.write_text(index, encoding="utf-8")
modals_path.write_text(modals, encoding="utf-8")
components_path.write_text(components, encoding="utf-8")
tests_path.write_text(tests, encoding="utf-8")

print("Separated book filters from the scrollable modal body.")
