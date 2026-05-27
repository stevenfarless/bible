// search.js
// All search-related logic for BibleApp.
// Every function accepts an `app` instance as its first argument.

import { normaliseBookAlias } from './book-aliases.js';

// ─── Utilities ──────────────────────────────────────────────────────────────────────────────

export function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

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

// ─── Reference parsing ────────────────────────────────────────────────────────────────────

/**
 * Parses a Bible reference string into { book, chapter, verse }.
 *
 * 1. normaliseBookAlias() maps abbreviations/variants to canonical names.
 * 2. When bookList is provided, tries each name longest-first as a
 *    case-insensitive prefix match.
 * 3. Lazy regex fallback for callers without a book list.
 *
 * Accepts both ":" and " " as the chapter/verse delimiter so
 * "jn 3 16" and "John 3:16" both resolve correctly.
 *
 * @param {string} reference
 * @param {string[]} [bookList]
 * @returns {{ book: string, chapter: number, verse: number|null } | null}
 */
export function parseReference(reference, bookList) {
    const raw = String(reference || '').trim();
    const cleaned = normaliseBookAlias(raw);

    if (Array.isArray(bookList) && bookList.length > 0) {
        const sorted = [...bookList].sort((a, b) => b.length - a.length);
        for (const name of sorted) {
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const prefixRe = new RegExp(
                '^(' + escapedName + ')\\s+([\\d]+)(?:[:\\s]([\\d]+))?$',
                'i'
            );
            const m = cleaned.match(prefixRe);
            if (m) {
                const chapter = parseInt(m[2], 10);
                const verse = m[3] ? parseInt(m[3], 10) : null;
                if (!Number.isFinite(chapter)) continue;
                if (verse !== null && !Number.isFinite(verse)) continue;
                return { book: name, chapter, verse };
            }
        }
        return null;
    }

    // Regex fallback for callers without a book list.
    const match = cleaned.match(/^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+([\d]+)(?:[:\s]([\d]+))?$/);
    if (!match) return null;

    const book = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : null;

    if (!book || !Number.isFinite(chapter)) return null;
    if (verse !== null && !Number.isFinite(verse)) return null;

    return { book, chapter, verse };
}

export function isPassageReference(query) {
    const patterns = [
        /^[1-3]?\s*[a-z]+\s+\d+/i,
        /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
    ];
    return patterns.some((p) => p.test(query.trim()));
}

export async function loadPassageFromReference(app, reference) {
    const allBooks = app.getAllBooks();
    const parsed = parseReference(reference, allBooks);
    if (!parsed) return;
    const { book, chapter, verse } = parsed;

    app.state.selectedVerse = verse || null;
    await app.loadPassage(book, chapter);
    if (verse) {
        requestAnimationFrame(() => app.scrollToVerse(verse));
    }
}

// ─── UI state ────────────────────────────────────────────────────────────────────────────────

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

// ─── Input handling ─────────────────────────────────────────────────────────────────────

