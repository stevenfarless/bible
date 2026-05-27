// navigation.js
// Chapter and verse navigation helpers.
// All functions accept an `app` instance as their first argument.

/**
 * Updates the book/chapter span text and enables/disables the prev/next
 * chapter buttons based on the current position in the canon.
 * @param {object} app
 */
export function updateNavigationState(app) {
    const book = app.state.currentBook;
    const abbr = app.bookAbbreviations[book] || book;
    app.currentBookSpan.textContent = abbr;
    app.currentChapterSpan.textContent = app.state.currentChapter;

    const books = app.getAllBooks();
    const currentBookIndex = books.indexOf(book);
    const isFirstChapter = app.state.currentChapter === 1;
    const isLastChapter = app.state.currentChapter === app.getChapterCount(book);

    if (app.prevChapterBtn) app.prevChapterBtn.disabled = currentBookIndex === 0 && isFirstChapter;
    if (app.nextChapterBtn) app.nextChapterBtn.disabled = currentBookIndex === books.length - 1 && isLastChapter;
}

/**
 * Scrolls to the next verse in the current chapter, or advances to the
 * next chapter if already on the last verse.
 * @param {object} app
 */
export function navigateToNextVerse(app) {
    const currentVerse = app.state.selectedVerse || 1;
    const maxVerse = app.getCurrentVerseCount();

    if (currentVerse < maxVerse) {
        app.scrollToVerse(currentVerse + 1);
    } else {
        app.navigateChapter(1);
    }
}

/**
 * Scrolls to the previous verse in the current chapter, or goes back to
 * the last verse of the previous chapter (or previous book) if already
 * on verse 1.
 * @param {object} app
 */
export function navigateToPreviousVerse(app) {
    const currentVerse = app.state.selectedVerse || 1;

    if (currentVerse > 1) {
        app.scrollToVerse(currentVerse - 1);
        return;
    }

    const books = app.getAllBooks();
    const currentBookIndex = books.indexOf(app.state.currentBook);
    const isFirstChapter = app.state.currentChapter === 1;

    if (currentBookIndex === 0 && isFirstChapter) return;

    let newChapter = app.state.currentChapter - 1;
    let newBook = app.state.currentBook;

    if (newChapter < 1) {
        newBook = books[currentBookIndex - 1];
        newChapter = app.getChapterCount(newBook);
    }

    app.state.selectedVerse = null;
    app.loadPassage(newBook, newChapter);
}
