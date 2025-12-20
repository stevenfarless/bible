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
    this.API_KEY = '';

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
    this.isLoading = false; // NEW: Prevent race conditions

    this.init();
  }

  async init() {
    try {
      this.ui.init();
      await this.firebase.init();
      this.attachGlobalListeners();

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
    window.addEventListener(
      'scroll',
      () => {
        if (this.ui && this.ui.handleChromeScroll) {
          this.ui.handleChromeScroll();
        }

        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(
          () => {
            if (this.firebase && this.firebase.saveReadingPosition) {
              this.firebase.saveReadingPosition().catch((err) =>
                console.error('Error saving position:', err)
              );
            }
          },
          APP_CONFIG.SCROLL_SAVE_DEBOUNCE_MS
        );
      },
      { passive: true }
    );

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) =>
      this.handleKeyboardShortcuts(e)
    );
  }

  // ==============================
  // Core Logic
  // ==============================

  /**
   * Load a passage from the ESV API
   * @param {string} book - Book name (e.g., "John")
   * @param {number} chapter - Chapter number
   * @param {boolean} restoreScroll - Whether to restore scroll position
   */
  async loadPassage(book, chapter, restoreScroll = false) {
    // FIXED: Prevent race conditions
    if (this.isLoading) {
      console.warn('Already loading a passage, please wait');
      return;
    }

    // Validate parameters
    const allBooks = getAllBooks();
    if (!book || !allBooks.includes(book)) {
      console.error(`Invalid book: "${book}"`);
      // FIXED: Add null check
      if (this.ui && this.ui.showToast) {
        this.ui.showToast(`Invalid book: ${book}`);
      }
      return;
    }

    if (!Number.isInteger(chapter) || chapter < 1) {
      console.error(`Invalid chapter: ${chapter}`);
      // FIXED: Add null check
      if (this.ui && this.ui.showToast) {
        this.ui.showToast('Invalid chapter');
      }
      return;
    }

    const maxChapter = getChapterCount(book);
    if (chapter > maxChapter) {
      console.error(`Chapter ${chapter} does not exist in ${book}`);
      // FIXED: Add null check
      if (this.ui && this.ui.showToast) {
        this.ui.showToast(
          `${book} only has ${maxChapter} chapter${maxChapter === 1 ? '' : 's'}`
        );
      }
      return;
    }

    try {
      // FIXED: Set loading flag
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
      // FIXED: Add null check
      if (this.ui && this.ui.showToast) {
        this.ui.showToast(
          `Error loading passage: ${error.message || 'Unknown error'}`
        );
      }
      if (this.ui && this.ui.passageText) {
        this.ui.passageText.innerHTML = `<div class="error">Error loading passage. Please try again.</div>`;
      }
    } finally {
      // FIXED: Clear loading flag
      this.isLoading = false;
    }
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

  // ==============================
  // Keyboard Shortcuts
  // ==============================

  handleKeyboardShortcuts(e) {
    // Ctrl+K or Cmd+K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (this.search) {
        this.search.toggleSearch();
      }
      return;
    }

    // Escape for closing modals
    if (e.key === 'Escape') {
      if (this.search) {
        this.search.closeSearch();
      }
      if (this.ui) {
        this.ui.closeAllModals();
      }
      return;
    }

    // Arrow up/down for navigation
    if (e.key === 'ArrowUp' && e.shiftKey) {
      e.preventDefault();
      navigateChapter(this, -1);
      return;
    }

    if (e.key === 'ArrowDown' && e.shiftKey) {
      e.preventDefault();
      navigateChapter(this, 1);
      return;
    }

    // Search input capture - pass to search manager if open
    if (
      this.search &&
      this.ui &&
      this.ui.searchContainer &&
      this.ui.searchContainer.classList.contains('active')
    ) {
      this.search.handleKeydown(e);
    }
  }

  // ==============================
  // Cleanup
  // ==============================

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
