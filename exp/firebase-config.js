// firebase-config.js
// Centralises Firebase project settings used by client-side modules.
// Only public, non-secret values live here.
// The service account private key is NEVER referenced from browser code.

export const FIREBASE_DB_URL = 'https://esv-bible-6dffb-default-rtdb.firebaseio.com';

const nativeFetch = globalThis.fetch?.bind(globalThis);
let firebaseDatabasePromise = null;

async function getFirebaseDatabase() {
    if (!firebaseDatabasePromise) {
        firebaseDatabasePromise = import('./config/firebase-config.bundle.js')
            .then(({ initializeFirebaseDatabase }) => initializeFirebaseDatabase());
    }
    return firebaseDatabasePromise;
}

function parseBundleBookRequest(input, init) {
    const method = init?.method || input?.method || 'GET';
    if (String(method).toUpperCase() !== 'GET') return null;

    const requestUrl = typeof input === 'string' ? input : input?.url;
    if (!requestUrl) return null;

    let url;
    try {
        url = new URL(requestUrl, globalThis.location?.href || FIREBASE_DB_URL);
    } catch (_) {
        return null;
    }

    if (url.origin !== new URL(FIREBASE_DB_URL).origin) return null;

    const match = url.pathname.match(/^\/bundles\/([^/]+)\/books\/([^/]+)\.json$/);
    if (!match) return null;

    return {
        translation: decodeURIComponent(match[1]),
        book: decodeURIComponent(match[2]),
    };
}

async function fetchBundleBook({ translation, book }) {
    const database = await getFirebaseDatabase();
    const snapshot = await database
        .ref(`bundles/${translation}/books/${book}`)
        .once('value');
    const data = snapshot?.val?.() ?? null;

    return new Response(JSON.stringify(data), {
        status: data === null ? 404 : 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Realtime Database App Check headers are added by the Firebase SDK, not by
// plain REST fetches. Intercept only bundle-book reads and leave all other
// requests on the browser's native fetch path.
if (nativeFetch) {
    globalThis.fetch = async (input, init) => {
        const bundleRequest = parseBundleBookRequest(input, init);
        if (!bundleRequest) return nativeFetch(input, init);
        return fetchBundleBook(bundleRequest);
    };
}
