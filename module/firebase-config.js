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

// Initialize Firebase (compat SDK style)
firebase.initializeApp(firebaseConfig);

// Firebase services (Realtime Database, not Firestore)
const auth = firebase.auth();
const database = firebase.database();

// NOTE: This is obfuscation (base64), not cryptographic encryption.
const ApiKeyCodec = {
  encode(text) {
    return btoa(text);
  },
  decode(ciphertext) {
    try {
      return atob(ciphertext);
    } catch {
      return "";
    }
  },
};

// Export for use in app (globals)
window.firebaseAuth = auth;
window.firebaseDatabase = database;
window.apiKeyCodec = ApiKeyCodec;

// Optional helper if you want direct imports elsewhere
export async function loadUserData(userId) {
  try {
    const snapshot = await database.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData) return null;

    let apiKey = "";
    if (userData.apiKey) apiKey = ApiKeyCodec.decode(userData.apiKey);

    return { ...userData, apiKey };
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
}
