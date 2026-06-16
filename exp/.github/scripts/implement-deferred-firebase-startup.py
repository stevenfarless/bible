#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def path_for(relative: str) -> Path:
    return ROOT / relative


def read(relative: str) -> str:
    return path_for(relative).read_text(encoding="utf-8")


def write(relative: str, text: str) -> None:
    path_for(relative).write_text(text, encoding="utf-8")


def replace_once(relative: str, old: str, new: str) -> None:
    text = read(relative)
    if new in text:
        print(f"Already applied: {relative}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected one replacement anchor in {relative}, found {count}: {old[:140]!r}"
        )
    write(relative, text.replace(old, new, 1))


def replace_count(relative: str, old: str, new: str, expected: int) -> None:
    text = read(relative)
    if old not in text:
        if text.count(new) >= expected:
            print(f"Already applied: {relative}")
            return
        raise SystemExit(f"Replacement anchor missing in {relative}: {old!r}")
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f"Expected {expected} replacement anchors in {relative}, found {count}: {old!r}"
        )
    write(relative, text.replace(old, new))


def replace_region(
    relative: str,
    start_marker: str,
    end_marker: str,
    replacement: str,
    sentinel: str,
) -> None:
    text = read(relative)
    start = text.find(start_marker)
    if start < 0:
        if sentinel in text:
            print(f"Already replaced region: {relative}")
            return
        raise SystemExit(f"Start marker not found in {relative}: {start_marker!r}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"End marker not found in {relative}: {end_marker!r}")
    write(relative, text[:start] + replacement + text[end:])


def insert_before_once(relative: str, marker: str, content: str, sentinel: str) -> None:
    text = read(relative)
    if sentinel in text:
        print(f"Already inserted: {relative}")
        return
    count = text.count(marker)
    if count != 1:
        raise SystemExit(
            f"Expected one insertion marker in {relative}, found {count}: {marker!r}"
        )
    write(relative, text.replace(marker, content + marker, 1))


def append_once(relative: str, content: str, sentinel: str) -> None:
    text = read(relative)
    if sentinel in text:
        print(f"Already appended: {relative}")
        return
    write(relative, text.rstrip() + "\n\n" + content.rstrip() + "\n")


FIREBASE_CONFIG = r"""// Firebase configuration and lazy initialization.
// Auth loads only after the reader is visible. App Check and Database load only
// for authenticated synchronization or an explicit account operation.

import {
    getApp,
    getApps,
    initializeApp,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
    EmailAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    indexedDBLocalPersistence,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    verifyBeforeUpdateEmail,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "__FIREBASE_API_KEY__",
    authDomain: "esv-bible-6dffb.firebaseapp.com",
    databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
    projectId: "esv-bible-6dffb",
    storageBucket: "esv-bible-6dffb.firebasestorage.app",
    messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
    appId: "__FIREBASE_APP_ID__",
};

export const FIREBASE_DB_URL = firebaseConfig.databaseURL;

let firebaseApp = null;
let authInitializationPromise = null;
let appCheckInitializationPromise = null;
let databaseInitializationPromise = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    firebaseApp = getApps().length > 0
        ? getApp()
        : initializeApp(firebaseConfig);

    return firebaseApp;
}

export function initializeFirebaseAuth() {
    if (authInitializationPromise) return authInitializationPromise;

    authInitializationPromise = (async () => {
        const app = getFirebaseApp();
        const auth = getAuth(app);

        const ready = setPersistence(auth, indexedDBLocalPersistence)
            .catch(() => setPersistence(auth, browserLocalPersistence))
            .catch(() => setPersistence(auth, browserSessionPersistence))
            .catch((error) => {
                console.warn('Firebase auth persistence unavailable', error);
            });

        await ready;

        return {
            ready,
            onAuthStateChanged: (callback) =>
                onAuthStateChanged(auth, callback),
            signInWithEmailAndPassword: (email, password) =>
                signInWithEmailAndPassword(auth, email, password),
            createUserWithEmailAndPassword: (email, password) =>
                createUserWithEmailAndPassword(auth, email, password),
            signOut: () => signOut(auth),
            createCredential: (email, password) =>
                EmailAuthProvider.credential(email, password),
            reauthenticateWithCredential: (user, credential) =>
                reauthenticateWithCredential(user, credential),
            verifyBeforeUpdateEmail: (user, email) =>
                verifyBeforeUpdateEmail(user, email),
            updatePassword: (user, password) =>
                updatePassword(user, password),
            sendPasswordResetEmail: (email) =>
                sendPasswordResetEmail(auth, email),
            get currentUser() {
                return auth.currentUser;
            },
        };
    })();

    return authInitializationPromise;
}

function initializeFirebaseAppCheck(app) {
    if (appCheckInitializationPromise) return appCheckInitializationPromise;

    appCheckInitializationPromise = import(
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js'
    ).then(({ initializeAppCheck, ReCaptchaV3Provider }) => (
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(
                '6Lf8bAAtAAAAALvK77sjk7750S7XVUQR7Ai2cXXV'
            ),
            isTokenAutoRefreshEnabled: true,
        })
    ));

    return appCheckInitializationPromise;
}

export function initializeFirebaseDatabase() {
    if (databaseInitializationPromise) return databaseInitializationPromise;

    databaseInitializationPromise = (async () => {
        const app = getFirebaseApp();

        await initializeFirebaseAppCheck(app);

        const {
            get,
            getDatabase,
            onValue,
            ref,
            set,
        } = await import(
            'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js'
        );

        const database = getDatabase(app);

        function makeRef(path) {
            const databaseRef = ref(database, path);

            return {
                once: () => get(databaseRef),
                set: (value) => set(databaseRef, value),
                ref: (subpath) =>
                    makeRef(path ? `${path}/${subpath}` : subpath),
            };
        }

        return {
            ref: (path) => makeRef(path),
            onConnected: (callback) => onValue(
                ref(database, '.info/connected'),
                (snapshot) => callback(Boolean(snapshot.val()))
            ),
        };
    })();

    return databaseInitializationPromise;
}
"""

AUTH_LOAD_POSITION = r"""export async function loadSavedPositionIfChanged(app, withTimeout) {
    if (!app.currentUser || !app.database) return;

    if (app.hasLocalPositionChangedSinceAuthStart()) {
        app._dbgEvent(
            'auth restoration: skipped stale remote position after local interaction'
        );
        return;
    }

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

    if (app.hasLocalPositionChangedSinceAuthStart()) {
        app._dbgEvent(
            'auth restoration: skipped remote position changed during Firebase read'
        );
        return;
    }

    if (targetBook !== app.state.currentBook || targetChapter !== app.state.currentChapter) {
        app._applyingRemoteState = true;
        try {
            app.state.currentBook = targetBook;
            app.state.currentChapter = targetChapter;
            app.lastScrollPosition = targetScrollY;
            lsSetJSON('readingPosition', {
                book: targetBook,
                chapter: targetChapter,
                scrollY: targetScrollY,
            });
            await app.loadPassage(targetBook, targetChapter, Boolean(targetScrollY));
        } finally {
            app._applyingRemoteState = false;
        }
    } else if (targetScrollY) {
        app._applyingRemoteState = true;
        try {
            window.scrollTo(0, targetScrollY);
        } finally {
            app._applyingRemoteState = false;
        }
    }
}

"""

AUTH_LOGIN = r"""export async function handleLogin(app) {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        app.showToast('Please enter valid credentials');
        return;
    }

    try {
        app.prepareInteractiveAuthRestore();
        await app.ensureInteractiveAuth();
        await app.auth.signInWithEmailAndPassword(email, password);
        app.showToast('Signed in successfully!');
        app.closeModal(app.loginModal);
        app.maybeShowTranslationSyncModal();
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        app.cancelInteractiveAuthRestore();
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

"""

AUTH_SIGNUP = r"""export async function handleSignup(app) {
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
        app.prepareInteractiveAuthRestore();
        await app.ensureInteractiveAuth();
        const userCredential =
            await app.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await app.ensureInteractiveDatabase();
        await app.database.ref(`users/${user.uid}/settings`).set({
            fontSize: app.state.fontSize,
            showVerseNumbers: app.state.showVerseNumbers,
            coloredVerseNumbers: app.state.coloredVerseNumbers,
            showHeadings: app.state.showHeadings,
            showFootnotes: app.state.showFootnotes,
            showCrossReferences: app.state.showCrossReferences,
            verseByVerse: app.state.verseByVerse,
            showChapterArrows: app.state.showChapterArrows,
            hapticsEnabled: app.state.hapticsEnabled,
            colorTheme: app.state.colorTheme,
            lightMode: app.state.lightMode ?? 'system',
            translation: app.preferredTranslation || app.state.translation || 'KJV',
            readingFont: app.state.readingFont,
            verseSelectionGesture: app.state.verseSelectionGesture,
        });

        app.showToast('Account created successfully!');
        app.closeModal(app.signupModal);
    } catch (error) {
        app.cancelInteractiveAuthRestore();
        console.error('Signup error:', error);
        if (error.code === 'auth/email-already-in-use') {
            app.showToast('An account with this email already exists');
        } else {
            app.showToast(`Signup failed: ${error.message}`);
        }
    }
}

"""

AUTH_LOAD_USER = r"""export async function loadUserData(app, normalizeTranslation, withTimeout) {
    if (!app.currentUser || !app.database) return;

    let data;
    try {
        const snapshot = await withTimeout(
            app.database
                .ref(`users/${app.currentUser.uid}`)
                .once('value'),
            5000
        );
        if (!snapshot) {
            console.warn('loadUserData: timed out, keeping local settings');
            return;
        }
        data = snapshot.val();
    } catch (error) {
        console.error('loadUserData error:', error);
        return;
    }

    const settings = data?.settings;
    if (!settings) return;

    const applySetting = (key, value, storageKey = key) => {
        if (value == null || app.hasLocalSettingChangedSinceAuthStart(key)) {
            return;
        }

        app.state[key] = value;
        lsSet(storageKey, value);
    };

    applySetting('fontSize', settings.fontSize);
    applySetting('showVerseNumbers', settings.showVerseNumbers);
    applySetting('coloredVerseNumbers', settings.coloredVerseNumbers);
    applySetting('showHeadings', settings.showHeadings);
    applySetting('showFootnotes', settings.showFootnotes);
    applySetting('showCrossReferences', settings.showCrossReferences);
    applySetting('verseByVerse', settings.verseByVerse);
    applySetting('showChapterArrows', settings.showChapterArrows);
    applySetting('hapticsEnabled', settings.hapticsEnabled);
    applySetting('colorTheme', settings.colorTheme);
    applySetting('readingFont', settings.readingFont);
    applySetting('verseSelectionGesture', settings.verseSelectionGesture);

    if (
        settings.lightMode != null &&
        !app.hasLocalSettingChangedSinceAuthStart('lightMode')
    ) {
        app.state.lightMode =
            settings.lightMode === 'light' ||
            settings.lightMode === 'dark' ||
            settings.lightMode === 'system'
                ? settings.lightMode
                : settings.lightMode === true
                    ? 'light'
                    : settings.lightMode === false
                        ? 'dark'
                        : 'system';
        lsSet('lightMode', app.state.lightMode);
    }

    if (
        settings.translation != null &&
        !app.hasLocalSettingChangedSinceAuthStart('translation')
    ) {
        app.preferredTranslation = normalizeTranslation(
            settings.translation || app.preferredTranslation || 'KJV'
        );
        lsSet('preferredTranslation', app.preferredTranslation);
    }
}

"""

AUTH_FORGOT = r"""export async function handleForgotPassword(app) {
    const email = document.getElementById('forgotPasswordEmail').value.trim();

    if (!email) {
        app.showToast('Please enter your email address');
        return;
    }

    try {
        await app.ensureInteractiveAuth();
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
"""

APP_LAZY_METHODS = r"""    _firebaseModuleUrl() {
        const buildId =
            document.querySelector('meta[name="build-id"]')?.content || '';
        const hasInjectedBuildId =
            buildId && !buildId.startsWith('__BUILD_');

        return hasInjectedBuildId
            ? `./config/firebase-config.bundle.js?v=${encodeURIComponent(buildId)}`
            : './config/firebase-config.bundle.js';
    }

    _captureAuthRestoreBaseline() {
        this._authRestoreBaseline = {
            position: {
                book: this.state.currentBook,
                chapter: this.state.currentChapter,
                scrollY: this.lastScrollPosition || window.scrollY || 0,
            },
            settings: {
                fontSize: this.state.fontSize,
                showVerseNumbers: this.state.showVerseNumbers,
                coloredVerseNumbers: this.state.coloredVerseNumbers,
                showHeadings: this.state.showHeadings,
                showFootnotes: this.state.showFootnotes,
                showCrossReferences: this.state.showCrossReferences,
                verseByVerse: this.state.verseByVerse,
                showChapterArrows: this.state.showChapterArrows,
                hapticsEnabled: this.state.hapticsEnabled,
                lightMode: this.state.lightMode,
                colorTheme: this.state.colorTheme,
                translation: this.preferredTranslation,
                readingFont: this.state.readingFont,
                verseSelectionGesture: this.state.verseSelectionGesture,
            },
        };
        this._authRestoreInteraction.position = false;
        this._authRestoreInteraction.settings.clear();
        this._dbgEvent('auth restoration: local baseline captured');
    }

    _installAuthRestoreInteractionTracking() {
        if (this._authRestoreInteractionTrackingInstalled) return;
        this._authRestoreInteractionTrackingInstalled = true;

        const markPositionInteraction = (event) => {
            if (!event.isTrusted || this._applyingRemoteState) return;
            if (this.authStateResolved && !this._authRestorationActive) return;

            this._authRestoreInteraction.position = true;
        };

        document.addEventListener(
            'pointerdown',
            markPositionInteraction,
            { capture: true, passive: true }
        );
        window.addEventListener(
            'wheel',
            markPositionInteraction,
            { passive: true }
        );
        window.addEventListener(
            'touchmove',
            markPositionInteraction,
            { passive: true }
        );
        document.addEventListener('keydown', (event) => {
            if (
                event.isTrusted &&
                ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
            ) {
                markPositionInteraction(event);
            }
        }, true);
    }

    markLocalSettingInteraction(key) {
        if (!key) return;
        this._authRestoreInteraction.settings.add(key);
    }

    hasLocalPositionChangedSinceAuthStart() {
        const baseline = this._authRestoreBaseline?.position;
        if (!baseline) return false;

        return (
            this._authRestoreInteraction.position ||
            this.state.currentBook !== baseline.book ||
            this.state.currentChapter !== baseline.chapter
        );
    }

    hasLocalSettingChangedSinceAuthStart(key) {
        const baseline = this._authRestoreBaseline?.settings;
        if (!baseline || !(key in baseline)) return false;
        if (this._authRestoreInteraction.settings.has(key)) return true;

        const current = key === 'translation'
            ? this.preferredTranslation
            : this.state[key];

        return current !== baseline[key];
    }

    canWriteRemoteState() {
        return Boolean(
            this.currentUser &&
            this.database &&
            this._syncWritesEnabled
        );
    }

    async _flushLocalChangesAfterAuthRestore() {
        if (!this.currentUser || !this.database) return;

        const settings = this._authRestoreBaseline?.settings || {};
        const writes = [];
        const valueFor = (key) => (
            key === 'translation'
                ? this.preferredTranslation
                : this.state[key]
        );

        for (const key of Object.keys(settings)) {
            if (!this.hasLocalSettingChangedSinceAuthStart(key)) continue;

            writes.push(
                this.database
                    .ref(`users/${this.currentUser.uid}/settings/${key}`)
                    .set(valueFor(key))
            );
        }

        if (writes.length > 0) {
            await Promise.all(writes);
            this._dbgEvent(
                `auth restoration: flushed ${writes.length} newer local setting(s)`
            );
        }

        if (this.hasLocalPositionChangedSinceAuthStart()) {
            this.saveReadingPosition();
            this._dbgEvent(
                'auth restoration: flushed newer local reading position'
            );
        }
    }

    async _loadFirebaseModule(reason) {
        if (!this._firebaseModulePromise) {
            this._dbg.t_firebase_module_start = ms();
            this._dbgEvent(`firebase module: load started (${reason})`);

            const moduleUrl = this._firebaseModuleUrl();
            this._firebaseModulePromise = import(moduleUrl)
                .then((module) => {
                    this._dbg.t_firebase_module_end = ms();
                    this._dbgEvent(
                        `firebase module: load completed (${reason})`
                    );
                    return module;
                })
                .catch((error) => {
                    this._dbg.t_firebase_module_end = ms();
                    this._dbgEvent(
                        `firebase module: load failed (${reason}) — ${error.message}`
                    );
                    throw error;
                });
        }

        return this._firebaseModulePromise;
    }

    async _ensureFirebaseAuth(reason) {
        if (!this._authInitializationPromise) {
            this._dbg.t_auth_init_start = ms();
            this._dbgEvent(`auth initialization: started (${reason})`);

            this._authInitializationPromise = this
                ._loadFirebaseModule(reason)
                .then((module) => module.initializeFirebaseAuth())
                .then((auth) => {
                    this.auth = auth;
                    this.authAvailable = true;
                    this._dbg.t_auth_init_end = ms();
                    this._dbgEvent(
                        `auth initialization: completed (${reason})`
                    );
                    return auth;
                })
                .catch((error) => {
                    this.authAvailable = false;
                    this._dbg.t_auth_init_end = ms();
                    this._dbgEvent(
                        `auth initialization: failed (${reason}) — ${error.message}`
                    );
                    throw error;
                });
        }

        return this._authInitializationPromise;
    }

    async _ensureFirebaseDatabase(reason) {
        if (!this._databaseInitializationPromise) {
            this._dbg.t_database_init_start = ms();
            this._dbgEvent(
                `database/App Check initialization: started (${reason})`
            );

            this._databaseInitializationPromise = this
                ._loadFirebaseModule(reason)
                .then((module) => module.initializeFirebaseDatabase())
                .then((database) => {
                    this.database = database;
                    this._dbg.t_database_init_end = ms();
                    this._dbgEvent(
                        `database/App Check initialization: completed (${reason})`
                    );

                    if (
                        !this._firebaseConnectedUnsubscribe &&
                        database.onConnected
                    ) {
                        this._firebaseConnectedUnsubscribe =
                            database.onConnected((connected) => {
                                this._dbg.firebaseConnected = connected;
                                this._dbgEvent(
                                    `firebase: ${
                                        connected
                                            ? 'connected'
                                            : 'disconnected'
                                    }`
                                );
                            });
                    }

                    return database;
                })
                .catch((error) => {
                    this._dbg.t_database_init_end = ms();
                    this._dbgEvent(
                        `database/App Check initialization: failed (${reason}) — ${error.message}`
                    );
                    throw error;
                });
        }

        return this._databaseInitializationPromise;
    }

    _attachAuthObserver(auth) {
        if (this._authObserverAttached) return;
        this._authObserverAttached = true;

        auth.onAuthStateChanged((user) => {
            void this._handleAuthStateChanged(user);
        });
    }

    async _handleAuthStateChanged(user) {
        this._dbg.t_auth_state = ms();
        this.authStateResolved = true;

        if (!user) {
            this._authRestorationActive = false;
            this._syncWritesEnabled = false;
            this.currentUser = null;
            this._dbg.authStateUser = 'signed out';
            this._dbgEvent('auth restoration: signed out');
            this._dbgEvent(
                'database/App Check skipped for signed-out session'
            );
            this.hideSyncPrompt();

            if (this.settingsModal?.classList.contains('active')) {
                const promptShown = this.maybeShowSyncPrompt();
                if (promptShown) {
                    const settingsBody =
                        this.settingsModal.querySelector('.modal-body');
                    if (settingsBody) settingsBody.scrollTop = 0;
                }
            }

            try {
                await this.loadSyncedTranslationLibrary();
                this.maybeShowTranslationSyncModal();
            } catch (error) {
                console.warn(
                    'Signed-out translation preparation failed',
                    error
                );
                this._dbgEvent(
                    `auth restoration: signed-out preparation failed — ${error.message}`
                );
            }
            return;
        }

        this._authRestorationActive = true;
        this._syncWritesEnabled = false;
        this.currentUser = user;
        this._dbg.authStateUser = user.email;
        this._dbgEvent(`auth restoration: signed in as ${user.email}`);
        this.completeSyncPrompt();

        try {
            await this._ensureFirebaseDatabase(
                'authenticated restoration'
            );

            const translationBefore = this.state.translation;
            await this.loadUserData();
            const translationSyncResult =
                await this.loadSyncedTranslationLibrary();

            this._dbg.t_user_data_loaded = ms();
            this.applySettings();

            const bookBefore = this.state.currentBook;
            const chapterBefore = this.state.currentChapter;
            await this._loadSavedPositionIfChanged();

            const positionChanged =
                this.state.currentBook !== bookBefore ||
                this.state.currentChapter !== chapterBefore;

            if (
                translationSyncResult.activeTranslationChanged &&
                !positionChanged &&
                this.state.translation !== translationBefore
            ) {
                this._applyingRemoteState = true;
                try {
                    await this.loadPassage(
                        this.state.currentBook,
                        this.state.currentChapter,
                        Boolean(this.lastScrollPosition)
                    );
                } finally {
                    this._applyingRemoteState = false;
                }
            }

            this._syncWritesEnabled = true;
            try {
                await this._flushLocalChangesAfterAuthRestore();
            } catch (error) {
                console.error(
                    'Failed to flush reconciled local state',
                    error
                );
                this._dbgEvent(
                    `auth restoration: local flush failed — ${error.message}`
                );
            }

            this.maybeShowTranslationSyncModal();
            this._dbg.t_firebase_position_end = ms();
            this._dbg.firebasePositionChanged = positionChanged;
        } catch (error) {
            this._syncWritesEnabled = false;
            console.error('Authenticated restoration failed', error);
            this._dbgEvent(
                `auth restoration: sync unavailable — ${error.message}`
            );
        } finally {
            this._authRestorationActive = false;
        }
    }

    async _restoreAuthSession() {
        if (this._authRestorationPromise) {
            return this._authRestorationPromise;
        }

        this._dbg.t_auth_restore_start = ms();
        this._dbgEvent('auth restoration: started in background');

        this._authRestorationPromise = (async () => {
            try {
                const auth = await this._ensureFirebaseAuth(
                    'background restoration'
                );
                await auth.ready;
                this._attachAuthObserver(auth);
            } catch (error) {
                this.authAvailable = false;
                this.authStateResolved = true;
                this.currentUser = null;
                this._authRestorationActive = false;
                console.warn(
                    'Background authentication unavailable:',
                    error
                );
                this._dbgEvent(
                    `auth restoration: failed without blocking reading — ${error.message}`
                );
            }
        })();

        return this._authRestorationPromise;
    }

    _startBackgroundAuthRestoration() {
        if (this._authRestorationScheduled) return;

        this._authRestorationScheduled = true;
        this._dbg.t_auth_restore_scheduled = ms();
        this._dbgEvent(
            'auth restoration: scheduled after reader reveal'
        );

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    void this._restoreAuthSession();
                }, 0);
            });
        });
    }

    prepareInteractiveAuthRestore() {
        this._captureAuthRestoreBaseline();
        this._authRestorationActive = true;
        this._syncWritesEnabled = false;
        this._dbgEvent(
            'interactive auth: reconciliation baseline refreshed'
        );
    }

    cancelInteractiveAuthRestore() {
        this._authRestorationActive = false;
    }

    async ensureInteractiveAuth() {
        this._dbg.t_interactive_auth_start = ms();
        this._dbgEvent('interactive auth initialization: started');

        try {
            const auth = await this._ensureFirebaseAuth(
                'interactive account action'
            );
            this._attachAuthObserver(auth);
            this._dbg.t_interactive_auth_end = ms();
            this._dbgEvent(
                'interactive auth initialization: completed'
            );
            return auth;
        } catch (error) {
            this._dbg.t_interactive_auth_end = ms();
            this._dbgEvent(
                `interactive auth initialization: failed — ${error.message}`
            );
            throw new Error(
                'Account services could not be loaded. Check your connection and reload the app.',
                { cause: error }
            );
        }
    }

    async ensureInteractiveDatabase() {
        this._dbg.t_interactive_database_start = ms();
        this._dbgEvent(
            'interactive database/App Check initialization: started'
        );

        try {
            const database = await this._ensureFirebaseDatabase(
                'interactive account action'
            );
            this._dbg.t_interactive_database_end = ms();
            this._dbgEvent(
                'interactive database/App Check initialization: completed'
            );
            return database;
        } catch (error) {
            this._dbg.t_interactive_database_end = ms();
            this._dbgEvent(
                `interactive database/App Check initialization: failed — ${error.message}`
            );
            throw new Error(
                'Synchronization services could not be loaded. Check your connection and try again.',
                { cause: error }
            );
        }
    }

    async ensureInteractiveFirebase() {
        await this.ensureInteractiveAuth();
        await this.ensureInteractiveDatabase();
    }

"""

SMOKE_TESTS = r"""test('startup: anonymous reading survives Firebase bundle failure', async ({ page }) => {
        const errors = collectPageErrors(page);
        await page.route('**/config/firebase-config.bundle.js*', route => route.abort());

        await page.goto('/');
        await waitForPassage(page);
        await page.waitForFunction(
                () => window._bibleApp?.authStateResolved === true,
                null,
                { timeout: 10000 }
        );

        await page.locator('#nextChapter').click();
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');
        expect(errors).toHaveLength(0);
        expect(await page.evaluate(() => window._bibleApp.authAvailable)).toBe(false);
});

test('startup: signed-out reading does not request reCAPTCHA or Database', async ({ page }) => {
        const recaptchaRequests = [];
        page.on('request', request => {
                if (/recaptcha|api2\/anchor|api2\/reload/i.test(request.url())) {
                        recaptchaRequests.push(request.url());
                }
        });

        await page.route('**/config/firebase-config.bundle.js*', route => route.fulfill({
                contentType: 'text/javascript',
                body: `
                        window.__firebaseTest = { authCalls: 0, databaseCalls: 0 };
                        let authPromise;
                        export function initializeFirebaseAuth() {
                                window.__firebaseTest.authCalls += 1;
                                if (!authPromise) {
                                        authPromise = Promise.resolve({
                                                ready: Promise.resolve(),
                                                onAuthStateChanged(callback) {
                                                        setTimeout(() => callback(null), 0);
                                                },
                                                signInWithEmailAndPassword() {},
                                                createUserWithEmailAndPassword() {},
                                                signOut() {},
                                                sendPasswordResetEmail() {},
                                        });
                                }
                                return authPromise;
                        }
                        export function initializeFirebaseDatabase() {
                                window.__firebaseTest.databaseCalls += 1;
                                throw new Error('Database must remain unloaded');
                        }
                `,
        }));

        await page.goto('/');
        await waitForPassage(page);
        await waitForAuthState(page);

        expect(await page.evaluate(() => window.__firebaseTest)).toEqual({
                authCalls: 1,
                databaseCalls: 0,
        });
        expect(recaptchaRequests).toHaveLength(0);
});

test('startup: Firebase initialization is idempotent', async ({ page }) => {
        await page.route('**/config/firebase-config.bundle.js*', route => route.fulfill({
                contentType: 'text/javascript',
                body: `
                        window.__firebaseTest = { authCalls: 0, databaseCalls: 0 };
                        export async function initializeFirebaseAuth() {
                                window.__firebaseTest.authCalls += 1;
                                return {
                                        ready: Promise.resolve(),
                                        onAuthStateChanged(callback) {
                                                setTimeout(() => callback(null), 0);
                                        },
                                        signInWithEmailAndPassword() {},
                                        createUserWithEmailAndPassword() {},
                                        signOut() {},
                                        sendPasswordResetEmail() {},
                                };
                        }
                        export async function initializeFirebaseDatabase() {
                                window.__firebaseTest.databaseCalls += 1;
                                return {
                                        ref() {
                                                return {
                                                        once: async () => ({ val: () => null }),
                                                        set: async () => {},
                                                };
                                        },
                                        onConnected() {
                                                return () => {};
                                        },
                                };
                        }
                `,
        }));

        await page.goto('/');
        await waitForPassage(page);
        await waitForAuthState(page);

        await page.evaluate(async () => {
                await Promise.all([
                        window._bibleApp.ensureInteractiveFirebase(),
                        window._bibleApp.ensureInteractiveFirebase(),
                        window._bibleApp.ensureInteractiveFirebase(),
                ]);
        });

        expect(await page.evaluate(() => window.__firebaseTest)).toEqual({
                authCalls: 1,
                databaseCalls: 1,
        });
});

test('startup: existing session restores after passage reveal', async ({ page }) => {
        await page.route('**/config/firebase-config.bundle.js*', route => route.fulfill({
                contentType: 'text/javascript',
                body: `
                        window.__firebaseTest = {
                                sets: [],
                                authDeliveredAt: null,
                        };
                        const user = { uid: 'restored-user', email: 'restored@example.com' };
                        export async function initializeFirebaseAuth() {
                                return {
                                        ready: Promise.resolve(),
                                        onAuthStateChanged(callback) {
                                                setTimeout(() => {
                                                        window.__firebaseTest.authDeliveredAt = performance.now();
                                                        callback(user);
                                                }, 250);
                                        },
                                        signInWithEmailAndPassword() {},
                                        createUserWithEmailAndPassword() {},
                                        signOut() {},
                                        sendPasswordResetEmail() {},
                                };
                        }
                        export async function initializeFirebaseDatabase() {
                                return {
                                        ref(path) {
                                                return {
                                                        async once() {
                                                                if (path.endsWith('/readingPosition')) {
                                                                        return { val: () => ({
                                                                                book: 'Genesis',
                                                                                chapter: 2,
                                                                                scrollY: 0,
                                                                        }) };
                                                                }
                                                                if (path.endsWith('/translationLibrary')) {
                                                                        return { val: () => ({
                                                                                initialized: true,
                                                                                items: {},
                                                                        }) };
                                                                }
                                                                if (path === 'users/restored-user') {
                                                                        return { val: () => ({
                                                                                settings: {
                                                                                        fontSize: 22,
                                                                                        translation: 'KJV',
                                                                                },
                                                                        }) };
                                                                }
                                                                return { val: () => null };
                                                        },
                                                        async set(value) {
                                                                window.__firebaseTest.sets.push({ path, value });
                                                        },
                                                };
                                        },
                                        onConnected(callback) {
                                                callback(true);
                                                return () => {};
                                        },
                                };
                        }
                `,
        }));

        await page.goto('/');
        await waitForPassage(page);
        const revealAt = await page.evaluate(
                () => window._bibleApp._dbg.t_reveal_first ??
                        window._bibleApp._dbg.t_reveal_second
        );

        await page.waitForFunction(
                () => window._bibleApp?.currentUser?.uid === 'restored-user' &&
                        window._bibleApp?.state?.currentChapter === 2 &&
                        window._bibleApp?.state?.fontSize === 22,
                null,
                { timeout: 10000 }
        );

        const authDeliveredAt = await page.evaluate(
                () => window.__firebaseTest.authDeliveredAt
        );
        expect(revealAt).not.toBeNull();
        expect(authDeliveredAt).toBeGreaterThan(revealAt);
});

test('startup: delayed remote state preserves and flushes newer local changes', async ({ page }) => {
        await page.route('**/config/firebase-config.bundle.js*', route => route.fulfill({
                contentType: 'text/javascript',
                body: `
                        window.__firebaseTest = {
                                sets: [],
                                releaseReads: null,
                        };
                        let release;
                        const gate = new Promise(resolve => { release = resolve; });
                        window.__firebaseTest.releaseReads = release;
                        const user = { uid: 'delayed-user', email: 'delayed@example.com' };

                        export async function initializeFirebaseAuth() {
                                return {
                                        ready: Promise.resolve(),
                                        onAuthStateChanged(callback) {
                                                setTimeout(() => callback(user), 0);
                                        },
                                        signInWithEmailAndPassword() {},
                                        createUserWithEmailAndPassword() {},
                                        signOut() {},
                                        sendPasswordResetEmail() {},
                                };
                        }

                        export async function initializeFirebaseDatabase() {
                                return {
                                        ref(path) {
                                                return {
                                                        async once() {
                                                                await gate;
                                                                if (path.endsWith('/readingPosition')) {
                                                                        return { val: () => ({
                                                                                book: 'Genesis',
                                                                                chapter: 1,
                                                                                scrollY: 0,
                                                                        }) };
                                                                }
                                                                if (path.endsWith('/translationLibrary')) {
                                                                        return { val: () => ({
                                                                                initialized: true,
                                                                                items: {},
                                                                        }) };
                                                                }
                                                                if (path === 'users/delayed-user') {
                                                                        return { val: () => ({
                                                                                settings: {
                                                                                        fontSize: 18,
                                                                                        translation: 'KJV',
                                                                                },
                                                                        }) };
                                                                }
                                                                return { val: () => null };
                                                        },
                                                        async set(value) {
                                                                window.__firebaseTest.sets.push({ path, value });
                                                        },
                                                };
                                        },
                                        onConnected() {
                                                return () => {};
                                        },
                                };
                        }
                `,
        }));

        await page.goto('/');
        await waitForPassage(page);
        await page.waitForFunction(
                () => window._bibleApp?.currentUser?.uid === 'delayed-user'
        );

        await page.locator('#nextChapter').click();
        await page.evaluate(() => window._bibleApp.updateFontSize(24));
        await expect(page.locator('#passageTitle')).toContainText('Genesis 2');

        expect(await page.evaluate(() => window.__firebaseTest.sets)).toHaveLength(0);

        await page.evaluate(() => window.__firebaseTest.releaseReads());

        await page.waitForFunction(
                () => window._bibleApp?._authRestorationActive === false &&
                        window._bibleApp?._syncWritesEnabled === true,
                null,
                { timeout: 10000 }
        );

        expect(await page.evaluate(() => ({
                chapter: window._bibleApp.state.currentChapter,
                fontSize: window._bibleApp.state.fontSize,
        }))).toEqual({ chapter: 2, fontSize: 24 });

        const sets = await page.evaluate(() => window.__firebaseTest.sets);
        expect(sets.some(item =>
                item.path.endsWith('/settings/fontSize') && item.value === 24
        )).toBe(true);
        expect(sets.some(item =>
                item.path.endsWith('/readingPosition') &&
                item.value.chapter === 2
        )).toBe(true);
});

test('auth: interactive sign-in loads Auth on submit', async ({ page }) => {
        await page.route('**/config/firebase-config.bundle.js*', route => route.fulfill({
                contentType: 'text/javascript',
                body: `
                        window.__firebaseTest = {
                                signInCalls: 0,
                                databaseCalls: 0,
                        };
                        let observer;
                        const user = { uid: 'signed-in-user', email: 'test@example.com' };

                        export async function initializeFirebaseAuth() {
                                return {
                                        ready: Promise.resolve(),
                                        onAuthStateChanged(callback) {
                                                observer = callback;
                                                setTimeout(() => callback(null), 0);
                                        },
                                        async signInWithEmailAndPassword() {
                                                window.__firebaseTest.signInCalls += 1;
                                                setTimeout(() => observer(user), 0);
                                                return { user };
                                        },
                                        createUserWithEmailAndPassword() {},
                                        signOut() {},
                                        sendPasswordResetEmail() {},
                                };
                        }

                        export async function initializeFirebaseDatabase() {
                                window.__firebaseTest.databaseCalls += 1;
                                return {
                                        ref(path) {
                                                return {
                                                        async once() {
                                                                if (path.endsWith('/translationLibrary')) {
                                                                        return { val: () => ({
                                                                                initialized: true,
                                                                                items: {},
                                                                        }) };
                                                                }
                                                                return { val: () => null };
                                                        },
                                                        async set() {},
                                                };
                                        },
                                        onConnected() {
                                                return () => {};
                                        },
                                };
                        }
                `,
        }));

        await page.goto('/');
        await waitForPassage(page);
        await waitForAuthState(page);

        await page.locator('#userBtn').click();
        await page.locator('#loginEmail').fill('test@example.com');
        await page.locator('#loginPassword').fill('password');
        await page.locator('#loginForm button[type="submit"]').click();

        await expect(page.locator('#loginModal')).not.toHaveClass(/active/);
        await page.waitForFunction(
                () => window._bibleApp?.currentUser?.uid === 'signed-in-user'
        );

        expect(await page.evaluate(() => window.__firebaseTest.signInCalls)).toBe(1);
        expect(await page.evaluate(() => window.__firebaseTest.databaseCalls)).toBe(1);
});
"""

ARCHITECTURE = r"""### Deferred Firebase startup

`BibleApp` constructs and renders from local state without importing Firebase.
After the initial passage has rendered, it dynamically imports the versioned
Firebase bundle and restores Auth in the background. Signed-out restoration
stops after Auth and does not initialize Database, App Check, or reCAPTCHA.

Authenticated restoration initializes Database and App Check, reads remote
settings and reading position while remote UI writes are suspended, reconciles
those values against the local startup baseline, then flushes any newer local
changes. Interactive account actions share the same cached initialization
promises, so repeated taps cannot initialize Firebase more than once.
"""

def implement() -> None:
    # Pure local reading must not import the Firebase SDK module.
    replace_once(
        "bible-api.js",
        "import { FIREBASE_DB_URL } from './config/firebase-config.js';",
        "import { FIREBASE_DB_URL } from './firebase-config.js';",
    )

    # Replace eager Firebase configuration with lazy, idempotent services.
    config_path = path_for("config/firebase-config.js")
    current_config = config_path.read_text(encoding="utf-8")
    normalized_config = FIREBASE_CONFIG.rstrip() + "\n"
    if current_config != normalized_config:
        config_path.write_text(normalized_config, encoding="utf-8")

    # Auth module no longer imports Firebase directly.
    replace_once(
        "auth.js",
        "import { loadUserData as loadUserDataFromFirebase } from './config/firebase-config.js';\n\n",
        "",
    )
    replace_region(
        "auth.js",
        "export async function loadSavedPositionIfChanged(app, withTimeout) {",
        "/** @deprecated Use loadSavedPositionIfChanged for the auth flow. */",
        AUTH_LOAD_POSITION,
        "auth restoration: skipped stale remote position after local interaction",
    )
    replace_once(
        "auth.js",
        "    if (app.currentUser && app.database) {\n",
        "    if (app.canWriteRemoteState()) {\n",
    )
    replace_region(
        "auth.js",
        "export async function handleLogin(app) {",
        "export async function handleSignup(app) {",
        AUTH_LOGIN,
        "await app.ensureInteractiveAuth();",
    )
    replace_region(
        "auth.js",
        "export async function handleSignup(app) {",
        "export async function handleLogout(app) {",
        AUTH_SIGNUP,
        "await app.ensureInteractiveDatabase();",
    )
    replace_region(
        "auth.js",
        "export async function loadUserData(app, normalizeTranslation) {",
        "export async function handleChangeEmail(app) {",
        AUTH_LOAD_USER,
        "const applySetting = (key, value, storageKey = key) => {",
    )
    replace_once(
        "auth.js",
        '''export async function handleForgotPassword(app) {
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
''',
        AUTH_FORGOT,
    )

    # Constructor starts with Firebase completely unloaded.
    replace_once(
        "app.js",
        """        this.auth     = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
        this.authStateResolved = !this.auth || !this.database;
""",
        """        this.auth = null;
        this.database = null;
        this.currentUser = null;
        this.authAvailable = null;
        this.authStateResolved = false;
        this._firebaseModulePromise = null;
        this._authInitializationPromise = null;
        this._databaseInitializationPromise = null;
        this._authRestorationPromise = null;
        this._authObserverAttached = false;
        this._authRestorationScheduled = false;
        this._authRestorationActive = false;
        this._authRestoreBaseline = null;
        this._authRestoreInteraction = {
            position: false,
            settings: new Set(),
        };
        this._authRestoreInteractionTrackingInstalled = false;
        this._syncWritesEnabled = false;
        this._applyingRemoteState = false;
        this._firebaseConnectedUnsubscribe = null;
""",
    )
    insert_before_once(
        "app.js",
        "    async init() {\n",
        APP_LAZY_METHODS,
        "    _firebaseModuleUrl() {\n",
    )
    replace_once(
        "app.js",
        """            this.applySettings();
            this._dbg.t_settings_loaded = ms();
""",
        """            this.applySettings();
            this._captureAuthRestoreBaseline();
            this._installAuthRestoreInteractionTracking();
            this._dbg.t_settings_loaded = ms();
""",
    )
    replace_region(
        "app.js",
        """            if (!this.auth || !this.database) {
                console.warn('Firebase not available — sign-in disabled.');
""",
        "            const cacheHit = this._restorePassageCache();",
        "",
        "auth restoration: local baseline captured",
    )
    replace_region(
        "app.js",
        """            if (!this.auth || !this.database) {
                await this.loadSyncedTranslationLibrary();
""",
        "        } catch (err) {",
        "            this._startBackgroundAuthRestoration();\n",
        "auth restoration: scheduled after reader reveal",
    )
    replace_once(
        "app.js",
        """    navigateChapter(direction) {
        _logUserAction(`navigateChapter: ${direction > 0 ? 'next' : 'prev'} (${this.state.currentBook} ${this.state.currentChapter})`);
        navChapter(this, direction);
    }
""",
        """    navigateChapter(direction) {
        _logUserAction(`navigateChapter: ${direction > 0 ? 'next' : 'prev'} (${this.state.currentBook} ${this.state.currentChapter})`);
        this._authRestoreInteraction.position = true;
        navChapter(this, direction);
    }
""",
    )
    replace_once(
        "app.js",
        """    async toggleSetting(s) {
        _logUserAction(`toggleSetting: ${s}`);
        await toggleSetting(this, s);
    }
""",
        """    async toggleSetting(s) {
        _logUserAction(`toggleSetting: ${s}`);
        this.markLocalSettingInteraction(s);
        await toggleSetting(this, s);
    }
""",
    )
    replace_once(
        "app.js",
        """    async toggleVerseByVerse() {
        _logUserAction('toggleVerseByVerse');
        await toggleVerseByVerse(this);
    }
""",
        """    async toggleVerseByVerse() {
        _logUserAction('toggleVerseByVerse');
        this.markLocalSettingInteraction('verseByVerse');
        await toggleVerseByVerse(this);
    }
""",
    )
    replace_once(
        "app.js",
        """    async updateFontSize(size) {
        _logUserAction(`updateFontSize: ${size}`);
        await updateFontSize(this, size);
    }
""",
        """    async updateFontSize(size) {
        _logUserAction(`updateFontSize: ${size}`);
        this.markLocalSettingInteraction('fontSize');
        await updateFontSize(this, size);
    }
""",
    )
    replace_once(
        "app.js",
        """    async changeTranslation(t, options = {}) {
        _logUserAction(`changeTranslation: ${t}`);
        await changeTranslation(this, t, options);
    }
""",
        """    async changeTranslation(t, options = {}) {
        _logUserAction(`changeTranslation: ${t}`);
        if (options.syncPreference !== false) {
            this.markLocalSettingInteraction('translation');
        }
        await changeTranslation(this, t, options);
    }
""",
    )
    replace_once(
        "app.js",
        """    async loadUserData()    { await loadUserData(this, normalizeTranslation); }
""",
        """    async loadUserData()    {
        await loadUserData(this, normalizeTranslation, withTimeout);
    }
""",
    )
    replace_once(
        "app.js",
        """(async () => {
    await new Promise(resolve => {
        if (document.readyState !== 'loading') return resolve();
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    await import('./config/firebase-config.bundle.js').catch(
        (err) => console.warn('Firebase bundle failed to load — sign-in unavailable:', err)
    );
    new BibleApp();
})();
""",
        """(async () => {
    await new Promise((resolve) => {
        if (document.readyState !== 'loading') {
            resolve();
            return;
        }

        document.addEventListener('DOMContentLoaded', resolve, {
            once: true,
        });
    });

    new BibleApp();
})();
""",
    )

    # Extend fixed debug timing output with the three lifecycle phases.
    replace_once(
        "app.js",
        """        `  authStateChanged:     ${ts(dbg.t_auth_state)} (${dbg.authStateUser ?? 'n/a'})`,
        `  userDataLoaded:       ${ts(dbg.t_user_data_loaded)}`,
""",
        """        `  authRestoreScheduled:  ${ts(dbg.t_auth_restore_scheduled)}`,
        `  authRestoreStart:      ${ts(dbg.t_auth_restore_start)}`,
        `  firebaseModuleStart:   ${ts(dbg.t_firebase_module_start)}`,
        `  firebaseModuleEnd:     ${ts(dbg.t_firebase_module_end)}`,
        `  authInitStart:         ${ts(dbg.t_auth_init_start)}`,
        `  authInitEnd:           ${ts(dbg.t_auth_init_end)}`,
        `  databaseAppCheckStart:${ts(dbg.t_database_init_start)}`,
        `  databaseAppCheckEnd:  ${ts(dbg.t_database_init_end)}`,
        `  interactiveAuthStart: ${ts(dbg.t_interactive_auth_start)}`,
        `  interactiveAuthEnd:   ${ts(dbg.t_interactive_auth_end)}`,
        `  interactiveDbStart:   ${ts(dbg.t_interactive_database_start)}`,
        `  interactiveDbEnd:     ${ts(dbg.t_interactive_database_end)}`,
        `  authStateChanged:     ${ts(dbg.t_auth_state)} (${dbg.authStateUser ?? 'n/a'})`,
        `  userDataLoaded:       ${ts(dbg.t_user_data_loaded)}`,
""",
    )

    # Suspend UI-originated remote writes until restoration and reconciliation finish.
    replace_count(
        "settings.js",
        "    if (app.currentUser) {\n",
        "    if (app.canWriteRemoteState()) {\n",
        4,
    )
    replace_count(
        "ui.js",
        "\tif (app.currentUser) {\n",
        "\tif (app.canWriteRemoteState()) {\n",
        2,
    )
    replace_count(
        "events.js",
        "        if (app.currentUser) {\n",
        "        if (app.canWriteRemoteState()) {\n",
        2,
    )
    replace_once(
        "events.js",
        """    app.verseSelectionGestureSelect?.addEventListener('change', async (event) => {
        const gesture = event.currentTarget.value === 'tap' ? 'tap' : 'hold';
""",
        """    app.verseSelectionGestureSelect?.addEventListener('change', async (event) => {
        app.markLocalSettingInteraction('verseSelectionGesture');
        const gesture = event.currentTarget.value === 'tap' ? 'tap' : 'hold';
""",
    )
    replace_once(
        "events.js",
        """        readingFontSelector.addEventListener('change', async () => {
            const font = readingFontSelector.value;
""",
        """        readingFontSelector.addEventListener('change', async () => {
            app.markLocalSettingInteraction('readingFont');
            const font = readingFontSelector.value;
""",
    )
    replace_once(
        "events.js",
        """    document.getElementById('lightModeSelect')?.addEventListener('change', (event) => {
        app._dbgUserAction?.(`changeAppearance: ${event.currentTarget.value}`);
""",
        """    document.getElementById('lightModeSelect')?.addEventListener('change', (event) => {
        app.markLocalSettingInteraction('lightMode');
        app._dbgUserAction?.(`changeAppearance: ${event.currentTarget.value}`);
""",
    )
    replace_once(
        "events.js",
        """        lastAppliedTheme = theme;
        app._dbgUserAction?.(`changeTheme: ${theme}`);
""",
        """        lastAppliedTheme = theme;
        app.markLocalSettingInteraction('colorTheme');
        app._dbgUserAction?.(`changeTheme: ${theme}`);
""",
    )
    replace_once(
        "events.js",
        """        const canOfferSync = Boolean(
            app.auth &&
            app.database &&
            app.authStateResolved &&
            !app.currentUser
        );
""",
        """        const canOfferSync = Boolean(
            app.authAvailable === true &&
            app.authStateResolved &&
            !app.currentUser
        );
""",
    )
    replace_once(
        "translation-sync.js",
        """    if (!app.currentUser || !app.database) {
        rememberPendingAdd(normalized);
""",
        """    if (!app.canWriteRemoteState()) {
        rememberPendingAdd(normalized);
""",
    )
    replace_once(
        "translation-sync.js",
        "    if (app.currentUser && app.database) {\n",
        "    if (app.canWriteRemoteState()) {\n",
    )

    # Remove speculative Google/Firebase connections from signed-out startup.
    index = read("index.html")
    for line in (
        '\t<link rel="preconnect" href="https://esv-bible-6dffb-default-rtdb.firebaseio.com" />\n',
        '\t<link rel="preconnect" href="https://www.gstatic.com" />\n',
        '\t<link rel="preconnect" href="https://www.google.com" />\n',
        '\t<link rel="preconnect" href="https://apis.google.com" />\n',
        '\t<!-- Firebase App Check loads reCAPTCHA v3 through ReCaptchaV3Provider. -->\n',
    ):
        index = index.replace(line, "")
    write("index.html", index)

    # Offline build must emit the filename used by the runtime dynamic import.
    replace_once(
        "scripts/prepare-offline-build.mjs",
        "    const outputPath = path.join(outputRoot, 'config/firebase-config.js');",
        "    const outputPath = path.join(outputRoot, 'config/firebase-config.bundle.js');",
    )
    replace_once(
        "scripts/prepare-offline-build.mjs",
        """    await fs.rm(path.join(outputRoot, 'config/firebase-config.bundle.js'), { force: true });
""",
        "",
    )

    append_once(
        "tests/smoke.spec.js",
        SMOKE_TESTS,
        "startup: delayed remote state preserves and flushes newer local changes",
    )
    append_once(
        "docs/ARCHITECTURE.md",
        ARCHITECTURE,
        "### Deferred Firebase startup",
    )

    # The web service worker must not precache the lazy Firebase bundle.
    sw = read("sw.js")
    if "'./config/firebase-config.bundle.js'" in sw:
        raise SystemExit(
            "sw.js precaches config/firebase-config.bundle.js; remove it before running issue #253"
        )


def verify() -> None:
    required = {
        "bible-api.js": ["from './firebase-config.js'"],
        "auth.js": [
            "await app.ensureInteractiveAuth();",
            "await app.ensureInteractiveDatabase();",
            "hasLocalPositionChangedSinceAuthStart()",
        ],
        "config/firebase-config.js": [
            "export function initializeFirebaseAuth()",
            "export function initializeFirebaseDatabase()",
            "firebase-app-check.js",
            "firebase-database.js",
        ],
        "app.js": [
            "_firebaseModuleUrl()",
            "auth restoration: scheduled after reader reveal",
            "database/App Check skipped for signed-out session",
            "canWriteRemoteState()",
            "markLocalSettingInteraction(key)",
            "ensureInteractiveFirebase()",
        ],
        "events.js": ["app.authAvailable === true"],
        "tests/smoke.spec.js": [
            "startup: signed-out reading does not request reCAPTCHA or Database",
            "startup: existing session restores after passage reveal",
            "startup: delayed remote state preserves and flushes newer local changes",
            "auth: interactive sign-in loads Auth on submit",
        ],
    }

    for relative, snippets in required.items():
        text = read(relative)
        for snippet in snippets:
            if snippet not in text:
                raise SystemExit(f"Missing from {relative}: {snippet}")

    if "window.firebaseAuth" in read("app.js"):
        raise SystemExit("app.js still references window.firebaseAuth")
    if "window.firebaseDatabase" in read("app.js"):
        raise SystemExit("app.js still references window.firebaseDatabase")
    if "from './config/firebase-config.js'" in read("auth.js"):
        raise SystemExit("auth.js still statically imports Firebase")
    if "from './config/firebase-config.js'" in read("bible-api.js"):
        raise SystemExit("bible-api.js still imports the Firebase SDK module")
    if "'./config/firebase-config.bundle.js'" in read("sw.js"):
        raise SystemExit("The lazy Firebase bundle is still in the service-worker shell")


if __name__ == "__main__":
    implement()
    verify()
    print("Deferred Firebase startup implementation is present and structurally valid.")
