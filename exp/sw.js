const BUILD_ID = "bbf2bea4e9a88e4f92b5174376dd8f7ce19c5740";
const CACHE_NAME = `bible-${BUILD_ID}`;

// App shell assets (JS modules + CSS): network-first, bypass the browser
// HTTP cache entirely so style and code changes deploy immediately.
// vendor/ files are third-party SDKs that never change for a given
// version — they go through the cache-first path below.
const APP_SHELL_PATTERN = /^(?!\\..*\/vendor\/).*\.(js|mjs|css)$/;

// Translations whose data ships with the app and is cached at install time.
// Nothing outside this set is written to the SW cache unless the user
// explicitly downloads it via the translation picker.
const PRECACHED_TRANSLATIONS = new Set(['KJV', 'BSB']);

// Translations the user has downloaded during this SW lifetime.
// Populated via postMessage({ type: 'TRANSLATION_INSTALLED', translation }).
// Resets on SW restart — the API layer (bible-api.js) is the authoritative
// install record via IDB; this set just gates SW cache writes.
const installedTranslations = new Set(PRECACHED_TRANSLATIONS);

const CANONICAL_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
  'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalm','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah',
  'Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah',
  'Haggai','Zechariah','Malachi','Matthew','Mark','Luke',
  'John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
  'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
];

// All 66 books for KJV and BSB precached at activation so both translations
// are fully available offline immediately after PWA install.
const PER_BOOK_PRECACHE = [...PRECACHED_TRANSLATIONS].flatMap(t =>
  CANONICAL_BOOKS.map(b => `./translations/${t}/${encodeURIComponent(b)}.json`)
);

// BSB structure files (per-book JSON) used by bsb-structure.js.
const BSB_STRUCTURE_FILES = [
  './translations/BSB/BSB_structure/Genesis.json',
  './translations/BSB/BSB_structure/Psalm.json',
  './translations/BSB/BSB_structure/John.json',
  './translations/BSB/BSB_structure/Leviticus.json',
  './translations/BSB/BSB_structure/Matthew.json',
  './translations/BSB/BSB_structure/Mark.json',
  './translations/BSB/BSB_structure/Luke.json',
  './translations/BSB/BSB_structure/Acts.json',
  './translations/BSB/BSB_structure/Romans.json',
  './translations/BSB/BSB_structure/Revelation.json',
];

// Full app shell — everything needed to render the UI without any network.
// KJV and BSB search indexes are included here so offline search works
// immediately after PWA install without requiring a prior online session.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './bible-api.js',
  './bible-structure.js',
  './bsb-structure.js',
  './book-aliases.js',
  './reading-state.js',
  './ui.js',
  './navigation.js',
  './search.js',
  './auth.js',
  './modals.js',
  './settings.js',
  './keyboard.js',
  './events.js',
  './swipe.js',
  './firebase-config.js',
  './translations/index.json',
  './translations/KJV/KJV_search_index.json',
  './translations/BSB/BSB_search_index.json',
  './site.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon.ico',
  // Self-hosted fonts — precached so they load offline with no latency.
  './fonts/Cinzel-Regular.woff2',
  './fonts/GentiumBookPlus-Regular.woff2',
  './fonts/GentiumBookPlus-Italic.woff2',
  './fonts/GentiumBookPlus-Bold.woff2',
  './fonts/GentiumBookPlus-BoldItalic.woff2',
];

// Firebase RTDB paths that are safe to cache indefinitely.
function isFirebaseCacheable(url) {
  if (!url.hostname.endsWith('.firebaseio.com')) return false;
  const p = url.pathname;
  if (p.startsWith('/users/')) return false;
  if (p.startsWith('/translations/')) return true;
  if (p.startsWith('/translationIndex')) return true;
  if (p.startsWith('/searchIndex/')) return true;
  return false;
}

// Extract the translation abbreviation from a local translation file URL.
// e.g. /bible/exp/translations/NIV/John.json → "NIV"
// Returns null if the URL is not a translation data file.
function translationFromUrl(pathname) {
  const m = pathname.match(/\/translations\/([^/]+)\//);
  return m ? m[1] : null;
}

async function precacheFiles() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    [...PER_BOOK_PRECACHE, ...BSB_STRUCTURE_FILES].map(async (url) => {
      try {
        const cached = await cache.match(url);
        if (cached) return;
        const resp = await fetch(url);
        if (resp && resp.status === 200) {
          await cache.put(url, resp);
        }
      } catch {
        // Network unavailable — skip silently.
      }
    })
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL)
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();

    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    for (const client of allClients) {
      client.postMessage({ type: 'NEW_BUILD', buildId: BUILD_ID });
    }

    // Precache all KJV and BSB book files in the background after activation.
    precacheFiles();
  })());
});

// The app notifies the SW when a translation download completes so the SW
// cache write gate opens for that translation's files.
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;

  if (event.data?.type === 'TRANSLATION_INSTALLED') {
    const t = event.data.translation;
    if (t && typeof t === 'string') installedTranslations.add(t);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pass through all cross-origin requests the SW has no business handling.
  if (url.origin !== self.location.origin &&
      !url.hostname.endsWith('.firebaseio.com') &&
      !url.hostname.endsWith('.firebase.google.com')) {
    return;
  }

  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.txt')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.hostname.endsWith('.firebaseio.com')) {
    if (isFirebaseCacheable(url)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (event.request.method === 'GET' && resp && resp.status === 200) {
            cache.put(event.request, resp.clone());
          }
          return resp;
        } catch {
          return new Response('Offline', { status: 503 });
        }
      })());
    } else {
      event.respondWith(fetch(event.request));
    }
    return;
  }

  if (APP_SHELL_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' })).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  const isRoot = url.pathname === '/' || url.pathname.endsWith('/index.html');

  if (isRoot) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(new Request(event.request, { cache: 'no-store' }));
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, resp.clone());
        return resp;
      } catch {
        const cached = await caches.match(event.request);
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Everything else (vendor JS, JSON data files, fonts, images): cache-first.
  // For translation data files, only write to the SW cache if the translation
  // is precached (KJV/BSB) or has been explicitly installed by the user.
  // Non-installed translations are served from the network but never stored.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const resp = await fetch(event.request);
      if (event.request.method === 'GET' && resp && resp.status === 200) {
        const translation = translationFromUrl(url.pathname);
        const allowCache = translation === null || installedTranslations.has(translation);
        if (allowCache) cache.put(event.request, resp.clone());
      }
      return resp;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  })());
});
