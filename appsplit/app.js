// ====================
// ESV Bible Reader App
// ====================

import { BibleApi, loadTranslationIndex } from './bible-api.js';
import { loadStructure, eventsForChapter } from './bsb-structure.js';
import {
    initializeState,
    navigateChapter as navChapter,
    scrollToVerse as scrollVerse,
    applyVerseGlow as glowVerse,
} from './reading-state.js';
import {
    cacheElements,
    loadTheme,
    toggleTheme,
    updateThemeIcon,
    changeColorTheme,
} from './ui.js';
import {
    initializeBibleStructure,
    getAllBooks,
    getChapterCount,
    getTestament,
    getDisplayName,
} from './bible-structure.js';
import {
    updateNavigationState,
    navigateToNextVerse,
    navigateToPreviousVerse,
} from './navigation.js';
import {
    toggleSearch,
    closeSearch,
    handleSearch,
    handleSearchKeydown,
    refreshSearchResultItems,
    setSearchSelectedIndex,
    activateSelectedSearchResult,
    isPassageReference,
    handlePassageReference,
    fetchAllSearchResults,
    groupSearchResultsByCanon,
    performKeywordSearch,
    displaySearchResults,
    parseReference,
    loadPassageFromReference,
    escapeRegExp,
    highlightSearchTerm,
    stripHTML,
} from './search.js';
import {
    loadSavedPositionIfChanged,
    loadSavedReadingPosition,
    saveReadingPosition,
    checkApiKey,
    handleUserButtonClick,
    handleLogin,
    handleSignup,
    handleLogout,
    loadUserData,
} from './auth.js';
import {
    openModal,
    closeModal,
    openBookModal,
    populateBookModal,
    openChapterModal,
    populateChapterModal,
    openVerseModal,
    populateVerseModal,
    getCurrentVerseCount,
    attachDragToResize,
} from './modals.js';

function readBool(key, defaultValue) {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return defaultValue;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return defaultValue;
    } catch { return defaultValue; }
}

const TRANSLATION_ALIASES = {
    NRSVue: 'NRSVUE',
};

function normalizeTranslation(t) {
    return TRANSLATION_ALIASES[t] || t;
}

function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

class BibleApp {
    constructor() {
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;

        this._copyrightMap = {};

        this.bibleBooks = initializeBibleStructure();

        this.bookAbbreviations = {
            Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut',
            Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', '1 Samuel': '1Sam', '2 Samuel': '2Sam',
            '1 Kings': '1Kgs', '2 Kings': '2Kgs', '1 Chronicles': '1Chr', '2 Chronicles': '2Chr',
            Ezra: 'Ezra', Nehemiah: 'Neh', Esther: 'Esth', Job: 'Job', Psalm: 'Ps', Proverbs: 'Prov',
            Ecclesiastes: 'Eccl', 'Song of Solomon': 'Song', Isaiah: 'Isa', Jeremiah: 'Jer',
            Lamentations: 'Lam', Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos',
            Obadiah: 'Obad', Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph',
            Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal', Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke',
            John: 'John', Acts: 'Acts', Romans: 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor',
            Galatians: 'Gal', Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col',
            '1 Thessalonians': '1Thess', '2 Thessalonians': '2Thess', '1 Timothy': '1Tim', '2 Timothy': '2Tim',
            Titus: 'Titus', Philemon: 'Phlm', Hebrews: 'Heb', James: 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet',
            '1 John': '1John', '2 John': '2John', '3 John': '3John', Jude: 'Jude', Revelation: 'Rev',
        };

        this.bookDisplayNames = {
            Psalm: 'Psalms',
        };

        this.state = initializeState();
        this.searchTimeout = null;
        this.searchSelectedIndex = -1;
        this.searchResultItems = null;
        this.searchLastQuery = '';
        this.currentSearchResults = [];
        this.scrollTimeout = null;
        this.lastScrollPosition = 0;
        this.chromeHidden = false;
        this.chromeScrollLastY = window.scrollY || 0;
        this.chromeDelta = 2;
        this.chromeScrollTicking = false;
        this.chromeSuspend = false;

        this.showChrome = () => {
            if (!this.chromeHidden) return;
            document.body.classList.remove('chrome-hidden');
            this.chromeHidden = false;
        };

        this.hideChrome = () => {
            if (this.chromeHidden) return;
            document.body.classList.add('chrome-hidden');
            this.chromeHidden = true;
        };

        this.handleChromeScroll = () => {
            if (this.chromeScrollTicking) return;
            this.chromeScrollTicking = true;
            if (this.chromeSuspend) {
                this.chromeScrollLastY = window.scrollY || window.pageYOffset || 0;
                this.chromeScrollTicking = false;
                return;
            }

            window.requestAnimationFrame(() => {
                const y = window.scrollY || window.pageYOffset || 0;
                const delta = y - this.chromeScrollLastY;
                const modalOpen = !!document.querySelector('.modal.active');
                const searchOpen = !!this.searchContainer?.classList.contains('active');

                if (y <= 0 || modalOpen || searchOpen) {
                    this.showChrome();
                    this.chromeScrollLastY = y;
                    this.chromeScrollTicking = false;
                    return;
                }

                if (delta > this.chromeDelta) this.hideChrome();
                if (delta < -this.chromeDelta) this.showChrome();

                this.chromeScrollLastY = y;
                this.chromeScrollTicking = false;
            });
        };

        this.originalPassageHtml = null;
        this.searchExpandedTestaments = new Set();
        this.searchExpandedBooks = new Set();
        this.bibleApi = new BibleApi(this.state.translation || 'ESV');
        this.init();
    }