export function handleSearch(app, query) {
    clearTimeout(app.searchTimeout);
    clearTimeout(app.searchBlurTimeout);
    app.searchLastQuery = query;
    app.currentSearchResults = [];

    if (!query.trim()) {
        app.searchResults.innerHTML = '';
        app.searchSelectedIndex = -1;
        app.searchResultItems = null;
        return;
    }

    // Dismiss the system keyboard 800 ms after the user stops typing.
    // The input stays focused (and can be re-tapped) but the keyboard retracts
    // so search results are visible without manual dismissal.
    app.searchBlurTimeout = setTimeout(() => {
        app.searchInput?.blur();
    }, 800);

    app.searchTimeout = setTimeout(async () => {
        if (isPassageReference(query)) {
            await handlePassageReference(app, query);
        } else {
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

// ─── Result list selection ─────────────────────────────────────────────────────────────────

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

// ─── API calls ───────────────────────────────────────────────────────────────────────────────

export async function handlePassageReference(app, reference) {
    const data = await app.bibleApi.fetchPassage(reference);

    if (data && data.passages && data.passages.length > 0) {
        const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
        const preview = stripHTML(data.passages[0]).substring(0, 200);

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
        // fetchPassage returned null — the input looked like a reference but
        // didn't resolve. Fall back to keyword search so the user still gets
        // results rather than a dead-end "No passage found".
        await performKeywordSearch(app, reference);
    }
}

export async function fetchAllSearchResults(app, query, onBatch) {
    app.currentSearchResults = [];
    await app.bibleApi.searchPassages(query, (batchResults) => {
        app.currentSearchResults.push(...batchResults);
        if (typeof onBatch === 'function') onBatch(app.currentSearchResults.slice());
    });
    return app.currentSearchResults;
}

// ─── Grouping & display ───────────────────────────────────────────────────────────────────

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
        const testament = app.getTestament?.(book);

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

    await fetchAllSearchResults(app, query, (accumulatedResults) => {
        if (accumulatedResults.length > 0) {
            displaySearchResults(app, accumulatedResults, query);
        }
    });

    if (app.currentSearchResults.length > 0) {
        displaySearchResults(app, app.currentSearchResults, query);
    } else {
        app.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        refreshSearchResultItems(app, false);
    }

    // ── Cross-translation supplemental search (megasearch) ───────────────────
    // Only runs when the "Search all translations" toggle is on AND the query
    // is at least 3 characters. Silently skips uncached translations.
    const megasearchToggle = document.getElementById('megasearchToggle');
    const megasearchEnabled = megasearchToggle?.checked ?? false;

    if (megasearchEnabled && query.trim().length >= 3) {
        const queryAtLaunch = query;
        const knownRefs = new Set(app.currentSearchResults.map((r) => r.reference));

        app.bibleApi.searchPassagesAllTranslations(query, knownRefs).then((supplemental) => {
            if (app.searchLastQuery !== queryAtLaunch) return;
            if (!supplemental || supplemental.length === 0) return;

            const combined = [...app.currentSearchResults, ...supplemental];
            app.currentSearchResults = combined;
            displaySearchResults(app, combined, query);
        }).catch((err) => {
            console.warn('megasearch background pass failed', err);
        });
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

    // ── Results summary bar ────────────────────────────────────────────────
    const totalVerses = results.length;
    const totalBooks = groups.reduce((acc, g) => acc + g.books.length, 0);
    const countLabel = `${totalVerses} verse${totalVerses !== 1 ? 's' : ''} in ${totalBooks} book${totalBooks !== 1 ? 's' : ''}`;

    const parts = [
        `<div class="search-results-summary">
          <span class="search-results-count">${countLabel}</span>
          <span class="search-results-actions">
            <button class="search-expand-collapse-btn" data-action="expand">expand all</button>
            <span class="search-results-divider">·</span>
            <button class="search-expand-collapse-btn" data-action="collapse">collapse all</button>
          </span>
        </div>`,
    ];

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

                // Show source translation badge for supplemental results.
                const badge = result.sourceTranslation
                    ? ` <span class="search-result-translation-badge">${esc(result.sourceTranslation)}</span>`
                    : '';

                parts.push(`
          <div class="search-result-item" data-reference="${esc(result.reference)}" ${result.sourceTranslation ? `data-source-translation="${esc(result.sourceTranslation)}"` : ''}>
            <div class="search-result-reference">${esc(result.reference)}${badge}</div>
            <div class="search-result-content">${highlighted}</div>
          </div>
        `);
            }
        }
    }

    app.searchResults.innerHTML = parts.join('');

    // ── Expand / collapse all buttons ─────────────────────────────────────
    app.searchResults.querySelectorAll('.search-expand-collapse-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'expand') {
                for (const g of groups) {
                    app.searchExpandedTestaments.add(g.heading);
                    for (const b of g.books) app.searchExpandedBooks.add(b.book);
                }
            } else {
                app.searchExpandedTestaments.clear();
                app.searchExpandedBooks.clear();
            }
            displaySearchResults(app, results, query);
        });
    });

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
            // For supplemental results, switch to the source translation before
            // navigating so the passage the user sees matches the text they found.
            const sourceTrans = item.dataset.sourceTranslation;
            if (sourceTrans && sourceTrans !== app.bibleApi.translation) {
                await app.changeTranslation(sourceTrans);
            }
            await loadPassageFromReference(app, item.dataset.reference);
            closeSearch(app);
        });
    });

    refreshSearchResultItems(app, true);
}
