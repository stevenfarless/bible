// ====================
// ESV Bible Reader App
// ====================

import { BibleApi } from './bible-api.js';
import { BIBLE_BOOKS, BOOK_ABBREVIATIONS, getAllBooks, getChapterCount, getTestament } from './constants.js';
import { NavigationManager } from './navigation-manager.js';
import { ModalManager } from './modal-manager.js';
import { ChromeController } from './chrome-controller.js';
import { attachEventListeners } from './event-handlers.js';
import { PassageRenderer } from './passage-renderer.js';
import { AuthManager } from './auth-manager.js';
import { loadUserData as loadUserDataFromFirebase } from './firebase-config.js';
import { cacheElements, loadTheme } from './ui.js';

class BibleApp {
    constructor() {
        // Configuration
        this.API_BASE_URL = 'https://api.esv.org/v3';
        this.API_KEY = '';

        // Firebase references
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;

        // State
        this.state = {
            currentBook: 'John',
            currentChapter: 1,
            currentMaxVerse: null, // ← NEW: actual last verse from API
            selectedVerse: null,
            fontSize: 18,
            showVerseNumbers: true,
            showHeadings: true,
            showFootnotes: false,
            showCrossReferences: false,
            verseByVerse: false,
            colorTheme: 'dracula',
            lightMode: false
        };

        // Managers & Controllers
        this.bibleApi = new BibleApi(
            this.API_BASE_URL,
            () => this.API_KEY,
            () => this.state
        );
        this.navigationManager = new NavigationManager(this.state, BOOK_ABBREVIATIONS);
        this.modalManager = new ModalManager();
        this.chromeController = new ChromeController();
        this.passageRenderer = new PassageRenderer(this.bibleApi, this.state);
        this.authManager = new AuthManager(this.auth, this.database);

        // Search state
        this.searchTimeout = null;
        this.searchSelectedIndex = -1;
        this.searchResultItems = null;
        this.searchExpandedTestaments = new Set();
        this.searchExpandedBooks = new Set();
        this.currentSearchResults = [];

        // Scroll tracking
        this.scrollTimeout = null;
        this.lastScrollPosition = 0;

        // Original passage HTML for verse highlighting
        this.originalPassageHtml = null;

        // Initialize
        this.init();
    }

    // ================================
    // Initialization
    // ================================

