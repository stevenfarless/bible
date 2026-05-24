// ====================
// Search Module
// ====================
// All search-related functions follow the same pattern as reading-state.js:
// they accept the app instance as the first argument instead of using `this`.

/**
 * Escape special RegExp characters in a string.
 */
export function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap matched search terms in <strong> tags.
 */
export function highlightSearchTerm(text, term) {
    if (text == null) return '';
    const safeText = String(text);
    const rawTerm = term == null ? '' : String(term).trim();
    if (!rawTerm) return safeText;

    try {
        const regex = new RegExp(escapeRegExp(rawTerm), 'gi');
        return safeText.replace(regex, (match) => `<strong>${match}</strong>`);
    } catch (err) {
        console.warn('highlightSearchTerm failed', err);
        return safeText;
    }
}

export function toggleSearch(app) {
    app.searchContainer.classList.toggle('active');
    if (app.searchContainer.classList.contains('active')) {
        app.searchInput.focus();
    } else {
        app.searchInput.value = '';
        app.searchResults.innerHTML = '';
        app.searchSelectedIndex = -1;
        app.searchResultItems = [];
    }
}

export function closeSearch(app) {
    app.searchContainer.classList.remove('active');
    app.searchInput.value = '';
    app.searchResults.innerHTML = '';
    app.searchSelectedIndex = -1;
    app.searchResultItems = [];
}

export function handleSearch(app, query) {
    clearTimeout(app.searchTimeout);
    app.searchLastQuery = query;
    app.searchPage = 1;
    app.currentSearchResults = [];

    if (!query.trim()) {
        app.searchResults.innerHTML = '';
        app.searchSelectedIndex = -1;
        app.searchResultItems = null;
        return;
    }

    app.searchTimeout = setTimeout(async () => {
        if (isPassageReference(query)) {
            await handlePassageReference(app, query);
        } else {
            app.searchPage = 1;
            await performKeywordSearch(app, query);
        }
    }, 300);
}

export function handleSearchKeydown(app, e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch(app);
        return;
    }

    if (!app.searchResultItems || app.searchResultItems.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSearchSelectedIndex(app, Math.min(app.searchSelectedIndex + 1, app.searchResultItems.length - 1), true);
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSearchSelectedIndex(app, Math.max(app.searchSelectedIndex - 1, 0), true);
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        activateSelectedSearchResult(app);
    }
}

export function refreshSearchResultItems(app, autoSelectFirst = false) {
    app.searchResultItems = Array.from(
        app.searchResults.querySelectorAll('.search-result-item')
    );

    if (!app.searchResultItems.length) {
        app.searchSelectedIndex = -1;
        return;
    }

    if (autoSelectFirst) {
        setSearchSelectedIndex(app, 0, false);
    } else {
        if (app.searchSelectedIndex < 0 || app.searchSelectedIndex >= app.searchResultItems.length) {
            app.searchSelectedIndex = -1;
        } else {
            setSearchSelectedIndex(app, app.searchSelectedIndex, false);
        }
    }
}

export function setSearchSelectedIndex(app, index, scrollIntoView = false) {
    if (!app.searchResultItems || app.searchResultItems.length === 0) {
        app.searchSelectedIndex = -1;
        return;
    }

    const clamped = Math.max(0, Math.min(index, app.searchResultItems.length - 1));
    app.searchSelectedIndex = clamped;

    app.searchResultItems.forEach((el, i) => {
        el.classList.toggle('selected', i === clamped);
    });

    if (scrollIntoView) {
        app.searchResultItems[clamped]?.scrollIntoView({ block: 'nearest' });
    }
}

export function activateSelectedSearchResult(app) {
    if (!app.searchResultItems || app.searchSelectedIndex < 0 || app.searchSelectedIndex >= app.searchResultItems.length) return;
    app.searchResultItems[app.searchSelectedIndex]?.click();
}

export function isPassageReference(query) {
    const patterns = [
        /^[1-3]?\s*[a-z]+\s+\d+/i,
        /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
    ];
    return patterns.some((p) => p.test(query.trim()));
}

export async function handlePassageReference(app, reference) {
    const data = await app.bibleApi.fetchPassage(reference);

    if (data && data.passages && data.passages.length > 0) {
        const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
        const preview = app.stripHTML(data.passages[0]).substring(0, 200);

        app.searchResults.innerHTML =
            '<div class="search-result-item" data-reference="' + safeCanonical + '">' +
            '<div class="search-result-reference">' + safeCanonical + '</div>' +
            '<div class="search-result-content">' + preview + '...</div>' +
            '</div>';

        const item = app.searchResults.querySelector('.search-result-item');
        if (item) {
            item.addEventListener('click', async () => {
                await loadPassageFromReference(app, item.dataset.reference);
                closeSearch(app);
            });
        }

        refreshSearchResultItems(app, true);
    } else {
        app.searchResults.innerHTML = '<div class="search-no-results">No passage found</div>';
        refreshSearchResultItems(app, false);
    }
}

export async function fetchAllSearchResults(app, query) {
    app.currentSearchResults = [];
    app.searchPage = 1;

    while (true) {
        const data = await app.bibleApi.searchPassages(query, app.searchPage);
        if (!data || !data.results || !data.results.length) break;

        app.currentSearchResults = app.currentSearchResults.concat(data.results);

        const total = data.total_results ?? data.total;
        const pageSize = data.page_size ?? 100;
        const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

        if (app.searchPage >= totalPages || app.searchPage >= 10) break;

        app.searchPage += 1;
    }

    return app.currentSearchResults;
}

