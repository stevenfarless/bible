// js/modules/reading-state.js
import { getChapterCount, getAllBooks } from './bible-structure.js';

/**
 * Initialize default reading state
 */
export function initializeState() {
    return {
        currentBook: 'John',
        currentChapter: 3,
        scrollPosition: 0,
        fontSize: 18,
        showVerseNumbers: true,
        showHeadings: true,
        showFootnotes: false,
        showCrossReferences: false,
        showRedLetters: false,
        verseByVerse: false,
        lightMode: false,
        colorTheme: 'dracula'
    };
}

/**
 * Navigate to next or previous chapter
 * @param {Object} app - The BibleApp instance
 * @param {number} direction - -1 for previous, 1 for next
 */
export function navigateChapter(app, direction) {
    const { currentBook, currentChapter } = app.state;
    const chapterCount = getChapterCount(currentBook);
    const allBooks = getAllBooks();
    const currentBookIndex = allBooks.indexOf(currentBook);

    let newBook = currentBook;
    let newChapter = currentChapter + direction;

    // Handle chapter overflow
    if (newChapter < 1) {
        // Go to previous book's last chapter
        if (currentBookIndex > 0) {
            newBook = allBooks[currentBookIndex - 1];
            newChapter = getChapterCount(newBook);
        } else {
            // Already at first chapter of first book
            if (app.ui) {
                app.ui.showToast('Already at the beginning');
            }
            return;
        }
    } else if (newChapter > chapterCount) {
        // Go to next book's first chapter
        if (currentBookIndex < allBooks.length - 1) {
            newBook = allBooks[currentBookIndex + 1];
            newChapter = 1;
        } else {
            // Already at last chapter of last book
            if (app.ui) {
                app.ui.showToast('Already at the end');
            }
            return;
        }
    }

    // Load the new passage
    app.loadPassage(newBook, newChapter);
}
