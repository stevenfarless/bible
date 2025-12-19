// js/modules/ui-manager.js

import { cacheElements, loadTheme, toggleTheme, changeColorTheme, updateThemeIcon } from './ui-utils.js';
import { BOOK_ABBREVIATIONS, BIBLE_STRUCTURE, getChapterCount } from './bible-structure.js';
import { scrollToVerse } from './reading-state.js';
import { getRedLetterVerses } from './words-of-jesus.js';

export class UIManager {
  constructor(app) {
    this.app = app;

    this.chromeHidden = false;
    this.chromeScrollLastY = 0;
    this.chromeDelta = 2;
    this.chromeScrollTicking = false;
    this.chromeSuspend = false;
    this.scrollTimeout = null;
  }

  init() {
    cacheElements(this);
    
    // Verify critical elements loaded
    const required = [
      'searchToggleBtn', 'helpBtn', 'settingsBtn', 'userBtn',
      'prevChapterBtn', 'nextChapterBtn', 'bookSelector', 'chapterSelector',
      'passageText', 'passageTitle', 'toast', 'copyright'
    ];
    
    const missing = required.filter(key => !this[key]);
    if (missing.length > 0) {
      console.error('❌ Missing required elements:', missing);
      console.error('Check that these IDs exist in index.html');
    }
    
    loadTheme(this.app);
    this.attachEventListeners();
    this.initializeAccordion();
  }

