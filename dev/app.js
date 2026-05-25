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
import { cacheElements, loadTheme, toggleTheme, changeColorTheme } from './ui.js';
import {
    initializeBibleStructure,
    getAllBooks,
    getChapterCount,
    getTestament,
    getDisplayName,
} from './bible-structure.js';
import { updateNavigationState, navigateToNextVerse, navigateToPreviousVerse } from './navigation.js';
import {
    toggleSearch, closeSearch, handleSearch, handleSearchKeydown,
    refreshSearchResultItems, setSearchSelectedIndex, activateSelectedSearchResult,
    isPassageReference, handlePassageReference, fetchAllSearchResults,
    groupSearchResultsByCanon, performKeywordSearch, displaySearchResults,
    parseReference, loadPassageFromReference, escapeRegExp, highlightSearchTerm, stripHTML,
} from './search.js';
import {
    loadSavedPositionIfChanged, loadSavedReadingPosition, saveReadingPosition,
    checkApiKey, handleUserButtonClick, handleLogin, handleSignup, handleLogout, loadUserData,
} from './auth.js';
import {
    openModal, closeModal,
    openBookModal, populateBookModal,
    openChapterModal, populateChapterModal,
    openVerseModal, populateVerseModal,
    getCurrentVerseCount,
} from './modals.js';
import {
    loadLocalSettings, applySettings, toggleSetting,
    toggleVerseByVerse, updateFontSize, changeTranslation, updateCopyright,
} from './settings.js';
import { handleKeyboardShortcuts } from './keyboard.js';
import { attachEventListeners } from './events.js';

const TRANSLATION_ALIASES = { NRSVue: 'NRSVUE' };
function normalizeTranslation(t) { return TRANSLATION_ALIASES[t] || t; }

function withTimeout(promise, ms, fallback = null) {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

function revealApp() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.classList.remove('initializing');
        });
    });
}

class BibleApp {
    constructor() {
        this.auth     = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
        this._copyrightMap = {};
        this._normalizeTranslation = normalizeTranslation;

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

        this.bookDisplayNames = { Psalm: 'Psalms' };

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
                const y     = window.scrollY || window.pageYOffset || 0;
                const delta = y - this.chromeScrollLastY;
                const modalOpen  = !!document.querySelector('.modal.active');
                const searchOpen = !!this.searchContainer?.classList.contains('active');
                if (y <= 0 || modalOpen || searchOpen) {
                    this.showChrome();
                } else {
                    if (delta > this.chromeDelta)  this.hideChrome();
                    if (delta < -this.chromeDelta) this.showChrome();
                }
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

    getAllBooks()          { return getAllBooks(this); }
    getChapterCount(book) { return getChapterCount(this, book); }
    getTestament(book)    { return getTestament(this, book); }
    getDisplayName(book)  { return getDisplayName(this, book); }

    async init() {
        document.body.classList.add('initializing');
        try {
            try { await registerServiceWorker(this); } catch (_) { console.warn('Service worker unavailable:', _); }

            cacheElements(this);
            loadTheme(this);

            const themeSelector = document.getElementById('themeSelector');
            const lightModeToggle = document.getElementById('lightModeToggle');
            if (themeSelector) {
                let saved = 'dracula';
                try { saved = localStorage.getItem('colorTheme') || 'dracula'; } catch (_) {}
                themeSelector.value = saved;
            }
            if (lightModeToggle) lightModeToggle.checked = document.body.classList.contains('light-mode');

            attachEventListeners(this);
            this.initializeAccordion();
            document.body.setAttribute('data-app-ready', 'true');

            this.loadLocalSettings();
            this.applySettings();

            if (!this.auth || !this.database) {
                console.warn('Firebase not available — sign-in disabled.');
            }

            // Run translation registry and passage fetch concurrently.
            // _copyrightMap is initialized to {} so updateCopyright() inside
            // loadPassage() is safe to call before the registry resolves.
            // If the registry loses the race, copyright text renders empty
            // briefly and then updates when _loadTranslationRegistry settles.
            await Promise.all([
                this._loadTranslationRegistry(),
                this.loadPassage(this.state.currentBook, this.state.currentChapter),
            ]);
            revealApp();

            if (this.auth && this.database) {
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
        } catch (err) {
            console.error('BibleApp init error:', err);
            revealApp();
        }
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
        for (const t of translations) this._copyrightMap[t.id] = t.copyright || '';
        // Re-render copyright now that the map is populated, in case loadPassage
        // completed first and rendered with an empty map.
        this.updateCopyright?.();
    }

    initializeAccordion() {
        document.querySelectorAll('.accordion-header').forEach((header) => {
            header.addEventListener('click', () => header.closest('.accordion-section').classList.toggle('active'));
        });
        const openAccountBtn = document.getElementById('openAccountBtn');
        if (openAccountBtn) {
            openAccountBtn.addEventListener('click', () => {
                this.closeModal(this.settingsModal);
                this.openModal(this.currentUser ? this.userMenuModal : this.loginModal);
            });
        }
    }

    async _loadSavedPositionIfChanged() { await loadSavedPositionIfChanged(this, withTimeout); }
    async loadSavedReadingPosition()    { await loadSavedReadingPosition(this, withTimeout); }
    saveReadingPosition()               { saveReadingPosition(this); }

    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) this.saveReadingPosition?.();

        this.state.currentBook    = book;
        this.state.currentChapter = chapter;

        this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';

        let scaffoldEvents = [];
        try {
            const allEvents = await loadStructure(book);
            scaffoldEvents = eventsForChapter(allEvents, chapter);
        } catch (err) {
            console.warn('loadPassage: BSB structure scaffold unavailable', err);
        }

        const data = await this.bibleApi.fetchPassage(
            `${book} ${chapter}`,
            scaffoldEvents,
            this.state.showHeadings !== false
        );

        if (!data) {
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
            return;
        }

        this.updateNavigationState();
        this.passageTitle.textContent = book === 'Psalm'
            ? `Psalm ${chapter}`
            : `${this.getDisplayName(book)} ${chapter}`;
        this.passageText.innerHTML = data.passages[0];
        this.originalPassageHtml   = this.passageText.innerHTML;
        this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);

