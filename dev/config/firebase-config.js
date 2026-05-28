// ================================
// Firebase Configuration — modular SDK v9 with compat shim
// app.js uses compat-style .ref().once()/.set() and auth.signIn* methods.
// We wrap the modular SDK to preserve that contract without loading compat.
// ================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {
    getDatabase,
    ref,
    get,
    set,
    onValue,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';
import {
    initializeAppCheck,
    ReCaptchaV3Provider,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check.js';

const firebaseConfig = {
    apiKey: "AIzaSyCHH_MNP89AsMlhzfjbcJEN3lJBebtdnKs",
    authDomain: "esv-bible-6dffb.firebaseapp.com",
    databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
    projectId: "esv-bible-6dffb",
    storageBucket: "esv-bible-6dffb.firebasestorage.app",
    messagingSenderId: "824462651620",
    appId: "1:824462651620:web:5f46fe033ac46d2329bcf1",
};

export const FIREBASE_DB_URL = firebaseConfig.databaseURL;

const app = initializeApp(firebaseConfig);

initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Lf8bAAtAAAAALvK77sjk7750S7XVUQR7Ai2cXXV'),
    isTokenAutoRefreshEnabled: true,
});

const _auth = getAuth(app);
const _db   = getDatabase(app);

// ── Database shim ──────────────────────────────────────────────────────────
// Returns a ref-like object whose .once() and .set() match the compat API.
function makeRef(path) {
    const dbRef = ref(_db, path);
    return {
        once: (_event) => get(dbRef).then((snap) => snap),
        set:  (value)  => set(dbRef, value),
        ref:  (subpath) => makeRef(path ? `${path}/${subpath}` : subpath),
    };
}

const dbShim = {
    ref: (path) => makeRef(path),
};

// ── Auth shim ──────────────────────────────────────────────────────────────
const authShim = {
    onAuthStateChanged: (cb)         => onAuthStateChanged(_auth, cb),
    signInWithEmailAndPassword: (e, p) => signInWithEmailAndPassword(_auth, e, p),
    createUserWithEmailAndPassword: (e, p) => createUserWithEmailAndPassword(_auth, e, p),
    signOut: ()                      => signOut(_auth),
    get currentUser()                { return _auth.currentUser; },
};

// Expose on window so app.js reads window.firebaseAuth / window.firebaseDatabase
window.firebaseAuth     = authShim;
window.firebaseDatabase = dbShim;

// ── loadUserData export ────────────────────────────────────────────────────
export async function loadUserData(userId) {
    try {
        const snap = await get(ref(_db, `users/${userId}`));
        const userData = snap.val();
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
                colorTheme:          s.colorTheme           || 'dracula',
                lightMode:           typeof s.lightMode === 'boolean' ? s.lightMode : false,
                translation:         s.translation          || 'ESV',
            },
        };
    } catch (err) {
        console.error('loadUserData error:', err);
        return null;
    }
}
