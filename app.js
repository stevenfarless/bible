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

function readBool(key, defaultValue) {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return defaultValue;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return defaultValue;
    } catch {
        return defaultValue;
    }
}

const TRANSLATION_ALIASES = {
    NRSVue: 'NRSVUE',
};

function normalizeTranslation(t) {
    return TRANSLATION_ALIASES[t] || t;
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
        await registerServiceWorker(this);

        cacheElements(this);
        loadTheme(this);

        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            try {
                const savedTheme = localStorage.getItem('colorTheme') || 'dracula';
                themeSelector.value = savedTheme;
            } catch { themeSelector.value = 'dracula'; }
        }

        if (lightModeToggle) {
            lightModeToggle.checked = document.body.classList.contains('light-mode');
        }

        this.attachEventListeners();
        this.initializeAccordion();

        if (!this.auth || !this.database) {
            console.error('Firebase auth/database not ready when app initialized.');
            this.loadLocalSettings();
            this.applySettings();
            this.loadPassage(this.state.currentBook, this.state.currentChapter);
            setTimeout(() => {
                this.showToast('Sign in is temporarily unavailable. Please refresh the page.');
            }, 500);
            return;
        }

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
                this.loadPassage(this.state.currentBook, this.state.currentChapter);
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
                const sectionEl = header.closest('.accordion-section');
                const targetKey = header.getAttribute('data-target');
                const panel = document.querySelector(`.accordion-panel[data-panel="${targetKey}"]`);
                if (!panel) return;
                const isOpen = panel.classList.contains('open');
                if (isOpen) {
                    panel.classList.remove('open');
                    sectionEl?.classList.remove('open');
                } else {
                    panel.classList.add('open');
                    sectionEl?.classList.add('open');
                }
            });
        });
    }

    // ================================
    // Event Listeners
    // ================================

    attachEventListeners() {
        // Navigation
        document.getElementById('prevChapter')?.addEventListener('click', () => this.navigateChapter(-1));
        document.getElementById('nextChapter')?.addEventListener('click', () => this.navigateChapter(1));

        // Book/Chapter/Verse selectors
        document.getElementById('bookSelector')?.addEventListener('click', () => this.openBookModal());
        document.getElementById('chapterSelector')?.addEventListener('click', () => this.openChapterModal());
        document.getElementById('verseSelector')?.addEventListener('click', () => this.openVerseModal());
        document.getElementById('closeBookModal')?.addEventListener('click', () => this.closeModal('bookModal'));
        document.getElementById('closeChapterModal')?.addEventListener('click', () => this.closeModal('chapterModal'));
        document.getElementById('closeVerseModal')?.addEventListener('click', () => this.closeModal('verseModal'));

        // Settings
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettingsModal());
        document.getElementById('closeSettingsModal')?.addEventListener('click', () => this.closeModal('settingsModal'));

        const verseNumbersToggle = document.getElementById('verseNumbersToggle');
        const headingsToggle = document.getElementById('headingsToggle');
        const footnotesToggle = document.getElementById('footnotesToggle');
        const crossReferencesToggle = document.getElementById('crossReferencesToggle');
        const verseByVerseToggle = document.getElementById('verseByVerseToggle');
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');
        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');
        const translationSelector = document.getElementById('translationSelector');

        if (verseNumbersToggle) {
            verseNumbersToggle.addEventListener('change', () => this.toggleSetting('showVerseNumbers', 'verseNumbersToggle'));
        }
        if (headingsToggle) {
            headingsToggle.addEventListener('change', () => this.toggleSetting('showHeadings', 'headingsToggle'));
        }
        if (footnotesToggle) {
            footnotesToggle.addEventListener('change', () => this.toggleSetting('showFootnotes', 'footnotesToggle'));
        }
        if (crossReferencesToggle) {
            crossReferencesToggle.addEventListener('change', () => this.toggleSetting('showCrossReferences', 'crossReferencesToggle'));
        }
        if (verseByVerseToggle) {
            verseByVerseToggle.addEventListener('change', () => {
                this.state.verseByVerse = verseByVerseToggle.checked;
                try { localStorage.setItem('verseByVerse', String(this.state.verseByVerse)); } catch { /* ignore */ }
                this.loadPassage(this.state.currentBook, this.state.currentChapter, this.state.currentVerse);
                this.syncSettingsToFirebase();
            });
        }

        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', () => {
                const size = parseInt(fontSizeSlider.value, 10);
                document.documentElement.style.setProperty('--font-size', `${size}px`);
                if (fontSizeValue) fontSizeValue.textContent = `${size}px`;
                this.state.fontSize = size;
                try { localStorage.setItem('fontSize', size); } catch { /* ignore */ }
                this.syncSettingsToFirebase();
            });
        }

        if (themeSelector) {
            themeSelector.addEventListener('change', () => {
                changeColorTheme(this, themeSelector.value);
            });
        }

        if (lightModeToggle) {
            lightModeToggle.addEventListener('change', () => {
                toggleTheme(this);
            });
        }

        if (translationSelector) {
            translationSelector.addEventListener('change', () => {
                const translation = translationSelector.value;
                this.state.translation = normalizeTranslation(translation);
                this.bibleApi.setTranslation(this.state.translation);
                try { localStorage.setItem('translation', translation); } catch { /* ignore */ }
                this.loadPassage(this.state.currentBook, this.state.currentChapter, this.state.currentVerse);
                this.syncSettingsToFirebase();
            });
        }

        // Search
        document.getElementById('searchToggle')?.addEventListener('click', () => this.toggleSearch());
        document.getElementById('closeSearch')?.addEventListener('click', () => this.closeSearch());
        document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearchInput(e));
        document.getElementById('searchInput')?.addEventListener('keydown', (e) => this.handleSearchKeydown(e));

        // Copy
        document.getElementById('copyBtn')?.addEventListener('click', () => this.copyPassage());

        // Auth
        document.getElementById('userBtn')?.addEventListener('click', () => this.handleUserButtonClick());
        document.getElementById('closeLoginModal')?.addEventListener('click', () => this.closeModal('loginModal'));
        document.getElementById('closeSignupModal')?.addEventListener('click', () => this.closeModal('signupModal'));
        document.getElementById('closeUserMenuModal')?.addEventListener('click', () => this.closeModal('userMenuModal'));
        document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('loginModal');
            this.openModal('signupModal');
        });
        document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('signupModal');
            this.openModal('loginModal');
        });
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signupForm')?.addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('openAccountBtn')?.addEventListener('click', () => {
            this.closeModal('settingsModal');
            this.handleUserButtonClick();
        });

        // References modal
        document.getElementById('closeReferencesModal')?.addEventListener('click', () => this.closeModal('referencesModal'));

        // Help
        document.getElementById('helpBtn')?.addEventListener('click', () => this.openModal('helpModal'));
        document.getElementById('closeHelpModal')?.addEventListener('click', () => this.closeModal('helpModal'));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Chrome scroll hide/show
        window.addEventListener('scroll', this.handleChromeScroll, { passive: true });
    }

    // ================================
    // Settings
    // ================================

    loadLocalSettings() {
        this.state.showVerseNumbers    = readBool('showVerseNumbers', true);
        this.state.showHeadings        = readBool('showHeadings', true);
        this.state.showFootnotes       = readBool('showFootnotes', false);
        this.state.showCrossReferences = readBool('showCrossReferences', false);
        this.state.verseByVerse        = readBool('verseByVerse', false);

        try {
            this.state.fontSize             = parseInt(localStorage.getItem('fontSize') || '18', 10);
            this.state.colorTheme  = localStorage.getItem('colorTheme')  || 'dracula';
            this.state.translation = normalizeTranslation(localStorage.getItem('translation') || 'ESV');
        } catch {
            this.state.fontSize    = 18;
            this.state.colorTheme  = 'dracula';
            this.state.translation = 'ESV';
        }
        this.bibleApi.setTranslation(this.state.translation);
    }

    applySettings() {
        const {
            showVerseNumbers, showHeadings, showFootnotes, showCrossReferences,
            verseByVerse, fontSize, colorTheme,
        } = this.state;

        const verseNumbersToggle    = document.getElementById('verseNumbersToggle');
        const headingsToggle        = document.getElementById('headingsToggle');
        const footnotesToggle       = document.getElementById('footnotesToggle');
        const crossReferencesToggle = document.getElementById('crossReferencesToggle');
        const verseByVerseToggle    = document.getElementById('verseByVerseToggle');
        const fontSizeSlider        = document.getElementById('fontSizeSlider');
        const fontSizeValue         = document.getElementById('fontSizeValue');
        const translationSelector   = document.getElementById('translationSelector');

        if (verseNumbersToggle)    verseNumbersToggle.checked    = showVerseNumbers;
        if (headingsToggle)        headingsToggle.checked        = showHeadings;
        if (footnotesToggle)       footnotesToggle.checked       = showFootnotes;
        if (crossReferencesToggle) crossReferencesToggle.checked = showCrossReferences;
        if (verseByVerseToggle)    verseByVerseToggle.checked    = verseByVerse;

        if (fontSizeSlider) {
            fontSizeSlider.value = fontSize;
            document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
            if (fontSizeValue) fontSizeValue.textContent = `${fontSize}px`;
        }

        if (translationSelector && this.state.translation) {
            translationSelector.value = this.state.translation;
        }

        changeColorTheme(this, colorTheme, false);
        updateThemeIcon(this);
    }

    toggleSetting(settingKey, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        this.state[settingKey] = el.checked;
        try { localStorage.setItem(settingKey, String(el.checked)); } catch { /* ignore */ }
        this.loadPassage(this.state.currentBook, this.state.currentChapter, this.state.currentVerse);
        this.syncSettingsToFirebase();
    }

    // ================================
    // Firebase: User Data
    // ================================

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            const data = await loadUserDataFromFirebase(this.currentUser.uid);
            if (!data) {
                this.loadLocalSettings();
                return;
            }

            const s = data.settings || {};
            this.state.fontSize            = s.fontSize            ?? 18;
            this.state.showVerseNumbers    = s.showVerseNumbers     !== false;
            this.state.showHeadings        = s.showHeadings         !== false;
            this.state.showFootnotes       = s.showFootnotes        === true;
            this.state.showCrossReferences = s.showCrossReferences  === true;
            this.state.verseByVerse        = s.verseByVerse         === true;
            this.state.colorTheme          = s.colorTheme           || 'dracula';
            this.state.lightMode           = typeof s.lightMode === 'boolean' ? s.lightMode : false;
            this.state.translation         = normalizeTranslation(s.translation || 'ESV');
            this.bibleApi.setTranslation(this.state.translation);
        } catch (err) {
            console.error('Failed to load user data from Firebase:', err);
            this.loadLocalSettings();
        }
    }

    async syncSettingsToFirebase() {
        if (!this.currentUser || !this.database) return;

        try {
            const settingsRef = this.database.ref(`users/${this.currentUser.uid}/settings`);
            await settingsRef.set({
                fontSize:            this.state.fontSize,
                showVerseNumbers:    this.state.showVerseNumbers,
                showHeadings:        this.state.showHeadings,
                showFootnotes:       this.state.showFootnotes,
                showCrossReferences: this.state.showCrossReferences,
                verseByVerse:        this.state.verseByVerse,
                colorTheme:          this.state.colorTheme,
                lightMode:           this.state.lightMode || false,
                translation:         this.state.translation,
            });
        } catch (err) {
            console.error('Failed to sync settings to Firebase:', err);
        }
    }

    // ================================
    // Firebase: Reading Position
    // ================================

    async loadSavedReadingPosition() {
        if (!this.currentUser || !this.database) {
            this.loadPassage(this.state.currentBook, this.state.currentChapter);
            return;
        }

        try {
            const posRef = this.database.ref(`users/${this.currentUser.uid}/readingPosition`);
            const snap = await posRef.once('value');
            const pos = snap.val();
            if (pos && pos.book && pos.chapter) {
                this.state.currentBook    = pos.book;
                this.state.currentChapter = pos.chapter;
                this.state.currentVerse   = pos.verse || 1;
            }
        } catch (err) {
            console.error('Failed to load reading position:', err);
        }

        this.loadPassage(this.state.currentBook, this.state.currentChapter, this.state.currentVerse);
    }

    async saveReadingPosition() {
        if (!this.currentUser || !this.database) return;
        try {
            const posRef = this.database.ref(`users/${this.currentUser.uid}/readingPosition`);
            await posRef.set({
                book:    this.state.currentBook,
                chapter: this.state.currentChapter,
                verse:   this.state.currentVerse,
            });
        } catch (err) {
            console.error('Failed to save reading position:', err);
        }
    }

    // ================================
    // Auth
    // ================================

    handleUserButtonClick() {
        if (this.currentUser) {
            this.openUserMenu();
        } else {
            this.openModal('loginModal');
        }
    }

    openUserMenu() {
        const emailEl = document.getElementById('userEmail');
        const themeEl = document.getElementById('userTheme');
        if (emailEl) emailEl.textContent = this.currentUser?.email || '';
        if (themeEl) themeEl.textContent = this.state.colorTheme || 'Dracula';
        this.openModal('userMenuModal');
    }

    async handleLogin(e) {
        e.preventDefault();
        const email    = document.getElementById('loginEmail')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;
        if (!email || !password || !this.auth) return;

        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.closeModal('loginModal');
            this.showToast('Signed in successfully.');
        } catch (err) {
            this.showToast(`Sign in failed: ${err.message}`);
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const email    = document.getElementById('signupEmail')?.value?.trim();
        const password = document.getElementById('signupPassword')?.value;
        if (!email || !password || !this.auth) return;

        try {
            await this.auth.createUserWithEmailAndPassword(email, password);
            this.closeModal('signupModal');
            this.showToast('Account created successfully.');
        } catch (err) {
            this.showToast(`Sign up failed: ${err.message}`);
        }
    }

    async handleLogout() {
        if (!this.auth) return;
        try {
            await this.auth.signOut();
            this.closeModal('userMenuModal');
            this.showToast('Signed out.');
        } catch (err) {
            this.showToast(`Sign out failed: ${err.message}`);
        }
    }

    checkApiKey() { /* ESV API key check placeholder */ }

    // ================================
    // Passage Loading
    // ================================

    async loadPassage(book, chapter, verse = null) {
        const passageText = document.getElementById('passageText');
        if (!passageText) return;
        passageText.innerHTML = '<div class="loading">Loading passage...</div>';

        const chapterNum  = Math.max(1, Math.min(chapter, this.getChapterCount(book)));
        const reference   = `${book} ${chapterNum}`;

        try {
            let scaffold = [];
            if (this.state.translation === 'BSB') {
                const structure = await loadStructure();
                scaffold = eventsForChapter(structure, book, chapterNum);
            }

            const result = await this.bibleApi.fetchPassage(
                reference,
                scaffold,
                this.state.showHeadings,
            );

            if (!result) {
                passageText.innerHTML = '<div class="error">Passage not found.</div>';
                return;
            }

            const html = result.passages.join('');
            passageText.innerHTML = this.applyDisplaySettings(html);

            const titleEl = document.getElementById('passageTitle');
            if (titleEl) titleEl.textContent = result.canonical || reference;

            const bookAbbr = document.getElementById('currentBook');
            const chapterEl = document.getElementById('currentChapter');
            const verseEl   = document.getElementById('currentVerse');
            if (bookAbbr)  bookAbbr.textContent  = this.bookAbbreviations[book] || book;
            if (chapterEl) chapterEl.textContent = chapterNum;
            if (verseEl)   verseEl.textContent   = verse || 1;

            this.state.currentBook    = book;
            this.state.currentChapter = chapterNum;
            this.state.currentVerse   = verse || 1;

            const copyrightEl = document.getElementById('copyright');
            if (copyrightEl) {
                copyrightEl.textContent = this.getCopyrightText();
            }

            await this.saveReadingPosition();

            this.originalPassageHtml = passageText.innerHTML;

            if (verse) {
                requestAnimationFrame(() => {
                    scrollVerse(verse, chapterNum);
                    glowVerse(verse, chapterNum);
                });
            }
        } catch (err) {
            console.error('loadPassage error:', err);
            passageText.innerHTML = '<div class="error">Failed to load passage. Please try again.</div>';
        }
    }

    applyDisplaySettings(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (!this.state.showVerseNumbers) {
            doc.querySelectorAll('.verse-num').forEach(el => el.remove());
        }
        if (!this.state.showHeadings) {
            doc.querySelectorAll('.pericope-heading').forEach(el => el.remove());
        }
        if (this.state.verseByVerse) {
            doc.querySelectorAll('.verse').forEach(el => {
                el.style.display = 'block';
                el.style.marginBottom = '0.5em';
            });
        }

        return doc.body.innerHTML;
    }

    getCopyrightText() {
        const t = this.state.translation;
        return this._copyrightMap[t] || '';
    }

    // ================================
    // Navigation
    // ================================

    navigateChapter(direction) {
        const result = navChapter(this.state, direction, this.bibleBooks);
        if (!result) return;
        this.state.currentBook    = result.book;
        this.state.currentChapter = result.chapter;
        this.state.currentVerse   = 1;
        this.loadPassage(result.book, result.chapter);
    }

    // ================================
    // Modals
    // ================================

    openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('active');
        this.chromeSuspend = true;
    }

    closeModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active');
        this.chromeSuspend = false;
    }

    openSettingsModal() {
        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');

        if (themeSelector) themeSelector.value = this.state.colorTheme || 'dracula';
        if (lightModeToggle) lightModeToggle.checked = this.state.lightMode || false;
        if (fontSizeSlider) {
            fontSizeSlider.value = this.state.fontSize || 18;
            if (fontSizeValue) fontSizeValue.textContent = `${this.state.fontSize || 18}px`;
        }

        this.openModal('settingsModal');
    }

    openBookModal() {
        const otGrid = document.getElementById('oldTestamentBooks');
        const ntGrid = document.getElementById('newTestamentBooks');
        if (!otGrid || !ntGrid) return;

        const render = (container, books) => {
            container.innerHTML = '';
            Object.keys(books).forEach(book => {
                const btn = document.createElement('button');
                btn.className = 'book-btn';
                btn.textContent = this.bookAbbreviations[book] || book;
                btn.title = this.getDisplayName(book);
                if (book === this.state.currentBook) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    this.state.currentBook    = book;
                    this.state.currentChapter = 1;
                    this.state.currentVerse   = 1;
                    this.closeModal('bookModal');
                    this.openChapterModal();
                });
                container.appendChild(btn);
            });
        };

        render(otGrid, this.bibleBooks['Old Testament']);
        render(ntGrid, this.bibleBooks['New Testament']);
        this.openModal('bookModal');
    }

    openChapterModal() {
        const grid = document.getElementById('chapterGrid');
        const titleEl = document.getElementById('chapterModalBook');
        if (!grid || !titleEl) return;

        titleEl.textContent = this.getDisplayName(this.state.currentBook);
        const count = this.getChapterCount(this.state.currentBook);
        grid.innerHTML = '';

        for (let i = 1; i <= count; i++) {
            const btn = document.createElement('button');
            btn.className = 'chapter-btn';
            btn.textContent = i;
            if (i === this.state.currentChapter) btn.classList.add('active');
            btn.addEventListener('click', () => {
                this.closeModal('chapterModal');
                this.loadPassage(this.state.currentBook, i);
            });
            grid.appendChild(btn);
        }

        this.openModal('chapterModal');
    }

    openVerseModal() {
        const grid = document.getElementById('verseGrid');
        const titleEl = document.getElementById('verseModalBook');
        if (!grid) return;

        if (titleEl) titleEl.textContent = `${this.getDisplayName(this.state.currentBook)} ${this.state.currentChapter}`;

        const passageText = document.getElementById('passageText');
        const verses = passageText ? [...passageText.querySelectorAll('.verse')] : [];
        const count = verses.length || 30;

        grid.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const btn = document.createElement('button');
            btn.className = 'chapter-btn';
            btn.textContent = i;
            if (i === this.state.currentVerse) btn.classList.add('active');
            btn.addEventListener('click', () => {
                this.state.currentVerse = i;
                document.getElementById('currentVerse').textContent = i;
                this.closeModal('verseModal');
                scrollVerse(i, this.state.currentChapter);
                glowVerse(i, this.state.currentChapter);
            });
            grid.appendChild(btn);
        }

        this.openModal('verseModal');
    }

    // ================================
    // Search
    // ================================

    toggleSearch() {
        const container = document.getElementById('searchContainer');
        const input     = document.getElementById('searchInput');
        if (!container) return;
        const isActive = container.classList.toggle('active');
        if (isActive) {
            this.chromeSuspend = true;
            input?.focus();
        } else {
            this.chromeSuspend = false;
            input && (input.value = '');
            document.getElementById('searchResults').innerHTML = '';
        }
    }

    closeSearch() {
        const container = document.getElementById('searchContainer');
        const input     = document.getElementById('searchInput');
        if (!container) return;
        container.classList.remove('active');
        this.chromeSuspend = false;
        if (input) input.value = '';
        const resultsEl = document.getElementById('searchResults');
        if (resultsEl) resultsEl.innerHTML = '';
    }

    handleSearchInput(e) {
        const query = e.target.value.trim();
        clearTimeout(this.searchTimeout);
        this.searchPage = 1;
        this.searchLastQuery = query;
        this.searchHasMore = false;
        this.currentSearchResults = [];
        this.searchSelectedIndex = -1;

        if (!query) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        this.searchTimeout = setTimeout(() => this.performSearch(query, 1), 300);
    }

    async performSearch(query, page = 1) {
        const resultsEl = document.getElementById('searchResults');
        if (!resultsEl) return;

        if (page === 1) {
            resultsEl.innerHTML = '<div class="search-loading">Searching...</div>';
        } else {
            const loadMore = resultsEl.querySelector('.search-load-more');
            if (loadMore) loadMore.remove();
            const loadingMore = document.createElement('div');
            loadingMore.className = 'search-loading';
            loadingMore.textContent = 'Loading more...';
            resultsEl.appendChild(loadingMore);
        }

        const data = await this.bibleApi.searchPassages(query, page);

        if (page === 1) resultsEl.innerHTML = '';
        else {
            const loadingEl = resultsEl.querySelector('.search-loading');
            if (loadingEl) loadingEl.remove();
        }

        if (!data || data.results.length === 0) {
            if (page === 1) resultsEl.innerHTML = '<div class="no-results">No results found.</div>';
            return;
        }

        this.currentSearchResults.push(...data.results);
        this.searchHasMore = this.currentSearchResults.length < data.total_results;
        this.searchPage = page;

        const refMap = this.buildReferenceMap(data.results);
        this.renderSearchResults(resultsEl, refMap, page > 1);

        if (this.searchHasMore) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'search-load-more';
            loadMoreBtn.textContent = `Load more (${data.total_results - this.currentSearchResults.length} remaining)`;
            loadMoreBtn.addEventListener('click', () => {
                this.performSearch(this.searchLastQuery, this.searchPage + 1);
            });
            resultsEl.appendChild(loadMoreBtn);
        }

        this.searchResultItems = resultsEl.querySelectorAll('.search-result-item');
    }

    buildReferenceMap(results) {
        const map = new Map();
        for (const r of results) {
            if (!map.has(r.book)) map.set(r.book, new Map());
            const bookMap = map.get(r.book);
            if (!bookMap.has(r.chapter)) bookMap.set(r.chapter, []);
            bookMap.get(r.chapter).push(r);
        }
        return map;
    }

    renderSearchResults(container, refMap, append = false) {
        for (const [book, chapterMap] of refMap) {
            const testament = this.getTestament(book);
            if (!testament) continue;

            let testamentSection = container.querySelector(`[data-testament="${testament}"]`);
            if (!testamentSection) {
                testamentSection = document.createElement('div');
                testamentSection.className = 'search-testament';
                testamentSection.setAttribute('data-testament', testament);

                const testamentHeader = document.createElement('button');
                testamentHeader.className = 'search-testament-header';
                const isExpanded = this.searchExpandedTestaments.has(testament);
                testamentHeader.innerHTML = `
                    <span>${testament}</span>
                    <svg class="chevron ${isExpanded ? 'open' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>`;
                testamentHeader.addEventListener('click', () => {
                    this.searchExpandedTestaments.has(testament)
                        ? this.searchExpandedTestaments.delete(testament)
                        : this.searchExpandedTestaments.add(testament);
                    testamentHeader.querySelector('.chevron').classList.toggle('open');
                    booksList.classList.toggle('collapsed');
                });

                const booksList = document.createElement('div');
                booksList.className = `search-books-list ${isExpanded ? '' : 'collapsed'}`;
                testamentSection.appendChild(testamentHeader);
                testamentSection.appendChild(booksList);
                container.appendChild(testamentSection);
            }

            const booksList = testamentSection.querySelector('.search-books-list');

            for (const [chapter, verses] of chapterMap) {
                const bookKey = `${book}-${chapter}`;
                let bookSection = booksList.querySelector(`[data-book-key="${bookKey}"]`);
                if (!bookSection) {
                    bookSection = document.createElement('div');
                    bookSection.className = 'search-book';
                    bookSection.setAttribute('data-book-key', bookKey);

                    const bookHeader = document.createElement('button');
                    bookHeader.className = 'search-book-header';
                    const isExpanded = this.searchExpandedBooks.has(bookKey);
                    bookHeader.innerHTML = `
                        <span>${this.getDisplayName(book)} ${chapter}</span>
                        <svg class="chevron ${isExpanded ? 'open' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>`;
                    bookHeader.addEventListener('click', () => {
                        this.searchExpandedBooks.has(bookKey)
                            ? this.searchExpandedBooks.delete(bookKey)
                            : this.searchExpandedBooks.add(bookKey);
                        bookHeader.querySelector('.chevron').classList.toggle('open');
                        verseList.classList.toggle('collapsed');
                    });

                    const verseList = document.createElement('div');
                    verseList.className = `search-verse-list ${isExpanded ? '' : 'collapsed'}`;

                    bookSection.appendChild(bookHeader);
                    bookSection.appendChild(verseList);
                    booksList.appendChild(bookSection);
                }

                const verseList = bookSection.querySelector('.search-verse-list');

                for (const result of verses) {
                    const item = document.createElement('button');
                    item.className = 'search-result-item';
                    item.setAttribute('data-book', result.book);
                    item.setAttribute('data-chapter', result.chapter);
                    item.setAttribute('data-verse', result.verse);
                    item.innerHTML = `
                        <span class="result-ref">${this.getDisplayName(result.book)} ${result.chapter}:${result.verse}</span>
                        <span class="result-text">${result.text}</span>`;
                    item.addEventListener('click', () => {
                        this.closeSearch();
                        this.loadPassage(result.book, result.chapter, result.verse);
                    });
                    verseList.appendChild(item);
                }
            }
        }
    }

    handleSearchKeydown(e) {
        const resultsEl = document.getElementById('searchResults');
        if (!resultsEl) return;
        const items = [...resultsEl.querySelectorAll('.search-result-item')];
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.searchSelectedIndex = Math.min(this.searchSelectedIndex + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.searchSelectedIndex = Math.max(this.searchSelectedIndex - 1, 0);
        } else if (e.key === 'Enter' && this.searchSelectedIndex >= 0) {
            e.preventDefault();
            items[this.searchSelectedIndex]?.click();
            return;
        } else {
            return;
        }

        items.forEach((item, i) => item.classList.toggle('selected', i === this.searchSelectedIndex));
        items[this.searchSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    }

    // ================================
    // Utility
    // ================================

    copyPassage() {
        const passageText = document.getElementById('passageText');
        if (!passageText) return;
        const text = passageText.innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Passage copied to clipboard.');
        }).catch(() => {
            this.showToast('Failed to copy passage.');
        });
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = message;
        toast.appendChild(span);
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    handleKeyboardShortcuts(e) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        const modalOpen = !!document.querySelector('.modal.active');
        const searchOpen = !!document.getElementById('searchContainer')?.classList.contains('active');

        if (e.key === 'Escape') {
            if (searchOpen) { this.closeSearch(); return; }
            const active = document.querySelector('.modal.active');
            if (active) { active.classList.remove('active'); this.chromeSuspend = false; }
            return;
        }

        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); this.toggleSearch(); return; }
        if (modalOpen || searchOpen) return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'h': this.navigateChapter(-1); break;
            case 'ArrowRight':
            case 'l': this.navigateChapter(1); break;
            case 'ArrowUp':
            case 'k': {
                e.preventDefault();
                const prev = Math.max(1, this.state.currentVerse - 1);
                this.state.currentVerse = prev;
                document.getElementById('currentVerse').textContent = prev;
                scrollVerse(prev, this.state.currentChapter);
                glowVerse(prev, this.state.currentChapter);
                break;
            }
            case 'ArrowDown':
            case 'j': {
                e.preventDefault();
                const next = this.state.currentVerse + 1;
                this.state.currentVerse = next;
                document.getElementById('currentVerse').textContent = next;
                scrollVerse(next, this.state.currentChapter);
                glowVerse(next, this.state.currentChapter);
                break;
            }
            case 'v': this.state.verseByVerse = !this.state.verseByVerse;
                this.loadPassage(this.state.currentBook, this.state.currentChapter, this.state.currentVerse);
                break;
        }
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

// Wait for DOM + Firebase module to fully initialize before constructing the app.
// Using a top-level async IIFE ensures the config/firebase-config.js module
// (which performs async CDN imports) has fully resolved before BibleApp reads
// window.firebaseAuth and window.firebaseDatabase.
(async () => {
    await new Promise(resolve => {
        if (document.readyState !== 'loading') return resolve();
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });

    // Await the firebase config module so gstatic.com CDN imports finish
    // and window.firebaseAuth / window.firebaseDatabase are set before
    // BibleApp constructor runs.
    try {
        await import('./config/firebase-config.js');
    } catch (err) {
        console.error('Firebase config module failed to load:', err);
    }

    new BibleApp();
})();
