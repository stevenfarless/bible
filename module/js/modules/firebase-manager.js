// js/modules/firebase-manager.js
import { auth, db, database, EncryptionHelper, loadUserData } from './firebase-config.js';

export class FirebaseManager {
  constructor(app) {
    this.app = app;
    this.auth = auth;
    this.db = db;
    this.database = database;
    this.encryptionHelper = EncryptionHelper;
    this.currentUser = null;
  }

  async init() {
    // Listen for auth state changes
    this.auth.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      
      if (user) {
        console.log('✅ User signed in:', user.email);
        await this.loadUserSettings(user.uid);
      } else {
        console.log('👤 No user signed in');
        this.loadLocalSettings();
      }
      
      // Load initial passage after settings are ready
      this.app.loadPassage(
        this.app.state.currentBook,
        this.app.state.currentChapter
      );
    });
  }

  async loadUserSettings(userId) {
    const userData = await loadUserData(userId);
    
    if (userData) {
      // Apply API key
      if (userData.apiKey) {
        this.app.API_KEY = userData.apiKey;
        console.log('✅ API key loaded from Firebase');
      }
      
      // Apply settings
      Object.assign(this.app.state, userData.settings);
      this.app.ui.applySettings();
      console.log('✅ Settings loaded from Firebase');
    } else {
      console.log('⚠️ No user data found, using defaults');
      this.loadLocalSettings();
    }
  }

  loadLocalSettings() {
    // Load from localStorage as fallback
    const localApiKey = localStorage.getItem('esvApiKey');
    if (localApiKey) {
      this.app.API_KEY = this.encryptionHelper.decrypt(localApiKey);
    }
    
    // Load other settings from localStorage
    const savedSettings = localStorage.getItem('bibleAppSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        Object.assign(this.app.state, settings);
        this.app.ui.applySettings();
      } catch (e) {
        console.error('Failed to parse local settings:', e);
      }
    }
  }

  async saveApiKey(apiKey) {
    if (!apiKey) return false;

    const encrypted = this.encryptionHelper.encrypt(apiKey);

    // Save to Firebase if logged in
    if (this.currentUser) {
      try {
        await this.database.ref(`users/${this.currentUser.uid}/apiKey`).set(encrypted);
        this.app.API_KEY = apiKey;
        console.log('✅ API key saved to Firebase');
        return true;
      } catch (error) {
        console.error('Error saving API key:', error);
        return false;
      }
    } else {
      // Save locally if not logged in
      localStorage.setItem('esvApiKey', encrypted);
      this.app.API_KEY = apiKey;
      console.log('✅ API key saved locally');
      return true;
    }
  }

  async saveSetting(key, value) {
    // Save to Firebase if logged in
    if (this.currentUser) {
      try {
        await this.database.ref(`users/${this.currentUser.uid}/settings/${key}`).set(value);
      } catch (error) {
        console.error('Error saving setting to Firebase:', error);
      }
    }
    
    // Always save locally as backup
    const settings = JSON.parse(localStorage.getItem('bibleAppSettings') || '{}');
    settings[key] = value;
    localStorage.setItem('bibleAppSettings', JSON.stringify(settings));
  }

  async saveReadingPosition() {
    if (!this.currentUser) return;

    const position = {
      book: this.app.state.currentBook,
      chapter: this.app.state.currentChapter,
      scrollY: window.scrollY || 0,
      timestamp: Date.now()
    };

    try {
      await this.database.ref(`users/${this.currentUser.uid}/readingPosition`).set(position);
    } catch (error) {
      console.error('Error saving reading position:', error);
    }
  }

  async handleLogin(email, password) {
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      this.app.ui.showToast(error.message);
      return false;
    }
  }

  async handleSignup(email, password) {
    try {
      await this.auth.createUserWithEmailAndPassword(email, password);
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      this.app.ui.showToast(error.message);
      return false;
    }
  }

  async handleLogout() {
    try {
      await this.auth.signOut();
      this.app.ui.showToast('Signed out successfully');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      this.app.ui.showToast('Failed to sign out');
      return false;
    }
  }
}
