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
        // Firebase references
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;

        // Bible structure data
        this.bibleBooks = this.initializeBibleStructure();

        // Book abbreviations for UI
        this.bookAbbreviations = {
            Genesis: 'Gen',
            Exodus: 'Exod',
            Leviticus: 'Lev',
            Numbers: 'Num',
            Deuteronomy: 'Deut',
            Joshua: 'Josh',
            Judges: 'Judg',
            Ruth: 'Ruth',
            '1 Samuel': '1Sam',
            '2 Samuel': '2Sam',
            '1 Kings': '1Kgs',
            '2 Kings': '2Kgs',
            '1 Chronicles': '1Chr',
            '2 Chronicles': '2Chr',
            Ezra: 'Ezra',
            Nehemiah: 'Neh',
            Esther: 'Esth',
            Job: 'Job',
            Psalms: 'Ps',
            Proverbs: 'Prov',
            Ecclesiastes: 'Eccl',
            'Song of Solomon': 'Song',
            Isaiah: 'Isa',
            Jeremiah: 'Jer',
            Lamentations: 'Lam',
            Ezekiel: 'Ezek',
            Daniel: 'Dan',
            Hosea: 'Hos',
            Joel: 'Joel',
            Amos: 'Amos',
            Obadiah: 'Obad',
            Jonah: 'Jonah',
            Micah: 'Mic',
            Nahum: 'Nah',
            Habakkuk: 'Hab',
            Zephaniah: 'Zeph',
            Haggai: 'Hag',
            Zechariah: 'Zech',
            Malachi: 'Mal',
            Matthew: 'Matt',
            Mark: 'Mark',
            Luke: 'Luke',
            John: 'John',
            Acts: 'Acts',
            Romans: 'Rom',
            '1 Corinthians': '1Cor',
            '2 Corinthians': '2Cor',
            Galatians: 'Gal',
            Ephesians: 'Eph',
            Philippians: 'Phil',
            Colossians: 'Col',
            '1 Thessalonians': '1Thes',
            '2 Thessalonians': '2Thes',
            '1 Timothy': '1Tim',
            '2 Timothy': '2Tim',
            Titus: 'Titus',
            Philemon: 'Phlm',
            Hebrews: 'Heb',
            James: 'Jas',
            '1 Peter': '1Pet',
            '2 Peter': '2Pet',
            '1 John': '1John',
            '2 John': '2John',
            '3 John': '3John',
            Jude: 'Jude',
            Revelation: 'Rev',
        };

        // State management
        this.state = initializeState();

        // Cache for search debouncing
        this.searchTimeout = null;

        // Search keyboard navigation state
        this.searchSelectedIndex = -1;
        this.searchResultItems = null;

        // Search pagination state
        this.searchPage = 1;
        this.searchLastQuery = '';
        this.searchHasMore = false;
        this.currentSearchResults = [];

        // Scroll tracking
        this.scrollTimeout = null;

        // Reading position tracking
        this.lastScrollPosition = 0;

        // Auto-hide chrome (Header + Nav)
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

        // stores untouched HTML for current chapter
        this.originalPassageHtml = null;

        // Search grouping expansion state
        this.searchExpandedTestaments = new Set();
        this.searchExpandedBooks = new Set();

        // Bible reader — local JSON files, no API key needed
        this.bibleApi = new BibleApi();

        // Initialize app
        this.init();
    } // end constructor


    // ================================
    // Initialization
    // ================================

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

        // Wait for Firebase auth state
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
        // Header
        this.searchToggleBtn.addEventListener('click', () => this.toggleSearch());
        this.helpBtn.addEventListener('click', () => this.openModal(this.helpModal));
        this.settingsBtn.addEventListener('click', () =>
            this.openModal(this.settingsModal)
        );

        // Search
        this.closeSearchBtn.addEventListener('click', () => this.closeSearch());
        this.searchInput.addEventListener('input', (e) =>
            this.handleSearch(e.target.value)
        );
        this.searchInput.addEventListener('keydown', (e) =>
            this.handleSearchKeydown(e)
        );

        // Navigation
        this.prevChapterBtn.addEventListener('click', () =>
            this.navigateChapter(-1)
        );
        this.nextChapterBtn.addEventListener('click', () =>
            this.navigateChapter(1)
        );
        this.bookSelector.addEventListener('click', () => this.openBookModal());
        this.chapterSelector.addEventListener('click', () => this.openChapterModal());
        this.verseSelector.addEventListener('click', () => this.openVerseModal());
        this.closeVerseModal.addEventListener('click', () =>
            this.closeModal(this.verseModal)
        );

        // References modal
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

        // Modal close buttons
        this.closeBookModal.addEventListener('click', () =>
            this.closeModal(this.bookModal)
        );
        this.closeChapterModal.addEventListener('click', () =>
            this.closeModal(this.chapterModal)
        );
        this.closeHelpModal.addEventListener('click', () =>
            this.closeModal(this.helpModal)
        );
        this.closeSettingsModal.addEventListener('click', () =>
            this.closeModal(this.settingsModal)
        );
        this.closeReferencesModal.addEventListener('click', () =>
            this.closeModal(this.referencesModal)
        );

        // References modal drag-to-resize
        const referencesContent = this.referencesModal.querySelector('.modal-content');
        const referencesHeader = this.referencesModal.querySelector('.modal-header');
        const referencesBody = this.referencesModal.querySelector('.modal-body');

        let isRefDragging = false;
        let refStartY = 0;
        let refStartHeight = 0;
        let refStartScrollTop = 0;

        const handleRefTouchStart = (e) => {
            if (!referencesHeader.contains(e.target)) return;
            isRefDragging = true;
            refStartY = e.touches[0].clientY;
            refStartHeight = referencesContent.offsetHeight;
            refStartScrollTop = referencesBody.scrollTop;
            referencesContent.classList.add('dragging');
        };

        const handleRefTouchMove = (e) => {
            if (!isRefDragging) return;
            const currentY = e.touches[0].clientY;
            const deltaY = refStartY - currentY;
            let newHeight = refStartHeight + deltaY;
            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.9;
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            referencesContent.style.height = `${newHeight}px`;
            e.preventDefault();
        };

        const handleRefTouchEnd = (e) => {
            if (!isRefDragging) return;
            isRefDragging = false;
            referencesContent.classList.remove('dragging');
            const endY = e.changedTouches[0].clientY;
            const totalDragDistance = endY - refStartY;
            if (totalDragDistance > 150 && refStartScrollTop === 0) {
                this.closeModal(this.referencesModal);
                setTimeout(() => { referencesContent.style.height = '50vh'; }, 300);
            }
        };

        referencesHeader.addEventListener('touchstart', handleRefTouchStart, { passive: false });
        document.addEventListener('touchmove', handleRefTouchMove, { passive: false });
        document.addEventListener('touchend', handleRefTouchEnd, { passive: true });

        let isRefMouseDragging = false;
        let refMouseStartY = 0;
        let refMouseStartHeight = 0;

        referencesHeader.addEventListener('mousedown', (e) => {
            if (e.target.closest('.close-btn')) return;
            isRefMouseDragging = true;
            refMouseStartY = e.clientY;
            refMouseStartHeight = referencesContent.offsetHeight;
            referencesContent.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isRefMouseDragging) return;
            const deltaY = refMouseStartY - e.clientY;
            let newHeight = refMouseStartHeight + deltaY;
            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.9;
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            referencesContent.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', (e) => {
            if (!isRefMouseDragging) return;
            isRefMouseDragging = false;
            referencesContent.classList.remove('dragging');
            const endY = e.clientY;
            const totalDragDistance = endY - refMouseStartY;
            if (totalDragDistance > 150) {
                this.closeModal(this.referencesModal);
                setTimeout(() => { referencesContent.style.height = '50vh'; }, 300);
            }
        });

        // Settings modal drag-to-resize
        const settingsContent = this.settingsModal.querySelector('.modal-content');
        const settingsHeader = this.settingsModal.querySelector('.modal-header');
        const settingsBody = this.settingsModal.querySelector('.modal-body');

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;
        let startScrollTop = 0;

        const handleTouchStart = (e) => {
            if (!settingsHeader.contains(e.target)) return;
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = settingsContent.offsetHeight;
            startScrollTop = settingsBody.scrollTop;
            settingsContent.classList.add('dragging');
        };

        const handleTouchMove = (e) => {
            if (!isDragging) return;
            const currentY = e.touches[0].clientY;
            const deltaY = startY - currentY;
            let newHeight = startHeight + deltaY;
            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.9;
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            settingsContent.style.height = `${newHeight}px`;
            e.preventDefault();
        };

        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            settingsContent.classList.remove('dragging');
            const endY = e.changedTouches[0].clientY;
            const totalDragDistance = endY - startY;
            if (totalDragDistance > 150 && startScrollTop === 0) {
                this.closeModal(this.settingsModal);
                setTimeout(() => { settingsContent.style.height = '50vh'; }, 300);
            }
        };

        settingsHeader.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

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
            const deltaY = mouseStartY - e.clientY;
            let newHeight = mouseStartHeight + deltaY;
            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.9;
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            settingsContent.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', (e) => {
            if (!isMouseDragging) return;
            isMouseDragging = false;
            settingsContent.classList.remove('dragging');
            const endY = e.clientY;
            const totalDragDistance = endY - mouseStartY;
            if (totalDragDistance > 150) {
                this.closeModal(this.settingsModal);
                setTimeout(() => { settingsContent.style.height = '50vh'; }, 300);
            }
        });

        // Settings
        this.saveApiKeyBtn?.addEventListener('click', () => this.saveApiKey());
        this.verseNumbersToggle.addEventListener('change', () =>
            this.toggleSetting('showVerseNumbers')
        );
        this.headingsToggle.addEventListener('change', () =>
            this.toggleSetting('showHeadings')
        );
        this.footnotesToggle.addEventListener('change', () =>
            this.toggleSetting('showFootnotes')
        );

        this.crossReferencesToggle = document.getElementById('crossReferencesToggle');
        if (this.crossReferencesToggle) {
            this.crossReferencesToggle.addEventListener('change', () =>
                this.toggleSetting('showCrossReferences')
            );
        }

        this.verseByVerseToggle.addEventListener('change', () =>
            this.toggleVerseByVerse()
        );
        this.fontSizeSlider.addEventListener('input', (e) =>
            this.updateFontSize(e.target.value)
        );

        // Theme
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

        // User button
        this.userBtn.addEventListener('click', () => this.handleUserButtonClick());

        // Auth modal switching
        document.getElementById('showSignupLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(this.loginModal);
            this.openModal(this.signupModal);
        });

        document.getElementById('showLoginLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal(this.signupModal);
            this.openModal(this.loginModal);
        });

        // Auth form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Close auth modals
        this.closeLoginModal.addEventListener('click', () =>
            this.closeModal(this.loginModal)
        );
        this.closeSignupModal.addEventListener('click', () =>
            this.closeModal(this.signupModal)
        );
        this.closeUserMenuModal.addEventListener('click', () =>
            this.closeModal(this.userMenuModal)
        );

        // Scroll tracking + auto-hide chrome
        window.addEventListener(
            'scroll',
            () => {
                this.handleChromeScroll();
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    this.saveReadingPosition();
                }, 500);
            },
            { passive: true }
        );

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
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
                Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31,
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

    // ==========================================
    // Passage Loading
    // ==========================================

    async loadPassage(book, chapter, restoreScroll = false) {
        if (!restoreScroll) {
            this.saveReadingPosition();
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

        console.log('=== DEBUGGING FOOTNOTES ===');
        console.log('showFootnotes setting:', this.state.showFootnotes);
        console.log('All .footnote elements:', this.passageText.querySelectorAll('.footnote'));
        const footnotes = this.passageText.querySelectorAll('.footnote');
        footnotes.forEach((fn, i) => { console.log(`Footnote ${i}:`, fn.outerHTML); });
        console.log('=== END DEBUG ===');

        this.originalPassageHtml = this.passageText.innerHTML;

        this.attachFootnoteHandlers();
        this.makeFootnotesClickable();

        this.copyright.textContent = `Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.`;

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

        this.saveReadingPosition();
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

        this.prevChapterBtn.disabled = currentBookIndex === 0 && isFirstChapter;
        this.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLastChapter;
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

    closeSearch() {
        this.searchContainer.classList.remove('active');
        this.searchInput.value = '';
        this.searchResults.innerHTML = '';
        this.searchSelectedIndex = -1;
        this.searchResultItems = [];
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchLastQuery = query;
        this.searchPage = 1;
        this.currentSearchResults = [];

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
                this.searchPage = 1;
                await this.performKeywordSearch(query, false);
            }
        }, 300);
    }

    addLoadMoreButton() {
        const old = this.searchResults.querySelector('.search-load-more');
        if (old) old.remove();
        if (!this.searchHasMore) return;
        const btn = document.createElement('button');
        btn.className = 'search-load-more';
        btn.textContent = 'Load more results';
        btn.addEventListener('click', async () => {
            this.searchPage += 1;
            await this.performKeywordSearch(this.searchLastQuery, true);
        });
        this.searchResults.appendChild(btn);
    }

    handleSearchKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeSearch();
            return;
        }

        if (!this.searchResultItems || this.searchResultItems.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(this.searchSelectedIndex + 1, this.searchResultItems.length - 1);
            this.setSearchSelectedIndex(next, true);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(this.searchSelectedIndex - 1, 0);
            this.setSearchSelectedIndex(prev, true);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            this.activateSelectedSearchResult();
        }
    }

    refreshSearchResultItems(autoSelectFirst = false) {
        this.searchResultItems = Array.from(
            this.searchResults.querySelectorAll('.search-result-item')
        );

        if (!this.searchResultItems.length) {
            this.searchSelectedIndex = -1;
            return;
        }

        if (autoSelectFirst) {
            this.setSearchSelectedIndex(0, false);
        } else {
            if (this.searchSelectedIndex < 0 || this.searchSelectedIndex >= this.searchResultItems.length) {
                this.searchSelectedIndex = -1;
            } else {
                this.setSearchSelectedIndex(this.searchSelectedIndex, false);
            }
        }
    }

    setSearchSelectedIndex(index, scrollIntoView = false) {
        if (!this.searchResultItems || this.searchResultItems.length === 0) {
            this.searchSelectedIndex = -1;
            return;
        }
        const clamped = Math.max(0, Math.min(index, this.searchResultItems.length - 1));
        this.searchSelectedIndex = clamped;
        this.searchResultItems.forEach((el, i) => {
            if (i === clamped) el.classList.add('selected');
            else el.classList.remove('selected');
        });
        const selectedEl = this.searchResultItems[clamped];
        if (selectedEl && scrollIntoView) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }

    activateSelectedSearchResult() {
        if (!this.searchResultItems || this.searchSelectedIndex < 0 || this.searchSelectedIndex >= this.searchResultItems.length) return;
        const selectedEl = this.searchResultItems[this.searchSelectedIndex];
        if (selectedEl) selectedEl.click();
    }

    isPassageReference(query) {
        const patterns = [
            /^[1-3]?\s*[a-z]+\s+\d+/i,
            /^[1-3]?\s*[a-z]+\s+\d+:\d+/i,
        ];
        return patterns.some((pattern) => pattern.test(query.trim()));
    }

    async handlePassageReference(reference) {
        const data = await this.bibleApi.fetchPassage(reference);

        if (data && data.passages && data.passages.length > 0) {
            const safeCanonical = String(data.canonical || '').replace(/"/g, '&quot;');
            const preview = this.stripHTML(data.passages[0]).substring(0, 200);

            this.searchResults.innerHTML =
                '<div class="search-result-item" data-reference="' + safeCanonical + '">' +
                '<div class="search-result-reference">' + safeCanonical + '</div>' +
                '<div class="search-result-content">' + preview + '...</div>' +
                '</div>';

            const item = this.searchResults.querySelector('.search-result-item');
            if (item) {
                item.addEventListener('click', async () => {
                    await this.loadPassageFromReference(item.dataset.reference);
                    this.closeSearch();
                });
            }

            if (typeof this.refreshSearchResultItems === 'function') {
                this.refreshSearchResultItems(true);
            }
        } else {
            this.searchResults.innerHTML = '<div class="search-no-results">No passage found</div>';
            if (typeof this.refreshSearchResultItems === 'function') {
                this.refreshSearchResultItems(false);
            }
        }
    }

    async fetchAllSearchResults(query) {
        this.currentSearchResults = [];
        this.searchPage = 1;

        while (true) {
            const data = await this.bibleApi.searchPassages(query, this.searchPage);
            if (!data || !data.results || !data.results.length) break;

            this.currentSearchResults = this.currentSearchResults.concat(data.results);

            const total = data.total_results ?? data.total;
            const pageSize = data.page_size ?? 100;
            const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

            if (this.searchPage >= totalPages) break;
            if (this.searchPage >= 10) break;

            this.searchPage += 1;
        }

        return this.currentSearchResults;
    }

    groupSearchResultsByCanon(results) {
        if (!Array.isArray(results)) return [];

        const otBooks = Object.keys(this.bibleBooks['Old Testament']);
        const ntBooks = Object.keys(this.bibleBooks['New Testament']);

        const otGroups = new Map();
        const ntGroups = new Map();

        for (const result of results) {
            const parsed = this.parseReference?.(result.reference);
            if (!parsed) continue;
            const { book } = parsed;
            const testament = this.getTestament?.(book);
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
                books: otBooks.filter(b => otGroups.has(b)).map(book => ({ book, results: otGroups.get(book) })),
            });
        }
        if (ntGroups.size) {
            grouped.push({
                heading: 'New Testament',
                books: ntBooks.filter(b => ntGroups.has(b)).map(book => ({ book, results: ntGroups.get(book) })),
            });
        }
        return grouped;
    }

    async performKeywordSearch(query) {
        this.searchResults.innerHTML = '<div class="loading" style="min-height: 100px">Searching...</div>';
        this.searchSelectedIndex = -1;
        this.searchResultItems = [];

        if (this.searchExpandedTestaments) this.searchExpandedTestaments.clear();
        if (this.searchExpandedBooks) this.searchExpandedBooks.clear();

        const allResults = await this.fetchAllSearchResults(query);

        if (allResults && allResults.length > 0) {
            this.displaySearchResults(allResults, query);
        } else {
            this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            if (typeof this.refreshSearchResultItems === 'function') {
                this.refreshSearchResultItems(false);
            }
        }
    }

    displaySearchResults(results, query) {
        const groups = this.groupSearchResultsByCanon(results);

        if (!groups.length) {
            this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            if (typeof this.refreshSearchResultItems === 'function') {
                this.refreshSearchResultItems(false);
            }
            return;
        }

        if (this.searchExpandedTestaments.size === 0 && this.searchExpandedBooks.size === 0) {
            const firstGroup = groups[0];
            if (firstGroup) {
                this.searchExpandedTestaments.add(firstGroup.heading);
                const firstBook = firstGroup.books && firstGroup.books[0];
                if (firstBook) this.searchExpandedBooks.add(firstBook.book);
            }
        }

        const escapeHtml = (str) =>
            String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const parts = [];

        for (const group of groups) {
            const testName = group.heading;
            const testamentExpanded = this.searchExpandedTestaments.has(testName);

            parts.push(`
      <div class="search-group-heading" data-testament="${escapeHtml(testName)}">
        <span class="search-group-title">${escapeHtml(testName)}</span>
        <span class="search-group-chevron ${testamentExpanded ? 'expanded' : ''}">▾</span>
      </div>`);

            if (!testamentExpanded) continue;

            for (const bookBlock of group.books) {
                const bookName = bookBlock.book;
                const bookExpanded = this.searchExpandedBooks.has(bookName);

                parts.push(`
        <div class="search-book-heading" data-book="${escapeHtml(bookName)}">
          <span class="search-book-title">${escapeHtml(bookName)}</span>
          <span class="search-book-chevron ${bookExpanded ? 'expanded' : ''}">▾</span>
        </div>`);

                if (!bookExpanded) continue;

                for (const result of bookBlock.results) {
                    let highlightedContent = result.content;
                    try {
                        highlightedContent = this.highlightSearchTerm(result.content, query);
                    } catch (err) {
                        highlightedContent = result.content;
                    }
                    const safeRef = escapeHtml(result.reference);
                    parts.push(`
          <div class="search-result-item" data-reference="${safeRef}">
            <div class="search-result-reference">${safeRef}</div>
            <div class="search-result-content">${highlightedContent}</div>
          </div>`);
                }
            }
        }

        this.searchResults.innerHTML = parts.join('');

        this.searchResults.querySelectorAll('.search-group-heading').forEach((el) => {
            el.addEventListener('click', () => {
                const testament = el.getAttribute('data-testament');
                if (!testament) return;
                if (this.searchExpandedTestaments.has(testament)) this.searchExpandedTestaments.delete(testament);
                else this.searchExpandedTestaments.add(testament);
                this.displaySearchResults(results, query);
            });
        });

        this.searchResults.querySelectorAll('.search-book-heading').forEach((el) => {
            el.addEventListener('click', () => {
                const book = el.getAttribute('data-book');
                if (!book) return;
                if (this.searchExpandedBooks.has(book)) this.searchExpandedBooks.delete(book);
                else this.searchExpandedBooks.add(book);
                this.displaySearchResults(results, query);
            });
        });

        this.searchResults.querySelectorAll('.search-result-item').forEach((item) => {
            item.addEventListener('click', async () => {
                const reference = item.dataset.reference;
                await this.loadPassageFromReference(reference);
                this.closeSearch();
            });
        });

        if (typeof this.refreshSearchResultItems === 'function') {
            this.refreshSearchResultItems(true);
        }
    }

    parseReference(reference) {
        const cleaned = String(reference || '').trim();
        const match = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
        if (!match) return null;
        const book = match[1].trim();
        const chapter = parseInt(match[2], 10);
        const verse = match[3] ? parseInt(match[3], 10) : null;
        if (!book || !Number.isFinite(chapter)) return null;
        if (verse !== null && !Number.isFinite(verse)) return null;
        return { book, chapter, verse };
    }

    async loadPassageFromReference(reference) {
        const parsed = this.parseReference(reference);
        if (!parsed) return;
        const { book, chapter, verse } = parsed;
        this.state.selectedVerse = verse || null;
        await this.loadPassage(book, chapter);
        if (verse) this.scrollToVerse(verse);
    }

    escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    highlightSearchTerm(text, term) {
        if (text == null) return '';
        const safeText = String(text);
        const rawTerm = term == null ? '' : String(term).trim();
        if (!rawTerm) return safeText;
        const escapedTerm = this.escapeRegExp(rawTerm);
        try {
            const regex = new RegExp(escapedTerm, 'gi');
            return safeText.replace(regex, (match) => `<strong>${match}</strong>`);
        } catch (err) {
            return safeText;
        }
    }

    stripHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
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
        Object.keys(this.bibleBooks['Old Testament']).forEach(book => {
            this.oldTestamentBooks.appendChild(createBookButton(book));
        });

        this.newTestamentBooks.innerHTML = '';
        Object.keys(this.bibleBooks['New Testament']).forEach(book => {
            this.newTestamentBooks.appendChild(createBookButton(book));
        });
    }

    openChapterModal() {
        this.populateChapterModal();
        this.openModal(this.chapterModal);
    }

    populateChapterModal() {
        this.chapterModalBook.textContent = this.state.currentBook;
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
        this.verseModalBook.textContent = `${this.state.currentBook} ${this.state.currentChapter}`;
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
        const verseNums = this.passageText.querySelectorAll('.verse-num');
        return verseNums.length > 0 ? verseNums.length + 1 : 0;
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
        // No API key needed — passages load from local JSON.
        // Show login prompt so users can sync reading position.
        setTimeout(() => {
            this.showToast('Welcome! Please sign in to sync your reading position.');
            this.openModal(this.loginModal);
        }, 500);
    }

    saveApiKey() {
        // API key no longer used. Close the modal if it was open.
        this.closeModal(this.settingsModal);
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
    }

    applySettings() {
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector && this.state.colorTheme) {
            themeSelector.value = this.state.colorTheme;
        }
        const theme = this.state.colorTheme || 'dracula';
        changeColorTheme(this, theme);
        if (this.state.lightMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        updateThemeIcon(this.state.lightMode);
    }

    async toggleSetting(setting) {
        const toggleMap = {
            showVerseNumbers: 'verseNumbersToggle',
            showHeadings: 'headingsToggle',
            showFootnotes: 'footnotesToggle',
            showCrossReferences: 'crossReferencesToggle',
        };
        const toggleElement = this[toggleMap[setting]];
        if (!toggleElement) {
            console.error(`Toggle not found for setting: ${setting}`);
            return;
        }
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
        this.state.fontSize = parseInt(size);
        this.fontSizeValue.textContent = `${size}px`;
        this.passageText.style.fontSize = `${size}px`;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/fontSize`).set(parseInt(size));
        } else {
            localStorage.setItem('fontSize', size);
        }
    }

    // ================================
    // Utilities
    // ================================

    copyPassage() {
        const textContent = this.stripHTML(this.passageText.innerHTML);
        const reference = this.passageTitle.textContent;
        const fullText = `${reference}\n\n${textContent}\n\n${this.copyright.textContent}`;
        navigator.clipboard.writeText(fullText)
            .then(() => { this.showToast('Passage copied to clipboard!'); })
            .catch(err => {
                console.error('Failed to copy:', err);
                this.showToast('Failed to copy passage');
            });
    }

    showError(message) {
        this.passageText.innerHTML = `<div class="error">${message}</div>`;
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        setTimeout(() => { this.toast.classList.remove('show'); }, 3000);
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.toggleSearch();
        }

        if (e.key === 'Escape') {
            if (this.bookModal.classList.contains('active')) this.closeModal(this.bookModal);
            if (this.chapterModal.classList.contains('active')) this.closeModal(this.chapterModal);
            if (this.helpModal.classList.contains('active')) this.closeModal(this.helpModal);
            if (this.settingsModal.classList.contains('active')) this.closeModal(this.settingsModal);
            if (this.loginModal.classList.contains('active')) this.closeModal(this.loginModal);
            if (this.signupModal.classList.contains('active')) this.closeModal(this.signupModal);
            if (this.userMenuModal.classList.contains('active')) this.closeModal(this.userMenuModal);
            if (this.searchContainer.classList.contains('active')) this.closeSearch();
            if (this.verseModal.classList.contains('active')) this.closeModal(this.verseModal);
            if (this.referencesModal.classList.contains('active')) this.closeModal(this.referencesModal);
        }

        if (!document.querySelector('.modal.active') && !this.searchContainer.classList.contains('active')) {
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
            const colorTheme = this.state?.colorTheme || localStorage.getItem('colorTheme') || 'dracula';
            const themeNameMap = {
                dracula: isLight ? 'Alucard (Light)' : 'Dracula (Dark)',
                steel: `Steel (${isLight ? 'Light' : 'Dark'})`,
                onyx: `Onyx (${isLight ? 'Light' : 'Dark'})`,
                reader: `Reader (${isLight ? 'Parchment' : 'Night'})`,
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
                if (confirm('Invalid login. No account found with this email. Would you like to sign up instead?')) {
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
            await this.database.ref(`users/${user.uid}`).set({
                settings: {
                    fontSize: 18,
                    showVerseNumbers: true,
                    showHeadings: true,
                    showFootnotes: false,
                    showCrossReferences: false,
                    verseByVerse: false,
                },
                createdAt: Date.now(),
            });
            this.showToast('Account created successfully!');
            this.closeModal(this.signupModal);
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
        } catch (error) {
            console.error('Signup error:', error);
            if (error.code === 'auth/email-already-in-use') {
                this.showToast('Account already exists. Please sign in.');
            } else {
                this.showToast(`Signup failed: ${error.message}`);
            }
        }
    }

    async handleLogout() {
        try {
            await this.auth.signOut();
            this.showToast('Signed out successfully!');
            this.closeModal(this.userMenuModal);
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Logout failed');
        }
    }

    // ================================
    // Firebase Data Management
    // ================================

    async loadUserData() {
        if (!this.currentUser) return;
        const data = await loadUserDataFromFirebase(this.currentUser.uid);
        if (!data) return;
        const s = data.settings;
        this.state.fontSize = s.fontSize;
        this.state.showVerseNumbers = s.showVerseNumbers;
        this.state.showHeadings = s.showHeadings;
        this.state.showFootnotes = s.showFootnotes;
        this.state.showCrossReferences = s.showCrossReferences || false;
        this.state.verseByVerse = s.verseByVerse;
        this.state.colorTheme = s.colorTheme || 'dracula';
        this.state.lightMode = typeof s.lightMode === 'boolean' ? s.lightMode : false;
    }

    // ================================
    // Reading Position Persistence
    // ================================

    async saveReadingPosition() {
        if (!this.currentUser) return;
        const position = {
            book: this.state.currentBook,
            chapter: this.state.currentChapter,
            scrollPosition: window.pageYOffset || document.documentElement.scrollTop,
            lastUpdated: Date.now(),
        };
        try {
            await this.database.ref(`users/${this.currentUser.uid}/readingPosition`).set(position);
        } catch (error) {
            console.error('Error saving reading position:', error);
        }
    }

    getSavedScrollPosition() {
        return this.lastScrollPosition;
    }

    async loadSavedReadingPosition() {
        if (!this.currentUser) return;
        try {
            const snapshot = await this.database.ref(`users/${this.currentUser.uid}/readingPosition`).once('value');
            const position = snapshot.val();
            if (position && position.book && position.chapter) {
                this.lastScrollPosition = position.scrollPosition || 0;
                await this.loadPassage(position.book, position.chapter, true);
            } else {
                await this.loadPassage(this.state.currentBook, this.state.currentChapter);
            }
        } catch (error) {
            console.error('Error loading reading position:', error);
            await this.loadPassage(this.state.currentBook, this.state.currentChapter);
        }
    }

    // =========================================
    // FOOTNOTES AND CROSS-REFERENCES
    // =========================================

    attachFootnoteHandlers() {
        const links = this.passageText.querySelectorAll('a.fn');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleReferenceClick(link);
            });
        });
    }

    handleReferenceClick(link) {
        const href = link.getAttribute('href');
        if (!href) return;
        this.footnotesSection.style.display = 'none';
        this.crossReferencesSection.style.display = 'none';
        this.footnotesContent.innerHTML = '';
        this.crossReferencesContent.innerHTML = '';
        if (href.startsWith('#f')) {
            const footnoteId = href.substring(1);
            this.loadFootnote(footnoteId, link);
        }
        this.openModal(this.referencesModal);
    }

    loadFootnote(footnoteId, clickedLink) {
        let verseRef = this.getVerseReferenceForElement(clickedLink);
        const footnoteElement = this.passageText.querySelector(`#${footnoteId}`);

        if (footnoteElement) {
            const footnoteSpan = footnoteElement.closest('.footnote');
            if (!footnoteSpan) { this.showFootnoteError(verseRef); return; }

            let footnoteText = '';
            let currentNode = footnoteSpan.nextSibling;

            while (currentNode) {
                if (currentNode.nodeName === 'BR') break;
                if (currentNode.nodeType === 1 && currentNode.classList?.contains('footnote')) break;
                if (currentNode.nodeType === 1 && currentNode.classList?.contains('footnote-ref')) {
                    currentNode = currentNode.nextSibling;
                    continue;
                }
                if (currentNode.nodeType === 1 && currentNode.tagName === 'NOTE') {
                    footnoteText += currentNode.textContent.trim();
                    break;
                }
                if (currentNode.nodeType === 3) footnoteText += currentNode.textContent;
                currentNode = currentNode.nextSibling;
            }

            footnoteText = footnoteText.trim();
            this.footnotesContent.innerHTML = `
                <div class="footnote-item">
                    <div class="footnote-ref-display" style="color: var(--secondary-color); font-size: 0.9em; margin-bottom: 0.5rem; font-weight: 600;">${verseRef}</div>
                    <div class="footnote-text">${footnoteText || 'Footnote text not found.'}</div>
                </div>`;
            this.footnotesSection.style.display = 'block';
        } else {
            this.showFootnoteError(verseRef);
        }
    }

    showFootnoteError(verseRef) {
        this.footnotesContent.innerHTML = `
            <div class="footnote-item">
                <div class="footnote-ref-display" style="color: var(--secondary-color); font-size: 0.9em; margin-bottom: 0.5rem; font-weight: 600;">${verseRef}</div>
                <div class="footnote-text">Footnote not found. Make sure "Show footnotes" is enabled in Settings, then reload this passage.</div>
            </div>`;
        this.footnotesSection.style.display = 'block';
    }

    makeFootnotesClickable() {
        const footnoteSupElements = this.passageText.querySelectorAll('sup.footnote');
        footnoteSupElements.forEach((sup) => {
            sup.style.cursor = 'pointer';
            sup.addEventListener('click', (e) => {
                e.preventDefault();
                const footnoteNumber = sup.textContent.trim();
                const verseRef = this.getVerseReferenceForElement(sup);
                this.showFootnoteModal(footnoteNumber, verseRef);
            });
        });
    }

    getVerseReferenceForElement(element) {
        let currentElement = element;
        while (currentElement) {
            const verseNum = currentElement.querySelector?.('.verse-num');
            if (verseNum) {
                const verseNumber = verseNum.textContent.trim();
                return `${this.state.currentBook} ${this.state.currentChapter}:${verseNumber}`;
            }
            currentElement = currentElement.previousElementSibling;
            if (!currentElement) break;
        }
        return `${this.state.currentBook} ${this.state.currentChapter}`;
    }

    showFootnoteModal(footnoteNumber, verseRef) {
        this.footnotesContent.innerHTML = `
            <div class="footnote-item">
                <div class="footnote-ref-display" style="color: var(--secondary-color); font-size: 0.9em; margin-bottom: 0.5rem; font-weight: 600;">${verseRef}</div>
                <div class="footnote-text">Footnote ${footnoteNumber}: Footnote content not available in local JSON translation.</div>
            </div>`;
        this.footnotesSection.style.display = 'block';
        this.crossReferencesSection.style.display = 'none';
        this.openModal(this.referencesModal);
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

// Initialize the app
document.addEventListener('DOMContentLoaded', initializeBibleApp);
