// js/modules/app.js
import { BibleApi } from './bible-api.js';
import { initializeState, navigateChapter } from './reading-state.js';
import {
    BOOK_ABBREVIATIONS,
    getAllBooks,
    getChapterCount,
} from './bible-structure.js';
import { UIManager } from './ui-manager.js';
import { SearchManager } from './search-manager.js';
import { FirebaseManager } from './firebase-manager.js';
import { ReferencesManager } from './references-manager.js';

// ================================
// Configuration Constants
// ================================
const APP_CONFIG = {
    API_BASE_URL: 'https://api.esv.org/v3',
    API_TIMEOUT_MS: 10000,
    SCROLL_SAVE_DEBOUNCE_MS: 500,
};

class BibleApp {
    constructor() {
        this.API_BASE_URL = APP_CONFIG.API_BASE_URL;

        // Load API key from localStorage
        this.API_KEY = localStorage.getItem('esvApiKey') || '';

        // Initialize state
        this.state = initializeState();
        this.bookAbbreviations = BOOK_ABBREVIATIONS;

        // Initialize managers
        this.ui = new UIManager(this);
        this.search = new SearchManager(this);
        this.firebase = new FirebaseManager(this);
        this.references = new ReferencesManager(this);

        // Initialize API with dependency injection
        this.bibleApi = new BibleApi(
            this.API_BASE_URL,
            () => this.API_KEY,
            () => this.state
        );

        // State tracking
        this.lastScrollPosition = 0;
        this.originalPassageHtml = null;
        this.scrollTimeout = null;
        this.isLoading = false; // Prevent race conditions

        this.init();
    }

    async init() {
        try {
            this.ui.init();
            await this.firebase.init();
            this.attachGlobalListeners();

            // Check authentication first
            if (!this.firebase.currentUser) {
                // User is not logged in - show login modal
                if (this.ui.passageText) {
                    this.ui.passageText.innerHTML = `
                        <div class="error" style="text-align: center; padding: 40px;">
                            <h2>Welcome to Bible Dev</h2>
                            <p>Please sign in or create an account to get started.</p>
                        </div>
                    `;
                }
                // Open login modal automatically
                if (this.ui.loginModal) {
                    this.ui.openModal(this.ui.loginModal);
                }
            } else if (!this.API_KEY) {
                // User is logged in but no API key
                this.ui.showToast('Please add your ESV API key in Settings');
                if (this.ui.passageText) {
                    this.ui.passageText.innerHTML = `
                        <div class="error" style="text-align: center; padding: 40px;">
                            <h2>ESV API Key Required</h2>
                            <p>Please add your API key in Settings to load passages.</p>
                            <p style="font-size: 0.9rem; margin-top: 20px;">
                                Get a free key at 
                                <a href="https://api.esv.org" target="_blank" style="color: var(--accent)">api.esv.org</a>
                            </p>
                        </div>
                    `;
                }
            } else {
                // User is logged in and has API key - load initial passage
                await this.loadPassage(this.state.currentBook, this.state.currentChapter);
            }

            // Mark DOM as ready so CSS shows content
            document.body.classList.add('js-ready');
        } catch (error) {
            console.error('App initialization error:', error);
            if (this.ui && this.ui.showToast) {
                this.ui.showToast('Failed to initialize app. Please refresh.');
            }
        }
    }

