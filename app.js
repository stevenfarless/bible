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
    openTranslationModal, populateTranslationModal,
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

const PASSAGE_CACHE_KEY = 'passageCache';

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

// ── Debug panel ────────────────────────────────────────────────────────────
// Triple-tap the header bar to open. Tap the panel to copy. Tap outside to close.
// REMOVE BEFORE MERGING TO MAIN.

function ms() { return Math.round(performance.now()); }
function ts(t) { return t == null ? 'n/a' : `+${t}ms`; }

function buildDebugReport(app) {
    const dbg = app._dbg || {};
    const now = ms();

    const LS_KEYS = [
        'readingPosition', 'passageCache',
        'translation', 'colorTheme', 'lightMode',
        'fontSize', 'showVerseNumbers', 'showHeadings',
        'showFootnotes', 'showCrossReferences', 'verseByVerse',
    ];
    const ls = {};
    for (const k of LS_KEYS) {
        try {
            const raw = localStorage.getItem(k);
            if (k === 'passageCache' && raw) {
                const p = JSON.parse(raw);
                ls[k] = `book=${p.book} ch=${p.chapter} translation=${p.translation} (html ${p.html?.length ?? 0} chars)`;
            } else if (k === 'readingPosition' && raw) {
                const p = JSON.parse(raw);
                ls[k] = `book=${p.book} ch=${p.chapter} scrollY=${p.scrollY}`;
            } else {
                ls[k] = raw ?? '(not set)';
            }
        } catch (_) {
            ls[k] = '(error reading)';
        }
    }

    let cacheMatch = 'N/A';
    try {
        const raw = localStorage.getItem(PASSAGE_CACHE_KEY);
        if (raw) {
            const { book, chapter, translation } = JSON.parse(raw);
            const sb = app?.state?.currentBook;
            const sc = app?.state?.currentChapter;
            const st = app?.state?.translation || 'KJV';
            const hit = book === sb && parseInt(chapter, 10) === sc && translation === st;
            cacheMatch = hit ? 'HIT ✓' : `MISS ✗ cache=(${book} ${chapter} ${translation}) state=(${sb} ${sc} ${st})`;
        } else {
            cacheMatch = 'MISS ✗ (no cache entry)';
        }
    } catch (_) { cacheMatch = 'MISS ✗ (parse error)'; }

    const snap = dbg.stateAtLoad || {};
    const diffs = [];
    const cur = {
        book:        app?.state?.currentBook,
        chapter:     app?.state?.currentChapter,
        translation: app?.state?.translation,
        colorTheme:  app?.state?.colorTheme,
        lightMode:   app?.state?.lightMode,
        fontSize:    app?.state?.fontSize,
        scrollY:     window.scrollY,
    };
    for (const [k, v] of Object.entries(cur)) {
        const was = snap[k];
        if (was !== undefined && String(was) !== String(v)) diffs.push(`  ${k}: ${was} → ${v}`);
    }

    const api = app?.bibleApi;
    const bookCacheKeys   = api?._bookCache         ? [...api._bookCache.keys()]         : [];
    const searchCacheKeys = api?._searchIndexCache  ? [...api._searchIndexCache.keys()]  : [];

    const timings = [
        `  scriptStart:          ${ts(dbg.t_script_start)}`,
        `  domReady:             ${ts(dbg.t_dom_ready)}`,
        `  swRegistered:         ${ts(dbg.t_sw_registered)} (background)`,
        `  settingsLoaded:       ${ts(dbg.t_settings_loaded)}`,
        `  cacheRestoreResult:   ${dbg.cacheRestoreResult ?? 'n/a'} at ${ts(dbg.t_cache_restore)}`,
        `  revealApp (1st):      ${ts(dbg.t_reveal_first)}`,
        `  passageFetchStart:    ${ts(dbg.t_passage_fetch_start)}`,
        `  passageFetchEnd:      ${ts(dbg.t_passage_fetch_end)}  (${dbg.passageFetchMs != null ? dbg.passageFetchMs + 'ms RTDB' : 'n/a'})`,
        `  revealApp (2nd):      ${ts(dbg.t_reveal_second)}`,
        `  authStateChanged:     ${ts(dbg.t_auth_state)} (${dbg.authStateUser ?? 'n/a'})`,
        `  userDataLoaded:       ${ts(dbg.t_user_data_loaded)}`,
        `  firebasePositionEnd:  ${ts(dbg.t_firebase_position_end)} (${dbg.firebasePositionChanged ? 'changed passage' : 'no change'})`,
        `  panelOpened:          +${now}ms (session age)`,
    ];

    const lines = [
        '=== timings (ms since navigation start) ===',
        ...timings,
        '',
        '=== state changes since load ===',
        diffs.length ? diffs.join('\n') : '  (none)',
        '',
        '=== localStorage ===',
        ...Object.entries(ls).map(([k, v]) => `  ${k}: ${v}`),
        '',
        '=== passage cache match (now) ===',
        `  ${cacheMatch}`,
        '',
        '=== session event log ===',
        ...(dbg.events?.length ? dbg.events.map(e => `  ${ts(e.t)}  ${e.msg}`) : ['  (none)']),
        '',
        '=== API memory cache ===',
        `  bookCache (${bookCacheKeys.length}): ${bookCacheKeys.join(', ') || '(empty)'}`,
        `  searchIndexCache (${searchCacheKeys.length}): ${searchCacheKeys.join(', ') || '(empty)'}`,
        '',
        '=== app state (now) ===',
        `  currentBook: ${app?.state?.currentBook}`,
        `  currentChapter: ${app?.state?.currentChapter}`,
        `  translation: ${app?.state?.translation}`,
        `  colorTheme: ${app?.state?.colorTheme}`,
        `  lightMode: ${app?.state?.lightMode}`,
        `  fontSize: ${app?.state?.fontSize}`,
        `  scrollY: ${window.scrollY}`,
        `  currentUser: ${app?.currentUser?.email ?? 'not signed in'}`,
    ];
    return lines.join('\n');
}