        this.updateCopyright();
        this.currentVerseSpan.textContent = '1';
        this.chromeSuspend = true;
        document.body.classList.add('chrome-no-transition');
        this.showChrome();
        window.scrollTo(0, restoreScroll ? (this.lastScrollPosition || 0) : 0);

        requestAnimationFrame(() => {
            this.chromeScrollLastY = window.scrollY || window.pageYOffset || 0;
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
        });

        this.saveReadingPosition?.();
    }

    navigateChapter(direction) { navChapter(this, direction); }
    updateNavigationState()    { updateNavigationState(this); }
    navigateToNextVerse()      { navigateToNextVerse(this); }
    navigateToPreviousVerse()  { navigateToPreviousVerse(this); }

    toggleSearch()                          { toggleSearch(this); }
    closeSearch()                           { closeSearch(this); }
    handleSearch(query)                     { handleSearch(this, query); }
    handleSearchKeydown(e)                  { handleSearchKeydown(this, e); }
    refreshSearchResultItems(autoSelect)    { refreshSearchResultItems(this, autoSelect); }
    setSearchSelectedIndex(i, scroll)       { setSearchSelectedIndex(this, i, scroll); }
    activateSelectedSearchResult()          { activateSelectedSearchResult(this); }
    isPassageReference(q)                   { return isPassageReference(q); }
    async handlePassageReference(ref)       { await handlePassageReference(this, ref); }
    async fetchAllSearchResults(q, onBatch) { return fetchAllSearchResults(this, q, onBatch); }
    groupSearchResultsByCanon(results)      { return groupSearchResultsByCanon(this, results); }
    async performKeywordSearch(q)           { await performKeywordSearch(this, q); }
    displaySearchResults(results, q)        { displaySearchResults(this, results, q); }
    parseReference(ref)                     { return parseReference(ref); }
    async loadPassageFromReference(ref)     { await loadPassageFromReference(this, ref); }
    escapeRegExp(str)                       { return escapeRegExp(str); }
    highlightSearchTerm(text, term)         { return highlightSearchTerm(text, term); }
    stripHTML(html)                         { return stripHTML(html); }

    openModal(modal)       { openModal(this, modal); }
    closeModal(modal)      { closeModal(this, modal); }
    openBookModal()        { openBookModal(this); }
    populateBookModal()    { populateBookModal(this); }
    openChapterModal()     { openChapterModal(this); }
    populateChapterModal() { populateChapterModal(this); }
    openVerseModal()       { openVerseModal(this); }
    populateVerseModal()   { populateVerseModal(this); }
    getCurrentVerseCount() { return getCurrentVerseCount(this); }
    scrollToVerse(n)       { scrollVerse(this, n); }
    applyVerseGlow()       { glowVerse(this); }

    loadLocalSettings()          { loadLocalSettings(this); }
    applySettings()              { applySettings(this); }
    async toggleSetting(s)       { await toggleSetting(this, s); }
    async toggleVerseByVerse()   { await toggleVerseByVerse(this); }
    async updateFontSize(size)   { await updateFontSize(this, size); }
    async changeTranslation(t)   { await changeTranslation(this, t); }
    updateCopyright()            { updateCopyright(this); }

    handleKeyboardShortcuts(e)   { handleKeyboardShortcuts(this, e); }

    checkApiKey() { checkApiKey(this); }

    copyPassage() {
        const text = this.stripHTML(this.passageText.innerHTML);
        const ref  = this.passageTitle.textContent;
        navigator.clipboard.writeText(`${ref}\n\n${text}\n\n${this.copyright?.textContent ?? ''}`)
            .then(() => this.showToast('Passage copied to clipboard!'))
            .catch((err) => { console.error('Failed to copy:', err); this.showToast('Failed to copy passage'); });
    }

    showError(message) { this.passageText.innerHTML = `<div class="error">${message}</div>`; }

    showToast(message) {
        if (!this.toast) return;
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => this.toast.classList.remove('show'), 3000);
    }

    handleUserButtonClick() { handleUserButtonClick(this); }
    async handleLogin()     { await handleLogin(this); }
    async handleSignup()    { await handleSignup(this); }
    async handleLogout()    { await handleLogout(this); }
    async loadUserData()    { await loadUserData(this, normalizeTranslation); }
}


