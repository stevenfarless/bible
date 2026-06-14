from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected {label} was not found; aborting without changes.")
    return text.replace(old, new, 1)


modals_path = Path("modals.js")
components_path = Path("css/components.css")
modals = modals_path.read_text(encoding="utf-8")
components = components_path.read_text(encoding="utf-8")

installed = (
    "--book-filter-row-height: 65px;" in components
    and "--book-filter-height" not in modals
    and "bookFilterResizeObserver" not in modals
)
if installed:
    print("Book modal sticky layers are already corrected.")
    raise SystemExit(0)

old_observer_reset = """    app.bookFilterResizeObserver?.disconnect();
    app.bookFilterResizeObserver = null;

"""
modals = replace_once(
    modals,
    old_observer_reset,
    "",
    "book filter observer cleanup",
)

old_measurement = """    modalBody.appendChild(filterBar);

    const updateFilterHeight = () => {
        modalBody.style.setProperty(
            '--book-filter-height',
            `${filterBar.offsetHeight}px`
        );
    };

    requestAnimationFrame(updateFilterHeight);

    if (typeof ResizeObserver !== 'undefined') {
        app.bookFilterResizeObserver = new ResizeObserver(updateFilterHeight);
        app.bookFilterResizeObserver.observe(filterBar);
    }

    const createBookButton = (book) => {
"""
new_measurement = """    modalBody.appendChild(filterBar);

    const createBookButton = (book) => {
"""
modals = replace_once(
    modals,
    old_measurement,
    new_measurement,
    "book filter height measurement block",
)

old_css = """/* Book & Chapter Selectors */
.book-testament-filters {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    gap: var(--spacing-sm);
    margin: 0;
    padding: 0 0 var(--spacing-md);
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-neutral);
    isolation: isolate;
}

.book-testament-filters + .book-category {
    padding-top: var(--spacing-lg);
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
    margin-bottom: var(--spacing-xl);
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
    top: var(--book-filter-height, 0px);
    z-index: 3;
}

.book-testament-filters::before,
#bookModal .modal-body:not(.book-testament-filter-active) .book-category h4::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background-color: var(--bg-card);
}
"""
new_css = """/* Book & Chapter Selectors */
#bookModal .modal-body {
    --book-filter-row-height: 65px;
}

.book-testament-filters {
    position: sticky;
    top: calc(-1 * var(--spacing-lg));
    z-index: 4;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    height: calc(
        var(--book-filter-row-height) + var(--spacing-lg)
    );
    margin:
        calc(-1 * var(--spacing-lg))
        0
        0;
    padding:
        var(--spacing-lg)
        0
        var(--spacing-md);
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-neutral);
}

.book-testament-filters + .book-category {
    padding-top: var(--spacing-lg);
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
    top: calc(
        var(--book-filter-row-height)
        - var(--spacing-lg)
    );
    z-index: 3;
}
"""
components = replace_once(
    components,
    old_css,
    new_css,
    "book selector sticky CSS block",
)

modals_path.write_text(modals, encoding="utf-8")
components_path.write_text(components, encoding="utf-8")

print("Corrected the book modal sticky layers.")