    attachGlobalListeners() {
        // Scroll event listener with debounce
        window.addEventListener('scroll', () => {
            if (this.ui && this.ui.handleChromeScroll) {
                this.ui.handleChromeScroll();
            }

            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                if (this.firebase && this.firebase.saveReadingPosition) {
                    this.firebase.saveReadingPosition().catch(err =>
                        console.error('Error saving position:', err)
                    );
                }
            }, APP_CONFIG.SCROLL_SAVE_DEBOUNCE_MS);
        }, { passive: true });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    // ================================
    // Core Logic
    // ================================

    /**
     * Load a passage from the ESV API
     * @param {string} book - Book name (e.g., 'John')
     * @param {number} chapter - Chapter number
     * @param {boolean} restoreScroll - Whether to restore scroll position
     */
    async loadPassage(book, chapter, restoreScroll = false) {
        // Prevent race conditions
        if (this.isLoading) {
            console.warn('Already loading a passage, please wait');
            return;
        }

        // Validate parameters
        const allBooks = getAllBooks();
        if (!book || !allBooks.includes(book)) {
            console.error('Invalid book:', book);
            if (this.ui && this.ui.showToast) {
                this.ui.showToast(`Invalid book: ${book}`);
            }
            return;
        }

        if (!Number.isInteger(chapter) || chapter < 1) {
            console.error('Invalid chapter:', chapter);
            if (this.ui && this.ui.showToast) {
                this.ui.showToast('Invalid chapter');
            }
            return;
        }

        const maxChapter = getChapterCount(book);
        if (chapter > maxChapter) {
            console.error(`Chapter ${chapter} does not exist in ${book}`);
            if (this.ui && this.ui.showToast) {
                this.ui.showToast(
                    `${book} only has ${maxChapter} chapter${maxChapter > 1 ? 's' : ''}`
                );
            }
            return;
        }

        try {
            // Set loading flag
            this.isLoading = true;

            // Save position before loading new passage
            if (!restoreScroll && this.firebase) {
                await this.firebase.saveReadingPosition();
            }

            // Update state
            this.state.currentBook = book;
            this.state.currentChapter = chapter;
            this.updateNavigationUI();

            const reference = `${book} ${chapter}`;

            // Show loading state
            if (this.ui && this.ui.passageText) {
                this.ui.passageText.innerHTML = `<div class="loading">Loading ${reference}...</div>`;
            }

            // Fetch passage from API
            const data = await this.bibleApi.fetchPassage(reference);

            if (!data || !data.passages || data.passages.length === 0) {
                if (this.ui && this.ui.passageText) {
                    this.ui.passageText.innerHTML = `<div class="error">Passage not found: ${reference}</div>`;
                }
                return;
            }

            // Store original HTML for verse selection
            this.originalPassageHtml = data.passages[0];

            // Display passage
            if (this.ui && this.ui.passageText) {
                this.ui.passageText.innerHTML = this.originalPassageHtml;
            }

            // Attach reference handlers (footnotes, cross-refs)
            if (this.references) {
                this.references.makeFootnotesClickable();
            }

            // Restore scroll position if requested
            if (restoreScroll) {
                setTimeout(() => {
                    window.scrollTo(0, this.lastScrollPosition);
                }, 0);
            }
        } catch (error) {
            console.error('Error loading passage:', error);
            if (this.ui && this.ui.showToast) {
                this.ui.showToast(
                    `Error loading passage: ${error.message || 'Unknown error'}`
                );
            }
            if (this.ui && this.ui.passageText) {
                this.ui.passageText.innerHTML = `<div class="error">Error loading passage. Please try again.</div>`;
            }
        } finally {
            // Clear loading flag
            this.isLoading = false;
        }
    }

    /**
     * Navigate to previous or next chapter
     * @param {number} direction - -1 for previous, 1 for next
     */
    navigateChapter(direction) {
        navigateChapter(this, direction);
    }

    /**
     * Update navigation UI to reflect current book/chapter
     */
    updateNavigationUI() {
        if (!this.ui || !this.ui.currentBookSpan || !this.ui.currentChapterSpan) {
            return;
        }

        this.ui.currentBookSpan.textContent = this.state.currentBook;
        this.ui.currentChapterSpan.textContent = this.state.currentChapter;
    }

    // ================================
    // Settings Management
    // ================================

    /**
     * Set API key
     */
    setApiKey(key) {
        this.API_KEY = key;
        localStorage.setItem('esvApiKey', key);

        // Reload current passage with new API key
        if (this.state.currentBook && this.state.currentChapter) {
            this.loadPassage(this.state.currentBook, this.state.currentChapter);
        }
    }

    /**
     * Toggle a setting
     */
    toggleSetting(setting) {
        if (this.state[setting] !== undefined) {
            this.state[setting] = !this.state[setting];

            if (this.ui) {
                this.ui.applySettings();
            }

            if (this.firebase) {
                this.firebase.saveSettings();
            }

            // Reload passage if heading or footnote settings changed
            if (['showHeadings', 'showFootnotes', 'showCrossReferences'].includes(setting)) {
                this.loadPassage(this.state.currentBook, this.state.currentChapter, true);
            }
        }
    }

    /**
     * Toggle verse-by-verse mode
     */
    toggleVerseByVerse() {
        this.state.verseByVerse = !this.state.verseByVerse;

        if (this.ui) {
            this.ui.applySettings();
        }

        if (this.firebase) {
            this.firebase.saveSettings();
        }
    }

    /**
     * Update font size
     */
    updateFontSize(size) {
        const fontSize = parseInt(size, 10);
        if (fontSize >= 12 && fontSize <= 32) {
            this.state.fontSize = fontSize;

            if (this.ui) {
                this.ui.applySettings();
            }

            if (this.firebase) {
                this.firebase.saveSettings();
            }
        }
    }

    // ================================
    // User Authentication
    // ================================

    /**
     * Handle user button click
     */
    handleUserButtonClick() {
        if (this.firebase && this.firebase.currentUser) {
            // User is logged in, show user menu
            if (this.ui && this.ui.userMenuModal) {
                this.ui.openModal(this.ui.userMenuModal);
            }
        } else {
            // User is not logged in, show login modal
            if (this.ui && this.ui.loginModal) {
                this.ui.openModal(this.ui.loginModal);
            }
        }
    }

    // ================================
    // Keyboard Shortcuts
    // ================================

    handleKeyboardShortcuts(e) {
        // Don't handle shortcuts when typing in input fields
        const isInputField = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.isContentEditable;

        // Ctrl+K or Cmd+K for search (works everywhere)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (this.search) {
                this.search.toggleSearch();
            }
            return;
        }

        // Escape for closing modals (works everywhere)
        if (e.key === 'Escape') {
            if (this.search) {
                this.search.closeSearch();
            }
            if (this.ui) {
                this.ui.closeAllModals();
            }
            return;
        }

        // Search input capture - pass to search manager if open
        if (this.search && this.ui && this.ui.searchContainer) {
            if (this.ui.searchContainer.classList.contains('active')) {
                this.search.handleKeydown(e);
                return; // Don't process other shortcuts when search is open
            }
        }

        // Don't handle navigation shortcuts in input fields
        if (isInputField) {
            return;
        }

        // Check if any modal is open
        const modalOpen = document.querySelector('.modal.active');
        if (modalOpen) {
            return; // Don't handle navigation when modal is open
        }

        // Arrow keys and vim keys for chapter navigation
        if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            this.navigateChapter(-1);
            return;
        }

        if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            this.navigateChapter(1);
            return;
        }

        // Arrow Up/j for previous chapter
        if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            this.navigateChapter(-1);
            return;
        }

        // Arrow Down/j for next chapter
        if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            this.navigateChapter(1);
            return;
        }

        // Page Up/Down for scrolling
        if (e.key === 'PageUp') {
            // Let browser handle default scroll
            return;
        }

        if (e.key === 'PageDown') {
            // Let browser handle default scroll
            return;
        }
    }

    // ================================
    // Cleanup
    // ================================

    destroy() {
        // Clean up event listeners
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Clean up managers
        if (this.search) {
            this.search.destroy();
        }
        if (this.references) {
            this.references.destroy();
        }
        if (this.ui) {
            this.ui.destroy();
        }
        if (this.firebase) {
            this.firebase.destroy();
        }
    }
}

// ================================
// Initialize App on Page Load
// ================================
let app;

document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new BibleApp();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ff5555;">
                <h1>Application Error</h1>
                <p>Failed to initialize the app. Please refresh the page.</p>
                <p style="font-size: 0.85rem; color: #888;">${error.message}</p>
            </div>
        `;
    }
});

// Handle app destruction on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});

// Export for module usage
export { BibleApp };
export default BibleApp;
