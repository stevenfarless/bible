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
import { loadUserData as loadUserDataFromFirebase } from './config/firebase-config.js';
import {
    cacheElements,
    loadTheme,
    toggleTheme,
    updateThemeIcon,
    changeColorTheme,
} from './ui.js';
import {
    toggleSearch,
    closeSearch,
    handleSearch,
    handleSearchKeydown,
    parseReference,
    loadPassageFromReference,
    highlightSearchTerm,
    escapeRegExp,
    isPassageReference,
    handlePassageReference,
    fetchAllSearchResults,
    groupSearchResultsByCanon,
    performKeywordSearch,
    displaySearchResults,
    refreshSearchResultItems,
    setSearchSelectedIndex,
    activateSelectedSearchResult,
} from './search.js';

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

/**
 * Race a promise against a timeout. Resolves with the promise result if it
 * settles within `ms`, otherwise resolves with `fallback` (never rejects).
 */
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

        // Populated from translations/index.json.
        // Keys are translation IDs (e.g. 'ESV'), values are copyright strings.
        this._copyrightMap = {};

        this.bibleBooks = this.initializeBibleStructure();

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
        this.searchPage = 1;
        this.searchLastQuery = '';
        this.searchHasMore = false;
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
    // Bible Structure
    // ================================

    initializeBibleStructure() {
        return {
            'Old Testament': {
                Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
                Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
                '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
                Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalm: 150, Proverbs: 31,
                Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52,
                Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
                Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
                Haggai: 2, Zechariah: 14, Malachi: 4,
            },
            'New Testament': {
                Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
                '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6,
                Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
                '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13,
                James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
                '3 John': 1, Jude: 1, Revelation: 22,
            },
        };
    }

    getAllBooks() {
        return [
            ...Object.keys(this.bibleBooks['Old Testament']),
            ...Object.keys(this.bibleBooks['New Testament']),
        ];
    }

    getChapterCount(book) {
        for (const testament in this.bibleBooks) {
            if (this.bibleBooks[testament][book]) {
                return this.bibleBooks[testament][book];
            }
        }
        return 0;
    }

    getTestament(book) {
        if (this.bibleBooks['Old Testament'][book]) return 'Old Testament';
        if (this.bibleBooks['New Testament'][book]) return 'New Testament';
        return null;
    }

    getDisplayName(book) {
        return this.bookDisplayNames[book] || book;
    }

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

        // --- Unconditional initial render ---
        // Load local settings and render the passage immediately so the page
        // is never stuck on "Loading passage..." regardless of Firebase state.
        // onAuthStateChanged below will refine this if the user is signed in.
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

        // Firebase auth runs in parallel — if the user is signed in, load their
        // cloud settings and saved position, then re-render only if the position
        // actually differs from what's already showing.
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                // Race user data fetch against 5 s — a slow RTDB connection on
                // refresh must not block the passage from loading.
                await withTimeout(this.loadUserData(), 5000);
                this.applySettings();
                await this._loadSavedPositionIfChanged();
            } else {
                this.currentUser = null;
                // Local render already happened above; just show the sign-in hint.
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
        this.searchToggleBtn?.addEventListener('click', () => toggleSearch(this));
        this.helpBtn?.addEventListener('click', () => this.openModal(this.helpModal));
        this.settingsBtn?.addEventListener('click', () => this.openModal(this.settingsModal));

        this.closeSearchBtn?.addEventListener('click', () => closeSearch(this));
        this.searchInput?.addEventListener('input', (e) => handleSearch(this, e.target.value));
        this.searchInput?.addEventListener('keydown', (e) => handleSearchKeydown(this, e));

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
            this.closeReferencesModal?.addEventListener('click', () => this.closeModal(this.referencesModal));
        }

        // References modal drag-to-resize
        if (this.referencesModal) {
            const referencesContent = this.referencesModal.querySelector('.modal-content');
            const referencesHeader = this.referencesModal.querySelector('.modal-header');
            const referencesBody = this.referencesModal.querySelector('.modal-body');

            let isRefDragging = false;
            let refStartY = 0;
            let refStartHeight = 0;
            let refStartScrollTop = 0;

            referencesHeader?.addEventListener('touchstart', (e) => {
                isRefDragging = true;
                refStartY = e.touches[0].clientY;
                refStartHeight = referencesContent.offsetHeight;
                refStartScrollTop = referencesBody?.scrollTop ?? 0;
                referencesContent.classList.add('dragging');
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!isRefDragging) return;
                const deltaY = refStartY - e.touches[0].clientY;
                let newH = Math.max(200, Math.min(window.innerHeight * 0.9, refStartHeight + deltaY));
                referencesContent.style.height = `${newH}px`;
                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchend', (e) => {
                if (!isRefDragging) return;
                isRefDragging = false;
                referencesContent.classList.remove('dragging');
                const totalDrag = e.changedTouches[0].clientY - refStartY;
                if (totalDrag > 150 && refStartScrollTop === 0) {
                    this.closeModal(this.referencesModal);
                    setTimeout(() => { referencesContent.style.height = '50vh'; }, 300);
                }
            }, { passive: true });

            let isRefMouseDragging = false;
            let refMouseStartY = 0;
            let refMouseStartHeight = 0;

            referencesHeader?.addEventListener('mousedown', (e) => {
                if (e.target.closest('.close-btn')) return;
                isRefMouseDragging = true;
                refMouseStartY = e.clientY;
                refMouseStartHeight = referencesContent.offsetHeight;
                referencesContent.classList.add('dragging');
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isRefMouseDragging) return;
                const newH = Math.max(200, Math.min(window.innerHeight * 0.9, refMouseStartHeight + (refMouseStartY - e.clientY)));
                referencesContent.style.height = `${newH}px`;
            });

            document.addEventListener('mouseup', (e) => {
                if (!isRefMouseDragging) return;
                isRefMouseDragging = false;
                referencesContent.classList.remove('dragging');
                if (e.clientY - refMouseStartY > 150) {
                    this.closeModal(this.referencesModal);
                    setTimeout(() => { referencesContent.style.height = '50vh'; }, 300);
                }
            });
        }

        // Settings modal drag-to-resize
        const settingsContent = this.settingsModal.querySelector('.modal-content');
        const settingsHeader = this.settingsModal.querySelector('.modal-header');
        const settingsBody = this.settingsModal.querySelector('.modal-body');

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;
        let startScrollTop = 0;

        settingsHeader.addEventListener('touchstart', (e) => {
            if (!settingsHeader.contains(e.target)) return;
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = settingsContent.offsetHeight;
            startScrollTop = settingsBody.scrollTop;
            settingsContent.classList.add('dragging');
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.touches[0].clientY;
            const newH = Math.max(200, Math.min(window.innerHeight * 0.9, startHeight + deltaY));
            settingsContent.style.height = `${newH}px`;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            settingsContent.classList.remove('dragging');
            const totalDrag = e.changedTouches[0].clientY - startY;
            if (totalDrag > 150 && startScrollTop === 0) {
                this.closeModal(this.settingsModal);
                setTimeout(() => { settingsContent.style.height = '50vh'; }, 300);
            }
        }, { passive: true });

        let isMouseDragging = false;
        let mouseStartY = 0;
        let mouseStartHeight = 0;

        settingsHeader.addEventListener('mousedown', (e) => {
            if (e.target.closest('.close-btn')) return;
            isMouseDragging = true;
            mouseStartY = e.clientY;
            mouseStartHeight = settingsContent.offsetHeight;
            settingsContent.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isMouseDragging) return;
            const newH = Math.max(200, Math.min(window.innerHeight * 0.9, mouseStartHeight + (mouseStartY - e.clientY)));
            settingsContent.style.height = `${newH}px`;
        });

        document.addEventListener('mouseup', (e) => {
            if (!isMouseDragging) return;
            isMouseDragging = false;
            settingsContent.classList.remove('dragging');
            if (e.clientY - mouseStartY > 150) {
                this.closeModal(this.settingsModal);
                setTimeout(() => { settingsContent.style.height = '50vh'; }, 300);
            }
        });

        this.verseNumbersToggle?.addEventListener('change', () => this.toggleSetting('showVerseNumbers'));
        this.headingsToggle?.addEventListener('change', () => this.toggleSetting('showHeadings'));
        this.footnotesToggle?.addEventListener('change', () => this.toggleSetting('showFootnotes'));

        this.crossReferencesToggle = document.getElementById('crossReferencesToggle');
        if (this.crossReferencesToggle) {
            this.crossReferencesToggle?.addEventListener('change', () => this.toggleSetting('showCrossReferences'));
        }

        this.verseByVerseToggle?.addEventListener('change', () => this.toggleVerseByVerse());
        this.fontSizeSlider?.addEventListener('input', (e) => this.updateFontSize(e.target.value));

        if (this.translationSelector) {
            this.translationSelector?.addEventListener('change', async (e) => {
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

    /**
     * Called after Firebase resolves a signed-in user. Reads the cloud-saved
     * reading position and re-renders only if it differs from the passage that
     * was already loaded during the unconditional init render.
     */
    async _loadSavedPositionIfChanged() {
        if (!this.currentUser || !this.database) return;

        let targetBook = this.state.currentBook;
        let targetChapter = this.state.currentChapter;
        let targetScrollY = 0;

        try {
            const snapshot = await withTimeout(
                this.database.ref(`users/${this.currentUser.uid}/readingPosition`).once('value'),
                5000
            );

            if (snapshot) {
                const pos = snapshot.val();
                if (pos && pos.book && pos.chapter) {
                    targetBook = pos.book;
                    targetChapter = pos.chapter;
                    targetScrollY = pos.scrollY || 0;
                }
            } else {
                console.warn('_loadSavedPositionIfChanged: timed out, keeping current passage');
            }
        } catch (err) {
            console.error('_loadSavedPositionIfChanged: Firebase read failed', err);
        }

        // Only re-render if the saved position differs from what's already showing.
        if (targetBook !== this.state.currentBook || targetChapter !== this.state.currentChapter) {
            this.state.currentBook = targetBook;
            this.state.currentChapter = targetChapter;
            this.lastScrollPosition = targetScrollY;
            await this.loadPassage(targetBook, targetChapter, !!targetScrollY);
        } else if (targetScrollY) {
            // Same passage — just restore the scroll position.
            window.scrollTo(0, targetScrollY);
        }
    }

    /** @deprecated Use _loadSavedPositionIfChanged for the auth flow. */
    async loadSavedReadingPosition() {
        if (!this.currentUser || !this.database) {
            await this.loadPassage(this.state.currentBook, this.state.currentChapter);
            return;
        }

        try {
            const snapshot = await withTimeout(
                this.database.ref(`users/${this.currentUser.uid}/readingPosition`).once('value'),
                5000
            );

            if (snapshot) {
                const pos = snapshot.val();
                if (pos && pos.book && pos.chapter) {
                    this.state.currentBook = pos.book;
                    this.state.currentChapter = pos.chapter;
                    this.lastScrollPosition = pos.scrollY || 0;
                }
            } else {
                console.warn('loadSavedReadingPosition: timed out, loading from local state');
            }
        } catch (err) {
            console.error('loadSavedReadingPosition: failed to read Firebase', err);
        }

        await this.loadPassage(this.state.currentBook, this.state.currentChapter, !!this.lastScrollPosition);
    }

    saveReadingPosition() {
        if (!this.currentUser || !this.database) return;

        const pos = {
            book: this.state.currentBook,
            chapter: this.state.currentChapter,
            scrollY: window.scrollY || 0,
        };

        this.database
            .ref(`users/${this.currentUser.uid}/readingPosition`)
            .set(pos)
            .catch((err) => console.error('saveReadingPosition: Firebase write failed', err));
    }

    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) {
            this.saveReadingPosition?.();
        }

        this.state.currentBook = book;
        this.state.currentChapter = chapter;
        this.updateNavigationState();

        const reference = `${book} ${chapter}`;
        this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';

        // Load BSB structure scaffold for all translations.
        // The scaffold is keyed by chapter/verse and applies regardless of translation
        // since all supported translations share the same versification.
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
    // Navigation
    // ================================

    navigateChapter(direction) {
        navChapter(this, direction);
    }

    updateNavigationState() {
        const book = this.state.currentBook;
        const abbr = this.bookAbbreviations[book] || book;
        this.currentBookSpan.textContent = abbr;
        this.currentChapterSpan.textContent = this.state.currentChapter;

        const books = this.getAllBooks();
        const currentBookIndex = books.indexOf(book);
        const isFirstChapter = this.state.currentChapter === 1;
        const isLastChapter = this.state.currentChapter === this.getChapterCount(book);

        if (this.prevChapterBtn) this.prevChapterBtn.disabled = currentBookIndex === 0 && isFirstChapter;
        if (this.nextChapterBtn) this.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLastChapter;
    }

    // ================================
    // Modals
    // ================================

    openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        if (!modal) return;
        if (modal === this.settingsModal || modal === this.referencesModal) {
            const content = modal.querySelector('.modal-content');
            content.style.animation = 'slideDownToBottom 250ms ease';
            setTimeout(() => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
                content.style.animation = '';
            }, 250);
        } else {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    openBookModal() {
        this.populateBookModal();
        this.openModal(this.bookModal);
    }

    populateBookModal() {
        const createBookButton = (book) => {
            const btn = document.createElement('button');
            btn.className = 'book-item';
            btn.textContent = this.bookAbbreviations[book] || book;
            btn.addEventListener('click', () => {
                this.state.selectedVerse = null;
                this.loadPassage(book, 1);
                this.closeModal(this.bookModal);
            });
            return btn;
        };

        this.oldTestamentBooks.innerHTML = '';
        Object.keys(this.bibleBooks['Old Testament']).forEach((book) => {
            this.oldTestamentBooks.appendChild(createBookButton(book));
        });

        this.newTestamentBooks.innerHTML = '';
        Object.keys(this.bibleBooks['New Testament']).forEach((book) => {
            this.newTestamentBooks.appendChild(createBookButton(book));
        });
    }

    openChapterModal() {
        this.populateChapterModal();
        this.openModal(this.chapterModal);
    }

    populateChapterModal() {
        this.chapterModalBook.textContent = this.getDisplayName(this.state.currentBook);
        this.chapterGrid.innerHTML = '';

        const chapterCount = this.getChapterCount(this.state.currentBook);

        for (let i = 1; i <= chapterCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'chapter-item';
            btn.textContent = i;
            btn.addEventListener('click', () => {
                this.state.selectedVerse = null;
                this.loadPassage(this.state.currentBook, i);
                this.closeModal(this.chapterModal);
            });
            this.chapterGrid.appendChild(btn);
        }
    }

    openVerseModal() {
        this.populateVerseModal();
        this.openModal(this.verseModal);
    }

    populateVerseModal() {
        const book = this.state.currentBook;
        const displayBook = book === 'Psalm'
            ? `Psalm ${this.state.currentChapter}`
            : `${this.getDisplayName(book)} ${this.state.currentChapter}`;
        this.verseModalBook.textContent = displayBook;
        this.verseGrid.innerHTML = '';

        const verseCount = this.getCurrentVerseCount();

        if (verseCount === 0) {
            this.verseGrid.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">No verses found in current passage</p>';
            return;
        }

        for (let i = 1; i <= verseCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'chapter-item';
            btn.textContent = i;
            btn.addEventListener('click', () => {
                this.scrollToVerse(i);
                this.closeModal(this.verseModal);
            });
            this.verseGrid.appendChild(btn);
        }
    }

    getCurrentVerseCount() {
        return this.passageText.querySelectorAll('.verse-num').length;
    }

    scrollToVerse(verseNumber) {
        scrollVerse(this, verseNumber);
    }

    navigateToNextVerse() {
        const currentVerse = this.state.selectedVerse || 1;
        const maxVerse = this.getCurrentVerseCount();

        if (currentVerse < maxVerse) {
            this.scrollToVerse(currentVerse + 1);
        } else {
            this.navigateChapter(1);
        }
    }

    navigateToPreviousVerse() {
        const currentVerse = this.state.selectedVerse || 1;

        if (currentVerse > 1) {
            this.scrollToVerse(currentVerse - 1);
        } else {
            const books = this.getAllBooks();
            const currentBookIndex = books.indexOf(this.state.currentBook);
            const isFirstChapter = this.state.currentChapter === 1;

            if (currentBookIndex === 0 && isFirstChapter) return;

            let newChapter = this.state.currentChapter - 1;
            let newBook = this.state.currentBook;

            if (newChapter < 1) {
                newBook = books[currentBookIndex - 1];
                newChapter = this.getChapterCount(newBook);
            }

            this.state.selectedVerse = null;
            this.loadPassage(newBook, newChapter);
        }
    }

    applyVerseGlow() {
        glowVerse(this);
    }

    // ================================
    // Settings
    // ================================

    checkApiKey() {
        setTimeout(() => {
            this.showToast('Sign in to sync your reading position across devices.');
        }, 500);
    }

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
        if (themeSelector && this.state.colorTheme) {
            themeSelector.value = this.state.colorTheme;
        }
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

        if (this.passageText) {
            this.passageText.classList.toggle('verse-by-verse', !!this.state.verseByVerse);
        }
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

        // Re-render the current passage so heading visibility updates immediately.
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

    stripHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
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
            toggleSearch(this);
        }

        if (e.key === 'Escape') {
            if (this.bookModal?.classList.contains('active'))       this.closeModal(this.bookModal);
            if (this.chapterModal?.classList.contains('active'))    this.closeModal(this.chapterModal);
            if (this.helpModal?.classList.contains('active'))       this.closeModal(this.helpModal);
            if (this.settingsModal?.classList.contains('active'))   this.closeModal(this.settingsModal);
            if (this.loginModal?.classList.contains('active'))      this.closeModal(this.loginModal);
            if (this.signupModal?.classList.contains('active'))     this.closeModal(this.signupModal);
            if (this.userMenuModal?.classList.contains('active'))   this.closeModal(this.userMenuModal);
            if (this.searchContainer?.classList.contains('active')) closeSearch(this);
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
    // Firebase Authentication
    // ================================

    handleUserButtonClick() {
        if (this.currentUser) {
            document.getElementById('userEmail').textContent = this.currentUser.email;
            const isLight = document.body.classList.contains('light-mode');
            let colorTheme = this.state?.colorTheme || 'dracula';

            try { colorTheme = this.state?.colorTheme || localStorage.getItem('colorTheme') || 'dracula'; } catch (_) {}
            const themeNameMap = {
                dracula: isLight ? 'Alucard (Light)' : 'Dracula (Dark)',
                steel:   `Steel (${isLight ? 'Light' : 'Dark'})`,
                onyx:    `Onyx (${isLight ? 'Light' : 'Dark'})`,
                reader:  `Reader (${isLight ? 'Parchment' : 'Night'})`,
            };
            document.getElementById('userTheme').textContent =
                themeNameMap[colorTheme] || (isLight ? 'Alucard (Light)' : 'Dracula (Dark)');
            this.openModal(this.userMenuModal);
        } else {
            this.openModal(this.loginModal);
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showToast('Please enter valid credentials');
            return;
        }

        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.showToast('Signed in successfully!');
            this.closeModal(this.loginModal);
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/user-not-found') {
                if (confirm('No account found with this email. Sign up instead?')) {
                    this.closeModal(this.loginModal);
                    this.openModal(this.signupModal);
                    document.getElementById('signupEmail').value = email;
                }
            } else if (error.code === 'auth/wrong-password') {
                this.showToast('Incorrect password');
            } else {
                this.showToast(`Login failed: ${error.message}`);
            }
        }
    }

    async handleSignup() {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        if (!email || !password) {
            this.showToast('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters');
            return;
        }

        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await this.database.ref(`users/${user.uid}/settings`).set({
                fontSize: this.state.fontSize,
                showVerseNumbers: this.state.showVerseNumbers,
                showHeadings: this.state.showHeadings,
                showFootnotes: this.state.showFootnotes,
                showCrossReferences: this.state.showCrossReferences,
                verseByVerse: this.state.verseByVerse,
                colorTheme: this.state.colorTheme,
                lightMode: this.state.lightMode,
                translation: this.state.translation || 'ESV',
            });

            this.showToast('Account created successfully!');
            this.closeModal(this.signupModal);
        } catch (error) {
            console.error('Signup error:', error);
            if (error.code === 'auth/email-already-in-use') {
                this.showToast('An account with this email already exists');
            } else {
                this.showToast(`Signup failed: ${error.message}`);
            }
        }
    }

    async handleLogout() {
        try {
            await this.auth.signOut();
            this.showToast('Signed out successfully');
            this.closeModal(this.userMenuModal);
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Failed to sign out');
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;
        const data = await loadUserDataFromFirebase(this.currentUser.uid);
        if (!data) return;
        const s = data.settings;
        this.state.fontSize             = s.fontSize;
        this.state.showVerseNumbers     = s.showVerseNumbers;
        this.state.showHeadings         = s.showHeadings;
        this.state.showFootnotes        = s.showFootnotes;
        this.state.showCrossReferences  = s.showCrossReferences;
        this.state.verseByVerse         = s.verseByVerse;
        this.state.colorTheme           = s.colorTheme;
        this.state.lightMode            = s.lightMode;
        this.state.translation          = normalizeTranslation(s.translation || 'ESV');
    }
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
      // SW sends RELOAD when it takes over from an old cached version.
      // JS files are now network-first, so a reload fetches the latest code.
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
