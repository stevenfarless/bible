// events.js
// Wires all DOM event listeners to BibleApp instance methods.
// New feature bindings go here — app.js does not need to change.

import { toggleTheme, changeColorTheme } from './ui.js';
import { attachDragToResize } from './modals.js';
import { runMegasearch } from './search.js';

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

    // When the megasearch toggle is switched ON and there are already results
    // showing, run a supplemental pass immediately against whatever translations
    // are now in the cache — no need to retype the query.
    document.getElementById('megasearchToggle')?.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        const query = app.searchLastQuery || '';
        if (query.trim().length >= 3 && app.currentSearchResults?.length > 0) {
            runMegasearch(app, query);
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

    // ── Copy passage ────────────────────────────────────────────
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            app.copyPassage();
            const prev = copyBtn.getAttribute('aria-label');
            copyBtn.setAttribute('aria-label', 'Copied!');
            copyBtn.classList.add('copy-btn--copied');
            setTimeout(() => {
                copyBtn.setAttribute('aria-label', prev);
                copyBtn.classList.remove('copy-btn--copied');
            }, 2000);
        });
    }

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
