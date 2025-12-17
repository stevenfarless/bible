// js/modules/search-manager.js
import { getAllBooks, getTestament } from './bible-structure.js';

export class SearchManager {
    constructor(app) {
        this.app = app;
        this.timeout = null;
        this.selectedIndex = -1;
        this.resultItems = null;
        this.page = 1;
        this.lastQuery = '';
        this.hasMore = false;
        this.currentResults = [];
        this.expandedTestaments = new Set();
        this.expandedBooks = new Set();
    }

    toggleSearch() {
        const container = this.app.ui.elements.searchContainer;
        const input = this.app.ui.elements.searchInput;

        container.classList.toggle('active');
        if (container.classList.contains('active')) {
            input.focus();
        } else {
            this.closeSearch();
        }
    }

    closeSearch() {
        const ui = this.app.ui.elements;
        ui.searchContainer.classList.remove('active');
        ui.searchInput.value = '';
        ui.searchResults.innerHTML = '';
        this.selectedIndex = -1;
        this.resultItems = [];
    }

    handleInput(query) {
        clearTimeout(this.timeout);
        this.lastQuery = query;
        this.page = 1;
        this.currentResults = [];

        if (!query.trim()) {
            this.app.ui.elements.searchResults.innerHTML = '';
            this.selectedIndex = -1;
            this.resultItems = null;
            return;
        }

        this.timeout = setTimeout(async () => {
            if (this.isPassageReference(query)) {
                await this.handlePassageReference(query);
            } else {
                this.page = 1;
                await this.performKeywordSearch(query, false);
            }
        }, 300);
    }

    isPassageReference(query) {
        const patterns = [
            /^[1-3]?\s*[a-z]+\s+\d+/i,
            /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
        ];
        return patterns.some((pattern) => pattern.test(query.trim()));
    }

    async handlePassageReference(reference) {
        const data = await this.app.bibleApi.fetchPassage(reference);
        const resultsContainer = this.app.ui.elements.searchResults;

        if (data && data.passages && data.passages.length > 0) {
            const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
            const preview = this.app.ui.stripHTML(data.passages[0]).substring(0, 200);

            resultsContainer.innerHTML =
                `<div class="search-result-item" data-reference="${safeCanonical}">
                    <div class="search-result-reference">${safeCanonical}</div>
                    <div class="search-result-content">${preview}...</div>
                </div>`;

            const item = resultsContainer.querySelector('.search-result-item');
            if (item) {
                item.addEventListener('click', async () => {
                    await this.loadPassageFromReference(item.dataset.reference);
                    this.closeSearch();
                });
            }
            this.refreshResultItems(true);
        } else {
            resultsContainer.innerHTML = '<div class="search-no-results">No passage found</div>';
            this.refreshResultItems(false);
        }
    }

    async performKeywordSearch(query) {
        const resultsContainer = this.app.ui.elements.searchResults;
        resultsContainer.innerHTML = '<div class="loading" style="min-height: 100px">Searching...</div>';
        this.selectedIndex = -1;
        this.resultItems = [];

        if (this.expandedTestaments) this.expandedTestaments.clear();
        if (this.expandedBooks) this.expandedBooks.clear();

        const allResults = await this.fetchAllSearchResults(query);

        if (allResults && allResults.length > 0) {
            this.displaySearchResults(allResults, query);
        } else {
            resultsContainer.innerHTML = '<div class="search-no-results">No results found</div>';
            this.refreshResultItems(false);
        }
    }

    async fetchAllSearchResults(query) {
        this.currentResults = [];
        this.page = 1;

        while (true) {
            const data = await this.app.bibleApi.searchPassages(query, this.page);
            if (!data || !data.results || !data.results.length) break;

            this.currentResults = this.currentResults.concat(data.results);
            const total = data.total_results ?? data.total;
            const pageSize = data.page_size ?? 100;
            const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

            if (this.page >= totalPages) break;
            if (this.page >= 10) break; // Safety cap

            this.page += 1;
        }
        return this.currentResults;
    }

    displaySearchResults(results, query) {
        const groups = this.groupSearchResultsByCanon(results);
        const resultsContainer = this.app.ui.elements.searchResults;

        if (!groups.length) {
            resultsContainer.innerHTML = '<div class="search-no-results">No results found</div>';
            this.refreshResultItems(false);
            return;
        }

        if (this.expandedTestaments.size === 0 && this.expandedBooks.size === 0) {
            const firstGroup = groups[0];
            if (firstGroup) {
                this.expandedTestaments.add(firstGroup.heading);
                const firstBook = firstGroup.books && firstGroup.books[0];
                if (firstBook) this.expandedBooks.add(firstBook.book);
            }
        }

        const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const parts = [];

        for (const group of groups) {
            const testName = group.heading;
            const testamentExpanded = this.expandedTestaments.has(testName);

            parts.push(`
                <div class="search-group-heading" data-testament="${escapeHtml(testName)}">
                    <span class="search-group-title">${escapeHtml(testName)}</span>
                    <span class="search-group-chevron ${testamentExpanded ? 'expanded' : ''}">▾</span>
                </div>
            `);

            if (!testamentExpanded) continue;

            for (const bookBlock of group.books) {
                const bookName = bookBlock.book;
                const bookExpanded = this.expandedBooks.has(bookName);

                parts.push(`
                    <div class="search-book-heading" data-book="${escapeHtml(bookName)}">
                        <span class="search-book-title">${escapeHtml(bookName)}</span>
                        <span class="search-book-chevron ${bookExpanded ? 'expanded' : ''}">▾</span>
                    </div>
                `);

                if (!bookExpanded) continue;

                for (const result of bookBlock.results) {
                    let highlightedContent = this.highlightSearchTerm(result.content, query);
                    const safeRef = escapeHtml(result.reference);

                    parts.push(`
                        <div class="search-result-item" data-reference="${safeRef}">
                            <div class="search-result-reference">${safeRef}</div>
                            <div class="search-result-content">${highlightedContent}</div>
                        </div>
                    `);
                }
            }
        }

        resultsContainer.innerHTML = parts.join('');

        this.attachResultListeners(results, query);
        this.refreshResultItems(true);
    }