function showDebugPanel(app) {
    const existing = document.getElementById('debugPanel');
    if (existing) { existing.remove(); return; }

    const report = buildDebugReport(app);

    const overlay = document.createElement('div');
    overlay.id = 'debugPanel';
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)',
        zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', boxSizing: 'border-box',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#1e1e2e', color: '#cdd6f4', fontFamily: 'monospace',
        fontSize: '13px', lineHeight: '1.6', padding: '1.25rem',
        borderRadius: '12px', maxWidth: '100%', width: '100%',
        maxHeight: '80vh', overflowY: 'auto', whiteSpace: 'pre-wrap',
        wordBreak: 'break-all', userSelect: 'text',
        border: '1px solid #45475a',
    });
    box.textContent = report;

    const hint = document.createElement('div');
    Object.assign(hint.style, {
        marginTop: '0.75rem', textAlign: 'center', color: '#a6e3a1',
        fontSize: '14px', fontFamily: 'monospace',
    });
    hint.textContent = 'Tap to copy  ·  Tap outside to close';

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { maxWidth: '600px', width: '100%' });
    wrapper.appendChild(box);
    wrapper.appendChild(hint);
    overlay.appendChild(wrapper);

    box.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(report)
            .then(() => { hint.textContent = 'Copied! ✓'; })
            .catch(() => { hint.textContent = 'Copy failed — select text manually'; });
    });

    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

function initDebugTrigger(app) {
    const target = document.querySelector('.header') || document.querySelector('.logo');
    if (!target) return;

    let taps = 0;
    let timer = null;

    target.addEventListener('touchend', (e) => {
        if (e.target.closest('.header-controls')) return;
        e.preventDefault();
        taps++;
        clearTimeout(timer);
        timer = setTimeout(() => { taps = 0; }, 700);
        if (taps >= 3) {
            taps = 0;
            clearTimeout(timer);
            showDebugPanel(app);
        }
    }, { passive: false });

    target.addEventListener('click', (e) => {
        if (e.target.closest('.header-controls')) return;
        if (e.sourceCapabilities?.firesTouchEvents) return;
        taps++;
        clearTimeout(timer);
        timer = setTimeout(() => { taps = 0; }, 700);
        if (taps >= 3) {
            taps = 0;
            clearTimeout(timer);
            showDebugPanel(app);
        }
    });
}

// Read readingPosition from localStorage without mutating app state.
// Returns { book, chapter } or null.
function _readSavedPosition() {
    try {
        const raw = localStorage.getItem('readingPosition');
        if (!raw) return null;
        const pos = JSON.parse(raw);
        if (pos?.book && pos?.chapter) return { book: pos.book, chapter: parseInt(pos.chapter, 10) };
    } catch (_) {}
    return null;
}

