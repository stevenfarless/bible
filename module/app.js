// ==================== 
// ESV Bible Reader App
// ==================== 

import { BibleApi } from './bible-api.js';
import { initializeState } from './reading-state.js';
import { loadUserData as loadUserDataFromFirebase } from './firebase-config.js';
import { cacheElements, loadTheme } from './ui.js';
import { API_CONFIG, BIBLE_BOOKS, BOOK_ABBREVIATIONS } from './constants.js';
import { ChromeController } from './chrome-controller.js';
import { ModalManager } from './modal-manager.js';
import { SearchManager } from './search-manager.js';
import { SettingsManager } from './settings-manager.js';
import { NavigationManager } from './navigation-manager.js';
import { PassageRenderer } from './passage-renderer.js';
import { AuthManager } from './auth-manager.js';
import { attachEventListeners } from './event-handlers.js';

class BibleApp {
  constructor() {
    // Configuration
    this.API_BASE_URL = API_CONFIG.BASE_URL;
    this.API_KEY = API_CONFIG.DEFAULT_API_KEY;

    // Firebase
    this.auth = window.firebaseAuth;
    this.database = window.firebaseDatabase;
    this.currentUser = null;

    // Bible data
    this.bibleBooks = BIBLE_BOOKS;
    this.bookAbbreviations = BOOK_ABBREVIATIONS;

    // State
    this.state = initializeState();
    this.scrollTimeout = null;
    this.lastScrollPosition = 0;

    // Managers
    this.chromeController = new ChromeController();
    this.modalManager = new ModalManager();
    this.bibleApi = new BibleApi(
      this.API_BASE_URL,
      () => this.API_KEY,
      () => this.state
    );
    this.passageRenderer = new PassageRenderer(this.bibleApi, this.state);
    this.searchManager = new SearchManager(this.bibleApi, this.passageRenderer);
    this.settingsManager = new SettingsManager(this.state, this.database);
    this.navigationManager = new NavigationManager(this.state, this.bookAbbreviations);
    this.authManager = new AuthManager(this.auth, this.database);

    // Initialize
    this.init();
  }

  init() {
    cacheElements(this);
    loadTheme(this);
    attachEventListeners(this);
    this.initializeAccordion();
    this.setupModals();
    this.listenToAuthState();
  }

  setupModals() {
    const modals = [
      'bookModal', 'chapterModal', 'verseModal',
      'settingsModal', 'helpModal', 'loginModal',
      'signupModal', 'userMenuModal', 'referencesModal'
    ];

    modals.forEach(name => {
      const modal = this[name];
      if (modal) {
        this.modalManager.registerModal(name, modal);
        this.modalManager.setupClickOutsideClose(modal);
        
        if (name === 'settingsModal' || name === 'referencesModal') {
          this.modalManager.setupDragResize(modal);
        }
      }
    });
  }

  listenToAuthState() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        const userData = await this.authManager.loadUserData(user);
        if (userData && userData.settings) {
          Object.assign(this.state, userData.settings);
        }
        this.settingsManager.applySettings();
        await this.loadSavedReadingPosition();
        this.authManager.updateUserButton(user, this.userBtn, this.userEmail);
      } else {
        this.currentUser = null;
        this.settingsManager.loadLocalSettings();
        this.settingsManager.applySettings();
        await this.passageRenderer.loadPassage(
          this.state.currentBook,
          this.state.currentChapter,
          this
        );
        this.authManager.updateUserButton(null, this.userBtn, this.userEmail);
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

  openModal(modal) {
    this.modalManager.open(modal);
  }

  closeModal(modal) {
    this.modalManager.close(modal);
  }

  navigateChapter(direction) {
    this.navigationManager.navigateChapter(direction, this);
  }

  async loadPassage(book, chapter, restoreScroll = false) {
    await this.passageRenderer.loadPassage(book, chapter, this, restoreScroll);
  }

  toggleSearch() {
    this.searchContainer.classList.toggle('active');
    if (this.searchContainer.classList.contains('active')) {
      this.searchInput.focus();
    } else {
      this.searchInput.value = '';
      this.searchResults.innerHTML = '';
      this.searchManager.reset();
    }
  }

  handleSearch(query) {
    this.searchManager.handleSearch(
      query,
      this.searchResults,
      (ref) => this.loadPassageFromReference(ref)
    );
  }

  async loadPassageFromReference(reference) {
    const parts = reference.match(/^(.+?)\s+(\d+)/);
    if (parts) {
      const book = parts[1];
      const chapter = parseInt(parts[2]);
      await this.loadPassage(book, chapter);
      this.toggleSearch();
    }
  }

  handleUserButtonClick() {
    if (this.currentUser) {
      this.openModal(this.userMenuModal);
    } else {
      this.openModal(this.loginModal);
    }
  }

  saveApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
      this.API_KEY = apiKeyInput.value.trim();
      localStorage.setItem('esvApiKey', this.API_KEY);
      alert('API key saved successfully!');
    }
  }

  checkApiKey() {
    const savedKey = localStorage.getItem('esvApiKey');
    if (savedKey) {
      this.API_KEY = savedKey;
      const apiKeyInput = document.getElementById('apiKeyInput');
      if (apiKeyInput) {
        apiKeyInput.value = savedKey;
      }
    } else if (!this.API_KEY) {
      this.openModal(this.settingsModal);
    }
  }

  async loadSavedReadingPosition() {
    if (!this.currentUser) return;

    const position = await this.authManager.loadReadingPosition(this.currentUser.uid);
    if (position) {
      this.lastScrollPosition = position.scrollPosition || 0;
      await this.loadPassage(position.book, position.chapter, true);
    } else {
      await this.loadPassage(this.state.currentBook, this.state.currentChapter);
    }
  }

  saveReadingPosition() {
    this.lastScrollPosition = window.scrollY || window.pageYOffset || 0;
    
    if (this.currentUser) {
      this.authManager.saveReadingPosition(
        this.currentUser.uid,
        this.state.currentBook,
        this.state.currentChapter,
        this.lastScrollPosition
      );
    }
    
    this.settingsManager.saveLocalSettings();
  }

  handleKeyboardShortcuts(e) {
    // Don't trigger shortcuts if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch(e.key) {
      case 'ArrowLeft':
        if (!e.shiftKey) this.navigateChapter(-1);
        break;
      case 'ArrowRight':
        if (!e.shiftKey) this.navigateChapter(1);
        break;
      case '/':
        e.preventDefault();
        this.toggleSearch();
        break;
      case 'Escape':
        if (this.searchContainer.classList.contains('active')) {
          this.toggleSearch();
        }
        break;
    }
  }

  attachFootnoteHandlers() {
    // Placeholder - implement based on your footnote UI
  }

  makeFootnotesClickable() {
    // Placeholder - implement based on your footnote UI
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new BibleApp();
  });
} else {
  window.app = new BibleApp();
}

export { BibleApp };
