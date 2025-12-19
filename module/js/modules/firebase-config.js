// js/modules/firebase-config.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

/**
 * Firebase Configuration
 * 
 * SECURITY NOTE:
 * These credentials are visible in client-side code. This is normal for Firebase.
 * Security is enforced through Firebase Security Rules (set in Firebase Console).
 * 
 * RECOMMENDED SECURITY RULES:
 * {
 *   "rules": {
 *     "users": {
 *       "$uid": {
 *         ".read": "$uid === auth.uid",
 *         ".write": "$uid === auth.uid"
 *       }
 *     }
 *   }
 * }
 */

const firebaseConfig = {
  projectId: "esv-bible-6dffb",
  authDomain: "esv-bible-6dffb.firebaseapp.com",
  databaseURL: "https://esv-bible-6dffb-default-rtdb.firebaseio.com",
  storageBucket: "esv-bible-6dffb.firebasestorage.app",
  messagingSenderId: "824462651620",
  appId: "1:824462651620:web:5f46fe033ac46d2329bcf1"
};

/**
 * Initialize Firebase
 */
let app, auth, database;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getDatabase(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

/**
 * Validate Firebase services are available
 */
export function validateFirebaseServices() {
  if (!app) {
    throw new Error('Firebase app not initialized');
  }
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }
  if (!database) {
    throw new Error('Firebase Database not initialized');
  }
  return true;
}

/**
 * Get Firebase service status
 */
export function getFirebaseStatus() {
  return {
    app: !!app,
    auth: !!auth,
    database: !!database,
    ready: !!(app && auth && database),
  };
}

export { app, auth, database };