export function groupSearchResultsByCanon(app, results) {
    if (!Array.isArray(results)) return [];

    const otBooks = Object.keys(app.bibleBooks['Old Testament']);
    const ntBooks = Object.keys(app.bibleBooks['New Testament']);
    const otGroups = new Map();
    const ntGroups = new Map();

    for (const result of results) {
        const parsed = parseReference(result.reference);
        if (!parsed) continue;
        const { book } = parsed;
        const testament = app.getTestament(book);

        if (testament === 'Old Testament') {
            if (!otGroups.has(book)) otGroups.set(book, []);
            otGroups.get(book).push(result);
        } else if (testament === 'New Testament') {
            if (!ntGroups.has(book)) ntGroups.set(book, []);
            ntGroups.get(book).push(result);
        }
    }

    const grouped = [];

    if (otGroups.size) {
        grouped.push({
            heading: 'Old Testament',
            books: otBooks.filter((b) => otGroups.has(b)).map((book) => ({ book, results: otGroups.get(book) })),
        });
    }

    if (ntGroups.size) {
        grouped.push({
            heading: 'New Testament',
            books: ntBooks.filter((b) => ntGroups.has(b)).map((book) => ({ book, results: ntGroups.get(book) })),
        });
    }

    return grouped;
}

export async function performKeywordSearch(app, query) {
    app.searchResults.innerHTML = '<div class="loading" style="min-height: 100px">Searching...</div>';
    app.searchSelectedIndex = -1;
    app.searchResultItems = [];

    app.searchExpandedTestaments?.clear();
    app.searchExpandedBooks?.clear();

    const allResults = await fetchAllSearchResults(app, query);

    if (allResults && allResults.length > 0) {
        displaySearchResults(app, allResults, query);
    } else {
        app.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        refreshSearchResultItems(app, false);
    }
}

export function displaySearchResults(app, results, query) {
    const groups = groupSearchResultsByCanon(app, results);

    if (!groups.length) {
        app.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        refreshSearchResultItems(app, false);
        return;
    }

    if (app.searchExpandedTestaments.size === 0 && app.searchExpandedBooks.size === 0) {
        const firstGroup = groups[0];
        if (firstGroup) {
            app.searchExpandedTestaments.add(firstGroup.heading);
            const firstBook = firstGroup.books && firstGroup.books[0];
            if (firstBook) app.searchExpandedBooks.add(firstBook.book);
        }
    }

    const esc = (str) =>
        String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const parts = [];

    for (const group of groups) {
        const testName = group.heading;
        const testamentExpanded = app.searchExpandedTestaments.has(testName);

        parts.push(`
      <div class="search-group-heading" data-testament="${esc(testName)}">
        <span class="search-group-title">${esc(testName)}</span>
        <span class="search-group-chevron ${testamentExpanded ? 'expanded' : ''}">&#9662;</span>
      </div>
    `);

        if (!testamentExpanded) continue;

        for (const bookBlock of group.books) {
            const bookName = bookBlock.book;
            const bookExpanded = app.searchExpandedBooks.has(bookName);

            parts.push(`
        <div class="search-book-heading" data-book="${esc(bookName)}">
          <span class="search-book-title">${esc(app.getDisplayName(bookName))}</span>
          <span class="search-book-chevron ${bookExpanded ? 'expanded' : ''}">&#9662;</span>
        </div>
      `);

            if (!bookExpanded) continue;

            for (const result of bookBlock.results) {
                let highlighted = result.content;
                try {
                    highlighted = highlightSearchTerm(result.content, query);
                } catch (err) {
                    console.warn('highlight failed', err);
                }

                parts.push(`
          <div class="search-result-item" data-reference="${esc(result.reference)}">
            <div class="search-result-reference">${esc(result.reference)}</div>
            <div class="search-result-content">${highlighted}</div>
          </div>
        `);
            }
        }
    }

    app.searchResults.innerHTML = parts.join('');

    app.searchResults.querySelectorAll('.search-group-heading').forEach((el) => {
        el.addEventListener('click', () => {
            const testament = el.getAttribute('data-testament');
            if (!testament) return;
            if (app.searchExpandedTestaments.has(testament)) {
                app.searchExpandedTestaments.delete(testament);
            } else {
                app.searchExpandedTestaments.add(testament);
            }
            displaySearchResults(app, results, query);
        });
    });

    app.searchResults.querySelectorAll('.search-book-heading').forEach((el) => {
        el.addEventListener('click', () => {
            const book = el.getAttribute('data-book');
            if (!book) return;
            if (app.searchExpandedBooks.has(book)) {
                app.searchExpandedBooks.delete(book);
            } else {
                app.searchExpandedBooks.add(book);
            }
            displaySearchResults(app, results, query);
        });
    });

    app.searchResults.querySelectorAll('.search-result-item').forEach((item) => {
        item.addEventListener('click', async () => {
            await loadPassageFromReference(app, item.dataset.reference);
            closeSearch(app);
        });
    });

    refreshSearchResultItems(app, true);
}

export function parseReference(reference) {
    const cleaned = String(reference || '').trim();
    const match = cleaned.match(/^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?::(\d+))?$/);
    if (!match) return null;

    const book = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : null;

    if (!book || !Number.isFinite(chapter)) return null;
    if (verse !== null && !Number.isFinite(verse)) return null;

    return { book, chapter, verse };
}

export async function loadPassageFromReference(app, reference) {
    const parsed = parseReference(reference);
    if (!parsed) return;

    const { book, chapter, verse } = parsed;
    app.state.selectedVerse = verse || null;
    await app.loadPassage(book, chapter);

    if (verse) app.scrollToVerse(verse);
}
