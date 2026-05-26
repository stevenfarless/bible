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
        translation: 'KJV'
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
    // Remove any existing glow wrapper without resetting innerHTML.
    // The wrapper is a <div data-verse-glow> inserted around the target .verse span.
    app.passageText.querySelectorAll('[data-verse-glow]').forEach(wrapper => {
        // Unwrap: move the verse span back to where the wrapper was, then remove wrapper.
        const parent = wrapper.parentNode;
        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, wrapper);
        }
        parent.removeChild(wrapper);
    });

    if (app.state.selectedVerse === null) return;

    const target = app.passageText.querySelector(
        `.verse[data-verse="${app.state.selectedVerse}"]`
    );
    if (!target) return;

    // Wrap the target verse in a block-level div that carries the glow styling.
    // Using a wrapper div means the glow is *always* a block element from the
    // very first paint — there is no inline-to-block reflow, so no position jump.
    const wrapper = document.createElement('div');
    wrapper.className = 'selected-verse-glow';
    wrapper.setAttribute('data-verse-glow', '');
    target.parentNode.insertBefore(wrapper, target);
    wrapper.appendChild(target);

    // scrollIntoView on an inline <span> is unreliable across browsers —
    // scroll to the block wrapper instead, which has stable geometry.
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
