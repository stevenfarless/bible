// config/firebase-config.bundle.js
// Loads Firebase SDK from vendored same-origin files (vendor/firebase/)
// so Brave and other privacy browsers cannot block gstatic.com imports.
import { initializeApp } from "../vendor/firebase/app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "../vendor/firebase/auth.js";
import {
  getDatabase,
  ref,
  get,
  set
} from "../vendor/firebase/database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGVPqbTZCQ3Hrs9sFIJm_PR32FP_CVXSw",
  authDomain: "esv-bible-6dffb.firebaseapp.com",
  databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
  projectId: "esv-bible-6dffb",
  storageBucket: "esv-bible-6dffb.firebasestorage.app",
  messagingSenderId: "824462651620",
  appId: "1:824462651620:web:5f46fe033ac46d2329bcf1"
};

const app = initializeApp(firebaseConfig);
const _auth = getAuth(app);
const _db = getDatabase(app);

window.firebaseAuth = {
  onAuthStateChanged: (cb) => onAuthStateChanged(_auth, cb),
  signInWithEmailAndPassword: (e, p) => signInWithEmailAndPassword(_auth, e, p),
  createUserWithEmailAndPassword: (e, p) => createUserWithEmailAndPassword(_auth, e, p),
  signOut: () => signOut(_auth),
  get currentUser() { return _auth.currentUser; }
};

window.firebaseDatabase = {
  ref: (path) => {
    const dbRef = ref(_db, path);
    return {
      once: () => get(dbRef).then((snap) => snap),
      set: (value) => set(dbRef, value),
      ref: (subpath) => window.firebaseDatabase.ref(path ? `${path}/${subpath}` : subpath)
    };
  }
};

export const FIREBASE_DB_URL = firebaseConfig.databaseURL;

export async function loadUserData(userId) {
  try {
    const snap = await get(ref(_db, `users/${userId}`));
    const userData = snap.val();
    if (!userData) return null;
    const s = userData.settings || {};
    return {
      settings: {
        fontSize: s.fontSize ?? 18,
        showVerseNumbers: s.showVerseNumbers !== false,
        showHeadings: s.showHeadings !== false,
        showFootnotes: s.showFootnotes === true,
        showCrossReferences: s.showCrossReferences === true,
        verseByVerse: s.verseByVerse === true,
        colorTheme: s.colorTheme || "dracula",
        lightMode: typeof s.lightMode === "boolean" ? s.lightMode : false,
        translation: s.translation || "ESV"
      }
    };
  } catch (err) {
    console.error("loadUserData error:", err);
    return null;
  }
}
