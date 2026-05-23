// ================================
// Firebase Configuration — modular SDK (v9+)
// ================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyCGVPqbTZCQ3Hrs9sFIJm_PR32FP_CVXSw",
  authDomain: "esv-bible-6dffb.firebaseapp.com",
  databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
  projectId: "esv-bible-6dffb",
  storageBucket: "esv-bible-6dffb.firebasestorage.app",
  messagingSenderId: "824462651620",
  appId: "1:824462651620:web:5f46fe033ac46d2329bcf1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Expose on window so app.js can read window.firebaseAuth / window.firebaseDatabase
window.firebaseAuth = auth;
window.firebaseDatabase = database;

export async function loadUserData(userId) {
  try {
    const snapshot = await get(ref(database, `users/${userId}`));
    const userData = snapshot.val();
    if (!userData) return null;

    const s = userData.settings || {};
    return {
      settings: {
        fontSize:            s.fontSize            ?? 18,
        showVerseNumbers:    s.showVerseNumbers     !== false,
        showHeadings:        s.showHeadings         !== false,
        showFootnotes:       s.showFootnotes        === true,
        showCrossReferences: s.showCrossReferences  === true,
        verseByVerse:        s.verseByVerse         === true,
        colorTheme:          s.colorTheme           || "dracula",
        lightMode:           typeof s.lightMode === "boolean" ? s.lightMode : false,
        translation:         s.translation          || "ESV",
      },
    };
  } catch (error) {
    console.error("Error loading user data:", error);
    return null;
  }
}
