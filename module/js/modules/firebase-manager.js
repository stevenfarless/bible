// js/modules/firebase-manager.js

import { auth, database } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  ref,
  set,
  get,
  onValue,
  off,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

/**
 * Firebase Manager
 * Handles authentication and data synchronization
 */
export class FirebaseManager {
  constructor(app) {
    this.app = app;
    this.currentUser = null;
    this.unsubscribeAuth = null;
    this.settingsListener = null;
    this.authInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize Firebase authentication and listeners
   */
  async init() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeAuth();
    return this.initializationPromise;
  }

  /**
   * Initialize authentication state listener
   * @private
   */
  async _initializeAuth() {
    if (this.authInitialized) {
      return;
    }

    return new Promise((resolve) => {
      this.unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        this.currentUser = user;

        if (user) {
          console.log('User signed in:', user.email);
          await this.loadSettings();
          this.setupSettingsSync();
          if (this.app.ui) {
            this.app.ui.updateAuthUI(true);
          }
        } else {
          console.log('User signed out');
          this.loadLocalSettings();
          this.removeSettingsSync();
          if (this.app.ui) {
            this.app.ui.updateAuthUI(false);
          }
        }

        if (!this.authInitialized) {
          this.authInitialized = true;
          resolve();
        }
      });
    });
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      const userCredential = await this._firebaseOperationWithTimeout(
        signInWithEmailAndPassword(auth, email, password),
        5000,
        'Sign in timed out'
      );
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw this._handleAuthError(error);
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    try {
      const userCredential = await this._firebaseOperationWithTimeout(
        createUserWithEmailAndPassword(auth, email, password),
        5000,
        'Sign up timed out'
      );
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw this._handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      await this._firebaseOperationWithTimeout(
        firebaseSignOut(auth),
        5000,
        'Sign out timed out'
      );
      this.currentUser = null;
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  /**
   * Load settings from Firebase
   */
  async loadSettings() {
    if (!this.currentUser) {
      console.warn('No user signed in');
      return;
    }

    try {
      const settingsRef = ref(database, `users/${this.currentUser.uid}/settings`);
      const snapshot = await this._firebaseOperationWithTimeout(
        get(settingsRef),
        5000,
        'Loading settings timed out'
      );

      if (snapshot.exists()) {
        const settings = snapshot.val();
        this._applySettings(settings);
      } else {
        console.log('No settings found, using defaults');
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.loadLocalSettings();
    }
  }

  /**
   * Save settings to Firebase
   */
  async saveSettings() {
    if (!this.currentUser) {
      console.warn('No user signed in, saving locally');
      this.saveLocalSettings();
      return;
    }

    try {
      const settingsRef = ref(database, `users/${this.currentUser.uid}/settings`);
      const settings = this._gatherSettings();

      await this._firebaseOperationWithTimeout(
        set(settingsRef, settings),
        5000,
        'Saving settings timed out'
      );

      this.saveLocalSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      this.saveLocalSettings();
    }
  }

  /**
   * Setup real-time settings sync
   */
  setupSettingsSync() {
    if (!this.currentUser || this.settingsListener) {
      return;
    }

    const settingsRef = ref(database, `users/${this.currentUser.uid}/settings`);
    this.settingsListener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val();
        this._applySettings(settings);
      }
    });
  }

  /**
   * Remove settings sync listener
   */
  removeSettingsSync() {
    if (this.settingsListener) {
      const settingsRef = ref(database, `users/${this.currentUser?.uid}/settings`);
      off(settingsRef, 'value', this.settingsListener);
      this.settingsListener = null;
    }
  }

  /**
   * Save reading position to Firebase
   */
  async saveReadingPosition() {
    if (!this.currentUser) {
      return;
    }

    try {
      const positionRef = ref(
        database,
        `users/${this.currentUser.uid}/readingPosition`
      );

      const position = {
        book: this.app.state.currentBook,
        chapter: this.app.state.currentChapter,
        scrollPosition: window.scrollY,
        timestamp: Date.now(),
      };

      await this._firebaseOperationWithTimeout(
        set(positionRef, position),
        3000,
        'Saving position timed out'
      );
    } catch (error) {
      console.error('Error saving reading position:', error);
    }
  }

  /**
   * Load settings from localStorage
   */
  loadLocalSettings() {
    try {
      const saved = localStorage.getItem('bibleReaderSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this._applySettings(settings);
      }
    } catch (error) {
      console.error('Error loading local settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveLocalSettings() {
    try {
      const settings = this._gatherSettings();
      localStorage.setItem('bibleReaderSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving local settings:', error);
    }
  }

  /**
   * Gather current settings from app state
   * @private
   */
  _gatherSettings() {
    return {
      fontSize: this.app.state.fontSize,
      showVerseNumbers: this.app.state.showVerseNumbers,
      showHeadings: this.app.state.showHeadings,
      showFootnotes: this.app.state.showFootnotes,
      showCrossReferences: this.app.state.showCrossReferences,
      showRedLetters: this.app.state.showRedLetters,
      verseByVerse: this.app.state.verseByVerse,
      colorTheme: this.app.state.colorTheme,
      lightMode: this.app.state.lightMode,
      currentBook: this.app.state.currentBook,
      currentChapter: this.app.state.currentChapter,
    };
  }

  /**
   * Apply settings to app state
   * @private
   */
  _applySettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return;
    }

    if (typeof settings.fontSize === 'number') {
      this.app.state.fontSize = settings.fontSize;
    }
    if (typeof settings.showVerseNumbers === 'boolean') {
      this.app.state.showVerseNumbers = settings.showVerseNumbers;
    }
    if (typeof settings.showHeadings === 'boolean') {
      this.app.state.showHeadings = settings.showHeadings;
    }
    if (typeof settings.showFootnotes === 'boolean') {
      this.app.state.showFootnotes = settings.showFootnotes;
    }
    if (typeof settings.showCrossReferences === 'boolean') {
      this.app.state.showCrossReferences = settings.showCrossReferences;
    }
    if (typeof settings.showRedLetters === 'boolean') {
      this.app.state.showRedLetters = settings.showRedLetters;
    }
    if (typeof settings.verseByVerse === 'boolean') {
      this.app.state.verseByVerse = settings.verseByVerse;
    }
    if (typeof settings.colorTheme === 'string') {
      this.app.state.colorTheme = settings.colorTheme;
    }
    if (typeof settings.lightMode === 'boolean') {
      this.app.state.lightMode = settings.lightMode;
    }

    if (this.app.ui) {
      this.app.ui.applySettings();
    }
  }

  /**
   * Handle authentication errors
   * @private
   */
  _handleAuthError(error) {
    const errorMessages = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password is too weak',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
    };

    const message = errorMessages[error.code] || error.message || 'Authentication failed';
    return new Error(message);
  }

  /**
   * Wrap Firebase operations with timeout
   * @private
   */
  async _firebaseOperationWithTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
    this.removeSettingsSync();
  }
}
