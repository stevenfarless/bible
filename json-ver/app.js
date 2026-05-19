// ====================
// ESV Bible Reader App
// ====================

import { BibleApi } from './bible-api.js';
import {
    initializeState,
    navigateChapter as navChapter,
    scrollToVerse as scrollVerse,
    applyVerseGlow as glowVerse,
} from './reading-state.js';
import { loadUserData as loadUserDataFromFirebase } from './firebase-config.js';
import {
    cacheElements,
    loadTheme,
    toggleTheme,
    updateThemeIcon,
    changeColorTheme,
} from './ui.js';

class BibleApp {
    constructor() {
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;

        this.bibleBooks = this.initializeBibleStructure();

        this.bookAbbreviations = {
            Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut',
            Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', '1 Samuel': '1Sam', '2 Samuel': '2Sam',
            '1 Kings': '1Kgs', '2 Kings': '2Kgs', '1 Chronicles': '1Chr', '2 Chronicles': '2Chr',
            Ezra: 'Ezra', Nehemiah: 'Neh', Esther: 'Esth', Job: 'Job', Psalms: 'Ps', Proverbs: 'Prov',
            Ecclesiastes: 'Eccl', 'Song of Solomon': 'Song', Isaiah: 'Isa', Jeremiah: 'Jer',
            Lamentations: 'Lam', Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos',
            Obadiah: 'Obad', Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph',
            Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal', Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke',
            John: 'John', Acts: 'Acts', Romans: 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor',
            Galatians: 'Gal', Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col',
            '1 Thessalonians': '1Thes', '2 Thessalonians': '2Thes', '1 Timothy': '1Tim', '2 Timothy': '2Tim',
            Titus: 'Titus', Philemon: 'Phlm', Hebrews: 'Heb', James: 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet',
            '1 John': '1John', '2 John': '2John', '3 John': '3John', Jude: 'Jude', Revelation: 'Rev',
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

    init() {
        cacheElements(this);
        loadTheme(this);

        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            const savedTheme = localStorage.getItem('colorTheme') || 'dracula';
            themeSelector.value = savedTheme;
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
        this.searchToggleBtn.addEventListener('click', () => this.toggleSearch());
        this.helpBtn.addEventListener('click', () => this.openModal(this.helpModal));
        this.settingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));

        this.closeSearchBtn.addEventListener('click', () => this.closeSearch());
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));

        this.prevChapterBtn.addEventListener('click', () => this.navigateChapter(-1));
        this.nextChapterBtn.addEventListener('click', () => this.navigateChapter(1));
        this.bookSelector.addEventListener('click', () => this.openBookModal());
        this.chapterSelector.addEventListener('click', () => this.openChapterModal());
        this.verseSelector.addEventListener('click', () => this.openVerseModal());
        this.closeVerseModal.addEventListener('click', () => this.closeModal(this.verseModal));

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
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });

        this.closeBookModal.addEventListener('click', () => this.closeModal(this.bookModal));
        this.closeChapterModal.addEventListener('click', () => this.closeModal(this.chapterModal));
        this.closeHelpModal.addEventListener('click', () => this.closeModal(this.helpModal));
        this.closeSettingsModal.addEventListener('click', () => this.closeModal(this.settingsModal));
        this.closeReferencesModal.addEventListener('click', () => this.closeModal(this.referencesModal));

        this.verseNumbersToggle.addEventListener('change', () => this.toggleSetting('showVerseNumbers'));
        this.headingsToggle.addEventListener('change', () => this.toggleSetting('showHeadings'));
        this.footnotesToggle.addEventListener('change', () => this.toggleSetting('showFootnotes'));

        this.crossReferencesToggle = document.getElementById('crossReferencesToggle');
        if (this.crossReferencesToggle) {
            this.crossReferencesToggle.addEventListener('change', () => this.toggleSetting('showCrossReferences'));
        }

        this.verseByVerseToggle.addEventListener('change', () => this.toggleVerseByVerse());
        this.fontSizeSlider.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        if (this.translationSelector) {
            this.translationSelector.addEventListener('change', async (e) => {
                await this.changeTranslation(e.target.value);
            });
        }

        this.themeToggleBtn.addEventListener('click', () => toggleTheme(this));

        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                changeColorTheme(this, e.target.value);
            });
        }

        if (lightModeToggle) {
            lightModeToggle.addEventListener('change', () => {
                toggleTheme(this);
            });
        }
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

        const data = await this.bibleApi.fetchPassage(reference);

        if (!data) {
            this.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
            return;
        }

        this.passageTitle.textContent = reference;
        this.passageText.innerHTML = data.passages[0];
        this.originalPassageHtml = this.passageText.innerHTML;

        this.attachFootnoteHandlers?.();
        this.makeFootnotesClickable?.();
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

    updateNavigationState() {
        const book = this.state.currentBook;
        const abbr = this.bookAbbreviations[book] || book;
        this.currentBookSpan.textContent = abbr;
        this.currentChapterSpan.textContent = this.state.currentChapter;
    }

    checkApiKey() {
        setTimeout(() => {
            this.showToast('Sign in to sync your reading position across devices.');
        }, 500);
    }

    loadLocalSettings() {
        this.state.fontSize = parseInt(localStorage.getItem('fontSize') || '18', 10);
        this.state.showVerseNumbers = localStorage.getItem('showVerseNumbers') !== 'false';
        this.state.showHeadings = localStorage.getItem('showHeadings') !== 'false';
        this.state.showFootnotes = localStorage.getItem('showFootnotes') === 'true';
        this.state.showCrossReferences = localStorage.getItem('showCrossReferences') === 'true';
        this.state.verseByVerse = localStorage.getItem('verseByVerse') === 'true';
        this.state.colorTheme = localStorage.getItem('colorTheme') || 'dracula';
        this.state.lightMode = localStorage.getItem('lightMode') === 'true';
        this.state.translation = localStorage.getItem('translation') || 'ESV';
    }

    applySettings() {
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector && this.state.colorTheme) {
            themeSelector.value = this.state.colorTheme;
        }
        if (this.translationSelector && this.state.translation) {
            this.translationSelector.value = this.state.translation;
        }
        this.bibleApi.setTranslation(this.state.translation || 'ESV');

        const theme = this.state.colorTheme || 'dracula';
        changeColorTheme(this, theme);
        if (this.state.lightMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        updateThemeIcon(this.state.lightMode);
        this.updateCopyright();
    }

    async toggleSetting(setting) {
        const toggleMap = {
            showVerseNumbers: 'verseNumbersToggle',
            showHeadings: 'headingsToggle',
            showFootnotes: 'footnotesToggle',
            showCrossReferences: 'crossReferencesToggle',
        };
        const toggleElement = this[toggleMap[setting]];
        if (!toggleElement) return;
        this.state[setting] = toggleElement.checked;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/${setting}`).set(toggleElement.checked);
        } else {
            localStorage.setItem(setting, toggleElement.checked);
        }
        if (setting === 'showVerseNumbers') {
            this.applySettings();
        } else {
            this.lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            await this.loadPassage(this.state.currentBook, this.state.currentChapter, true);
        }
    }

    async toggleVerseByVerse() {
        this.state.verseByVerse = this.verseByVerseToggle.checked;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/verseByVerse`).set(this.state.verseByVerse);
        } else {
            localStorage.setItem('verseByVerse', this.state.verseByVerse);
        }
        if (this.state.verseByVerse) {
            this.passageText.classList.add('verse-by-verse');
        } else {
            this.passageText.classList.remove('verse-by-verse');
        }
    }

    async updateFontSize(size) {
        this.state.fontSize = parseInt(size, 10);
        this.fontSizeValue.textContent = `${size}px`;
        this.passageText.style.fontSize = `${size}px`;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/fontSize`).set(parseInt(size, 10));
        } else {
            localStorage.setItem('fontSize', size);
        }
    }

    async changeTranslation(translation) {
        this.state.translation = translation;
        this.bibleApi.setTranslation(translation);

        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/translation`).set(translation);
        } else {
            localStorage.setItem('translation', translation);
        }

        this.updateCopyright();
        await this.loadPassage(this.state.currentBook, this.state.currentChapter);
    }

    updateCopyright() {
        const copyrights = {
            ESV: 'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.',
            KJV: 'King James Version (KJV). Public domain.',
        };
        this.copyright.textContent = copyrights[this.state.translation] || '';
    }

    async loadUserData() {
        if (!this.currentUser) return;
        const data = await loadUserDataFromFirebase(this.currentUser.uid);
        if (!data) return;
        const s = data.settings;
        this.state.fontSize = s.fontSize;
        this.state.showVerseNumbers = s.showVerseNumbers;
        this.state.showHeadings = s.showHeadings;
        this.state.showFootnotes = s.showFootnotes;
        this.state.showCrossReferences = s.showCrossReferences;
        this.state.verseByVerse = s.verseByVerse;
        this.state.colorTheme = s.colorTheme;
        this.state.lightMode = s.lightMode;
        this.state.translation = s.translation || 'ESV';
    }
}

function initializeBibleApp() {
    if (window.firebaseAuth && window.firebaseDatabase) {
        new BibleApp();
        return;
    }

    let attempts = 0;
    const maxAttempts = 50;
    const retryDelayMs = 100;

    const waitForFirebase = () => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            new BibleApp();
            return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
            console.error('Firebase failed to initialize before app startup timeout.');
            new BibleApp();
            return;
        }

        window.setTimeout(waitForFirebase, retryDelayMs);
    };

    waitForFirebase();
}

document.addEventListener('DOMContentLoaded', initializeBibleApp);
