// auth.js
// Firebase auth, user data, and reading-position persistence for BibleApp.

import { loadUserData as loadUserDataFromFirebase } from './config/firebase-config.js';

const MIN_RESTORED_SCROLL_Y = 96;

function lsSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
}

function lsSetJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function normalizeSavedScrollY(value) {
    const scrollY = parseInt(value, 10) || 0;
    return scrollY >= MIN_RESTORED_SCROLL_Y ? scrollY : 0;
}

export async function loadSavedPositionIfChanged(app, withTimeout) {
    if (!app.currentUser || !app.database) return;

    let targetBook = app.state.currentBook;
    let targetChapter = app.state.currentChapter;
    let targetScrollY = 0;

    try {
        const snapshot = await withTimeout(
            app.database.ref(`users/${app.currentUser.uid}/readingPosition`).once('value'),
            5000
        );

        if (snapshot) {
            const pos = snapshot.val();
            if (pos && pos.book && pos.chapter) {
                targetBook = pos.book;
                targetChapter = pos.chapter;
                targetScrollY = normalizeSavedScrollY(pos.scrollY);
            }
        } else {
            console.warn('_loadSavedPositionIfChanged: timed out, keeping current passage');
        }
    } catch (err) {
        console.error('_loadSavedPositionIfChanged: Firebase read failed', err);
    }

    if (targetBook !== app.state.currentBook || targetChapter !== app.state.currentChapter) {
        app.state.currentBook = targetBook;
        app.state.currentChapter = targetChapter;
        app.lastScrollPosition = targetScrollY;
        lsSetJSON('readingPosition', { book: targetBook, chapter: targetChapter, scrollY: targetScrollY });
        await app.loadPassage(targetBook, targetChapter, !!targetScrollY);
    }
}

/** @deprecated Use loadSavedPositionIfChanged for the auth flow. */
export async function loadSavedReadingPosition(app, withTimeout) {
    if (!app.currentUser || !app.database) {
        await app.loadPassage(app.state.currentBook, app.state.currentChapter);
        return;
    }

    try {
        const snapshot = await withTimeout(
            app.database.ref(`users/${app.currentUser.uid}/readingPosition`).once('value'),
            5000
        );

        if (snapshot) {
            const pos = snapshot.val();
            if (pos && pos.book && pos.chapter) {
                app.state.currentBook = pos.book;
                app.state.currentChapter = pos.chapter;
                app.lastScrollPosition = normalizeSavedScrollY(pos.scrollY);
            }
        } else {
            console.warn('loadSavedReadingPosition: timed out, loading from local state');
        }
    } catch (err) {
        console.error('loadSavedReadingPosition: failed to read Firebase', err);
    }

    await app.loadPassage(app.state.currentBook, app.state.currentChapter, !!app.lastScrollPosition);
}

export function saveReadingPosition(app) {
    const pos = {
        book:    app.state.currentBook,
        chapter: app.state.currentChapter,
        scrollY: normalizeSavedScrollY(window.scrollY),
    };

    // Always write locally — this is what _restorePassageCache matches against
    // on the next cold load. Without this, signed-in users always get a cache
    // miss because their localStorage position is stale.
    lsSetJSON('readingPosition', pos);

    if (app.currentUser && app.database) {
        app.database
            .ref(`users/${app.currentUser.uid}/readingPosition`)
            .set(pos)
            .catch((err) => console.error('saveReadingPosition: Firebase write failed', err));
    }
}

export function checkApiKey(app) {
    setTimeout(() => {
        app.showToast('Sign in to sync your reading position across devices.');
    }, 500);
}

export function handleUserButtonClick(app) {
    if (app.currentUser) {
        document.getElementById('userEmail').textContent = app.currentUser.email;
        const isLight = document.body.classList.contains('light-mode');
        let colorTheme = app.state?.colorTheme || '';

        try { colorTheme = app.state?.colorTheme || localStorage.getItem('colorTheme') || ''; } catch (_) {}
        const themeNameMap = {
            dracula:    'Dracula (Purple/Pink)',
            onyx:       'Onyx (Gold/OLED)',
            sage:       'Sage (Green/Forest)',
            ember:      'Ember (Amber/Candlelit)',
            perplexity: 'Perplexity (Teal/Minimal)',
            basic:      'Basic (Black & White)',
            geek:       'The Geek Shall Inherit The Earth',
            gnome:      'GNOME 3 (Adwaita)',
        };
        document.getElementById('userTheme').textContent =
            themeNameMap[colorTheme] || colorTheme;
        app.openModal(app.userMenuModal);
    } else {
        app.openModal(app.loginModal);
    }
}

export async function handleLogin(app) {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        app.showToast('Please enter valid credentials');
        return;
    }

    try {
        await app.auth.signInWithEmailAndPassword(email, password);
        app.showToast('Signed in successfully!');
        app.closeModal(app.loginModal);
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            if (confirm('No account found with this email. Sign up instead?')) {
                app.closeModal(app.loginModal);
                app.openModal(app.signupModal);
                document.getElementById('signupEmail').value = email;
            }
        } else if (error.code === 'auth/wrong-password') {
            app.showToast('Incorrect password');
        } else {
            app.showToast(`Login failed: ${error.message}`);
        }
    }
}

