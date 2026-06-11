// events.js
// Wires all DOM event listeners to BibleApp instance methods.
// New feature bindings go here — app.js does not need to change.

import { setLightMode, changeColorTheme, applyLightMode } from './ui.js';
import { attachDragToResize } from './bottom-sheet-drag.js';
import { runMegasearch, performKeywordSearch } from './search.js';
import { applyReadingFont } from './settings.js';
import { initSwipe } from './swipe.js';
import { handleChangeEmail, handleChangePassword, handleForgotPassword } from './auth.js';

const CHANGE_EMAIL_HTML = `
<div id="changeEmailModal" class="modal">
                <div class="modal-content">
                        <div class="modal-header">
                                <h3>Change Email</h3>
                                <button class="close-btn" id="closeChangeEmailModal">&times;</button>
                        </div>
                        <div class="modal-body">
                                <form id="changeEmailForm">
                                        <input type="hidden" name="username" autocomplete="username">
                                        <div class="setting-item">
                                                <label for="changeEmailCurrent">Current Password</label>
                                                <input type="password" id="changeEmailCurrent" class="input-field" placeholder="Enter current password" autocomplete="current-password">
                                        </div>
                                        <div class="setting-item">
                                                <label for="changeEmailNew">New Email</label>
                                                <input type="email" id="changeEmailNew" class="input-field" placeholder="Enter new email" autocomplete="email">
                                        </div>
                                        <button type="submit" class="primary-btn" style="width:100%;margin-top:var(--spacing-md)">Update Email</button>
                                </form>
                        </div>
                </div>
        </div>`;

const CHANGE_PASSWORD_HTML = `
<div id="changePasswordModal" class="modal">
                <div class="modal-content">
                        <div class="modal-header">
                                <h3>Change Password</h3>
                                <button class="close-btn" id="closeChangePasswordModal">&times;</button>
                        </div>
                        <div class="modal-body">
                                <form id="changePasswordForm">
                                        <input type="hidden" name="username" autocomplete="username">
                                        <div class="setting-item">
                                                <label for="changePasswordCurrent">Current Password</label>
                                                <input type="password" id="changePasswordCurrent" class="input-field" placeholder="Enter current password" autocomplete="current-password">
                                        </div>
                                        <div class="setting-item">
                                                <label for="changePasswordNew">New Password</label>
                                                <input type="password" id="changePasswordNew" class="input-field" placeholder="At least 6 characters" autocomplete="new-password">
                                        </div>
                                        <button type="submit" class="primary-btn" style="width:100%;margin-top:var(--spacing-md)">Update Password</button>
                                </form>
                        </div>
                </div>
        </div>`;

function injectModal(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const el = tmp.firstElementChild;
    document.body.appendChild(el);
    return el;
}

function teardown(modal, app) {
    app.closeModal(modal);
    // Let the closing animation finish before removing
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
    // Fallback if no transition fires
    setTimeout(() => { if (modal.isConnected) modal.remove(); }, 400);
}

function openChangeEmailModal(app) {
    const modal = injectModal(CHANGE_EMAIL_HTML);
    const usernameField = modal.querySelector('input[name="username"]');
    if (usernameField) usernameField.value = app.currentUser?.email ?? '';

    app.openModal(modal);

    modal.querySelector('#closeChangeEmailModal').addEventListener('click', () => teardown(modal, app));
    modal.querySelector('#changeEmailForm').addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangeEmail(app).then(() => teardown(modal, app));
    });
}

function openChangePasswordModal(app) {
    const modal = injectModal(CHANGE_PASSWORD_HTML);
    const usernameField = modal.querySelector('input[name="username"]');
    if (usernameField) usernameField.value = app.currentUser?.email ?? '';

    app.openModal(modal);

    modal.querySelector('#closeChangePasswordModal').addEventListener('click', () => teardown(modal, app));
    modal.querySelector('#changePasswordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangePassword(app).then(() => teardown(modal, app));
    });
}

/**
 * @param {object} app - BibleApp instance
 */
