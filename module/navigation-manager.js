// ====================
// Navigation Management
// ====================

import { BIBLE_BOOKS, getChapterCount } from "./constants.js";

export class NavigationManager {
  constructor(state, bookAbbreviations) {
    this.state = state;
    this.bookAbbreviations = bookAbbreviations;
  }

  navigateChapter(direction, app) {
    const books = [
      ...Object.keys(BIBLE_BOOKS["Old Testament"]),
      ...Object.keys(BIBLE_BOOKS["New Testament"]),
    ];

    const currentBookIndex = books.indexOf(this.state.currentBook);
    const maxChapter = getChapterCount(this.state.currentBook);

    let newChapter = this.state.currentChapter + direction;
    let newBook = this.state.currentBook;

    if (newChapter < 1) {
      if (currentBookIndex > 0) {
        newBook = books[currentBookIndex - 1];
        newChapter = getChapterCount(newBook);
      } else {
        return;
      }
    } else if (newChapter > maxChapter) {
      if (currentBookIndex < books.length - 1) {
        newBook = books[currentBookIndex + 1];
        newChapter = 1;
      } else {
        return;
      }
    }

    app.loadPassage(newBook, newChapter);
  }

  updateNavigationState(app) {
    const book = this.state.currentBook;
    const abbr = this.bookAbbreviations[book] || book;

    app.currentBookSpan.textContent = abbr;
    app.currentChapterSpan.textContent = this.state.currentChapter;

    const books = [
      ...Object.keys(BIBLE_BOOKS["Old Testament"]),
      ...Object.keys(BIBLE_BOOKS["New Testament"]),
    ];

    const currentBookIndex = books.indexOf(book);
    const isFirstChapter = this.state.currentChapter === 1;
    const isLastChapter = this.state.currentChapter === getChapterCount(book);

    app.prevChapterBtn.disabled = currentBookIndex === 0 && isFirstChapter;
    app.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLastChapter;
  }

  openBookModal(app) {
    const otContainer = document.getElementById("oldTestamentBooks");
    const ntContainer = document.getElementById("newTestamentBooks");
    if (!otContainer || !ntContainer) return;

    otContainer.innerHTML = "";
    ntContainer.innerHTML = "";

    const renderBookButton = (book, container) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "book-item";
      if (book === this.state.currentBook) btn.classList.add("active");

      btn.textContent = book;

      btn.addEventListener("click", async () => {
        await app.loadPassage(book, 1);
        app.closeModal(app.bookModal);
      });

      container.appendChild(btn);
    };

    for (const book of Object.keys(BIBLE_BOOKS["Old Testament"])) {
      renderBookButton(book, otContainer);
    }

    for (const book of Object.keys(BIBLE_BOOKS["New Testament"])) {
      renderBookButton(book, ntContainer);
    }

    app.openModal(app.bookModal);
  }

  openChapterModal(app) {
    const chapterGrid = document.getElementById("chapterGrid");
    const headerBook = document.getElementById("chapterModalBook");
    if (!chapterGrid) return;

    if (headerBook) headerBook.textContent = this.state.currentBook;

    chapterGrid.innerHTML = "";

    const chapterCount = getChapterCount(this.state.currentBook);

    for (let i = 1; i <= chapterCount; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chapter-item";
      if (i === this.state.currentChapter) btn.classList.add("active");

      btn.textContent = String(i);

      btn.addEventListener("click", async () => {
        await app.loadPassage(this.state.currentBook, i);
        app.closeModal(app.chapterModal);
      });

      chapterGrid.appendChild(btn);
    }

    app.openModal(app.chapterModal);
  }

  openVerseModal(app) {
    const verseGrid = document.getElementById("verseGrid");
    const header = document.getElementById("verseModalBook");
    if (!verseGrid) return;

    if (header) header.textContent = `${this.state.currentBook} ${this.state.currentChapter}`;

    verseGrid.innerHTML = "";

    // NOTE: Without verse-count metadata, provide a practical default range.
    // Many chapters are <= 50 verses; users can still jump quickly.
    const maxVerses = 99999;

    for (let v = 1; v <= maxVerses; v++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chapter-item"; // reuse same grid button styles

      btn.textContent = String(v);

      btn.addEventListener("click", async () => {
        // Load the chapter, then scroll to verse if verse numbers are displayed.
        await app.loadPassage(this.state.currentBook, this.state.currentChapter);
        app.closeModal(app.verseModal);

        // Optional: try to scroll to verse marker in rendered HTML (best-effort).
        // ESV HTML commonly includes verse anchors; this keeps it safe even if not present.
        const verseAnchor =
          document.querySelector(`[data-verse="${v}"]`) ||
          document.getElementById(String(v)) ||
          document.querySelector(`a[name="${v}"]`);

        if (verseAnchor) verseAnchor.scrollIntoView({ block: "start" });
      });

      verseGrid.appendChild(btn);
    }

    app.openModal(app.verseModal);
  }
}
