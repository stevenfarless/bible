// js/modules/ui-manager.js NEW VERSION
import { cacheElements, loadTheme, toggleTheme, changeColorTheme, updateThemeIcon } from './ui-utils.js';
import { BOOK_ABBREVIATIONS, BIBLE_STRUCTURE, getChapterCount, getAllBooks } from './bible-structure.js';
import { scrollToVerse } from './reading-state.js';
import { getRedLetterVerses } from './words-of-jesus.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.elements = {};

        // Chrome/Scroll state
        this.chromeHidden = false;
        this.chromeScrollLastY = 0;
        this.chromeDelta = 2;
        this.chromeScrollTicking = false;
        this.chromeSuspend = false;
        this.scrollTimeout = null;
    }

    init() {
        cacheElements(this);
        this.elements = this;

        this.loadTheme();
        this.attachEventListeners();
        this.initializeAccordion();
    }

    loadTheme() {
        loadTheme(this);
        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            themeSelector.value = localStorage.getItem('colorTheme') || 'dracula';
        }
        if (lightModeToggle) {
            lightModeToggle.checked = document.body.classList.contains('light-mode');
        }
    }

    attachEventListeners() {
        // Header & Nav
        this.searchToggleBtn.addEventListener('click', () => this.app.search.toggleSearch());
        this.helpBtn.addEventListener('click', () => this.openModal(this.helpModal));
        this.settingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));

        // Navigation Buttons
        this.prevChapterBtn.addEventListener('click', () => this.app.navigateChapter(-1));
        this.nextChapterBtn.addEventListener('click', () => this.app.navigateChapter(1));

        // Selectors
        this.bookSelector.addEventListener('click', () => this.openBookModal());
        this.chapterSelector.addEventListener('click', () => this.openChapterModal());
        this.verseSelector.addEventListener('click', () => this.openVerseModal());

        // Search Input
        this.closeSearchBtn.addEventListener('click', () => this.app.search.closeSearch());
        this.searchInput.addEventListener('input', (e) => this.app.search.handleInput(e.target.value));
        this.searchInput.addEventListener('keydown', (e) => this.app.search.handleKeydown(e));

        // Settings
        this.saveApiKeyBtn.addEventListener('click', () => {
            this.app.firebase.saveApiKey(this.apiKeyInput.value.trim())
                .then(success => {
                    if (success) {
                        this.showToast('API key saved!');
                        this.closeModal(this.settingsModal);
                        this.app.loadPassage(this.app.state.currentBook, this.app.state.currentChapter);
                    } else {
                        this.showToast('Failed to save API key');
                    }
                });
        });

        // Toggles
        this.verseNumbersToggle.addEventListener('change', () => this.app.toggleSetting('showVerseNumbers'));
        this.headingsToggle.addEventListener('change', () => this.app.toggleSetting('showHeadings'));
        this.footnotesToggle.addEventListener('change', () => this.app.toggleSetting('showFootnotes'));
        const crossRefToggle = document.getElementById('crossReferencesToggle');
        if (crossRefToggle) crossRefToggle.addEventListener('change', () => this.app.toggleSetting('showCrossReferences'));

        this.verseByVerseToggle.addEventListener('change', () => this.app.toggleVerseByVerse());
        this.fontSizeSlider.addEventListener('input', (e) => this.app.updateFontSize(e.target.value));

        // Red Letters
        const redLettersToggle = document.getElementById('redLettersToggle');
        if (redLettersToggle) {
            redLettersToggle.checked = this.app.state.showRedLetters;
            redLettersToggle.addEventListener('change', () => this.app.toggleRedLetters());
        }

        // Theme
        this.themeToggleBtn.addEventListener('click', () => toggleTheme(this));
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) themeSelector.addEventListener('change', (e) => changeColorTheme(this, e.target.value));
        const lightModeToggle = document.getElementById('lightModeToggle');
        if (lightModeToggle) lightModeToggle.addEventListener('change', () => toggleTheme(this));

        // Auth
        this.userBtn.addEventListener('click', () => this.app.handleUserButtonClick());
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.firebase.handleLogin(
                document.getElementById('loginEmail').value,
                document.getElementById('loginPassword').value
            ).then(success => {
                if (success === true) this.closeModal(this.loginModal);
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.app.firebase.handleLogout().then(() => this.closeModal(this.userMenuModal));
        });

        // Modals - Close on click outside
        [this.bookModal, this.chapterModal, this.verseModal, this.settingsModal,
        this.helpModal, this.loginModal, this.signupModal, this.userMenuModal,
        this.referencesModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });

        // Specific Close Buttons
        this.closeBookModal.addEventListener('click', () => this.closeModal(this.bookModal));
        this.closeChapterModal.addEventListener('click', () => this.closeModal(this.chapterModal));
        this.closeVerseModal.addEventListener('click', () => this.closeModal(this.verseModal));
        this.closeHelpModal.addEventListener('click', () => this.closeModal(this.helpModal));
        this.closeSettingsModal.addEventListener('click', () => this.closeModal(this.settingsModal));
        document.getElementById('closeReferencesModal').addEventListener('click', () => this.closeModal(this.referencesModal));

        // Auth switching
        document.getElementById('showSignupLink').addEventListener('click', (e) => {
            e.preventDefault(); this.closeModal(this.loginModal); this.openModal(this.signupModal);
        });
        document.getElementById('showLoginLink').addEventListener('click', (e) => {
            e.preventDefault(); this.closeModal(this.signupModal); this.openModal(this.loginModal);
        });
    }

    initializeAccordion() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.accordion-section').classList.toggle('active');
            });
        });
        const openAccountBtn = document.getElementById('openAccountBtn');
        if (openAccountBtn) {
            openAccountBtn.addEventListener('click', () => {
                this.closeModal(this.settingsModal);
                this.app.firebase.currentUser ? this.openModal(this.userMenuModal) : this.openModal(this.loginModal);
            });
        }
    }

    // ===============================
    // Modals
    // ===============================

    openModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
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
        const createBtn = (book) => {
            const btn = document.createElement('button');
            btn.className = 'book-item';
            btn.textContent = BOOK_ABBREVIATIONS[book] || book;
            btn.addEventListener('click', () => {
                this.app.state.selectedVerse = null;
                this.app.loadPassage(book, 1);
                this.closeModal(this.bookModal);
            });
            return btn;
        };
        this.oldTestamentBooks.innerHTML = '';
        Object.keys(BIBLE_STRUCTURE['Old Testament']).forEach(b => this.oldTestamentBooks.appendChild(createBtn(b)));
        this.newTestamentBooks.innerHTML = '';
        Object.keys(BIBLE_STRUCTURE['New Testament']).forEach(b => this.newTestamentBooks.appendChild(createBtn(b)));
    }

    openChapterModal() {
        this.populateChapterModal();
        this.openModal(this.chapterModal);
    }

    populateChapterModal() {
        this.chapterModalBook.textContent = this.app.state.currentBook;
        this.chapterGrid.innerHTML = '';
        const count = getChapterCount(this.app.state.currentBook);
        for (let i = 1; i <= count; i++) {
            const btn = document.createElement('button');
            btn.className = 'chapter-item';
            btn.textContent = i;
            btn.addEventListener('click', () => {
                this.app.state.selectedVerse = null;
                this.app.loadPassage(this.app.state.currentBook, i);
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
        this.verseModalBook.textContent = `${this.app.state.currentBook} ${this.app.state.currentChapter}`;
        this.verseGrid.innerHTML = '';
        const count = this.getCurrentVerseCount();
        if (count === 0) {
            this.verseGrid.innerHTML = '<p>No verses found</p>';
            return;
        }
        for (let i = 1; i <= count; i++) {
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
        const nums = this.passageText.querySelectorAll('.verse-num');
        return nums.length > 0 ? nums.length + 1 : 0;
    }

    // scrollToVerse(num) {
    //     scrollToVerse(this, num);
    // }

    scrollToVerse(num) {
        scrollToVerse(this.app, num);
    }

    // ===============================
    // Red Letters & Chrome
    // ===============================

    applyRedLetters() {
        if (!this.app.state.showRedLetters) {
            this.passageText.querySelectorAll('.red-letter').forEach(el => el.classList.remove('red-letter'));
            return;
        }
        const redVerses = getRedLetterVerses(this.app.state.currentBook, this.app.state.currentChapter);
        if (!redVerses || redVerses.length === 0) return;

        this.passageText.querySelectorAll('p[id^="p"]').forEach(p => {
            const match = p.id.match(/p(\d{10})/);
            if (match) {
                const verseNum = parseInt(match[1].substring(5, 8), 10);
                if (redVerses.includes(verseNum)) this.colorizeVerse(p);
            }
        });
    }

    colorizeVerse(verseElement) {
        const verseNumEl = verseElement.querySelector('.verse-num');
        if (!verseNumEl) {
            verseElement.classList.add('red-letter');
            return;
        }
        const walker = document.createTreeWalker(verseElement, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (!verseNumEl.contains(node) && node.nodeValue.trim()) nodes.push(node);
        }
        nodes.forEach(textNode => {
            const span = document.createElement('span');
            span.className = 'red-letter';
            textNode.parentNode.insertBefore(span, textNode);
            span.appendChild(textNode);
        });
    }

    showChrome() {
        if (!this.chromeHidden) return;
        document.body.classList.remove('chrome-hidden');
        this.chromeHidden = false;
    }

    hideChrome() {
        if (this.chromeHidden) return;
        document.body.classList.add('chrome-hidden');
        this.chromeHidden = true;
    }

    handleChromeScroll() {
        if (this.chromeScrollTicking) return;
        this.chromeScrollTicking = true;

        if (this.chromeSuspend) {
            this.chromeScrollLastY = window.scrollY || 0;
            this.chromeScrollTicking = false;
            return;
        }

        window.requestAnimationFrame(() => {
            const y = window.scrollY || 0;
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
    }

    // ===============================
    // Utilities
    // ===============================

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => this.toast.classList.remove('show'), 3000);
    }

    stripHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    applySettings() {
        const theme = this.app.state.colorTheme || 'dracula';
        changeColorTheme(this, theme);
        if (this.app.state.lightMode) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        updateThemeIcon(this.app.state.lightMode);
    }
}
