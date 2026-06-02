// events.js
// Wires all DOM event listeners to BibleApp instance methods.
// New feature bindings go here — app.js does not need to change.

import { toggleTheme, changeColorTheme } from './ui.js';
import { attachDragToResize } from './modals.js';
import { runMegasearch, performKeywordSearch } from './search.js';
import { applyReadingFont } from './settings.js';

/**
 * @param {object} app - BibleApp instance
 */
export function attachEventListeners(app) {
    // ── Search ───────────────────────────────────────────────────
    app.searchToggleBtn?.addEventListener('click', () => app.toggleSearch());
    app.closeSearchBtn?.addEventListener('click',  () => app.closeSearch());
    app.searchInput?.addEventListener('input',     (e) => app.handleSearch(e.target.value, 'type'));
    app.searchInput?.addEventListener('keydown',   (e) => app.handleSearchKeydown(e));
    // iOS/Android: paste does not reliably fire `input`; read value after DOM settles.
    app.searchInput?.addEventListener('paste',     ()  => setTimeout(() => app.handleSearch(app.searchInput.value, 'paste'), 0));

    // Megasearch toggle:
    // ON  — run a supplemental pass against cached translations immediately.
    // OFF — re-run the active-translation-only search to strip supplemental results.
    document.getElementById('megasearchToggle')?.addEventListener('change', (e) => {
        const query = app.searchLastQuery || '';
        if (e.target.checked) {
            if (query.trim().length >= 3 && app.currentSearchResults?.length > 0) {
                runMegasearch(app, query);
            }
        } else {
            if (query.trim().length > 0) {
                performKeywordSearch(app, query);
            }
        }
    });

    // ── Navigation ──────────────────────────────────────────────
    app.prevChapterBtn?.addEventListener('click',  () => app.navigateChapter(-1));
    app.nextChapterBtn?.addEventListener('click',  () => app.navigateChapter(1));
    app.bookSelector?.addEventListener('click',    () => app.openBookModal());
    app.chapterSelector?.addEventListener('click', () => app.openChapterModal());
    app.verseSelector?.addEventListener('click',   () => app.openVerseModal());

    // ── Translation badge (nav) ──────────────────────────────────
    app.translationSelectorBtn?.addEventListener('click', () => app.openTranslationModal());

    // ── Copy passage ─────────────────────────────────────────────
    document.getElementById('copyPassage')?.addEventListener('click', () => app.copyPassage());

    // ── Modals: late-cached elements ─────────────────────────────────
    app.referencesModal        = document.getElementById('referencesModal');
    app.closeReferencesModal   = document.getElementById('closeReferencesModal');
    app.footnotesSection       = document.getElementById('footnotesSection');
    app.footnotesContent       = document.getElementById('footnotesContent');
    app.crossReferencesSection = document.getElementById('crossReferencesSection');
    app.crossReferencesContent = document.getElementById('crossReferencesContent');

    // Backdrop-click closes any modal
    [
        app.bookModal, app.chapterModal, app.verseModal,
        app.settingsModal, app.helpModal, app.loginModal,
        app.signupModal, app.userMenuModal, app.referencesModal,
        app.translationModal,
    ].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (e) => { if (e.target === modal) app.closeModal(modal); });
    });

    app.helpBtn?.addEventListener('click',            () => app.openModal(app.helpModal));
    app.settingsBtn?.addEventListener('click',        () => app.openModal(app.settingsModal));
    app.closeVerseModal?.addEventListener('click',    () => app.closeModal(app.verseModal));
    app.closeBookModal?.addEventListener('click',     () => app.closeModal(app.bookModal));
    app.closeDeuterocanonInfoModal?.addEventListener('click', () => app.closeModal(app.deuterocanonInfoModal));
    app.closeChapterModal?.addEventListener('click',  () => app.closeModal(app.chapterModal));
    app.closeHelpModal?.addEventListener('click',     () => app.closeModal(app.helpModal));
    app.closeSettingsModal?.addEventListener('click', () => app.closeModal(app.settingsModal));
    app.closeReferencesModal?.addEventListener('click', () => app.closeModal(app.referencesModal));
    app.closeTranslationModal?.addEventListener('click', () => app.closeModal(app.translationModal));

    attachDragToResize(app);

    // ── Settings toggles ────────────────────────────────────────────
    app.verseNumbersToggle?.addEventListener('change', () => app.toggleSetting('showVerseNumbers'));
    app.headingsToggle?.addEventListener('change',     () => app.toggleSetting('showHeadings'));
    app.footnotesToggle?.addEventListener('change',    () => app.toggleSetting('showFootnotes'));

    app.crossReferencesToggle = document.getElementById('crossReferencesToggle');
    app.crossReferencesToggle?.addEventListener('change', () => app.toggleSetting('showCrossReferences'));

    app.verseByVerseToggle?.addEventListener('change', () => app.toggleVerseByVerse());
    app.fontSizeSlider?.addEventListener('input',  (e) => app.updateFontSize(e.target.value));

        const readingFontSelector = document.getElementById('readingFontSelector');
if (readingFontSelector) {
    readingFontSelector.addEventListener('change', async () => {
        const font = readingFontSelector.value;
        app.state.readingFont = font;
        localStorage.setItem('readingFont', font);
        applyReadingFont(app, font);

        if (app.currentUser) {
            await app.database
                .ref(`users/${app.currentUser.uid}/settings/readingFont`)
                .set(font);
        }
    });
}
    
    // Settings <select> still works as a secondary route
    app.translationSelector?.addEventListener('change', async (e) => app.changeTranslation(e.target.value));

    // ── Theme ────────────────────────────────────────────────────
    app.themeToggleBtn?.addEventListener('click', () => toggleTheme(app));
    document.getElementById('themeSelector')?.addEventListener('change',   (e) => changeColorTheme(app, e.target.value));
    document.getElementById('lightModeToggle')?.addEventListener('change', () => toggleTheme(app));

    // ── Auth ─────────────────────────────────────────────────────
    app.userBtn?.addEventListener('click', () => app.handleUserButtonClick());

    document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        app.closeModal(app.loginModal);
        app.openModal(app.signupModal);
    });
    document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        app.closeModal(app.signupModal);
        app.openModal(app.loginModal);
    });
    document.getElementById('loginForm')?.addEventListener('submit',  (e) => { e.preventDefault(); app.handleLogin(); });
    document.getElementById('signupForm')?.addEventListener('submit', (e) => { e.preventDefault(); app.handleSignup(); });
    document.getElementById('logoutBtn')?.addEventListener('click',   () => app.handleLogout());

    app.closeLoginModal?.addEventListener('click',    () => app.closeModal(app.loginModal));
    app.closeSignupModal?.addEventListener('click',   () => app.closeModal(app.signupModal));
    app.closeUserMenuModal?.addEventListener('click', () => app.closeModal(app.userMenuModal));

    // ── Scroll (chrome hide/show + position save) ───────────────────
    window.addEventListener('scroll', () => {
        app.handleChromeScroll();
        clearTimeout(app.scrollTimeout);
        app.scrollTimeout = setTimeout(() => app.saveReadingPosition(), 500);
    }, { passive: true });

    // ── Keyboard ────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => app.handleKeyboardShortcuts(e));
}