/* ─── Service Worker & Update Toast ─── */

async function registerServiceWorker(appInstance) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        const pageBuildId = document.querySelector('meta[name="build-id"]')?.content || '';
        console.info('[BUILD_ID]', pageBuildId || '__BUILD_ID__');
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'NEW_VERSION') showUpdateToast(appInstance);
            if (e.data?.type === 'NEW_BUILD') {
                const swBuildId = e.data.buildId || '';
                if (pageBuildId && swBuildId && pageBuildId !== swBuildId) window.location.reload();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible')
                reg.update().catch((err) => console.warn('SW update check failed', err));
        });
    } catch (err) {
        console.warn('SW registration failed', err);
    }
}

function showUpdateToast(appInstance) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = '';
    const text    = Object.assign(document.createElement('span'),  { textContent: 'A new version is available.' });
    const action  = Object.assign(document.createElement('button'),{ textContent: 'Refresh', className: 'toast-action' });
    const dismiss = Object.assign(document.createElement('button'),{ textContent: '\u00d7', className: 'toast-dismiss' });
    text.style.flex = '1';
    action.addEventListener('click',  () => location.reload());
    dismiss.addEventListener('click', () => toast.classList.remove('show'));
    toast.append(text, action, dismiss);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 30000);
}

(async () => {
    await new Promise(resolve => {
        if (document.readyState !== 'loading') return resolve();
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    // Fire-and-forget: Firebase auth loads in the background.
    // BibleApp constructs immediately regardless of whether auth succeeds.
    import('./config/firebase-config.bundle.js').catch(
        (err) => console.warn('Firebase bundle failed to load — sign-in unavailable:', err)
    );
    new BibleApp();
})();