class BibleApp {
    constructor() {
        this.auth     = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
        this._copyrightMap = {};
        this._translationRegistry = [];
        this._normalizeTranslation = normalizeTranslation;

        // Debug instrumentation — REMOVE BEFORE MERGING TO MAIN.
        this._dbg = {
            t_script_start: ms(),
            events: [],
        };

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
        this.bibleApi = new BibleApi(this.state.translation || 'KJV');
        this.init();
    }

    _dbgEvent(msg) {
        this._dbg.events.push({ t: ms(), msg });
    }

    getAllBooks()          { return getAllBooks(this); }
    getChapterCount(book) { return getChapterCount(this, book); }
    getTestament(book)    { return getTestament(this, book); }
    getDisplayName(book)  { return getDisplayName(this, book); }

    // ── Passage cache ──────────────────────────────────────────────────────

    _savePassageCache(book, chapter, translation, title, html) {
        try {
            localStorage.setItem(PASSAGE_CACHE_KEY, JSON.stringify({
                book,
                chapter: parseInt(chapter, 10),
                translation: translation || 'KJV',
                title,
                html,
            }));
        } catch (_) {}
    }

    _restorePassageCache() {
        try {
            const raw = localStorage.getItem(PASSAGE_CACHE_KEY);
            if (!raw) return false;
            const { book, chapter, translation, title, html } = JSON.parse(raw);

            const stateBook    = this.state.currentBook;
            const stateChapter = this.state.currentChapter;
            const stateTrans   = this.state.translation || 'KJV';

            // parseInt on both sides guards against older cache entries
            // that stored chapter as a string.
            if (
                book                    !== stateBook    ||
                parseInt(chapter, 10)  !== stateChapter ||
                translation            !== stateTrans
            ) {
                this._dbgEvent(
                    `cache MISS: cache=(${book} ${chapter} ${translation}) state=(${stateBook} ${stateChapter} ${stateTrans})`
                );
                return false;
            }

            if (this.passageTitle) this.passageTitle.textContent = title || '';
            if (this.passageText) {
                this.passageText.innerHTML = html;
                this.originalPassageHtml   = html;
                this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
            }
            this.updateNavigationState();
            return true;
        } catch (_) {
            return false;
        }
    }