    attachResultListeners(results, query) {
        const container = this.app.ui.elements.searchResults;

        container.querySelectorAll('.search-group-heading').forEach((el) => {
            el.addEventListener('click', () => {
                const t = el.getAttribute('data-testament');
                if (this.expandedTestaments.has(t)) this.expandedTestaments.delete(t);
                else this.expandedTestaments.add(t);
                this.displaySearchResults(results, query);
            });
        });

        container.querySelectorAll('.search-book-heading').forEach((el) => {
            el.addEventListener('click', () => {
                const b = el.getAttribute('data-book');
                if (this.expandedBooks.has(b)) this.expandedBooks.delete(b);
                else this.expandedBooks.add(b);
                this.displaySearchResults(results, query);
            });
        });

        container.querySelectorAll('.search-result-item').forEach((item) => {
            item.addEventListener('click', async () => {
                await this.loadPassageFromReference(item.dataset.reference);
                this.closeSearch();
            });
        });
    }

    highlightSearchTerm(text, term) {
        if (!text) return '';
        const safeText = String(text);
        const rawTerm = term ? String(term).trim() : '';
        if (!rawTerm) return safeText;

        const escapedTerm = String(rawTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const regex = new RegExp(escapedTerm, 'gi');
            return safeText.replace(regex, (match) => `<strong>${match}</strong>`);
        } catch {
            return safeText;
        }
    }

    groupSearchResultsByCanon(results) {
        if (!Array.isArray(results)) return [];

        const otGroups = new Map();
        const ntGroups = new Map();

        for (const result of results) {
            const parsed = this.parseReference(result.reference);
            if (!parsed) continue;

            const { book } = parsed;
            const testament = getTestament(book);

            if (testament === "Old Testament") {
                if (!otGroups.has(book)) otGroups.set(book, []);
                otGroups.get(book).push(result);
            } else if (testament === "New Testament") {
                if (!ntGroups.has(book)) ntGroups.set(book, []);
                ntGroups.get(book).push(result);
            }
        }

        const grouped = [];
        const otBooks = getAllBooks().filter(b => getTestament(b) === 'Old Testament');
        const ntBooks = getAllBooks().filter(b => getTestament(b) === 'New Testament');

        if (otGroups.size) {
            grouped.push({
                heading: "Old Testament",
                books: otBooks.filter(b => otGroups.has(b)).map(book => ({ book, results: otGroups.get(book) }))
            });
        }
        if (ntGroups.size) {
            grouped.push({
                heading: "New Testament",
                books: ntBooks.filter(b => ntGroups.has(b)).map(book => ({ book, results: ntGroups.get(book) }))
            });
        }
        return grouped;
    }

    parseReference(reference) {
        const cleaned = String(reference || '').trim();
        const match = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
        if (!match) return null;

        const book = match[1].trim();
        const chapter = parseInt(match[2], 10);
        const verse = match[3] ? parseInt(match[3], 10) : null;
        return { book, chapter, verse };
    }

    async loadPassageFromReference(reference) {
        const parsed = this.parseReference(reference);
        if (!parsed) return;

        this.app.state.selectedVerse = parsed.verse || null;
        await this.app.loadPassage(parsed.book, parsed.chapter);
        if (parsed.verse) {
            this.app.ui.scrollToVerse(parsed.verse);
        }
    }

    refreshResultItems(autoSelectFirst) {
        this.resultItems = Array.from(this.app.ui.elements.searchResults.querySelectorAll('.search-result-item'));
        if (!this.resultItems.length) {
            this.selectedIndex = -1;
            return;
        }
        if (autoSelectFirst) this.setSelectedIndex(0, false);
    }

    setSelectedIndex(index, scroll) {
        if (!this.resultItems || !this.resultItems.length) return;
        const clamped = Math.max(0, Math.min(index, this.resultItems.length - 1));
        this.selectedIndex = clamped;

        this.resultItems.forEach((el, i) => {
            if (i === clamped) el.classList.add('selected');
            else el.classList.remove('selected');
        });

        if (scroll && this.resultItems[clamped]) {
            this.resultItems[clamped].scrollIntoView({ block: 'nearest' });
        }
    }

    handleKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeSearch();
            return;
        }
        if (!this.resultItems || !this.resultItems.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.setSelectedIndex(this.selectedIndex + 1, true);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.setSelectedIndex(this.selectedIndex - 1, true);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = this.resultItems[this.selectedIndex];
            if (selected) selected.click();
        }
    }
}
