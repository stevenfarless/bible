// reading-state.js
// Responsibility: navigation, verse selection, highlight, reading position.

export function initializeState() {
    return {
        currentBook: 'John',
        currentChapter: 1,
        selectedVerse: null,
        fontSize: 18,
        showVerseNumbers: true,
        showHeadings: true,
        showFootnotes: false,
        showCrossReferences: false,
        verseByVerse: false,
        colorTheme: 'dracula',
        lightMode: false,
        translation: 'ESV'
    };
}


export function navigateChapter(app, direction) {
    let newChapter = app.state.currentChapter + direction;
    let newBook = app.state.currentBook;

    const chapterCount = app.getChapterCount(app.state.currentBook);

    if (newChapter < 1) {
        const books = app.getAllBooks();
        const currentIndex = books.indexOf(app.state.currentBook);
        if (currentIndex > 0) {
            newBook = books[currentIndex - 1];
            newChapter = app.getChapterCount(newBook);
        } else {
            return;
        }
    } else if (newChapter > chapterCount) {
        const books = app.getAllBooks();
        const currentIndex = books.indexOf(app.state.currentBook);
        if (currentIndex < books.length - 1) {
            newBook = books[currentIndex + 1];
            newChapter = 1;
        } else {
            return;
        }
    }

    app.state.selectedVerse = null;
    app.loadPassage(newBook, newChapter);
}

export function scrollToVerse(app, verseNumber) {
    app.state.selectedVerse = verseNumber;
    app.currentVerseSpan.textContent = `${verseNumber}`;
    app.applyVerseGlow();
}

export function applyVerseGlow(app) {
    // Remove any existing glow without resetting innerHTML.
    app.passageText.querySelectorAll('.selected-verse-glow').forEach(el => {
        el.classList.remove('selected-verse-glow');
    });

    if (app.state.selectedVerse === null) return;

    const target = app.passageText.querySelector(
        `.verse[data-verse="${app.state.selectedVerse}"]`
    );
    if (!target) return;

    target.classList.add('selected-verse-glow');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
