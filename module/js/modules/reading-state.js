// js/modules/reading-state.js
// Responsibility: app-level state shape, chapter/verse navigation, verse scrolling

export function initializeState() {
  return {
    currentBook: 'Genesis',
    currentChapter: 1,
    selectedVerse: null,

    // display settings
    fontSize: 18,
    showVerseNumbers: true,
    showHeadings: true,
    showFootnotes: false,
    showCrossReferences: false,
    verseByVerse: false,
    showRedLetters: true,

    // theme
    colorTheme: 'dracula',
    lightMode: false,
  };
}

// Chapter navigation (same semantics as old app)
export function navigateChapter(app, direction) {
  const books = app.getAllBooks ? app.getAllBooks() : [];
  const book = app.state.currentBook;
  const chapter = app.state.currentChapter;

  const currentBookIndex = books.indexOf(book);
  if (currentBookIndex === -1) return;

  const chapterCount = app.getChapterCount
    ? app.getChapterCount(book)
    : 1;

  let newBook = book;
  let newChapter = chapter + direction;

  if (direction > 0 && newChapter > chapterCount) {
    // next book
    if (currentBookIndex >= books.length - 1) return;
    newBook = books[currentBookIndex + 1];
    newChapter = 1;
  } else if (direction < 0 && newChapter < 1) {
    // previous book
    if (currentBookIndex <= 0) return;
    newBook = books[currentBookIndex - 1];
    newChapter = app.getChapterCount
      ? app.getChapterCount(newBook)
      : 1;
  }

  app.state.selectedVerse = null;
  app.loadPassage(newBook, newChapter);
}

// Scroll to a verse and remember selection
export function scrollToVerse(app, verseNumber) {
  if (!app.ui || !app.ui.passageText) return;

  app.state.selectedVerse = verseNumber;

  const container = app.ui.passageText;
  const verseSelector = `.verse-num[id^="v"][id*="${verseNumber}-"]`;
  const verseEl =
    container.querySelector(verseSelector) ||
    container.querySelector(`[data-verse="${verseNumber}"]`);

  if (!verseEl) return;

  const rect = verseEl.getBoundingClientRect();
  const offset = window.scrollY + rect.top - 80; // offset for header/nav
  window.scrollTo({
    top: offset,
    behavior: 'smooth',
  });

  applyVerseGlow(app, verseEl);
}

// Add a temporary glow highlight to a verse container
export function applyVerseGlow(app, verseElement) {
  if (!verseElement) return;
  const row = verseElement.closest('p, div');
  if (!row) return;

  row.classList.add('verse-glow');
  setTimeout(() => row.classList.remove('verse-glow'), 800);
}