export function attachEventListeners(app) {
    // ── Search ───────────────────────────────────────────────────────────────
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

    // ── Navigation ──────────────────────────────────────────────────────────
    app.prevChapterBtn?.addEventListener('click',  () => app.navigateChapter(-1));
    app.nextChapterBtn?.addEventListener('click',  () => app.navigateChapter(1));
    app.bookSelector?.addEventListener('click',    () => app.openBookModal());
    app.chapterSelector?.addEventListener('click', () => app.openChapterModal());
    app.verseSelector?.addEventListener('click',   () => app.openVerseModal());

    // Phase 3 three-panel drag-follow swipe navigation.
    // Replaces the Phase 1/2 touchstart+touchend handler that was inline here.
    // initSwipe() wraps #passageText in a clipping viewport and pre-renders
    // adjacent panels after every loadPassage() resolves via
    // app.swipe.syncAdjacentPanels() (called from app.loadPassage).
    initSwipe(app);

    // ── Translation badge (nav) ──────────────────────────────────────────────
    app.translationSelectorBtn?.addEventListener('click', () => app.openTranslationModal());

    // ── Copy passage ─────────────────────────────────────────────────────────
    document.getElementById('copyPassage')?.addEventListener('click', () => app.copyPassage());

    // ── Verse tap-to-select ──────────────────────────────────────────────────
    // Delegated to #swipeViewport (the stable wrapper) rather than app.passageText,
    // because app.passageText is reassigned to a new DOM node on every swipe commit.
    // Attaching to passageText directly would break verse selection after any swipe.
    // touch-action:manipulation on .verse (set in CSS) eliminates the 300ms tap
    // delay on mobile without disabling scroll.
    // Tapping the already-selected verse deselects it.
    const verseClickTarget = document.getElementById('swipeViewport') ?? app.passageText;
    verseClickTarget?.addEventListener('click', (e) => {
        const verse = e.target.closest('.verse');
        if (!verse) return;
        // Ignore clicks that originated inside the tool tray or trigger.
        if (e.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;
        const num = parseInt(verse.dataset.verse, 10);
        if (!num) return;
        if (app.state.selectedVerse === num) {
            app.state.selectedVerse = null;
            app.applyVerseGlow();
        } else {
            app.scrollToVerse(num);
        }
    });

    // ── Modals: late-cached elements ─────────────────────────────────────────
    app.referencesModal        = document.getElementById('referencesModal');
    app.closeReferencesModal   = document.getElementById('closeReferencesModal');
    app.footnotesSection       = document.getElementById('footnotesSection');
    app.footnotesContent       = document.getElementById('footnotesContent');
    app.crossReferencesSection = document.getElementById('crossReferencesSection');
    app.crossReferencesContent = document.getElementById('crossReferencesContent');

    // Backdrop-click closes any modal
    [
        app.bookModal, app.chapterModal, app.verseModal,
        app.settingsModal, app.loginModal,
        app.signupModal, app.userMenuModal, app.referencesModal,
        app.translationModal, app.deuterocanonInfoModal,
    ].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (e) => { if (e.target === modal) app.closeModal(modal); });
    });

    app.settingsBtn?.addEventListener('click',        () => app.openModal(app.settingsModal));
    app.closeVerseModal?.addEventListener('click',    () => app.closeModal(app.verseModal));
    app.closeBookModal?.addEventListener('click',     () => app.closeModal(app.bookModal));
    app.closeDeuterocanonInfoModal?.addEventListener('click', () => app.closeModal(app.deuterocanonInfoModal));
    app.closeChapterModal?.addEventListener('click',  () => app.closeModal(app.chapterModal));
    app.closeSettingsModal?.addEventListener('click', () => app.closeModal(app.settingsModal));
    app.closeReferencesModal?.addEventListener('click', () => app.closeModal(app.referencesModal));
    app.closeTranslationModal?.addEventListener('click', () => app.closeModal(app.translationModal));

    attachDragToResize(app);

    // ── Settings toggles ─────────────────────────────────────────────────────
    app.verseNumbersToggle?.addEventListener('change', () => app.toggleSetting('showVerseNumbers'));
    app.headingsToggle?.addEventListener('change',     () => app.toggleSetting('showHeadings'));
    app.footnotesToggle?.addEventListener('change',    () => app.toggleSetting('showFootnotes'));
    app.chapterArrowsToggle?.addEventListener('change',() => app.toggleSetting('showChapterArrows'));

    app.crossReferencesToggle = document.getElementById('crossReferencesToggle');
    app.crossReferencesToggle?.addEventListener('change', () => app.toggleSetting('showCrossReferences'));

    app.verseByVerseToggle?.addEventListener('change',  () => app.toggleVerseByVerse());
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

    // ── Theme ─────────────────────────────────────────────────────────────────
    document.getElementById('themeSelector')?.addEventListener('change', (e) => changeColorTheme(app, e.target.value));
    document.getElementById('lightModeSelect')?.addEventListener('change', (e) => setLightMode(app, e.target.value));

    // ── Auth ──────────────────────────────────────────────────────────────────
    document.getElementById('userBtn')?.addEventListener('click', () => app.handleUserButtonClick());
    document.getElementById('changeEmailBtn')?.addEventListener('click', () => { app.closeModal(app.userMenuModal); openChangeEmailModal(app); });
    document.getElementById('changePasswordBtn')?.addEventListener('click', () => { app.closeModal(app.userMenuModal); openChangePasswordModal(app); });

    document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        app.closeModal(app.loginModal);
        app.openModal(document.getElementById('forgotPasswordModal'));
    });
    document.getElementById('closeForgotPasswordModal')?.addEventListener('click', () => app.closeModal(document.getElementById('forgotPasswordModal')));
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', (e) => { e.preventDefault(); handleForgotPassword(app); });
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

    // ── Scroll (chrome hide/show + position save) ────────────────────────────
    window.addEventListener('scroll', () => {
        app.handleChromeScroll();
        clearTimeout(app.scrollTimeout);
        app.scrollTimeout = setTimeout(() => app.saveReadingPosition(), 500);
    }, { passive: true });

    // ── Keyboard ──────────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => app.handleKeyboardShortcuts(e));
    // Live-update appearance when OS dark/light mode changes
    window.matchMedia('(prefers-color-scheme: light)')
        .addEventListener('change', () => {
            if (app.state.lightMode === 'system') applyLightMode('system');
        });

}
