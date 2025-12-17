// ================================
// Firebase Configuration
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
firebase.initializeApp(firebaseConfig);

// Firebase services (using Realtime Database, not Firestore)
const auth = firebase.auth();
const database = firebase.database();

// Simple encryption for API keys
const EncryptionHelper = {
  encrypt(text) {
    return btoa(text);
  },
  decrypt(ciphertext) {
    try {
      return atob(ciphertext);
    } catch (e) {
      return "";
    }
  },
};

// Export for use in app (globals)
window.firebaseAuth = auth;
window.firebaseDatabase = database;
window.encryptionHelper = EncryptionHelper;

// Exported function for ES module imports
export async function loadUserData(userId) {
  try {
    const snapshot = await database.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData) return null;

    // Decrypt API key if present
    let apiKey = "";
    if (userData.apiKey) {
      apiKey = window.encryptionHelper.decrypt(userData.apiKey);
    }

    // Extract settings or default values
    const settings = {
      fontSize: (userData.settings && userData.settings.fontSize) || 18,
      showVerseNumbers:
        userData.settings ? userData.settings.showVerseNumbers !== false : true,
      showHeadings:
        userData.settings ? userData.settings.showHeadings !== false : true,
      showFootnotes:
        userData.settings ? userData.settings.showFootnotes === true : false,
      verseByVerse:
        userData.settings ? userData.settings.verseByVerse === true : false,
      colorTheme:
        userData.settings && userData.settings.colorTheme
          ? userData.settings.colorTheme
          : "dracula",
      lightMode:
        userData.settings && typeof userData.settings.lightMode === "boolean"
          ? userData.settings.lightMode
          : false,
    };;

    return { apiKey, settings };
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
}
