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
import { getRedLetterVerses } from './words-of-jesus.js';

class BibleApp {
    constructor() {
        // Configuration
        this.API_BASE_URL = 'https://api.esv.org/v3';
        this.API_KEY = '';

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

        // State management (use helper now)
        this.state = initializeState();

        // Cache for search debouncing
        this.searchTimeout = null;

        this.state.showRedLetters = localStorage.getItem('showRedLetters') === 'true';
        this.redLettersToggle = document.getElementById('redLettersToggle');

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

        // Define chrome functions ON THE INSTANCE (so they exist at runtime)
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
        this.searchExpandedTestaments = new Set(); // e.g., "Old Testament", "New Testament"
        this.searchExpandedBooks = new Set();      // e.g., "Genesis", "Romans"

        // ESV API client
        this.bibleApi = new BibleApi(
            this.API_BASE_URL,
            () => this.API_KEY,
            () => this.state
        );

        // this.searchPage = 1;
        // this.searchLastQuery = '';
        // this.searchHasMore = false;

        // Initialize app
        this.init();
    } // end constructor


    // ================================
    // Initialization
    // ================================

    init() {
        cacheElements(this);
        loadTheme(this);

        // Set theme selector value AND apply the theme class
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

        // Wait for Firebase auth state
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                this.applySettings();
                this.applyRedLetters();

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

        // Handle "Manage Account" button
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

        // References modal (footnotes and cross-references)
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

        // Modals
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

        // Settings
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.verseNumbersToggle.addEventListener('change', () =>
            this.toggleSetting('showVerseNumbers')
        );
        this.headingsToggle.addEventListener('change', () =>
            this.toggleSetting('showHeadings')
        );
        this.footnotesToggle.addEventListener('change', () =>
            this.toggleSetting('showFootnotes')
        );

        // Cross-references toggle
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

        // RED LETTERS TOGGLE - Fixed placement
        if (this.redLettersToggle) {
            this.redLettersToggle.checked = this.state.showRedLetters;
            this.redLettersToggle.addEventListener('change', () => this.toggleRedLetters());
        }

        // Theme toggle
        this.themeToggleBtn.addEventListener('click', () => toggleTheme(this));

        // Theme selector
        const themeSelector = document.getElementById('themeSelector');
        const lightModeToggle = document.getElementById('lightModeToggle');

        if (themeSelector) {
            themeSelector.addEventListener('change', (e) =>
                changeColorTheme(this, e.target.value)
            );
        }

        if (lightModeToggle) {
            lightModeToggle.addEventListener('change', () => toggleTheme(this));
        }

        // User button
        this.userBtn.addEventListener('click', () => this.handleUserButtonClick());

        // Auth modal switching
        document
            .getElementById('showSignupLink')
            .addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal(this.loginModal);
                this.openModal(this.signupModal);
            });

        document
            .getElementById('showLoginLink')
            .addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal(this.signupModal);
                this.openModal(this.loginModal);
            });

        // Auth form submissions
        document
            .getElementById('loginForm')
            .addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });

        document
            .getElementById('signupForm')
            .addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });

        document
            .getElementById('logoutBtn')
            .addEventListener('click', () => this.handleLogout());

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

        // Copy passage button
        this.copyBtn.addEventListener('click', () => this.copyPassage());

        // Track scroll position (auto-hide chrome)
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

        // Settings modal drag-to-resize and swipe-to-close
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
                setTimeout(() => {
                    settingsContent.style.height = '50vh';
                }, 300);
            }
        };

        settingsHeader.addEventListener('touchstart', handleTouchStart, {
            passive: false,
        });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Mouse events for desktop
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
                setTimeout(() => {
                    settingsContent.style.height = '50vh';
                }, 300);
            }
        });

        // References modal drag-to-resize (same pattern)
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
                setTimeout(() => {
                    referencesContent.style.height = '50vh';
                }, 300);
            }
        };

        referencesHeader.addEventListener('touchstart', handleRefTouchStart, {
            passive: false,
        });
        document.addEventListener('touchmove', handleRefTouchMove, { passive: false });
        document.addEventListener('touchend', handleRefTouchEnd, { passive: true });

        // Mouse events for references modal
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
                setTimeout(() => {
                    referencesContent.style.height = '50vh';
                }, 300);
            }
        });
    }

    async loadPassage(book, chapter, restoreScroll = false) {
        // Save reading position before loading new passage
        if (!restoreScroll) {
            this.saveReadingPosition();
        }

        // Update state
        this.state.currentBook = book;
        this.state.currentChapter = chapter;
        this.updateNavigationState();

        // Build reference string
        const reference = `${book} ${chapter}`;

        // Show loading state
        this.passageText.innerHTML = '<p class="loading">Loading passage...</p>';

        // Fetch passage from API
        const data = await this.bibleApi.fetchPassage(reference);

        if (!data || !data.passages || !data.passages[0]) {
            this.passageText.innerHTML = '<p class="error">Error loading passage</p>';
            return;
        }

        // Update UI with passage content
        this.passageTitle.textContent = reference;
        this.passageText.innerHTML = data.passages[0];

        // Cache original HTML
        this.originalPassageHtml = this.passageText.innerHTML;

        // Handle scroll position
        if (restoreScroll) {
            window.scrollTo(0, this.lastScrollPosition || 0);
        } else {
            window.scrollTo(0, 0);
        }

        // Apply display settings
        this.applySettings();

        // Apply red letters
        this.applyRedLetters();

        // Save reading position
        this.saveReadingPosition();
    }

    // ================================
    // Red Letters Methods
    // ================================

    /**
     * Apply red letter styling to current passage
     */
    applyRedLetters() {
        // Remove styling if disabled
        if (!this.state.showRedLetters) {
            const redLetters = this.passageText.querySelectorAll('.red-letter');
            redLetters.forEach((el) => el.classList.remove('red-letter'));
            return;
        }

        // Get current location
        const book = this.state.currentBook;
        const chapter = this.state.currentChapter;
        const redVerses = getRedLetterVerses(book, chapter);

        // No red letters in this chapter
        if (redVerses.length === 0) return;

        // Find all verse paragraphs
        const verseElements = this.passageText.querySelectorAll('p[id^="p"]');

        verseElements.forEach((p) => {
            const pId = p.getAttribute('id');
            if (!pId) return;

            // Parse ESV API verse ID format: p[BBBCCCVVV]-[seq]
            const match = pId.match(/p(\d{10})/);
            if (!match) return;

            const encodedVerse = match[1];
            const verseNum = parseInt(encodedVerse.substring(5, 8), 10);

            // Check if this verse should be red
            if (redVerses.includes(verseNum)) {
                this.colorizeVerse(p, verseNum);
            }
        });
    }

    /**
     * Helper: Colorize a single verse
     */
    colorizeVerse(verseElement, verseNum) {
        const verseNumEl = verseElement.querySelector('.verse-num');

        if (!verseNumEl) {
            // No verse number, color the whole paragraph
            verseElement.classList.add('red-letter');
            return;
        }

        // Create tree walker to find text nodes
        const walker = document.createTreeWalker(
            verseElement,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToWrap = [];
        let node;

        while ((node = walker.nextNode())) {
            // Skip verse number element
            if (!verseNumEl.contains(node) && node.nodeValue.trim()) {
                nodesToWrap.push(node);
            }
        }

        // Wrap text nodes in red-letter spans
        nodesToWrap.forEach((textNode) => {
            const span = document.createElement('span');
            span.className = 'red-letter';
            textNode.parentNode.insertBefore(span, textNode);
            span.appendChild(textNode);
        });
    }

    /**
     * Toggle red letters on/off
     */
    toggleRedLetters() {
        if (!this.redLettersToggle) return;

        this.state.showRedLetters = this.redLettersToggle.checked;
        localStorage.setItem('showRedLetters', this.state.showRedLetters);
        this.applyRedLetters();
    }
}

// ==========================================
// INITIALIZE APP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const app = new BibleApp();
    window.bibleApp = app;
});