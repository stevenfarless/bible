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

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

window.firebaseAuth = auth;
window.firebaseDatabase = database;

export async function loadUserData(userId) {
  try {
    const snapshot = await database.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData) return null;

    const s = userData.settings || {};
    const settings = {
      fontSize: s.fontSize || 18,
      showVerseNumbers: s.showVerseNumbers !== false,
      showHeadings: s.showHeadings !== false,
      showFootnotes: s.showFootnotes === true,
      showCrossReferences: s.showCrossReferences === true,
      verseByVerse: s.verseByVerse === true,
      colorTheme: s.colorTheme || "dracula",
      lightMode: typeof s.lightMode === "boolean" ? s.lightMode : false,
      translation: s.translation || "ESV",
    };

    return { settings };
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
}
