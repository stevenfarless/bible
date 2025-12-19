// js/modules/firebase-config.js
// ================================
// Firebase Configuration (Compat SDK)
// ================================

const firebaseConfig = {
  apiKey: "AIzaSyCGVPqbTZCQ3Hrs9sFIJm_PR32FP_CVXSw",
  authDomain: "esv-bible-6dffb.firebaseapp.com",
  databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
  projectId: "esv-bible-6dffb",
  storageBucket: "esv-bible-6dffb.firebasestorage.app",
  messagingSenderId: "824462651620",
  appId: "1:824462651620:web:5f46fe033ac46d2329bcf1",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const db = firebase.firestore();
export const database = firebase.database();

// Simple encryption for API keys
export const EncryptionHelper = {
  encrypt(text) {
    return btoa(text);
  },
  decrypt(ciphertext) {
    try {
      return atob(ciphertext);
    } catch (e) {
      console.error('Decryption failed:', e);
      return "";
    }
  },
};

// Export function to load user data
export async function loadUserData(userId) {
  try {
    const snapshot = await database.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData) return null;

    // Decrypt API key if present
    let apiKey = "";
    if (userData.apiKey) {
      apiKey = EncryptionHelper.decrypt(userData.apiKey);
    }

    // Extract settings with defaults
    const settings = {
      fontSize: userData.settings?.fontSize || 18,
      showVerseNumbers: userData.settings?.showVerseNumbers !== false,
      showHeadings: userData.settings?.showHeadings !== false,
      showFootnotes: userData.settings?.showFootnotes === true,
      showCrossReferences: userData.settings?.showCrossReferences === true,
      showRedLetters: userData.settings?.showRedLetters === true,
      verseByVerse: userData.settings?.verseByVerse === true,
      colorTheme: userData.settings?.colorTheme || "dracula",
      lightMode: userData.settings?.lightMode === true,
    };

    return { apiKey, settings };
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
}
