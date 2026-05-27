// auth.js
// Firebase auth, user data, and reading-position persistence for BibleApp.

import { loadUserData as loadUserDataFromFirebase } from './config/firebase-config.js';

function lsSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
}

function lsSetJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
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
                targetScrollY = pos.scrollY || 0;
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
    } else if (targetScrollY) {
        window.scrollTo(0, targetScrollY);
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
                app.lastScrollPosition = pos.scrollY || 0;
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
        scrollY: window.scrollY || 0,
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
        let colorTheme = app.state?.colorTheme || 'dracula';

        try { colorTheme = app.state?.colorTheme || localStorage.getItem('colorTheme') || 'dracula'; } catch (_) {}
        const themeNameMap = {
            dracula: isLight ? 'Alucard (Light)' : 'Dracula (Dark)',
            steel:   `Steel (${isLight ? 'Light' : 'Dark'})`,
            onyx:    `Onyx (${isLight ? 'Light' : 'Dark'})`,
            reader:  `Reader (${isLight ? 'Parchment' : 'Night'})`,
        };
        document.getElementById('userTheme').textContent =
            themeNameMap[colorTheme] || (isLight ? 'Alucard (Light)' : 'Dracula (Dark)');
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
            lightMode: app.state.lightMode,
            translation: app.state.translation || 'ESV',
        });

        app.showToast('Account created successfully!');
        app.closeModal(app.signupModal);
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
    app.state.lightMode            = s.lightMode;
    app.state.translation          = normalizeTranslation(s.translation || 'ESV');

    if (s.fontSize            != null) lsSet('fontSize',             s.fontSize);
    if (s.showVerseNumbers    != null) lsSet('showVerseNumbers',     s.showVerseNumbers);
    if (s.showHeadings        != null) lsSet('showHeadings',         s.showHeadings);
    if (s.showFootnotes       != null) lsSet('showFootnotes',        s.showFootnotes);
    if (s.showCrossReferences != null) lsSet('showCrossReferences',  s.showCrossReferences);
    if (s.verseByVerse        != null) lsSet('verseByVerse',         s.verseByVerse);
    if (s.colorTheme          != null) lsSet('colorTheme',           s.colorTheme);
    if (s.lightMode           != null) lsSet('lightMode',            s.lightMode);
    if (s.translation         != null) lsSet('translation',          normalizeTranslation(s.translation || 'ESV'));
}
