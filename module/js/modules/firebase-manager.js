// js/modules/firebase-manager.js NEW VERSION
import { loadUserData as loadUserDataFromFirebase } from '../../firebase-config.js';
import { updateThemeIcon, changeColorTheme } from './ui-utils.js';

export class FirebaseManager {
    constructor(app) {
        this.app = app;
        this.auth = window.firebaseAuth;
        this.database = window.firebaseDatabase;
        this.currentUser = null;
    }

    init() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                this.app.ui.applySettings();
                await this.loadSavedReadingPosition();
            } else {
                this.currentUser = null;
                this.loadLocalSettings();
                this.app.ui.applySettings();
                this.app.loadPassage(this.app.state.currentBook, this.app.state.currentChapter);
                this.checkApiKey();
            }
        });
    }

    async handleLogin(email, password) {
        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.app.ui.showToast('Signed in successfully!');
            return true;
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/user-not-found') {
                return 'user-not-found';
            } else if (error.code === 'auth/wrong-password') {
                this.app.ui.showToast('Incorrect password');
            } else {
                this.app.ui.showToast(`Login failed: ${error.message}`);
            }
            return false;
        }
    }

    async handleSignup(email, password, apiKey) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const encrypted = window.encryptionHelper.encrypt(apiKey);
            await this.database.ref(`users/${user.uid}`).set({
                apiKey: encrypted,
                settings: {
                    fontSize: 18,
                    showVerseNumbers: true,
                    showHeadings: true,
                    showFootnotes: false,
                    showCrossReferences: false,
                    verseByVerse: false,
                },
                createdAt: Date.now()
            });

            this.app.ui.showToast('Account created successfully!');
            return true;
        } catch (error) {
            console.error('Signup error:', error);
            if (error.code === 'auth/email-already-in-use') {
                this.app.ui.showToast('Account already exists. Please sign in.');
            } else {
                this.app.ui.showToast(`Signup failed: ${error.message}`);
            }
            return false;
        }
    }

    async handleLogout() {
        try {
            await this.auth.signOut();
            this.app.ui.showToast('Signed out successfully!');
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            this.app.ui.showToast('Logout failed');
            return false;
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;

        const data = await loadUserDataFromFirebase(this.currentUser.uid);
        if (!data) return;

        this.app.API_KEY = data.apiKey;
        const s = data.settings;
        const state = this.app.state;

        state.fontSize = s.fontSize;
        state.showVerseNumbers = s.showVerseNumbers;
        state.showHeadings = s.showHeadings;
        state.showFootnotes = s.showFootnotes;
        state.showCrossReferences = s.showCrossReferences || false;
        state.verseByVerse = s.verseByVerse;
        state.showRedLetters = s.showRedLetters || false;
        state.colorTheme = s.colorTheme || 'dracula';
        state.lightMode = typeof s.lightMode === 'boolean' ? s.lightMode : false;
    }

    loadLocalSettings() {
        const state = this.app.state;
        this.app.API_KEY = localStorage.getItem('esvApiKey') || '';
        state.fontSize = parseInt(localStorage.getItem('fontSize') || '18', 10);
        state.showVerseNumbers = localStorage.getItem('showVerseNumbers') !== 'false';
        state.showHeadings = localStorage.getItem('showHeadings') !== 'false';
        state.showFootnotes = localStorage.getItem('showFootnotes') === 'true';
        state.showCrossReferences = localStorage.getItem('showCrossReferences') === 'true';
        state.verseByVerse = localStorage.getItem('verseByVerse') === 'true';
        state.showRedLetters = localStorage.getItem('showRedLetters') === 'true';
        state.colorTheme = localStorage.getItem('colorTheme') || 'dracula';
        state.lightMode = localStorage.getItem('lightMode') === 'true';
    }

    async saveSetting(key, value) {
        this.app.state[key] = value;
        if (this.currentUser) {
            await this.database.ref(`users/${this.currentUser.uid}/settings/${key}`).set(value);
        } else {
            localStorage.setItem(key, value);
        }
    }

    async saveApiKey(apiKey) {
        if (this.currentUser) {
            try {
                const encrypted = window.encryptionHelper.encrypt(apiKey);
                await this.database.ref(`users/${this.currentUser.uid}/apiKey`).set(encrypted);
                return true;
            } catch (error) {
                console.error('Error saving API key:', error);
                return false;
            }
        } else {
            localStorage.setItem('esvApiKey', apiKey);
            return true;
        }
    }

    checkApiKey() {
        if (!this.app.API_KEY) {
            setTimeout(() => {
                this.app.ui.showToast('Welcome! Please sign in to start reading.');
                this.app.ui.openModal(this.app.ui.elements.loginModal);
            }, 500);
        }
    }

    async saveReadingPosition() {
        if (!this.currentUser) return;

        const position = {
            book: this.app.state.currentBook,
            chapter: this.app.state.currentChapter,
            scrollPosition: window.pageYOffset || document.documentElement.scrollTop,
            lastUpdated: Date.now()
        };

        try {
            await this.database.ref(`users/${this.currentUser.uid}/readingPosition`).set(position);
        } catch (error) {
            console.error('Error saving reading position:', error);
        }
    }

    async loadSavedReadingPosition() {
        if (!this.currentUser) return;

        try {
            const snapshot = await this.database.ref(`users/${this.currentUser.uid}/readingPosition`).once('value');
            const position = snapshot.val();

            if (position && position.book && position.chapter) {
                this.app.lastScrollPosition = position.scrollPosition || 0;
                await this.app.loadPassage(position.book, position.chapter, true);
            } else {
                await this.app.loadPassage(this.app.state.currentBook, this.app.state.currentChapter);
            }
        } catch (error) {
            console.error('Error loading reading position:', error);
            await this.app.loadPassage(this.app.state.currentBook, this.app.state.currentChapter);
        }
    }
}
