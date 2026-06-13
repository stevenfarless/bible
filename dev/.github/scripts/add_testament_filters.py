from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


paths = {
    "modals": Path("modals.js"),
    "components": Path("css/components.css"),
    "geek": Path("css/geek95.css"),
    "tests": Path("tests/smoke.spec.js"),
}

texts = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}
markers = {
    "modals": "const BOOK_TESTAMENT_FILTERS = [",
    "components": ".book-testament-filters {",
    "geek": ".geek-theme.light-mode .book-testament-filter--active",
    "tests": "book selector: testament filters toggle sections from canon data",
}
installed = {name: marker in texts[name] for name, marker in markers.items()}

if all(installed.values()):
    print("Testament filters are already installed.")
    raise SystemExit(0)

if any(installed.values()):
    present = ", ".join(name for name, found in installed.items() if found)
    missing = ", ".join(name for name, found in installed.items() if not found)
    raise SystemExit(
        f"Partial testament-filter installation detected. Present: {present}. Missing: {missing}."
    )

book_modal_marker = "// ── Book modal ────────────────────────────────────────────────────────────────\n\n"
book_modal_constants = """// ── Book modal ────────────────────────────────────────────────────────────────

const BOOK_TESTAMENT_FILTERS = [
    { testament: 'Old Testament', label: 'Old Testament' },
    { testament: 'Deuterocanon', label: 'Apocrypha' },
    { testament: 'New Testament', label: 'New Testament' },
];

"""
texts["modals"] = replace_once(
    texts["modals"],
    book_modal_marker,
    book_modal_constants,
    "book modal section marker",
)

old_populate = """export function populateBookModal(app) {
    const modalBody = app.bookModal?.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = '';

    const createBookButton = (book) => {
        const btn = document.createElement('button');
        btn.className = 'book-item';
        btn.textContent = app.bookAbbreviations[book] || book;
        btn.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(book, 1);
            app.closeModal(app.bookModal);
        });
        return btn;
    };

    for (const [testament, books] of Object.entries(app.bibleBooks)) {
        const section = document.createElement('div');
        section.className = 'book-category';

        const heading = document.createElement('h4');
        heading.textContent = testament === 'Deuterocanon' ? 'Apocrypha / Deuterocanon' : testament;
        if (testament === 'Deuterocanon') {
            const infoBtn = document.createElement('button');
            infoBtn.className = 'deuterocanon-info-btn';
            infoBtn.setAttribute('aria-label', 'About the Deuterocanon');
            infoBtn.innerHTML = '?';
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDeuterocanonInfoModal(app);
            });
            heading.appendChild(infoBtn);
        }
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'book-grid';
        if (testament === 'Old Testament') grid.id = 'oldTestamentBooks';
        if (testament === 'New Testament') grid.id = 'newTestamentBooks';

        for (const book of Object.keys(books)) {
            grid.appendChild(createBookButton(book));
        }

        section.appendChild(grid);
        modalBody.appendChild(section);
    }
}
"""
new_populate = """export function populateBookModal(app) {
    const modalBody = app.bookModal?.querySelector('.modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = '';

    const sections = new Map();
    const filterButtons = new Map();
    let activeTestament = null;

    const filterBar = document.createElement('div');
    filterBar.className = 'book-testament-filters';
    filterBar.setAttribute('role', 'group');
    filterBar.setAttribute('aria-label', 'Filter books by testament');

    const applyFilter = (testament) => {
        activeTestament = activeTestament === testament ? null : testament;

        for (const [sectionTestament, section] of sections) {
            section.hidden = activeTestament !== null
                && sectionTestament !== activeTestament;
        }

        for (const [buttonTestament, button] of filterButtons) {
            const isActive = buttonTestament === activeTestament;
            button.classList.toggle('book-testament-filter--active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        }

        modalBody.scrollTop = 0;
    };

    for (const { testament, label } of BOOK_TESTAMENT_FILTERS) {
        const books = app.bibleBooks[testament];
        if (!books || Object.keys(books).length === 0) continue;

        const button = document.createElement('button');
        button.className = 'book-testament-filter';
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => applyFilter(testament));

        filterButtons.set(testament, button);
        filterBar.appendChild(button);
    }

    modalBody.appendChild(filterBar);

    const createBookButton = (book) => {
        const button = document.createElement('button');
        button.className = 'book-item';
        button.type = 'button';
        button.textContent = app.bookAbbreviations[book] || book;
        button.addEventListener('click', () => {
            app.state.selectedVerse = null;
            app.loadPassage(book, 1);
            app.closeModal(app.bookModal);
        });
        return button;
    };

    for (const [testament, books] of Object.entries(app.bibleBooks)) {
        const section = document.createElement('div');
        section.className = 'book-category';
        section.dataset.testament = testament;

        const heading = document.createElement('h4');
        heading.textContent = testament === 'Deuterocanon'
            ? 'Apocrypha / Deuterocanon'
            : testament;

        if (testament === 'Deuterocanon') {
            const infoButton = document.createElement('button');
            infoButton.className = 'deuterocanon-info-btn';
            infoButton.type = 'button';
            infoButton.setAttribute('aria-label', 'About the Deuterocanon');
            infoButton.textContent = '?';
            infoButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openDeuterocanonInfoModal(app);
            });
            heading.appendChild(infoButton);
        }
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'book-grid';
        if (testament === 'Old Testament') grid.id = 'oldTestamentBooks';
        if (testament === 'Deuterocanon') grid.id = 'deuterocanonBooks';
        if (testament === 'New Testament') grid.id = 'newTestamentBooks';

        for (const book of Object.keys(books)) {
            grid.appendChild(createBookButton(book));
        }

        section.appendChild(grid);
        sections.set(testament, section);
        modalBody.appendChild(section);
    }
}
"""
texts["modals"] = replace_once(
    texts["modals"],
    old_populate,
    new_populate,
    "book modal population function",
)

