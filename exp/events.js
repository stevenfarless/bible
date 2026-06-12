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
                                                <input type="email" id="changeEmailNew" class="input-field" placeholder="Enter current email" autocomplete="email">
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
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
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

function syncReadingDisplay(app) {
    document.body.classList.toggle('hide-verse-numbers', !app.state.showVerseNumbers);
    document.body.classList.toggle('muted-verse-numbers', !app.state.coloredVerseNumbers);
    document.body.classList.toggle('hide-chapter-arrows', !app.state.showChapterArrows);
    document.body.classList.toggle('verse-by-verse-mode', !!app.state.verseByVerse);

    for (const panel of document.querySelectorAll('#passageText, #swipePrev, #swipeNext')) {
        panel.classList.toggle('verse-by-verse', !!app.state.verseByVerse);
    }
}

/**
 * @param {object} app - BibleApp instance
 */
export function attachEventListeners(app) {
    app.searchToggleBtn?.addEventListener('click', () => app.toggleSearch());
    app.closeSearchBtn?.addEventListener('click',  () => app.closeSearch());
    app.searchInput?.addEventListener('input',     (e) => app.handleSearch(e.target.value, 'type'));
    app.searchInput?.addEventListener('keydown',   (e) => app.handleSearchKeydown(e));
    app.searchInput?.addEventListener('paste',     ()  => setTimeout(() => app.handleSearch(app.searchInput.value, 'paste'), 0));

    document.getElementById('megasearchToggle')?.addEventListener('change', (e) => {
        const query = app.searchLastQuery || '';
        if (e.target.checked) {
            if (query.trim().length >= 3 && app.currentSearchResults?.length > 0) {
                runMegasearch(app, query);
            }
        } else if (query.trim().length > 0) {
            performKeywordSearch(app, query);
        }
    });

    app.prevChapterBtn?.addEventListener('click',  () => app.navigateChapter(-1));
    app.nextChapterBtn?.addEventListener('click',  () => app.navigateChapter(1));
    app.bookSelector?.addEventListener('click',    () => app.openBookModal());
    app.chapterSelector?.addEventListener('click', () => app.openChapterModal());
    app.verseSelector?.addEventListener('click',   () => app.openVerseModal());

    initSwipe(app);

    app.translationSelectorBtn?.addEventListener('click', () => app.openTranslationModal());
    document.getElementById('copyPassage')?.addEventListener('click', () => app.copyPassage());

    const versePressTarget = document.getElementById('swipeViewport') ?? app.passageText;

    if (versePressTarget) {
        const HOLD_MS = 500;
        const MOVE_LIMIT = 12;

        let holdTimer = null;
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let pressedVerse = null;
        let activated = false;

        const cancelVersePress = () => {
            clearTimeout(holdTimer);
            holdTimer = null;
            pointerId = null;
            pressedVerse = null;
        };

        versePressTarget.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            const verse = event.target.closest('.verse');
            if (!verse) return;
            if (event.target.closest('.verse-tools-tray, .verse-tools-trigger')) return;

            cancelVersePress();

            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            pressedVerse = verse;
            activated = false;

            holdTimer = setTimeout(() => {
                const num = parseInt(pressedVerse?.dataset.verse, 10);
                if (!num) return;

                activated = true;
                navigator.vibrate?.(20);

                if (app.state.selectedVerse === num) {
                    app.state.selectedVerse = null;
                    app.applyVerseGlow();
                } else {
                    app.scrollToVerse(num);
                }
            }, HOLD_MS);
        });

        versePressTarget.addEventListener('pointermove', (event) => {
            if (event.pointerId !== pointerId) return;

            const movedX = Math.abs(event.clientX - startX);
            const movedY = Math.abs(event.clientY - startY);

            if (movedX > MOVE_LIMIT || movedY > MOVE_LIMIT) {
                cancelVersePress();
            }
        });

        const finishVersePress = (event) => {
            if (event.pointerId !== pointerId) return;

            if (activated) {
                event.preventDefault();
                event.stopPropagation();
            }

            cancelVersePress();
        };

        versePressTarget.addEventListener('pointerup', finishVersePress);
        versePressTarget.addEventListener('pointercancel', finishVersePress);

        versePressTarget.addEventListener('contextmenu', (event) => {
            if (event.target.closest('.verse')) event.preventDefault();
        });
    }

    app.referencesModal        = document.getElementById('referencesModal');
    app.closeReferencesModal   = document.getElementById('closeReferencesModal');
    app.footnotesSection       = document.getElementById('footnotesSection');
    app.footnotesContent       = document.getElementById('footnotesContent');
    app.crossReferencesSection = document.getElementById('crossReferencesSection');
    app.crossReferencesContent = document.getElementById('crossReferencesContent');

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

    app.verseNumbersToggle?.addEventListener('input', (e) => {
        app.state.showVerseNumbers = e.currentTarget.checked;
        syncReadingDisplay(app);
    });
    app.verseNumbersToggle?.addEventListener('change', () => app.toggleSetting('showVerseNumbers'));

    app.coloredVerseNumbersToggle?.addEventListener('input', (e) => {
        app.state.coloredVerseNumbers = e.currentTarget.checked;
        syncReadingDisplay(app);
    });
    app.coloredVerseNumbersToggle?.addEventListener('change', () => {
        app.toggleSetting('coloredVerseNumbers');
    });

    app.headingsToggle?.addEventListener('change', () => app.toggleSetting('showHeadings'));
    app.footnotesToggle?.addEventListener('change', () => app.toggleSetting('showFootnotes'));

    app.chapterArrowsToggle?.addEventListener('input', (e) => {
        app.state.showChapterArrows = e.currentTarget.checked;
        syncReadingDisplay(app);
    });
    app.chapterArrowsToggle?.addEventListener('change', () => app.toggleSetting('showChapterArrows'));

    app.crossReferencesToggle = document.getElementById('crossReferencesToggle');
    app.crossReferencesToggle?.addEventListener('change', () => app.toggleSetting('showCrossReferences'));

    app.verseByVerseToggle?.addEventListener('input', (e) => {
        app.state.verseByVerse = e.currentTarget.checked;
        syncReadingDisplay(app);
    });
    app.verseByVerseToggle?.addEventListener('change', () => app.toggleVerseByVerse());
    app.fontSizeSlider?.addEventListener('input', (e) => app.updateFontSize(e.target.value));

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

    app.translationSelector?.addEventListener('change', async (e) => app.changeTranslation(e.target.value));

    document.getElementById('themeSelector')?.addEventListener('change', (e) => changeColorTheme(app, e.target.value));
    document.getElementById('lightModeSelect')?.addEventListener('change', (e) => setLightMode(app, e.target.value));

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

    window.addEventListener('scroll', () => {
        app.handleChromeScroll();
        clearTimeout(app.scrollTimeout);
        app.scrollTimeout = setTimeout(() => app.saveReadingPosition(), 500);
    }, { passive: true });

    document.addEventListener('keydown', (e) => app.handleKeyboardShortcuts(e));
    window.matchMedia('(prefers-color-scheme: light)')
        .addEventListener('change', () => {
            if (app.state.lightMode === 'system') applyLightMode('system');
        });
}
