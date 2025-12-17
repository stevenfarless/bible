// js/modules/app.js NEW VERSION
import { BibleApi } from './bible-api.js';
import { initializeState, navigateChapter, applyVerseGlow } from './reading-state.js';
import { BOOK_ABBREVIATIONS, getAllBooks, getChapterCount } from './bible-structure.js';

import { UIManager } from './ui-manager.js';
import { SearchManager } from './search-manager.js';
import { FirebaseManager } from './firebase-manager.js';
import { ReferencesManager } from './references-manager.js';

class BibleApp {
    constructor() {
        this.API_BASE_URL = 'https://api.esv.org/v3';
        this.API_KEY = '';

        this.state = initializeState();
        this.bookAbbreviations = BOOK_ABBREVIATIONS;

        // Initialize Managers
        this.ui = new UIManager(this);
        this.search = new SearchManager(this);
        this.firebase = new FirebaseManager(this);
        this.references = new ReferencesManager(this);

        this.bibleApi = new BibleApi(
            this.API_BASE_URL,
            () => this.API_KEY,
            () => this.state
        );

        this.lastScrollPosition = 0;

        this.init();
    }

    init() {
        // ===== FIX: Force synchronous UI state initialization =====
        document.body.classList.add('js-ready');
        const passageContainer = document.querySelector('.passage-container');
        const searchContainer = document.querySelector('.search-container');
        const modals = document.querySelectorAll('.modal');

        // Pre-apply critical styles
        if (passageContainer) passageContainer.style.opacity = '1';
        if (searchContainer) searchContainer.style.display = 'none';
        modals.forEach(modal => {
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
        });
        // ===== END FIX =====

        this.ui.init();
        this.firebase.init(); // Sets up auth listeners & loads initial data
        this.attachGlobalListeners();
    }

    attachGlobalListeners() {
        window.addEventListener('scroll', () => {
            this.ui.handleChromeScroll();
            clearTimeout(this.ui.scrollTimeout);
            this.ui.scrollTimeout = setTimeout(() => {
                this.firebase.saveReadingPosition();
            }, 500);
        }, { passive: true });

        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // ===============================
    // Core Logic
    // ===============================


    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) this.firebase.saveReadingPosition();

        this.state.currentBook = book;
        this.state.currentChapter = chapter;
        this.updateNavigationUI();

        const reference = `${book} ${chapter}`;
        this.ui.passageText.innerHTML = '<p class="loading">Loading passage...</p>';

        const data = await this.bibleApi.fetchPassage(reference);

        if (!data) {
            this.ui.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
            return;
        }

        this.ui.passageTitle.textContent = reference;
        this.ui.passageText.innerHTML = data.passages[0];

        // Post-load setup
        this.references.attachHandlers();
        this.references.makeFootnotesClickable();
        this.ui.applyRedLetters();

        this.ui.copyright.textContent = `Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.`;
        this.ui.currentVerseSpan.textContent = '1';

        // Scroll handling
        this.ui.chromeSuspend = true;
        document.body.classList.add('chrome-no-transition');
        this.ui.showChrome();

        if (restoreScroll) {
            window.scrollTo(0, this.lastScrollPosition || 0);
        } else {
            window.scrollTo(0, 0);
        }

        requestAnimationFrame(() => {
            this.ui.chromeScrollLastY = window.scrollY || 0;
            this.ui.chromeSuspend = false;
            document.body.classList.remove('chrome-no-transition');
        });

        this.firebase.saveReadingPosition();
    }

    updateNavigationUI() {
        const book = this.state.currentBook;
        const abbr = this.bookAbbreviations[book] || book;
        this.ui.currentBookSpan.textContent = abbr;
        this.ui.currentChapterSpan.textContent = this.state.currentChapter;

        const books = getAllBooks();
        const currentBookIndex = books.indexOf(book);
        const isFirst = this.state.currentChapter === 1;
        const isLast = this.state.currentChapter === getChapterCount(book);

        this.ui.prevChapterBtn.disabled = currentBookIndex === 0 && isFirst;
        this.ui.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLast;
    }

    navigateChapter(direction) {
        navigateChapter(this, direction);
    }

    // ===============================
    // Settings Logic
    // ===============================

    async toggleSetting(setting) {
        const toggleMap = {
            'showVerseNumbers': 'verseNumbersToggle',
            'showHeadings': 'headingsToggle',
            'showFootnotes': 'footnotesToggle',
            'showCrossReferences': 'crossReferencesToggle'
        };
        const el = this.ui[toggleMap[setting]];
        if (!el) return;

        this.state[setting] = el.checked;
        this.firebase.saveSetting(setting, el.checked);

        if (setting === 'showVerseNumbers') {
            this.ui.applySettings();
        } else {
            this.lastScrollPosition = window.pageYOffset;
            await this.loadPassage(this.state.currentBook, this.state.currentChapter, true);
        }
    }

    async toggleVerseByVerse() {
        this.state.verseByVerse = this.ui.verseByVerseToggle.checked;
        this.firebase.saveSetting('verseByVerse', this.state.verseByVerse);
        if (this.state.verseByVerse) this.ui.passageText.classList.add('verse-by-verse');
        else this.ui.passageText.classList.remove('verse-by-verse');
    }

    async updateFontSize(size) {
        this.state.fontSize = parseInt(size);
        this.ui.fontSizeValue.textContent = `${size}px`;
        this.ui.passageText.style.fontSize = `${size}px`;
        this.firebase.saveSetting('fontSize', parseInt(size));
    }

    toggleRedLetters() {
        const el = document.getElementById('redLettersToggle');
        if (!el) return;
        this.state.showRedLetters = el.checked;
        this.firebase.saveSetting('showRedLetters', el.checked);
        this.ui.applyRedLetters();
    }

    // ===============================
    // Shortcuts & User
    // ===============================

    handleUserButtonClick() {
        if (this.firebase.currentUser) {
            document.getElementById('userEmail').textContent = this.firebase.currentUser.email;
            this.ui.openModal(this.ui.userMenuModal);
        } else {
            this.ui.openModal(this.ui.loginModal);
        }
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.search.toggleSearch();
        }
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) this.ui.closeModal(activeModal);
            if (this.ui.searchContainer.classList.contains('active')) this.search.closeSearch();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.bibleApp = new BibleApp();
});
