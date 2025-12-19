// js/modules/reading-state.js

import { getAllBooks, getChapterCount } from './bible-structure.js';

export function initializeState() {
  return {
    currentBook: 'John',
    currentChapter: 3,
    selectedVerse: null,
    fontSize: 18,
    showVerseNumbers: true,
    showHeadings: true,
    showFootnotes: false,
    showCrossReferences: false,
    showRedLetters: false,
    verseByVerse: false,
    colorTheme: 'dracula',
    lightMode: false,
  };
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

export function navigateChapter(app, direction) {
  const books = getAllBooks();
  const currentBookIndex = books.indexOf(app.state.currentBook);
  const currentChapter = app.state.currentChapter;
  const maxChapter = getChapterCount(app.state.currentBook);

  if (direction === 1) {
    // Next chapter
    if (currentChapter < maxChapter) {
      // Stay in same book, go to next chapter
      app.state.selectedVerse = null;
      app.loadPassage(app.state.currentBook, currentChapter + 1);
    } else if (currentBookIndex < books.length - 1) {
      // Move to next book, chapter 1
      const nextBook = books[currentBookIndex + 1];
      app.state.selectedVerse = null;
      app.loadPassage(nextBook, 1);
    }
    // If at last chapter of last book, do nothing
  } else if (direction === -1) {
    // Previous chapter
    if (currentChapter > 1) {
      // Stay in same book, go to previous chapter
      app.state.selectedVerse = null;
      app.loadPassage(app.state.currentBook, currentChapter - 1);
    } else if (currentBookIndex > 0) {
      // Move to previous book, last chapter
      const prevBook = books[currentBookIndex - 1];
      const prevBookMaxChapter = getChapterCount(prevBook);
      app.state.selectedVerse = null;
      app.loadPassage(prevBook, prevBookMaxChapter);
    }
    // If at first chapter of first book, do nothing
  }
}

export function scrollToVerse(app, verseNumber) {
  if (!app.ui.passageText) return;

  // Find all verse number elements
  const verseElements = app.ui.passageText.querySelectorAll('.verse-num');
  
  // Find the verse number that matches
  for (let i = 0; i < verseElements.length; i++) {
    const verseEl = verseElements[i];
    const verseText = verseEl.textContent.trim();
    
    if (parseInt(verseText) === verseNumber) {
      // Get the parent paragraph/div
      const parent = verseEl.closest('p, div');
      if (parent) {
        // Scroll to it with offset for header
        const headerHeight = 120; // Adjust if needed
        const elementPosition = parent.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });

        // Highlight the verse temporarily
        parent.style.transition = 'background-color 0.3s ease';
        parent.style.backgroundColor = 'var(--primary-color)';
        parent.style.opacity = '0.2';
        
        setTimeout(() => {
          parent.style.backgroundColor = '';
          parent.style.opacity = '';
        }, 2000);

        break;
      }
    }
  }

  app.state.selectedVerse = verseNumber;
}
