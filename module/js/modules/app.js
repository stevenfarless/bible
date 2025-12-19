// js/modules/app.js

import { BibleApi } from './bible-api.js';
import { initializeState, navigateChapter } from './reading-state.js';
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

    // Managers
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
    this.ui.init();
    this.firebase.init(); // auth + settings + initial passage
    this.attachGlobalListeners();

    // Mark DOM as ready so CSS shows content
    document.body.classList.add('js-ready');
  }

  attachGlobalListeners() {
    window.addEventListener(
      'scroll',
      () => {
        this.ui.handleChromeScroll();
        clearTimeout(this.ui.scrollTimeout);
        this.ui.scrollTimeout = setTimeout(
          () => this.firebase.saveReadingPosition(),
          500
        );
      },
      { passive: true }
    );

    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  // ===============================
  // Core Logic
  // ===============================
  async loadPassage(book, chapter, restoreScroll = false) {
    if (!restoreScroll) {
      this.firebase.saveReadingPosition();
    }

    this.state.currentBook = book;
    this.state.currentChapter = chapter;
    this.updateNavigationUI();

    const reference = `${book} ${chapter}`;
    this.ui.passageText.innerHTML = `<div class="loading">Loading passage...</div>`;

    const data = await this.bibleApi.fetchPassage(reference);
    if (!data) {
      this.ui.chromeSuspend = false;
      document.body.classList.remove('chrome-no-transition');
      return;
    }

    this.ui.passageTitle.textContent = reference;
    this.ui.passageText.innerHTML = data.passages[0];

    this.originalPassageHtml = this.ui.passageText.innerHTML;

    // Post-load setup
    // In app.js, around line 85-95
this.references.attachHandlers();
this.references.makeFootnotesClickable();
this.ui.applyRedLetters();

// Add defensive check
if (this.ui.copyright) {
  this.ui.copyright.textContent =
    'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
    'copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. ' +
    'Used by permission. All rights reserved.';
} else {
  console.warn('⚠️ Copyright element not found');
}

if (this.ui.currentVerseSpan) {
  this.ui.currentVerseSpan.textContent = '1';
}

    // Scroll handling + chrome
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

  if (this.ui.currentBookSpan) {
    this.ui.currentBookSpan.textContent = abbr;
  }
  if (this.ui.currentChapterSpan) {
    this.ui.currentChapterSpan.textContent = this.state.currentChapter;
  }

  const books = getAllBooks();
  const currentBookIndex = books.indexOf(book);
  const isFirst = this.state.currentChapter === 1;
  const isLast = this.state.currentChapter === getChapterCount(book);

  // Previous button: disable only if at Genesis 1
  if (this.ui.prevChapterBtn) {
    this.ui.prevChapterBtn.disabled = currentBookIndex === 0 && isFirst;
  }

  // Next button: disable only if at Revelation last chapter
  if (this.ui.nextChapterBtn) {
    this.ui.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLast;
  }
}


  navigateChapter(direction) {
    navigateChapter(this, direction);
  }

navigateToNextVerse() {
  const currentVerse = this.state.selectedVerse || 1;
  const maxVerse = this.getCurrentVerseCount();

  if (currentVerse < maxVerse) {
    // Go to next verse in current chapter
    this.ui.scrollToVerse(currentVerse + 1);
  } else {
    // At last verse, go to next chapter
    this.navigateChapter(1);
  }
}

navigateToPreviousVerse() {
  const currentVerse = this.state.selectedVerse || 1;

  if (currentVerse > 1) {
    // Go to previous verse in current chapter
    this.ui.scrollToVerse(currentVerse - 1);
  } else {
    // At first verse, go to previous chapter and its last verse
    const books = getAllBooks();
    const currentBookIndex = books.indexOf(this.state.currentBook);
    const isFirstChapter = this.state.currentChapter === 1;

    if (currentBookIndex === 0 && isFirstChapter) {
      // Already at Genesis 1:1, can't go back further
      return;
    }

    // Navigate to previous chapter
    this.navigateChapter(-1);
  }
}

getCurrentVerseCount() {
  // Count verse numbers in current passage
  const verseNums = this.ui.passageText.querySelectorAll('.verse-num');
  // Add 1 because verse 1 typically doesn't have a .verse-num element
  return verseNums.length > 0 ? verseNums.length + 1 : 0;
}


  // ===============================
  // Settings Logic
  // ===============================
  async toggleSetting(setting) {
    const toggleMap = {
      showVerseNumbers: 'verseNumbersToggle',
      showHeadings: 'headingsToggle',
      showFootnotes: 'footnotesToggle',
      showCrossReferences: 'crossReferencesToggle',
    };

    const el = this.ui[toggleMap[setting]];
    if (!el) return;

    this.state[setting] = el.checked;
    this.firebase.saveSetting(setting, el.checked);

    if (setting === 'showVerseNumbers') {
      this.ui.applySettings();
    } else {
      this.lastScrollPosition =
        window.pageYOffset || document.documentElement.scrollTop || 0;
      await this.loadPassage(
        this.state.currentBook,
        this.state.currentChapter,
        true
      );
    }
  }

  async toggleVerseByVerse() {
    this.state.verseByVerse = this.ui.verseByVerseToggle.checked;
    this.firebase.saveSetting('verseByVerse', this.state.verseByVerse);

    if (this.state.verseByVerse) {
      this.ui.passageText.classList.add('verse-by-verse');
    } else {
      this.ui.passageText.classList.remove('verse-by-verse');
    }
  }

  async updateFontSize(size) {
    const n = parseInt(size, 10);
    this.state.fontSize = n;
    this.ui.fontSizeValue.textContent = `${n}px`;
    this.ui.passageText.style.fontSize = `${n}px`;
    this.firebase.saveSetting('fontSize', n);
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
      document.getElementById('userEmail').textContent =
        this.firebase.currentUser.email;
      this.ui.openModal(this.ui.userMenuModal);
    } else {
      this.ui.openModal(this.ui.loginModal);
    }
  }

  handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + K to open search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    this.search.toggleSearch();
    return;
  }

  // Escape to close modals
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      this.ui.closeModal(activeModal);
    }
    if (this.ui.searchContainer.classList.contains('active')) {
      this.search.closeSearch();
    }
    return;
  }

  // Navigation shortcuts - only when no modal is open and search is closed
  if (!document.querySelector('.modal.active') && !this.ui.searchContainer.classList.contains('active')) {
    // Chapter navigation: Arrow Left/Right or H/L
    if (e.key === 'ArrowLeft' || e.key === 'h') {
      e.preventDefault();
      this.navigateChapter(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      this.navigateChapter(1);
    }
    // Verse navigation: Arrow Up/Down or K/J
    else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      this.navigateToPreviousVerse();
    } else if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      this.navigateToNextVerse();
    }
  }
}
}

document.addEventListener('DOMContentLoaded', () => {
  window.bibleApp = new BibleApp();
});
