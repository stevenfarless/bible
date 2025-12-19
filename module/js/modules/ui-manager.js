// js/modules/ui-manager.js

import { cacheElements, loadTheme, toggleTheme, updateThemeIcon, changeColorTheme } from './ui-utils.js';
import { scrollToVerse, applyVerseGlow } from './reading-state.js';
import { getAllBooks, getChapterCount, BIBLE_BOOKS } from './bible-structure.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    
    // Chrome auto-hide state
    this.chromeHidden = false;
    this.chromeScrollLastY = window.scrollY || 0;
    this.chromeDelta = 2;
    this.chromeScrollTicking = false;
    this.chromeSuspend = false;
    this.scrollTimeout = null;

    // Define chrome functions on instance
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

        if (delta > this.chromeDelta) {
          this.hideChrome();
        }
        if (delta < -this.chromeDelta) {
          this.showChrome();
        }

        this.chromeScrollLastY = y;
        this.chromeScrollTicking = false;
      });
    };
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
    this.initModalDragResize();
  }

  attachEventListeners() {
    // Header buttons
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
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => toggleTheme(this.app));
    }

    // Navigation
    if (this.prevChapterBtn) {
      this.prevChapterBtn.addEventListener('click', () => this.app.navigateChapter(-1));
    }
    if (this.nextChapterBtn) {
      this.nextChapterBtn.addEventListener('click', () => this.app.navigateChapter(1));
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

    // Close modal buttons
    const closeButtons = {
      closeBookModal: this.bookModal,
      closeChapterModal: this.chapterModal,
      closeVerseModal: this.verseModal,
      closeHelpModal: this.helpModal,
      closeSettingsModal: this.settingsModal,
      closeLoginModal: this.loginModal,
      closeSignupModal: this.signupModal,
      closeUserMenuModal: this.userMenuModal,
      closeReferencesModal: this.referencesModal,
    };

    for (const [btnKey, modal] of Object.entries(closeButtons)) {
      if (this[btnKey] && modal) {
        this[btnKey].addEventListener('click', () => this.closeModal(modal));
      }
    }

    // Click outside modal to close
    const allModals = [
      this.bookModal, this.chapterModal, this.verseModal,
      this.helpModal, this.settingsModal, this.loginModal,
      this.signupModal, this.userMenuModal, this.referencesModal
    ];

    allModals.forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeModal(modal);
          }
        });
      }
    });

    // Settings
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
      this.crossReferencesToggle.addEventListener('change', () => this.app.toggleSetting('showCrossReferences'));
    }
    if (this.verseByVerseToggle) {
      this.verseByVerseToggle.addEventListener('change', () => this.app.toggleVerseByVerse());
    }
    if (this.fontSizeSlider) {
      this.fontSizeSlider.addEventListener('input', (e) => this.app.updateFontSize(e.target.value));
    }

    // Theme selector
    const themeSelector = document.getElementById('themeSelector');
    const lightModeToggle = document.getElementById('lightModeToggle');
    
    if (themeSelector) {
      themeSelector.addEventListener('change', (e) => changeColorTheme(this.app, e.target.value));
    }
    if (lightModeToggle) {
      lightModeToggle.addEventListener('change', () => toggleTheme(this.app));
    }

    // Auth modal switching
    const showSignupLink = document.getElementById('showSignupLink');
    const showLoginLink = document.getElementById('showLoginLink');
    
    if (showSignupLink) {
      showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal(this.loginModal);
        this.openModal(this.signupModal);
      });
    }
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModal(this.signupModal);
        this.openModal(this.loginModal);
      });
    }

    // Auth form submissions
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.firebase.handleLogin();
      });
    }
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.app.firebase.handleSignup();
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.app.firebase.handleLogout());
    }
  }

  initializeAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.accordion-section');
        section.classList.toggle('active');
      });
    });

    // Handle Manage Account button
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

  initModalDragResize() {
    // Settings Modal drag-to-resize
    const settingsContent = this.settingsModal?.querySelector('.modal-content');
    const settingsHeader = this.settingsModal?.querySelector('.modal-header');
    const settingsBody = this.settingsModal?.querySelector('.modal-body');

    if (settingsContent && settingsHeader && settingsBody) {
      let isDragging = false;
      let startY = 0;
      let startHeight = 0;
      let startScrollTop = 0;

      // Touch events (mobile)
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

      settingsHeader.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Mouse events (desktop)
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
    }

    // References Modal drag-to-resize
    const referencesContent = this.referencesModal?.querySelector('.modal-content');
    const referencesHeader = this.referencesModal?.querySelector('.modal-header');
    const referencesBody = this.referencesModal?.querySelector('.modal-body');

    if (referencesContent && referencesHeader && referencesBody) {
      let isRefDragging = false;
      let refStartY = 0;
      let refStartHeight = 0;
      let refStartScrollTop = 0;

      // Touch events (mobile)
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

      referencesHeader.addEventListener('touchstart', handleRefTouchStart, { passive: false });
      document.addEventListener('touchmove', handleRefTouchMove, { passive: false });
      document.addEventListener('touchend', handleRefTouchEnd, { passive: true });

      // Mouse events (desktop)
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
  }

  // Modal Management
  openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal(modal) {
    if (!modal) return;

    // Add closing animation for settings and references
    if (modal === this.settingsModal || modal === this.referencesModal) {
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.style.animation = 'slideDownToBottom 250ms ease';
        setTimeout(() => {
          modal.classList.remove('active');
          document.body.style.overflow = '';
          content.style.animation = '';
        }, 250);
        return;
      }
    }

    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Book Modal
  openBookModal() {
    this.populateBookModal();
    this.openModal(this.bookModal);
  }

  populateBookModal() {
    const createBookButton = (book) => {
      const btn = document.createElement('button');
      btn.className = 'book-item';
      btn.textContent = this.app.bookAbbreviations[book] || book;
      btn.addEventListener('click', () => {
        this.app.state.selectedVerse = null;
        this.app.loadPassage(book, 1);
        this.closeModal(this.bookModal);
      });
      return btn;
    };

    if (this.oldTestamentBooks) {
      this.oldTestamentBooks.innerHTML = '';
      Object.keys(BIBLE_BOOKS['Old Testament']).forEach(book => {
        this.oldTestamentBooks.appendChild(createBookButton(book));
      });
    }

    if (this.newTestamentBooks) {
      this.newTestamentBooks.innerHTML = '';
      Object.keys(BIBLE_BOOKS['New Testament']).forEach(book => {
        this.newTestamentBooks.appendChild(createBookButton(book));
      });
    }
  }

  // Chapter Modal
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
      const chapterCount = getChapterCount(this.app.state.currentBook);

      for (let i = 1; i <= chapterCount; i++) {
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
  }

  // Verse Modal
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
      const verseCount = this.getCurrentVerseCount();

      if (verseCount === 0) {
        this.verseGrid.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary)">No verses found in current passage</p>';
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
  }

  getCurrentVerseCount() {
    const verseNums = this.passageText?.querySelectorAll('.verse-num');
    return verseNums && verseNums.length > 0 ? verseNums.length + 1 : 0;
  }

  // Verse Navigation
  scrollToVerse(verseNumber) {
    scrollToVerse(this.app, verseNumber);
  }

  // Settings UI
  applySettings() {
    // Apply verse numbers visibility
    if (this.app.state.showVerseNumbers) {
      this.passageText?.classList.remove('hide-verse-numbers');
    } else {
      this.passageText?.classList.add('hide-verse-numbers');
    }

    // Apply verse-by-verse mode
    if (this.app.state.verseByVerse) {
      this.passageText?.classList.add('verse-by-verse');
    } else {
      this.passageText?.classList.remove('verse-by-verse');
    }

    // Apply font size
    if (this.passageText) {
      this.passageText.style.fontSize = `${this.app.state.fontSize}px`;
    }
    if (this.fontSizeValue) {
      this.fontSizeValue.textContent = `${this.app.state.fontSize}px`;
    }
  }

  applyRedLetters() {
    if (!this.passageText) return;

    const { showRedLetters } = this.app.state;
    const wordsOfJesus = this.passageText.querySelectorAll('.woj');

    wordsOfJesus.forEach(element => {
      if (showRedLetters) {
        element.style.color = '#FF5555';
      } else {
        element.style.color = '';
      }
    });
  }

  // Toast Notifications
  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }
}