components_anchor = """/* Book & Chapter Selectors */
.book-category {
"""
components_replacement = """/* Book & Chapter Selectors */
.book-testament-filters {
    position: sticky;
    top: 0;
    z-index: 3;
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-neutral);
}

.book-testament-filter {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
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
"""
texts["components"] = replace_once(
    texts["components"],
    components_anchor,
    components_replacement,
    "book selector CSS anchor",
)

texts["geek"] = replace_once(
    texts["geek"],
    """.geek-theme.light-mode .book-item,
.geek-theme.light-mode .chapter-item,
.geek-theme.light-mode .toast-action,
""",
    """.geek-theme.light-mode .book-item,
.geek-theme.light-mode .chapter-item,
.geek-theme.light-mode .book-testament-filter,
.geek-theme.light-mode .toast-action,
""",
    "Geek theme button group",
)
texts["geek"] = replace_once(
    texts["geek"],
    """.geek-theme.light-mode .book-item:hover,
.geek-theme.light-mode .chapter-item:hover,
.geek-theme.light-mode .primary-btn:hover,
""",
    """.geek-theme.light-mode .book-item:hover,
.geek-theme.light-mode .chapter-item:hover,
.geek-theme.light-mode .book-testament-filter:hover,
.geek-theme.light-mode .primary-btn:hover,
""",
    "Geek theme hover group",
)
texts["geek"] = replace_once(
    texts["geek"],
    """.geek-theme.light-mode .book-item:active,
.geek-theme.light-mode .chapter-item:active,
.geek-theme.light-mode .primary-btn:active,
""",
    """.geek-theme.light-mode .book-item:active,
.geek-theme.light-mode .chapter-item:active,
.geek-theme.light-mode .book-testament-filter:active,
.geek-theme.light-mode .primary-btn:active,
""",
    "Geek theme active group",
)
texts["geek"] = replace_once(
    texts["geek"],
    """    transform: translate(1px, 1px);
}

.geek-theme.light-mode .selector-btn svg,
""",
    """    transform: translate(1px, 1px);
}

.geek-theme.light-mode .book-testament-filter--active,
.geek-theme.light-mode .book-testament-filter--active:hover {
    background: #dfe300;
    color: #000055;
    border-color: #ffffff #6c6c6c #6c6c6c #ffffff;
}

.geek-theme.light-mode .selector-btn svg,
""",
    "Geek theme active filter rule anchor",
)

book_navigation_test = """test('book navigation: selecting a book loads its first chapter', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        await page.locator('#newTestamentBooks button', { hasText: 'Matt' }).first().click();

        await expect(page.locator('#bookModal')).not.toHaveClass(/active/);
        await expect(page.locator('#passageTitle')).toContainText('Matthew 1');
        await expect(page.locator('#passageText')).not.toBeEmpty();
});
"""
filter_test = """

test('book selector: testament filters toggle sections from canon data', async ({ page }) => {
        await page.goto('/');
        await waitForPassage(page);

        await page.locator('#bookSelector').click();
        await expect(page.locator('#bookModal')).toBeVisible();

        const oldSection = page.locator('.book-category[data-testament="Old Testament"]');
        const newSection = page.locator('.book-category[data-testament="New Testament"]');
        const deuterocanonSection = page.locator('.book-category[data-testament="Deuterocanon"]');
        const oldFilter = page.getByRole('button', { name: 'Old Testament' });
        const newFilter = page.getByRole('button', { name: 'New Testament' });
        const apocryphaFilter = page.getByRole('button', { name: 'Apocrypha' });

        await expect(page.locator('.book-testament-filter')).toHaveCount(2);
        await expect(page.locator('.book-testament-filter--active')).toHaveCount(0);
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

        await apocryphaFilter.click();

        await expect(oldSection).toBeVisible();
        await expect(deuterocanonSection).toBeVisible();
        await expect(newSection).toBeVisible();
        await expect(apocryphaFilter).toHaveAttribute('aria-pressed', 'false');
});
"""
texts["tests"] = replace_once(
    texts["tests"],
    book_navigation_test,
    book_navigation_test + filter_test,
    "book navigation smoke test",
)

for name, path in paths.items():
    path.write_text(texts[name], encoding="utf-8")

print("Added toggleable testament filters to the book selector.")