    // ================================
    // Bible Structure (delegated)
    // ================================

    getAllBooks() { return getAllBooks(this); }
    getChapterCount(book) { return getChapterCount(this, book); }
    getTestament(book) { return getTestament(this, book); }
    getDisplayName(book) { return getDisplayName(this, book); }

    // ================================
    // Initialization
    // ================================

    async init() {
        await this._loadTranslationRegistry();
        try { await registerServiceWorker(this); } catch (_swErr) { console.warn('Service worker unavailable:', _swErr); }

        cacheElements(this);
        loadTheme(this);

        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            let savedTheme = 'dracula';
            try { savedTheme = localStorage.getItem('colorTheme') || 'dracula'; } catch (_) {}
            themeSelector.value = savedTheme;
        }

        if (lightModeToggle) {
            lightModeToggle.checked = document.body.classList.contains('light-mode');
        }

        this.attachEventListeners();
        this.initializeAccordion();
        document.body.setAttribute('data-app-ready', 'true');

        this.loadLocalSettings();
        this.applySettings();
        await this.loadPassage(this.state.currentBook, this.state.currentChapter);

        if (!this.auth || !this.database) {
            console.error('Firebase auth/database not ready when app initialized.');
            setTimeout(() => {
                this.showToast('Sign in is temporarily unavailable. Please refresh the page.');
            }, 500);
            return;
        }

        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await withTimeout(this.loadUserData(), 5000);
                this.applySettings();
                await this._loadSavedPositionIfChanged();
            } else {
                this.currentUser = null;
                this.checkApiKey();
            }
        });
    }

    async _loadTranslationRegistry() {
        const translations = await loadTranslationIndex();

        const select = document.getElementById('translationSelector');
        if (select && translations.length > 0) {
            select.innerHTML = '';
            for (const t of translations) {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.label;
                select.appendChild(opt);
            }
        }

        this._copyrightMap = {};
        for (const t of translations) {
            this._copyrightMap[t.id] = t.copyright || '';
        }
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

    attachEventListeners() {
        this.searchToggleBtn?.addEventListener('click', () => this.toggleSearch());
        this.helpBtn?.addEventListener('click', () => this.openModal(this.helpModal));
        this.settingsBtn?.addEventListener('click', () => this.openModal(this.settingsModal));

        this.closeSearchBtn?.addEventListener('click', () => this.closeSearch());
        this.searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.searchInput?.addEventListener('keydown', (e) => this.handleSearchKeydown(e));

        this.prevChapterBtn?.addEventListener('click', () => this.navigateChapter(-1));
        this.nextChapterBtn?.addEventListener('click', () => this.navigateChapter(1));
        this.bookSelector?.addEventListener('click', () => this.openBookModal());
        this.chapterSelector?.addEventListener('click', () => this.openChapterModal());
        this.verseSelector?.addEventListener('click', () => this.openVerseModal());
        this.closeVerseModal?.addEventListener('click', () => this.closeModal(this.verseModal));

        this.referencesModal = document.getElementById('referencesModal');
        this.closeReferencesModal = document.getElementById('closeReferencesModal');
        this.footnotesSection = document.getElementById('footnotesSection');
        this.footnotesContent = document.getElementById('footnotesContent');
        this.crossReferencesSection = document.getElementById('crossReferencesSection');
        this.crossReferencesContent = document.getElementById('crossReferencesContent');

        [
            this.bookModal,
            this.chapterModal,
            this.verseModal,
            this.settingsModal,
            this.helpModal,
            this.loginModal,
            this.signupModal,
            this.userMenuModal,
            this.referencesModal,
        ].forEach((modal) => {
            if (!modal) return;
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });

        this.closeBookModal?.addEventListener('click', () => this.closeModal(this.bookModal));
        this.closeChapterModal?.addEventListener('click', () => this.closeModal(this.chapterModal));
        this.closeHelpModal?.addEventListener('click', () => this.closeModal(this.helpModal));
        this.closeSettingsModal?.addEventListener('click', () => this.closeModal(this.settingsModal));
        if (this.closeReferencesModal) {
            this.closeReferencesModal.addEventListener('click', () => this.closeModal(this.referencesModal));
        }

        attachDragToResize(this);

        this.verseNumbersToggle?.addEventListener('change', () => this.toggleSetting('showVerseNumbers'));
        this.headingsToggle?.addEventListener('change', () => this.toggleSetting('showHeadings'));
        this.footnotesToggle?.addEventListener('change', () => this.toggleSetting('showFootnotes'));

        this.crossReferencesToggle = document.getElementById('crossReferencesToggle');
        if (this.crossReferencesToggle) {
            this.crossReferencesToggle.addEventListener('change', () => this.toggleSetting('showCrossReferences'));
        }

        this.verseByVerseToggle?.addEventListener('change', () => this.toggleVerseByVerse());
        this.fontSizeSlider?.addEventListener('input', (e) => this.updateFontSize(e.target.value));

        if (this.translationSelector) {
            this.translationSelector.addEventListener('change', async (e) => {
                await this.changeTranslation(e.target.value);
            });
        }

        this.themeToggleBtn?.addEventListener('click', () => toggleTheme(this));

        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => changeColorTheme(this, e.target.value));
        }
        if (lightModeToggle) {
            lightModeToggle.addEventListener('change', () => toggleTheme(this));
        }

        this.userBtn?.addEventListener('click', () => this.handleUserButtonClick());

        document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(this.loginModal);
            this.openModal(this.signupModal);
        });

        document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(this.signupModal);
            this.openModal(this.loginModal);
        });

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        this.closeLoginModal?.addEventListener('click', () => this.closeModal(this.loginModal));
        this.closeSignupModal?.addEventListener('click', () => this.closeModal(this.signupModal));
        this.closeUserMenuModal?.addEventListener('click', () => this.closeModal(this.userMenuModal));

        window.addEventListener('scroll', () => {
            this.handleChromeScroll();
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => this.saveReadingPosition(), 500);
        }, { passive: true });

        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // ==========================================
    // Passage Loading
    // ==========================================

    async _loadSavedPositionIfChanged() { await loadSavedPositionIfChanged(this, withTimeout); }
    /** @deprecated Use _loadSavedPositionIfChanged for the auth flow. */
    async loadSavedReadingPosition() { await loadSavedReadingPosition(this, withTimeout); }
    saveReadingPosition() { saveReadingPosition(this); }

    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) this.saveReadingPosition?.();

        this.state.currentBook = book;
        this.state.currentChapter = chapter;
        this.updateNavigationState();

        const reference = `${book} ${chapter}`;
        this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';

        let scaffoldEvents = [];
        try {
            const allEvents = await loadStructure(book);
            scaffoldEvents = eventsForChapter(allEvents, chapter);
        } catch (err) {
            console.warn('loadPassage: BSB structure scaffold unavailable', err);
        }

        const data = await this.bibleApi.fetchPassage(
            reference,
            scaffoldEvents,
            this.state.showHeadings !== false
        );

        if (!data) {
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
            return;
        }

        const displayTitle = book === 'Psalm'
            ? `Psalm ${chapter}`
            : `${this.getDisplayName(book)} ${chapter}`;
        this.passageTitle.textContent = displayTitle;
        this.passageText.innerHTML = data.passages[0];
        this.originalPassageHtml = this.passageText.innerHTML;

        this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);

        this.updateCopyright();
        this.currentVerseSpan.textContent = '1';
        this.chromeSuspend = true;
        document.body.classList.add('chrome-no-transition');
        this.showChrome();

        if (restoreScroll) {
            window.scrollTo(0, this.lastScrollPosition || 0);
        } else {
            window.scrollTo(0, 0);
        }

        requestAnimationFrame(() => {
            this.chromeScrollLastY = window.scrollY || window.pageYOffset || 0;
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
        });

        this.saveReadingPosition?.();
    }

    // ================================
    // Navigation (delegated)
    // ================================

    navigateChapter(direction) { navChapter(this, direction); }
    updateNavigationState() { updateNavigationState(this); }
    navigateToNextVerse() { navigateToNextVerse(this); }
    navigateToPreviousVerse() { navigateToPreviousVerse(this); }

    // ================================
    // Search (delegated)
    // ================================

    toggleSearch() { toggleSearch(this); }
    closeSearch() { closeSearch(this); }
    handleSearch(query) { handleSearch(this, query); }
    handleSearchKeydown(e) { handleSearchKeydown(this, e); }
    refreshSearchResultItems(autoSelectFirst) { refreshSearchResultItems(this, autoSelectFirst); }
    setSearchSelectedIndex(index, scrollIntoView) { setSearchSelectedIndex(this, index, scrollIntoView); }
    activateSelectedSearchResult() { activateSelectedSearchResult(this); }
    isPassageReference(query) { return isPassageReference(query); }
    async handlePassageReference(reference) { await handlePassageReference(this, reference); }
    async fetchAllSearchResults(query, onBatch) { return fetchAllSearchResults(this, query, onBatch); }
    groupSearchResultsByCanon(results) { return groupSearchResultsByCanon(this, results); }
    async performKeywordSearch(query) { await performKeywordSearch(this, query); }
    displaySearchResults(results, query) { displaySearchResults(this, results, query); }
    parseReference(reference) { return parseReference(reference); }
    async loadPassageFromReference(reference) { await loadPassageFromReference(this, reference); }
    escapeRegExp(str) { return escapeRegExp(str); }
    highlightSearchTerm(text, term) { return highlightSearchTerm(text, term); }
    stripHTML(html) { return stripHTML(html); }

    // ================================
    // Modals (delegated)
    // ================================

    openModal(modal) { openModal(this, modal); }
    closeModal(modal) { closeModal(this, modal); }
    openBookModal() { openBookModal(this); }
    populateBookModal() { populateBookModal(this); }
    openChapterModal() { openChapterModal(this); }
    populateChapterModal() { populateChapterModal(this); }
    openVerseModal() { openVerseModal(this); }
    populateVerseModal() { populateVerseModal(this); }
    getCurrentVerseCount() { return getCurrentVerseCount(this); }

    scrollToVerse(verseNumber) { scrollVerse(this, verseNumber); }
    applyVerseGlow() { glowVerse(this); }

    // ================================
    // Settings
    // ================================

    checkApiKey() { checkApiKey(this); }

    loadLocalSettings() {
        try { this.state.fontSize = parseInt(localStorage.getItem('fontSize') || '18', 10); } catch (_) { this.state.fontSize = 18; }
        this.state.showVerseNumbers     = readBool('showVerseNumbers',   true);
        this.state.showHeadings         = readBool('showHeadings',       true);
        this.state.showFootnotes        = readBool('showFootnotes',      false);
        this.state.showCrossReferences  = readBool('showCrossReferences', false);
        this.state.verseByVerse         = readBool('verseByVerse',       false);
        this.state.lightMode            = readBool('lightMode',          false);
        try { this.state.colorTheme = localStorage.getItem('colorTheme') || 'dracula'; } catch (_) { this.state.colorTheme = 'dracula'; }
        try { this.state.translation = normalizeTranslation(localStorage.getItem('translation') || 'ESV'); } catch (_) { this.state.translation = 'ESV'; }
    }

    applySettings() {
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector && this.state.colorTheme) themeSelector.value = this.state.colorTheme;
        changeColorTheme(this, this.state.colorTheme || 'dracula');

        if (this.translationSelector && this.state.translation) {
            this.translationSelector.value = this.state.translation;
        }
        this.bibleApi.setTranslation(this.state.translation || 'ESV');

        document.body.classList.toggle('light-mode', !!this.state.lightMode);
        const lightModeToggle = document.getElementById('lightModeToggle');
        if (lightModeToggle) lightModeToggle.checked = !!this.state.lightMode;
        updateThemeIcon(this.state.lightMode);

        document.body.classList.toggle('hide-verse-numbers', !this.state.showVerseNumbers);
        if (this.verseNumbersToggle) this.verseNumbersToggle.checked = !!this.state.showVerseNumbers;
        if (this.headingsToggle) this.headingsToggle.checked = !!this.state.showHeadings;
        if (this.footnotesToggle) this.footnotesToggle.checked = !!this.state.showFootnotes;
        if (this.crossReferencesToggle) this.crossReferencesToggle.checked = !!this.state.showCrossReferences;

        if (this.passageText) this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
        if (this.verseByVerseToggle) this.verseByVerseToggle.checked = !!this.state.verseByVerse;

        const fontSize = this.state.fontSize || 18;
        if (this.fontSizeSlider) this.fontSizeSlider.value = fontSize;
        if (this.fontSizeValue) this.fontSizeValue.textContent = `${fontSize}px`;
        if (this.passageText) this.passageText.style.fontSize = `${fontSize}px`;

        this.updateCopyright();
    }

    async toggleSetting(setting) {
        const toggleMap = {
            showVerseNumbers:    'verseNumbersToggle',
            showHeadings:        'headingsToggle',
            showFootnotes:       'footnotesToggle',
            showCrossReferences: 'crossReferencesToggle',
        };
        const toggleElement = this[toggleMap[setting]];
        if (!toggleElement) return;
        this.state[setting] = toggleElement.checked;

        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/${setting}`).set(toggleElement.checked);
        } else {
            try { localStorage.setItem(setting, String(toggleElement.checked)); } catch (_) {}
        }

        if (setting === 'showHeadings') {
            await this.loadPassage(this.state.currentBook, this.state.currentChapter);
            return;
        }

        this.applySettings();
    }

    async toggleVerseByVerse() {
        this.state.verseByVerse = this.verseByVerseToggle.checked;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/verseByVerse`).set(this.state.verseByVerse);
        } else {
            try { localStorage.setItem('verseByVerse', String(this.state.verseByVerse)); } catch (_) {}
        }
        this.passageText.classList.toggle('verse-by-verse', this.state.verseByVerse);
    }

    async updateFontSize(size) {
        this.state.fontSize = parseInt(size, 10);
        this.fontSizeValue.textContent = `${size}px`;
        this.passageText.style.fontSize = `${size}px`;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/fontSize`).set(parseInt(size, 10));
        } else {
            try { localStorage.setItem('fontSize', size); } catch (_) {}
        }
    }

    async changeTranslation(translation) {
        this.state.translation = translation;
        this.bibleApi.setTranslation(translation);

        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/translation`).set(translation);
        } else {
            try { localStorage.setItem('translation', translation); } catch (_) {}
        }

        this.updateCopyright();
        await this.loadPassage(this.state.currentBook, this.state.currentChapter);
    }

    updateCopyright() {
        if (this.copyright) {
            this.copyright.textContent = this._copyrightMap[this.state.translation] || '';
        }
    }

    // ================================
    // Utilities
    // ================================

    copyPassage() {
        const textContent = this.stripHTML(this.passageText.innerHTML);
        const reference = this.passageTitle.textContent;
        const fullText = `${reference}\n\n${textContent}\n\n${this.copyright?.textContent ?? ''}`;

        navigator.clipboard.writeText(fullText)
            .then(() => this.showToast('Passage copied to clipboard!'))
            .catch((err) => {
                console.error('Failed to copy:', err);
                this.showToast('Failed to copy passage');
            });
    }

    showError(message) {
        this.passageText.innerHTML = `<div class="error">${message}</div>`;
    }

    showToast(message) {
        if (!this.toast) return;
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => this.toast.classList.remove('show'), 3000);
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.toggleSearch();
        }

        if (e.key === 'Escape') {
            if (this.bookModal?.classList.contains('active'))       this.closeModal(this.bookModal);
            if (this.chapterModal?.classList.contains('active'))    this.closeModal(this.chapterModal);
            if (this.helpModal?.classList.contains('active'))       this.closeModal(this.helpModal);
            if (this.settingsModal?.classList.contains('active'))   this.closeModal(this.settingsModal);
            if (this.loginModal?.classList.contains('active'))      this.closeModal(this.loginModal);
            if (this.signupModal?.classList.contains('active'))     this.closeModal(this.signupModal);
            if (this.userMenuModal?.classList.contains('active'))   this.closeModal(this.userMenuModal);
            if (this.searchContainer?.classList.contains('active')) this.closeSearch();
            if (this.verseModal?.classList.contains('active'))      this.closeModal(this.verseModal);
            if (this.referencesModal?.classList.contains('active')) this.closeModal(this.referencesModal);
        }

        if (!document.querySelector('.modal.active') && !this.searchContainer?.classList.contains('active')) {
            if (e.key === 'ArrowLeft' || e.key === 'h') {
                e.preventDefault();
                this.navigateChapter(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'l') {
                e.preventDefault();
                this.navigateChapter(1);
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                this.navigateToPreviousVerse();
            } else if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                this.navigateToNextVerse();
            } else if (e.key === 'v') {
                e.preventDefault();
                this.verseByVerseToggle.checked = !this.verseByVerseToggle.checked;
                this.toggleVerseByVerse();
            } else if (e.key === 's') {
                e.preventDefault();
                if (this.headingsToggle) {
                    this.headingsToggle.checked = !this.headingsToggle.checked;
                    this.toggleSetting('showHeadings');
                }
            }
        }
    }

    // ================================
    // Firebase Authentication (delegated)
    // ================================

    handleUserButtonClick() { handleUserButtonClick(this); }
    async handleLogin() { await handleLogin(this); }
    async handleSignup() { await handleSignup(this); }
    async handleLogout() { await handleLogout(this); }
    async loadUserData() { await loadUserData(this, normalizeTranslation); }
}