    async init() {
        document.body.classList.add('initializing');
        try {
            this._dbg.t_dom_ready = ms();

            registerServiceWorker(this)
                .then(() => { this._dbg.t_sw_registered = ms(); })
                .catch((err) => {
                    this._dbg.t_sw_registered = ms();
                    this._dbgEvent(`SW registration failed: ${err?.message}`);
                });

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
            this._dbg.t_settings_loaded = ms();

            this._dbg.stateAtLoad = {
                book:        this.state.currentBook,
                chapter:     this.state.currentChapter,
                translation: this.state.translation,
                colorTheme:  this.state.colorTheme,
                lightMode:   this.state.lightMode,
                fontSize:    this.state.fontSize,
                scrollY:     window.scrollY,
            };

            if (!this.auth || !this.database) {
                console.warn('Firebase not available — sign-in disabled.');
                this._dbgEvent('Firebase unavailable');
            }

            const cacheHit = this._restorePassageCache();
            this._dbg.t_cache_restore = ms();
            this._dbg.cacheRestoreResult = cacheHit ? 'HIT' : 'MISS';
            if (cacheHit) this._dbgEvent('cache restore: HIT');

            initDebugTrigger(this);

            // Decide what to load on startup:
            //
            // 1. Cache HIT and readingPosition agrees with the cache — nothing to
            //    fetch. Reveal immediately and run translation registry in background.
            //
            // 2. Cache HIT but readingPosition points somewhere different (stale cache
            //    from a previous session's last chapter before reload) — reveal the
            //    cached content immediately so the user sees something, then load the
            //    correct position in the background.
            //
            // 3. Cache MISS — load the target passage and reveal when done.

            const savedPos = _readSavedPosition();
            const posMatchesCache = !savedPos ||
                (savedPos.book === this.state.currentBook && savedPos.chapter === this.state.currentChapter);

            if (cacheHit && posMatchesCache) {
                // Fast path: cache is current. No RTDB fetch needed.
                this._dbg.t_reveal_first = ms();
                this._dbg.t_passage_fetch_start = null;
                this._dbg.t_passage_fetch_end   = null;
                this._dbg.passageFetchMs         = null;
                revealApp();
                this._dbgEvent('init: cache hit + position match — skipping RTDB fetch');
                this._loadTranslationRegistry();
            } else if (cacheHit && !posMatchesCache) {
                // Reveal stale cache immediately for fast paint, then fix the position.
                this._dbg.t_reveal_first = ms();
                revealApp();
                this._dbgEvent(`init: cache hit but position mismatch — loading ${savedPos.book} ${savedPos.chapter}`);
                this._dbg.t_passage_fetch_start = ms();
                await Promise.all([
                    this._loadTranslationRegistry(),
                    this.loadPassage(savedPos.book, savedPos.chapter),
                ]);
                this._dbg.t_passage_fetch_end = ms();
                this._dbg.passageFetchMs = this._dbg.t_passage_fetch_end - this._dbg.t_passage_fetch_start;
            } else {
                // Cache miss: fetch and then reveal.
                this._dbg.t_passage_fetch_start = ms();
                await Promise.all([
                    this._loadTranslationRegistry(),
                    this.loadPassage(this.state.currentBook, this.state.currentChapter),
                ]);
                this._dbg.t_passage_fetch_end = ms();
                this._dbg.passageFetchMs = this._dbg.t_passage_fetch_end - this._dbg.t_passage_fetch_start;
                this._dbg.t_reveal_second = ms();
                revealApp();
            }

            if (this.auth && this.database) {
                this.auth.onAuthStateChanged(async (user) => {
                    this._dbg.t_auth_state = ms();
                    if (user) {
                        this._dbg.authStateUser = user.email;
                        this._dbgEvent(`auth: signed in as ${user.email}`);
                        this.currentUser = user;
                        await withTimeout(this.loadUserData(), 5000);
                        this._dbg.t_user_data_loaded = ms();
                        this.applySettings();
                        const bookBefore = this.state.currentBook;
                        const chBefore   = this.state.currentChapter;
                        await this._loadSavedPositionIfChanged();
                        this._dbg.t_firebase_position_end = ms();
                        this._dbg.firebasePositionChanged =
                            this.state.currentBook !== bookBefore || this.state.currentChapter !== chBefore;
                        if (this._dbg.firebasePositionChanged) {
                            this._dbgEvent(`Firebase position changed: ${bookBefore} → ${this.state.currentBook} ${this.state.currentChapter}`);
                        }
                    } else {
                        this._dbg.authStateUser = 'signed out';
                        this._dbgEvent('auth: signed out');
                        this.currentUser = null;
                        this.checkApiKey();
                    }
                });
            }
        } catch (err) {
            console.error('BibleApp init error:', err);
            this._dbgEvent(`init error: ${err.message}`);
            revealApp();
        }
    }

    async _loadTranslationRegistry() {
        const translations = await loadTranslationIndex();
        // Save to instance so populateTranslationModal can read it.
        this._translationRegistry = translations.map(t => ({ id: t.id, name: t.label }));
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

        const alreadyCached =
            this.passageText &&
            this.passageText.querySelector('.loading') === null &&
            this.passageText.innerHTML.trim() !== '';
        if (!alreadyCached) {
            this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';
        }

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
            this._dbgEvent(`loadPassage: no data for ${book} ${chapter}`);
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
            return;
        }

        this.updateNavigationState();
        const title = book === 'Psalm'
            ? `Psalm ${chapter}`
            : `${this.getDisplayName(book)} ${chapter}`;
        this.passageTitle.textContent = title;
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

        this._dbgEvent(`loadPassage: rendered ${book} ${chapter} (${this.state.translation})`);
        this.saveReadingPosition?.();
        this._savePassageCache(book, chapter, this.state.translation || 'KJV', title, this.passageText.innerHTML);
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

    openModal(modal)           { openModal(this, modal); }
    closeModal(modal)          { closeModal(this, modal); }
    openBookModal()            { openBookModal(this); }
    populateBookModal()        { populateBookModal(this); }
    openChapterModal()         { openChapterModal(this); }
    populateChapterModal()     { populateChapterModal(this); }
    openVerseModal()           { openVerseModal(this); }
    populateVerseModal()       { populateVerseModal(this); }
    openTranslationModal()     { openTranslationModal(this); }
    populateTranslationModal() { populateTranslationModal(this); }
    getCurrentVerseCount()     { return getCurrentVerseCount(this); }
    scrollToVerse(n)           { scrollVerse(this, n); }
    applyVerseGlow()           { glowVerse(this); }

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
    import('./config/firebase-config.bundle.js').catch(
        (err) => console.warn('Firebase bundle failed to load — sign-in unavailable:', err)
    );
    new BibleApp();
})();
