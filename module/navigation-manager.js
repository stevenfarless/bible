// ==================== 
// Navigation Management
// ==================== 

import { getAllBooks, getChapterCount } from './constants.js';

export class NavigationManager {
  constructor(state, bookAbbreviations) {
    this.state = state;
    this.bookAbbreviations = bookAbbreviations;
  }

  navigateChapter(direction, app) {
    const books = getAllBooks();
    const currentBookIndex = books.indexOf(this.state.currentBook);
    const maxChapter = getChapterCount(this.state.currentBook);

    let newChapter = this.state.currentChapter + direction;
    let newBook = this.state.currentBook;

    if (newChapter < 1) {
      // Go to previous book's last chapter
      if (currentBookIndex > 0) {
        newBook = books[currentBookIndex - 1];
        newChapter = getChapterCount(newBook);
      } else {
        return; // Already at first chapter of first book
      }
    } else if (newChapter > maxChapter) {
      // Go to next book's first chapter
      if (currentBookIndex < books.length - 1) {
        newBook = books[currentBookIndex + 1];
        newChapter = 1;
      } else {
        return; // Already at last chapter of last book
      }
    }

    app.loadPassage(newBook, newChapter);
  }

  updateNavigationState(app) {
    const book = this.state.currentBook;
    const abbr = this.bookAbbreviations[book] || book;
    
    app.currentBookSpan.textContent = abbr;
    app.currentChapterSpan.textContent = this.state.currentChapter;

    // Update button states
    const books = getAllBooks();
    const currentBookIndex = books.indexOf(book);
    const isFirstChapter = this.state.currentChapter === 1;
    const isLastChapter = this.state.currentChapter === getChapterCount(book);

    app.prevChapterBtn.disabled = currentBookIndex === 0 && isFirstChapter;
    app.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLastChapter;
  }

  openBookModal(app) {
    const bookList = app.bookModal.querySelector('.book-list');
    if (!bookList) return;

    bookList.innerHTML = '';
    const books = getAllBooks();

    books.forEach(book => {
      const bookItem = document.createElement('div');
      bookItem.className = 'book-item';
      if (book === this.state.currentBook) {
        bookItem.classList.add('active');
      }
      bookItem.textContent = book;
      bookItem.addEventListener('click', () => {
        app.loadPassage(book, 1);
        app.closeModal(app.bookModal);
      });
      bookList.appendChild(bookItem);
    });

    app.openModal(app.bookModal);
  }

  openChapterModal(app) {
    const chapterList = app.chapterModal.querySelector('.chapter-list');
    if (!chapterList) return;

    chapterList.innerHTML = '';
    const chapterCount = getChapterCount(this.state.currentBook);

    for (let i = 1; i <= chapterCount; i++) {
      const chapterItem = document.createElement('div');
      chapterItem.className = 'chapter-item';
      if (i === this.state.currentChapter) {
        chapterItem.classList.add('active');
      }
      chapterItem.textContent = i;
      chapterItem.addEventListener('click', () => {
        app.loadPassage(this.state.currentBook, i);
        app.closeModal(app.chapterModal);
      });
      chapterList.appendChild(chapterItem);
    }

    app.openModal(app.chapterModal);
  }

  openVerseModal(app) {
    // This would require verse count data
    // For now, just open the modal
    app.openModal(app.verseModal);
  }
}