  attachEventListeners() {
    // Header
    if (this.searchToggleBtn) {
      this.searchToggleBtn.addEventListener('click', () => this.app.search.toggleSearch());
    }
    if (this.helpBtn) {
      this.helpBtn.addEventListener('click', () => this.openModal(this.helpModal));
    }
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));
    }
    if (this.userBtn) {
      this.userBtn.addEventListener('click', () => this.app.handleUserButtonClick());
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => this.copyPassage());
    }

    // Navigation
    if (this.prevChapterBtn) {
      this.prevChapterBtn.addEventListener('click', () => {
        console.log('← Previous chapter clicked');
        this.app.navigateChapter(-1);
      });
    }
    if (this.nextChapterBtn) {
      this.nextChapterBtn.addEventListener('click', () => {
        console.log('→ Next chapter clicked');
        this.app.navigateChapter(1);
      });
    }
    if (this.bookSelector) {
      this.bookSelector.addEventListener('click', () => this.openBookModal());
    }
    if (this.chapterSelector) {
      this.chapterSelector.addEventListener('click', () => this.openChapterModal());
    }
    if (this.verseSelector) {
      this.verseSelector.addEventListener('click', () => this.openVerseModal());
    }

    // Search
    if (this.closeSearchBtn) {
      this.closeSearchBtn.addEventListener('click', () => this.app.search.closeSearch());
    }
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.app.search.handleInput(e.target.value));
      this.searchInput.addEventListener('keydown', (e) => this.app.search.handleKeydown(e));
    }

    // Settings - API Key Form
    const apiKeyForm = document.getElementById('apiKeyForm');
    if (apiKeyForm && this.app.firebase) {
      apiKeyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.firebase.saveApiKey(this.apiKeyInput.value.trim()).then((success) => {
          if (success) {
            this.showToast('API key saved!');
            this.closeModal(this.settingsModal);
            this.app.loadPassage(this.app.state.currentBook, this.app.state.currentChapter);
          } else {
            this.showToast('Failed to save API key');
          }
        });
      });
    }

    // Settings toggles
    if (this.verseNumbersToggle) {
      this.verseNumbersToggle.addEventListener('change', () => this.app.toggleSetting('showVerseNumbers'));
    }
    if (this.headingsToggle) {
      this.headingsToggle.addEventListener('change', () => this.app.toggleSetting('showHeadings'));
    }
    if (this.footnotesToggle) {
      this.footnotesToggle.addEventListener('change', () => this.app.toggleSetting('showFootnotes'));
    }
    if (this.crossReferencesToggle) {
      this.crossReferencesToggle.addEventListener('change', () =>
        this.app.toggleSetting('showCrossReferences')
      );
    }
    if (this.verseByVerseToggle) {
      this.verseByVerseToggle.addEventListener('change', () => this.app.toggleVerseByVerse());
    }
    if (this.fontSizeSlider) {
      this.fontSizeSlider.addEventListener('input', (e) => this.app.updateFontSize(e.target.value));
    }

    const redToggle = document.getElementById('redLettersToggle');
    if (redToggle) {
      redToggle.checked = this.app.state.showRedLetters;
      redToggle.addEventListener('change', () => this.app.toggleRedLetters());
    }

    // Theme
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => toggleTheme(this.app));
    }
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.addEventListener('change', (e) => changeColorTheme(this.app, e.target.value));
    }
    const lightModeToggle = document.getElementById('lightModeToggle');
    if (lightModeToggle) {
      lightModeToggle.addEventListener('change', () => toggleTheme(this.app));
    }

    // Auth
    const loginForm = document.getElementById('loginForm');
    if (loginForm && this.app.firebase) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.firebase
          .handleLogin(
            document.getElementById('loginEmail').value,
            document.getElementById('loginPassword').value
          )
          .then((success) => {
            if (success === true) this.closeModal(this.loginModal);
          });
      });
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm && this.app.firebase) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.firebase
          .handleSignup(
            document.getElementById('signupEmail').value,
            document.getElementById('signupPassword').value
          )
          .then((success) => {
            if (success === true) this.closeModal(this.signupModal);
          });
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && this.app.firebase) {
      logoutBtn.addEventListener('click', () =>
        this.app.firebase.handleLogout().then(() => this.closeModal(this.userMenuModal))
      );
    }

    // Click outside to close
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

    // Modal close buttons
    if (this.closeBookModal) {
      this.closeBookModal.addEventListener('click', () => this.closeModal(this.bookModal));
    }
    if (this.closeChapterModal) {
      this.closeChapterModal.addEventListener('click', () => this.closeModal(this.chapterModal));
    }
    if (this.closeVerseModal) {
      this.closeVerseModal.addEventListener('click', () => this.closeModal(this.verseModal));
    }
    if (this.closeHelpModal) {
      this.closeHelpModal.addEventListener('click', () => this.closeModal(this.helpModal));
    }
    if (this.closeSettingsModal) {
      this.closeSettingsModal.addEventListener('click', () => this.closeModal(this.settingsModal));
    }
    if (this.closeLoginModal) {
      this.closeLoginModal.addEventListener('click', () => this.closeModal(this.loginModal));
    }
    if (this.closeSignupModal) {
      this.closeSignupModal.addEventListener('click', () => this.closeModal(this.signupModal));
    }
    if (this.closeUserMenuModal) {
      this.closeUserMenuModal.addEventListener('click', () => this.closeModal(this.userMenuModal));
    }
    if (this.closeReferencesModal) {
      this.closeReferencesModal.addEventListener('click', () =>
        this.closeModal(this.referencesModal)
      );
    }

    // Auth switching
    const showSignupLink = document.getElementById('showSignupLink');
    if (showSignupLink) {
      showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal(this.loginModal);
        this.openModal(this.signupModal);
      });
    }
    const showLoginLink = document.getElementById('showLoginLink');
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal(this.signupModal);
        this.openModal(this.loginModal);
      });
    }
  }

  initializeAccordion() {
    document.querySelectorAll('.accordion-header').forEach((header) => {
      header.addEventListener('click', () => {
        header.closest('.accordion-section')?.classList.toggle('active');
      });
    });

    const openAccountBtn = document.getElementById('openAccountBtn');
    if (openAccountBtn) {
      openAccountBtn.addEventListener('click', () => {
        this.closeModal(this.settingsModal);
        if (this.app.firebase.currentUser) {
          this.openModal(this.userMenuModal);
        } else {
          this.openModal(this.loginModal);
        }
      });
    }
  }

  // Modals
  openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal(modal) {
    if (!modal) return;
    if (modal === this.settingsModal || modal === this.referencesModal) {
      const content = modal.querySelector('.modal-content');
      if (content) {
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

    if (this.oldTestamentBooks) {
      this.oldTestamentBooks.innerHTML = '';
      Object.keys(BIBLE_STRUCTURE['Old Testament']).forEach((b) =>
        this.oldTestamentBooks.appendChild(createBtn(b))
      );
    }

    if (this.newTestamentBooks) {
      this.newTestamentBooks.innerHTML = '';
      Object.keys(BIBLE_STRUCTURE['New Testament']).forEach((b) =>
        this.newTestamentBooks.appendChild(createBtn(b))
      );
    }
  }

  openChapterModal() {
    this.populateChapterModal();
    this.openModal(this.chapterModal);
  }

  populateChapterModal() {
    if (this.chapterModalBook) {
      this.chapterModalBook.textContent = this.app.state.currentBook;
    }
    if (this.chapterGrid) {
      this.chapterGrid.innerHTML = '';
      const count = getChapterCount(this.app.state.currentBook);

      for (let i = 1; i <= count; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.textContent = String(i);
        btn.addEventListener('click', () => {
          this.app.state.selectedVerse = null;
          this.app.loadPassage(this.app.state.currentBook, i);
          this.closeModal(this.chapterModal);
        });
        this.chapterGrid.appendChild(btn);
      }
    }
  }

  openVerseModal() {
    this.populateVerseModal();
    this.openModal(this.verseModal);
  }

  populateVerseModal() {
    if (this.verseModalBook) {
      this.verseModalBook.textContent = `${this.app.state.currentBook} ${this.app.state.currentChapter}`;
    }
    if (this.verseGrid) {
      this.verseGrid.innerHTML = '';
      const count = this.getCurrentVerseCount();

      if (count === 0) {
        this.verseGrid.innerHTML = '<p class="empty-state">No verses found in current passage</p>';
        return;
      }

      for (let i = 1; i <= count; i++) {
        const btn = document.createElement('button');
        btn.className = 'chapter-item';
        btn.textContent = String(i);
        btn.addEventListener('click', () => {
          this.scrollToVerse(i);
          this.closeModal(this.verseModal);
        });
        this.verseGrid.appendChild(btn);
      }
    }
  }

  getCurrentVerseCount() {
    if (!this.passageText) return 0;
    const nums = this.passageText.querySelectorAll('.verse-num');
    return nums.length > 0 ? nums.length + 1 : 0;
  }

  scrollToVerse(num) {
    scrollToVerse(this.app, num);
  }

  // Copy passage
  copyPassage() {
    if (!this.passageText || !this.passageTitle) return;
    const textContent = this.stripHTML(this.passageText.innerHTML);
    const reference = this.passageTitle.textContent;
    const copyrightText = this.copyright ? this.copyright.textContent : '';
    const fullText = `${reference}\n\n${textContent}\n\n${copyrightText}`;

    navigator.clipboard
      .writeText(fullText)
      .then(() => this.showToast('Passage copied to clipboard!'))
      .catch((err) => {
        console.error('Failed to copy', err);
        this.showToast('Failed to copy passage');
      });
  }

  // Red letters
  applyRedLetters() {
    if (!this.passageText) return;
    
    if (!this.app.state.showRedLetters) {
      this.passageText
        .querySelectorAll('.red-letter')
        .forEach((el) => el.classList.remove('red-letter'));
      return;
    }

    const redVerses = getRedLetterVerses(
      this.app.state.currentBook,
      this.app.state.currentChapter
    );
    if (!redVerses || redVerses.length === 0) return;

    this.passageText.querySelectorAll('p[id],div[id]').forEach((p) => {
      const match = p.id.match(/p(\d{10})/);
      if (!match) return;
      const verseNum = parseInt(match[1].substring(5, 8), 10);
      if (redVerses.includes(verseNum)) {
        this.colorizeVerse(p);
      }
    });
  }

  colorizeVerse(verseElement) {
    const verseNumEl = verseElement.querySelector('.verse-num');
    if (!verseNumEl) {
      verseElement.classList.add('red-letter');
      return;
    }

    const walker = document.createTreeWalker(
      verseElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!verseNumEl.contains(node) && node.nodeValue.trim()) {
        nodes.push(node);
      }
    }

    nodes.forEach((textNode) => {
      const span = document.createElement('span');
      span.className = 'red-letter';
      textNode.parentNode.insertBefore(span, textNode);
      span.appendChild(textNode);
    });
  }

  // Chrome show/hide
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

      if (y < 50 || modalOpen || searchOpen) {
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

  // Utils
  showToast(message) {
    if (!this.toast) return;
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
    // Theme
    const theme = this.app.state.colorTheme || 'dracula';
    changeColorTheme(this.app, theme);

    if (this.app.state.lightMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    updateThemeIcon(this.app.state.lightMode);

    // Font size
    if (this.passageText && this.fontSizeValue) {
      this.passageText.style.fontSize = `${this.app.state.fontSize}px`;
      this.fontSizeValue.textContent = `${this.app.state.fontSize}px`;
    }

    // Verse-by-verse
    if (this.passageText) {
      if (this.app.state.verseByVerse) {
        this.passageText.classList.add('verse-by-verse');
      } else {
        this.passageText.classList.remove('verse-by-verse');
      }
    }
  }
}