    async init() {
        // Cache DOM elements
        cacheElements(this);
        loadTheme(this);

        // Set theme selector values
        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');
        if (themeSelector) {
            themeSelector.value = localStorage.getItem('colorTheme') || 'dracula';
        }
        if (lightModeToggle) {
            lightModeToggle.checked = document.body.classList.contains('light-mode');
        }

        // Attach all event listeners
        attachEventListeners(this);
        this.initializeAccordion();

        // Setup modal behaviors
        this.setupModals();

        // Wait for Firebase auth
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                this.applySettings();
                await this.loadSavedReadingPosition();
            } else {
                this.currentUser = null;
                this.loadLocalSettings();
                this.applySettings();
                await this.loadPassage(this.state.currentBook, this.state.currentChapter);
                this.checkApiKey();
            }
        });
    }

    initializeAccordion() {
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach((header) => {
            header.addEventListener('click', () => {
                const section = header.closest('.accordion-section');
                section.classList.toggle('active');
            });
        });

        const openAccountBtn = document.getElementById('openAccountBtn');
        if (openAccountBtn) {
            openAccountBtn.addEventListener('click', () => {
                this.closeModal(this.settingsModal);
                if (this.currentUser) {
                    this.openModal(this.userMenuModal);
                } else {
                    this.openModal(this.loginModal);
                }
            });
        }
    }

    setupModals() {
        // Register all modals
        const modals = [
            this.bookModal,
            this.chapterModal,
            this.verseModal,
            this.settingsModal,
            this.helpModal,
            this.loginModal,
            this.signupModal,
            this.userMenuModal,
            this.referencesModal
        ];

        modals.forEach(modal => {
            if (!modal) return;
            this.modalManager.registerModal(modal.id, modal);
            this.modalManager.setupClickOutsideClose(modal);
        });

        // Setup drag-resize for settings and references modals
        if (this.settingsModal) {
            this.modalManager.setupDragResize(this.settingsModal);
        }
        if (this.referencesModal) {
            this.modalManager.setupDragResize(this.referencesModal);
        }
    }

    // ================================
    // Passage Loading (with API meta extraction)
    // ================================

    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) {
            this.saveReadingPosition();
        }

        this.state.currentBook = book;
        this.state.currentChapter = chapter;
        this.navigationManager.updateNavigationState(this);

        const reference = `${book} ${chapter}`;
        if (this.passageText) {
            this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';
        }

        // Fetch from API
        const data = await this.bibleApi.fetchPassage(reference);
        if (!data) {
            this.chromeController.resumeAutoHide();
            return;
        }

        // ✨ NEW: Extract actual last verse from passage_meta
        const meta = data?.passage_meta?.[0];
        if (meta?.chapter_end?.length === 2) {
            const endVerseId = Number(meta.chapter_end[1]);
            this.state.currentMaxVerse = Number.isFinite(endVerseId) 
                ? endVerseId % 1000 
                : null;
        } else {
            this.state.currentMaxVerse = null;
        }

        // Update UI
        if (this.passageTitle) {
            this.passageTitle.textContent = reference;
        }
        if (this.passageText) {
            this.passageText.innerHTML = data.passages[0];
        }

        // Cache original HTML
        this.originalPassageHtml = data.passages[0];

        // Attach footnote handlers
        this.attachFootnoteHandlers();
        this.makeFootnotesClickable();

        // Update copyright
        if (this.copyright) {
            this.copyright.textContent = 
                'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
                'copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. ' +
                'Used by permission. All rights reserved.';
        }

        // Reset verse selector
        if (this.currentVerseSpan) {
            this.currentVerseSpan.textContent = '1';
        }

        // Handle chrome & scroll
        this.chromeController.suspendAutoHide();

        if (restoreScroll && this.lastScrollPosition) {
            window.scrollTo(0, this.lastScrollPosition);
        } else {
            window.scrollTo(0, 0);
        }

        requestAnimationFrame(() => {
            this.chromeController.resumeAutoHide();
        });

        this.saveReadingPosition();
    }

    // ================================
    // Navigation (delegates to manager)
    // ================================

    navigateChapter(direction) {
        this.navigationManager.navigateChapter(direction, this);
    }

    // ================================
    // Modal Management
    // ================================

    openModal(modal) {
        this.modalManager.open(modal);
    }

    closeModal(modal) {
        this.modalManager.close(modal);
    }

    // ================================
    // Search
    // ================================

    toggleSearch() {
        this.searchContainer.classList.toggle('active');
        if (this.searchContainer.classList.contains('active')) {
            this.searchInput.focus();
        } else {
            this.searchInput.value = '';
            this.searchResults.innerHTML = '';
            this.searchSelectedIndex = -1;
            this.searchResultItems = [];
        }
    }

    async handleSearch(query) {
        clearTimeout(this.searchTimeout);

        if (!query.trim()) {
            this.searchResults.innerHTML = '';
            this.searchSelectedIndex = -1;
            this.searchResultItems = null;
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            if (this.isPassageReference(query)) {
                await this.handlePassageReference(query);
            } else {
                await this.performKeywordSearch(query);
            }
        }, 300);
    }

    isPassageReference(query) {
        const patterns = [
            /^[1-3]?\s*[a-z]+\s+\d+/i,
            /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
        ];
        return patterns.some(pattern => pattern.test(query.trim()));
    }

    async handlePassageReference(reference) {
        const data = await this.bibleApi.fetchPassage(reference);
        if (data && data.passages && data.passages.length > 0) {
            const canonical = String(data.canonical || '').replace(/"/g, '&quot;');
            const preview = this.stripHTML(data.passages[0]).substring(0, 200);

            this.searchResults.innerHTML = `
                <div class="search-result-item" data-reference="${canonical}">
                    <div class="search-result-reference">${canonical}</div>
                    <div class="search-result-content">${preview}...</div>
                </div>
            `;

            const item = this.searchResults.querySelector('.search-result-item');
            if (item) {
                item.addEventListener('click', async () => {
                    await this.loadPassageFromReference(item.dataset.reference);
                    this.toggleSearch();
                });
            }
        } else {
            this.searchResults.innerHTML = '<div class="search-no-results">No passage found</div>';
        }
    }

    async performKeywordSearch(query) {
        this.searchResults.innerHTML = '<div class="loading">Searching...</div>';
        this.searchExpandedTestaments.clear();
        this.searchExpandedBooks.clear();

        // Fetch all results (pagination handled by API)
        const allResults = await this.fetchAllSearchResults(query);

        if (allResults && allResults.length > 0) {
            this.displaySearchResults(allResults, query);
        } else {
            this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        }
    }

    async fetchAllSearchResults(query) {
        const results = [];
        let page = 1;

        while (page <= 10) { // Safety cap
            const data = await this.bibleApi.searchPassages(query, page);
            if (!data || !data.results || !data.results.length) break;

            results.push(...data.results);

            const total = data.total_results ?? data.total;
            const pageSize = data.page_size ?? 100;
            const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

            if (page >= totalPages) break;
            page++;
        }

        return results;
    }

    displaySearchResults(results, query) {
        const groups = this.groupSearchResultsByCanon(results);

        if (!groups.length) {
            this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            return;
        }

        // Auto-expand first testament and book
        if (this.searchExpandedTestaments.size === 0 && this.searchExpandedBooks.size === 0) {
            const firstGroup = groups[0];
            if (firstGroup) {
                this.searchExpandedTestaments.add(firstGroup.heading);
                const firstBook = firstGroup.books?.[0];
                if (firstBook) {
                    this.searchExpandedBooks.add(firstBook.book);
                }
            }
        }

        const parts = [];

        for (const group of groups) {
            const testament = group.heading;
            const expanded = this.searchExpandedTestaments.has(testament);

            parts.push(`
                <div class="search-group-heading" data-testament="${this.escapeHtml(testament)}">
                    <span class="search-group-title">${this.escapeHtml(testament)}</span>
                    <span class="search-group-chevron ${expanded ? 'expanded' : ''}">▾</span>
                </div>
            `);

            if (!expanded) continue;

            for (const bookBlock of group.books) {
                const book = bookBlock.book;
                const bookExpanded = this.searchExpandedBooks.has(book);

                parts.push(`
                    <div class="search-book-heading" data-book="${this.escapeHtml(book)}">
                        <span class="search-book-title">${this.escapeHtml(book)}</span>
                        <span class="search-book-chevron ${bookExpanded ? 'expanded' : ''}">▾</span>
                    </div>
                `);

                if (!bookExpanded) continue;

                for (const result of bookBlock.results) {
                    const highlighted = this.highlightSearchTerm(result.content, query);
                    const ref = this.escapeHtml(result.reference);

                    parts.push(`
                        <div class="search-result-item" data-reference="${ref}">
                            <div class="search-result-reference">${ref}</div>
                            <div class="search-result-content">${highlighted}</div>
                        </div>
                    `);
                }
            }
        }

        this.searchResults.innerHTML = parts.join('');

        // Testament toggles
        this.searchResults.querySelectorAll('.search-group-heading').forEach(el => {
            el.addEventListener('click', () => {
                const testament = el.getAttribute('data-testament');
                if (this.searchExpandedTestaments.has(testament)) {
                    this.searchExpandedTestaments.delete(testament);
                } else {
                    this.searchExpandedTestaments.add(testament);
                }
                this.displaySearchResults(results, query);
            });
        });

        // Book toggles
        this.searchResults.querySelectorAll('.search-book-heading').forEach(el => {
            el.addEventListener('click', () => {
                const book = el.getAttribute('data-book');
                if (this.searchExpandedBooks.has(book)) {
                    this.searchExpandedBooks.delete(book);
                } else {
                    this.searchExpandedBooks.add(book);
                }
                this.displaySearchResults(results, query);
            });
        });

        // Click results
        this.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', async () => {
                await this.loadPassageFromReference(item.dataset.reference);
                this.toggleSearch();
            });
        });
    }

    groupSearchResultsByCanon(results) {
        const otBooks = Object.keys(BIBLE_BOOKS['Old Testament']);
        const ntBooks = Object.keys(BIBLE_BOOKS['New Testament']);

        const otGroups = new Map();
        const ntGroups = new Map();

        for (const result of results) {
            const parsed = this.parseReference(result.reference);
            if (!parsed) continue;

            const { book } = parsed;
            const testament = getTestament(book);

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
                books: otBooks
                    .filter(b => otGroups.has(b))
                    .map(book => ({ book, results: otGroups.get(book) }))
            });
        }

        if (ntGroups.size) {
            grouped.push({
                heading: 'New Testament',
                books: ntBooks
                    .filter(b => ntGroups.has(b))
                    .map(book => ({ book, results: ntGroups.get(book) }))
            });
        }

        return grouped;
    }

    parseReference(reference) {
        const match = String(reference || '').trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
        if (!match) return null;

        const book = match[1].trim();
        const chapter = parseInt(match[2], 10);
        const verse = match[3] ? parseInt(match[3], 10) : null;

        return { book, chapter, verse };
    }

    async loadPassageFromReference(reference) {
        const parsed = this.parseReference(reference);
        if (!parsed) return;

        const { book, chapter, verse } = parsed;
        this.state.selectedVerse = verse || null;

        await this.loadPassage(book, chapter);

        if (verse) {
            this.scrollToVerse(verse);
        }
    }

    highlightSearchTerm(text, term) {
        const safeText = String(text || '');
        const safeTerm = String(term || '').trim();
        if (!safeTerm) return safeText;

        try {
            const escaped = safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'gi');
            return safeText.replace(regex, match => `<strong>${match}</strong>`);
        } catch {
            return safeText;
        }
    }

    // ================================
    // Verse Navigation
    // ================================

    scrollToVerse(verseNumber) {
        this.state.selectedVerse = verseNumber;
        if (this.currentVerseSpan) {
            this.currentVerseSpan.textContent = String(verseNumber);
        }
        this.applyVerseGlow();
    }

    applyVerseGlow() {
        if (!this.originalPassageHtml) return;
        this.passageText.innerHTML = this.originalPassageHtml;

        if (this.state.selectedVerse === null) return;

        // Find verse number element
        const verseNums = this.passageText.querySelectorAll('.verse-num');
        let targetVerseNum = null;

        for (const vn of verseNums) {
            if (vn.textContent.trim() === String(this.state.selectedVerse)) {
                targetVerseNum = vn;
                break;
            }
        }

        if (!targetVerseNum) return;

        // Wrap verse in glow div
        const parentP = targetVerseNum.closest('p');
        if (!parentP) return;

        const glowDiv = document.createElement('div');
        glowDiv.className = 'selected-verse-glow';

        // Split paragraph at verse boundaries
        let collecting = false;
        Array.from(parentP.childNodes).forEach(node => {
            if (node === targetVerseNum) {
                collecting = true;
            }

            if (collecting) {
                if (node.nodeType === 1 && node.classList.contains('verse-num') && node !== targetVerseNum) {
                    collecting = false;
                    return;
                }
                glowDiv.appendChild(node.cloneNode(true));
            }
        });

        parentP.parentNode.insertBefore(glowDiv, parentP);
        glowDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ================================
    // Footnotes & Cross-References
    // ================================

    attachFootnoteHandlers() {
        const links = this.passageText.querySelectorAll('a.fn');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFootnoteClick(link);
            });
        });
    }

    makeFootnotesClickable() {
        const sups = this.passageText.querySelectorAll('sup.footnote');
        sups.forEach(sup => {
            sup.style.cursor = 'pointer';
            sup.addEventListener('click', (e) => {
                e.preventDefault();
                const link = sup.querySelector('a.fn');
                if (link) {
                    const title = link.getAttribute('title') || '';
                    const verseRef = this.getVerseReferenceForElement(sup);
                    this.showFootnoteModal(link.textContent.trim(), verseRef, title);
                }
            });
        });
    }

    handleFootnoteClick(link) {
        const title = link.getAttribute('title') || '';
        const verseRef = this.getVerseReferenceForElement(link);
        this.showFootnoteModal(link.textContent.trim(), verseRef, title);
    }

    showFootnoteModal(footnoteNumber, verseRef, title) {
        let footnoteText = '';

        if (title) {
            const temp = document.createElement('div');
            temp.innerHTML = title;
            const decoded = temp.textContent || temp.innerText || '';
            const noteMatch = decoded.match(/<note[^>]*>(.*?)<\/note>/s);
            if (noteMatch) {
                temp.innerHTML = noteMatch[1];
                footnoteText = temp.innerHTML;
            } else {
                footnoteText = decoded;
            }
        }

        if (!footnoteText) {
            footnoteText = 'Footnote content not available. Enable "Show footnotes" in Settings.';
        }

        this.footnotesSection.style.display = 'block';
        this.crossReferencesSection.style.display = 'none';
        this.footnotesContent.innerHTML = `
            <div class="footnote-item">
                <div class="footnote-ref-display">${verseRef} [${footnoteNumber}]</div>
                <div class="footnote-text">${footnoteText}</div>
            </div>
        `;
        this.openModal(this.referencesModal);
    }

    getVerseReferenceForElement(element) {
        let current = element;
        while (current) {
            const verseNum = current.querySelector?.('.verse-num');
            if (verseNum) {
                return `${this.state.currentBook} ${this.state.currentChapter}:${verseNum.textContent.trim()}`;
            }
            current = current.previousElementSibling;
            if (!current || current.tagName === 'H2' || current.tagName === 'H3') break;
        }
        return `${this.state.currentBook} ${this.state.currentChapter}`;
    }

    // ================================
    // Settings
    // ================================

    loadLocalSettings() {
        this.API_KEY = localStorage.getItem('esvApiKey') || '';
        this.state.fontSize = parseInt(localStorage.getItem('fontSize') || '18', 10);
        this.state.showVerseNumbers = localStorage.getItem('showVerseNumbers') !== 'false';
        this.state.showHeadings = localStorage.getItem('showHeadings') !== 'false';
        this.state.showFootnotes = localStorage.getItem('showFootnotes') === 'true';
        this.state.showCrossReferences = localStorage.getItem('showCrossReferences') === 'true';
        this.state.verseByVerse = localStorage.getItem('verseByVerse') === 'true';
        this.state.colorTheme = localStorage.getItem('colorTheme') || 'dracula';
        this.state.lightMode = localStorage.getItem('lightMode') === 'true';
    }

    applySettings() {
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.value = this.state.colorTheme;
        }

        // Apply theme classes
        document.body.classList.remove('steel-theme', 'onyx-theme', 'reader-theme');
        if (this.state.colorTheme === 'steel') document.body.classList.add('steel-theme');
        else if (this.state.colorTheme === 'onyx') document.body.classList.add('onyx-theme');
        else if (this.state.colorTheme === 'reader') document.body.classList.add('reader-theme');

        if (this.state.lightMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }

        // Apply font size
        if (this.passageText) {
            this.passageText.style.fontSize = `${this.state.fontSize}px`;
        }

        // Apply verse-by-verse
        if (this.passageText) {
            if (this.state.verseByVerse) {
                this.passageText.classList.add('verse-by-verse');
            } else {
                this.passageText.classList.remove('verse-by-verse');
            }
        }

        // Update toggles
        if (this.verseNumbersToggle) this.verseNumbersToggle.checked = this.state.showVerseNumbers;
        if (this.headingsToggle) this.headingsToggle.checked = this.state.showHeadings;
        if (this.footnotesToggle) this.footnotesToggle.checked = this.state.showFootnotes;
        if (this.crossReferencesToggle) this.crossReferencesToggle.checked = this.state.showCrossReferences;
        if (this.verseByVerseToggle) this.verseByVerseToggle.checked = this.state.verseByVerse;
        if (this.fontSizeSlider) this.fontSizeSlider.value = this.state.fontSize;
        if (this.fontSizeValue) this.fontSizeValue.textContent = `${this.state.fontSize}px`;
    }

    async saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showToast('Please enter a valid API key');
            return;
        }

        this.API_KEY = apiKey;

        if (this.currentUser) {
            await this.authManager.saveUserApiKey(this.currentUser.uid, apiKey);
            this.showToast('API key saved!');
        } else {
            localStorage.setItem('esvApiKey', apiKey);
            this.showToast('API key saved locally!');
        }

        this.closeModal(this.settingsModal);
        await this.loadPassage(this.state.currentBook, this.state.currentChapter);
    }

    // ================================
    // Firebase User Data
    // ================================

    async loadUserData() {
        if (!this.currentUser) return;

        const data = await this.authManager.loadUserData(this.currentUser);
        if (!data) return;

        // Load API key
        this.API_KEY = await this.authManager.loadUserApiKey(this.currentUser.uid);

        // Load settings
        const s = data.settings || {};
        this.state.fontSize = s.fontSize ?? 18;
        this.state.showVerseNumbers = s.showVerseNumbers ?? true;
        this.state.showHeadings = s.showHeadings ?? true;
        this.state.showFootnotes = s.showFootnotes ?? false;
        this.state.showCrossReferences = s.showCrossReferences ?? false;
        this.state.verseByVerse = s.verseByVerse ?? false;
        this.state.colorTheme = s.colorTheme || 'dracula';
        this.state.lightMode = s.lightMode ?? false;
    }

    async saveReadingPosition() {
        if (!this.currentUser) return;
        const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
        await this.authManager.saveReadingPosition(
            this.currentUser.uid,
            this.state.currentBook,
            this.state.currentChapter,
            scrollPos
        );
    }

    async loadSavedReadingPosition() {
        if (!this.currentUser) return;

        const position = await this.authManager.loadReadingPosition(this.currentUser.uid);
        if (position && position.book && position.chapter) {
            this.lastScrollPosition = position.scrollPosition || 0;
            await this.loadPassage(position.book, position.chapter, true);
        } else {
            await this.loadPassage(this.state.currentBook, this.state.currentChapter);
        }
    }

    // ================================
    // Auth UI
    // ================================

    handleUserButtonClick() {
        if (this.currentUser) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.textContent = this.currentUser.email;

            const userTheme = document.getElementById('userTheme');
            if (userTheme) {
                const isLight = document.body.classList.contains('light-mode');
                const themeMap = {
                    dracula: isLight ? 'Alucard (Light)' : 'Dracula (Dark)',
                    steel: `Steel (${isLight ? 'Light' : 'Dark'})`,
                    onyx: `Onyx (${isLight ? 'Light' : 'Dark'})`,
                    reader: `Reader (${isLight ? 'Parchment' : 'Night'})`
                };
                userTheme.textContent = themeMap[this.state.colorTheme] || 'Dracula (Dark)';
            }

            this.openModal(this.userMenuModal);
        } else {
            this.openModal(this.loginModal);
        }
    }

    checkApiKey() {
        if (!this.API_KEY) {
            setTimeout(() => {
                this.showToast('Welcome! Please sign in to start reading.');
                this.openModal(this.loginModal);
            }, 500);
        }
    }

    // ================================
    // Keyboard Shortcuts
    // ================================

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.toggleSearch();
            return;
        }

        // Escape to close
        if (e.key === 'Escape') {
            if (this.searchContainer.classList.contains('active')) {
                this.toggleSearch();
            }
            [this.bookModal, this.chapterModal, this.verseModal, this.settingsModal,
             this.helpModal, this.loginModal, this.signupModal, this.userMenuModal,
             this.referencesModal].forEach(modal => {
                if (modal?.classList.contains('active')) {
                    this.closeModal(modal);
                }
            });
            return;
        }

        // Navigation (only when no modal/search open)
        const modalOpen = document.querySelector('.modal.active');
        const searchOpen = this.searchContainer.classList.contains('active');
        if (modalOpen || searchOpen) return;

        if (e.key === 'ArrowLeft' || e.key === 'h') {
            e.preventDefault();
            this.navigateChapter(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'l') {
            e.preventDefault();
            this.navigateChapter(1);
        }
    }

    // ================================
    // Utilities
    // ================================

    stripHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    showToast(message) {
        if (!this.toast) return;
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new BibleApp();
    });
} else {
    window.app = new BibleApp();
}

export { BibleApp };
