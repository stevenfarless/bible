// config/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js";
var firebaseConfig = {
  apiKey: "AIzaSyCHH_MNP89AsMlhzfjbcJEN3lJBebtdnKs",
  authDomain: "esv-bible-6dffb.firebaseapp.com",
  databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
  projectId: "esv-bible-6dffb",
  storageBucket: "esv-bible-6dffb.firebasestorage.app",
  messagingSenderId: "824462651620",
  appId: "1:824462651620:web:5f46fe033ac46d2329bcf1"
};
var FIREBASE_DB_URL = firebaseConfig.databaseURL;
var app = initializeApp(firebaseConfig);
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Lf8bAAtAAAAALvK77sjk7750S7XVUQR7Ai2cXXV"),
  isTokenAutoRefreshEnabled: true
});
var _auth = getAuth(app);
var _db = getDatabase(app);
setPersistence(_auth, indexedDBLocalPersistence).catch(
  () => setPersistence(_auth, browserLocalPersistence).catch(
    () => setPersistence(_auth, browserSessionPersistence)
  )
);
function makeRef(path) {
  const dbRef = ref(_db, path);
  return {
    once: (_event) => get(dbRef).then((snap) => snap),
    set: (value) => set(dbRef, value),
    ref: (subpath) => makeRef(path ? `${path}/${subpath}` : subpath)
  };
}
var dbShim = {
  ref: (path) => makeRef(path)
};
var authShim = {
  onAuthStateChanged: (cb) => onAuthStateChanged(_auth, cb),
  signInWithEmailAndPassword: (e, p) => signInWithEmailAndPassword(_auth, e, p),
  createUserWithEmailAndPassword: (e, p) => createUserWithEmailAndPassword(_auth, e, p),
  signOut: () => signOut(_auth),
  get currentUser() {
    return _auth.currentUser;
  }
};
window.firebaseAuth = authShim;
window.firebaseDatabase = dbShim;
async function loadUserData(userId) {
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
export {
  FIREBASE_DB_URL,
  loadUserData
};
