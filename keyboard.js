// keyboard.js
// Global keyboard shortcut handler for BibleApp.

/**
 * @param {object} app - BibleApp instance
 * @param {KeyboardEvent} e
 */
export function handleKeyboardShortcuts(app, e) {
    // Search toggle
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        app.toggleSearch();
        return;
    }

    // Dismiss any open modal or search
    if (e.key === 'Escape') {
        [
            app.bookModal, app.chapterModal, app.helpModal,
            app.settingsModal, app.loginModal, app.signupModal,
            app.userMenuModal, app.verseModal, app.referencesModal,
        ].forEach((m) => { if (m?.classList.contains('active')) app.closeModal(m); });
        if (app.searchContainer?.classList.contains('active')) app.closeSearch();
        return;
    }

    // Navigation and reading shortcuts — only when no modal/search is open
    const modalOpen  = !!document.querySelector('.modal.active');
    const searchOpen = !!app.searchContainer?.classList.contains('active');
    if (modalOpen || searchOpen) return;

    switch (e.key) {
        case 'ArrowLeft':
        case 'h':
            e.preventDefault();
            app.navigateChapter(-1);
            break;
        case 'ArrowRight':
        case 'l':
            e.preventDefault();
            app.navigateChapter(1);
            break;
        case 'ArrowUp':
        case 'k':
            e.preventDefault();
            app.navigateToPreviousVerse();
            break;
        case 'ArrowDown':
        case 'j':
            e.preventDefault();
            app.navigateToNextVerse();
            break;
        case 'n':
            e.preventDefault();
            if (app.verseNumbersToggle) {
                app.verseNumbersToggle.checked = !app.verseNumbersToggle.checked;
                app.toggleSetting('showVerseNumbers');
            }
            break;
        case 'v':
            e.preventDefault();
            if (app.verseByVerseToggle) {
                app.verseByVerseToggle.checked = !app.verseByVerseToggle.checked;
                app.toggleVerseByVerse();
            }
            break;
        case 's':
            e.preventDefault();
            if (app.headingsToggle) {
                app.headingsToggle.checked = !app.headingsToggle.checked;
                app.toggleSetting('showHeadings');
            }
            break;
    }
}