/* ─── Service Worker & Update Toast ─── */
async function registerServiceWorker(appInstance) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

        const buildMeta = document.querySelector('meta[name="build-id"]')?.content || '__BUILD_ID__';
        console.info('[BUILD_ID]', buildMeta);

        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'NEW_VERSION') showUpdateToast(appInstance);
            if (e.data?.type === 'RELOAD') window.location.reload();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                reg.update().catch((err) => console.warn('SW update check failed', err));
            }
        });
    } catch (err) {
        console.warn('SW registration failed', err);
    }
}

function showUpdateToast(appInstance) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '';

    const text = document.createElement('span');
    text.textContent = 'A new version is available.';
    text.style.flex = '1';

    const action = document.createElement('button');
    action.textContent = 'Refresh';
    action.className = 'toast-action';
    action.addEventListener('click', () => location.reload());

    const dismiss = document.createElement('button');
    dismiss.textContent = '\u00d7';
    dismiss.className = 'toast-dismiss';
    dismiss.addEventListener('click', () => toast.classList.remove('show'));

    toast.appendChild(text);
    toast.appendChild(action);
    toast.appendChild(dismiss);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 30000);
}

(async () => {
    await new Promise(resolve => {
        if (document.readyState !== 'loading') return resolve();
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    try {
        await import('./config/firebase-config.js');
    } catch (err) {
        console.error('Firebase config module failed to load:', err);
    }
    new BibleApp();
})();
