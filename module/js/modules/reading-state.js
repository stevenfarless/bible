// js/modules/reading-state.js NEW VERSION
import { getAllBooks, getChapterCount } from './bible-structure.js';

export function initializeState() {
    return {
        currentBook: 'Genesis',
        currentChapter: 1,
        fontSize: 18,
        showVerseNumbers: true,
        showHeadings: true,
        showFootnotes: false,
        showCrossReferences: false,
        showRedLetters: false,
        verseByVerse: false,
        selectedVerse: null,
        lightMode: false,
        colorTheme: 'dracula'
    };
}

export function navigateChapter(app, direction) {
    const books = getAllBooks();
    const currentBookIndex = books.indexOf(app.state.currentBook);
    const chapterCount = getChapterCount(app.state.currentBook);

    let newBook = app.state.currentBook;
    let newChapter = app.state.currentChapter + direction;

    if (newChapter > chapterCount) {
        if (currentBookIndex < books.length - 1) {
            newBook = books[currentBookIndex + 1];
            newChapter = 1;
        } else {
            return; // Last chapter of Revelation
        }
    } else if (newChapter < 1) {
        if (currentBookIndex > 0) {
            newBook = books[currentBookIndex - 1];
            newChapter = getChapterCount(newBook);
        } else {
            return; // First chapter of Genesis
        }
    }

    app.loadPassage(newBook, newChapter);
}

export function scrollToVerse(app, verseNum) {
    const verses = Array.from(app.ui.passageText.querySelectorAll('.verse-num'));
    const target = verses.find(v => v.textContent.trim() === String(verseNum));

    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        applyVerseGlow(target);
        app.state.selectedVerse = verseNum;
    }
}

export function applyVerseGlow(element) {
    let container = element.closest('span.verse-span');
    if (!container) container = element.parentElement;

    container.classList.add('verse-glow');
    setTimeout(() => {
        container.classList.remove('verse-glow');
    }, 2000);
}
