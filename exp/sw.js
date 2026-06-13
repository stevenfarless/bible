// BUILD_ID is injected at deploy time by the CI workflow:
//   sed -i "s/c02f416/$GITHUB_SHA/g" sw.js
// The placeholder below is replaced with the full commit SHA before
// the file is published to GitHub Pages. Never edit the placeholder
// directly — changes here are overwritten on every deploy.
let BUILD_ID = 'pending';
let CACHE_NAME = 'bible-pending';

const APP_SHELL_PATTERN = /\.(js|mjs|css)$/;

const PRECACHED_TRANSLATIONS = new Set(['KJV', 'BSB']);

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

const PER_BOOK_PRECACHE = [...PRECACHED_TRANSLATIONS].flatMap(t =>
  CANONICAL_BOOKS.map(b => `./translations/${t}/${encodeURIComponent(b)}.json`)
);

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

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './css/base.css',
  './css/tokens.css',
  './css/fonts.css',
  './css/themes.css',
  './css/layout.css',
  './css/components.css',
  './css/modals.css',
  './css/interactions.css',
  './css/utilities.css',
  './css/pericope.css',
  './app.js',
  './bible-api.js',
  './bible-structure.js',
  './bsb-structure.js',
  './book-aliases.js',
  './reading-state.js',
  './translation-store.js',
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
  './vendor/minisearch/minisearch.esm.min.js',
  './site.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon.ico',
  './fonts/Cinzel-Regular.woff2',
  './fonts/GentiumBookPlus-Regular.woff2',
  './fonts/GentiumBookPlus-Italic.woff2',
  './fonts/GentiumBookPlus-Bold.woff2',
  './fonts/GentiumBookPlus-BoldItalic.woff2',
];

function isFirebaseCacheable(url) {
  if (!url.hostname.endsWith('.firebaseio.com')) return false;
  const p = url.pathname;
  if (p.startsWith('/users/')) return false;
  if (p.startsWith('/translations/')) return true;
  if (p.startsWith('/translationIndex')) return true;
  if (p.startsWith('/searchIndex/')) return true;
  return false;
}

function translationFromUrl(pathname) {
  const m = pathname.match(/\/translations\/([^/]+)\//);
  return m ? m[1] : null;
}

function resolveBuildId() {
  return 'c02f416';
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
  event.waitUntil((async () => {
    BUILD_ID = resolveBuildId();
    CACHE_NAME = `bible-${BUILD_ID}`;
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
  })());
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

    precacheFiles();
  })());
});

self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;

  if (event.data?.type === 'TRANSLATION_INSTALLED') {
    const t = event.data.translation;
    if (t && typeof t === 'string') installedTranslations.add(t);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

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
    // Stale-while-revalidate for app shell JS/CSS:
    // Serve from cache immediately, revalidate in the background.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Start background fetch to keep cache fresh
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(() => {
          // Network fetch failed; that's okay, we already returned cached version
        });
        
        // Return cached version immediately, or wait for network if not cached
        return cached || networkFetch;
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