export async function handleSignup(app) {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!email || !password) {
        app.showToast('Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        app.showToast('Password must be at least 6 characters');
        return;
    }

    try {
        const userCredential = await app.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await app.database.ref(`users/${user.uid}/settings`).set({
            fontSize: app.state.fontSize,
            showVerseNumbers: app.state.showVerseNumbers,
            showHeadings: app.state.showHeadings,
            showFootnotes: app.state.showFootnotes,
            showCrossReferences: app.state.showCrossReferences,
            verseByVerse: app.state.verseByVerse,
            colorTheme: app.state.colorTheme,
            lightMode: app.state.lightMode ?? 'system',
            translation: app.state.translation || 'ESV',
        });

        app.showToast('Account created successfully!');
        app.closeModal(app.loginModal);
    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 'auth/email-already-in-use') {
            app.showToast('An account with this email already exists');
        } else {
            app.showToast(`Signup failed: ${error.message}`);
        }
    }
}

export async function handleLogout(app) {
    try {
        await app.auth.signOut();
        app.showToast('Signed out successfully');
        app.closeModal(app.userMenuModal);
    } catch (error) {
        console.error('Logout error:', error);
        app.showToast('Failed to sign out');
    }
}

export async function loadUserData(app, normalizeTranslation) {
    if (!app.currentUser) return;
    const data = await loadUserDataFromFirebase(app.currentUser.uid);
    if (!data) return;
    const s = data.settings;

    app.state.fontSize             = s.fontSize;
    app.state.showVerseNumbers     = s.showVerseNumbers;
    app.state.showHeadings         = s.showHeadings;
    app.state.showFootnotes        = s.showFootnotes;
    app.state.showCrossReferences  = s.showCrossReferences;
    app.state.verseByVerse         = s.verseByVerse;
    app.state.colorTheme           = s.colorTheme;
    // Migrate old boolean values from Firebase to string enum
    app.state.lightMode =
        s.lightMode === 'light' || s.lightMode === 'dark' || s.lightMode === 'system'
            ? s.lightMode
            : s.lightMode === true ? 'light'
            : s.lightMode === false ? 'dark'
            : 'system';
    app.state.translation          = normalizeTranslation(s.translation || 'ESV');

    if (s.fontSize            != null) lsSet('fontSize',             s.fontSize);
    if (s.showVerseNumbers    != null) lsSet('showVerseNumbers',     s.showVerseNumbers);
    if (s.showHeadings        != null) lsSet('showHeadings',         s.showHeadings);
    if (s.showFootnotes       != null) lsSet('showFootnotes',        s.showFootnotes);
    if (s.showCrossReferences != null) lsSet('showCrossReferences',  s.showCrossReferences);
    if (s.verseByVerse        != null) lsSet('verseByVerse',         s.verseByVerse);
    if (s.colorTheme          != null) lsSet('colorTheme',           s.colorTheme);
    if (s.lightMode           != null) lsSet('lightMode',            app.state.lightMode);
    if (s.translation         != null) lsSet('translation',          normalizeTranslation(s.translation || 'ESV'));
}

export async function handleChangeEmail(app) {
    const currentPassword = document.getElementById('changeEmailCurrent').value;
    const newEmail = document.getElementById('changeEmailNew').value;

    if (!currentPassword || !newEmail) {
        app.showToast('Please fill in all fields');
        return;
    }

    try {
        const credential = app.auth.createCredential(app.currentUser.email, currentPassword);
        await app.auth.reauthenticateWithCredential(app.currentUser, credential);
        await app.auth.verifyBeforeUpdateEmail(app.currentUser, newEmail);
        app.showToast('Verification sent — check your inbox to confirm the new email');
        // modal teardown and field clearing handled by credential-modals.js
        document.getElementById('userEmail').textContent = newEmail;
    } catch (err) {
        if (err.code === 'auth/wrong-password') {
            app.showToast('Current password is incorrect');
        } else if (err.code === 'auth/email-already-in-use') {
            app.showToast('That email is already in use');
        } else if (err.code === 'auth/invalid-email') {
            app.showToast('Invalid email address');
        } else {
            app.showToast(`Failed: ${err.message}`);
        }
    }
}

export async function handleChangePassword(app) {
    const currentPassword = document.getElementById('changePasswordCurrent').value;
    const newPassword = document.getElementById('changePasswordNew').value;

    if (!currentPassword || !newPassword) {
        app.showToast('Please fill in all fields');
        return;
    }

    if (newPassword.length < 6) {
        app.showToast('New password must be at least 6 characters');
        return;
    }

    try {
        const credential = app.auth.createCredential(app.currentUser.email, currentPassword);
        await app.auth.reauthenticateWithCredential(app.currentUser, credential);
        await app.auth.updatePassword(app.currentUser, newPassword);
        app.showToast('Password updated successfully');
        // modal teardown and field clearing handled by credential-modals.js
    } catch (err) {
        if (err.code === 'auth/wrong-password') {
            app.showToast('Current password is incorrect');
        } else {
            app.showToast(`Failed: ${err.message}`);
        }
    }
}

export async function handleForgotPassword(app) {
    const email = document.getElementById('forgotPasswordEmail').value.trim();

    if (!email) {
        app.showToast('Please enter your email address');
        return;
    }

    try {
        await app.auth.sendPasswordResetEmail(email);
        app.showToast('Reset link sent — check your inbox');
        app.closeModal(document.getElementById('forgotPasswordModal'));
        document.getElementById('forgotPasswordEmail').value = '';
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            app.showToast('No account found with that email');
        } else if (err.code === 'auth/invalid-email') {
            app.showToast('Invalid email address');
        } else {
            app.showToast(`Failed: ${err.message}`);
        }
    }
}