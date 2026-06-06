const BUILD_ID = "7f7a7a7f1b621da087394b87e49bcdc31ebcba87";
const CACHE_NAME = `bible-${BUILD_ID}`;

// App shell assets (JS modules + CSS): network-first, bypass the browser
// HTTP cache entirely so style and code changes deploy immediately.
// vendor/ files are third-party SDKs that never change for a given
// version — they go through the cache-first path below.
const APP_SHELL_PATTERN = /^(?!\..*\/vendor\/).*\.(js|mjs|css)$/;

const TRANSLATIONS = [
  'ASV', 'BLB', 'BSB', 'CSB', 'ESV', 'ISV', 'KJV', 'LEB',
  'MEV', 'MSB', 'NET', 'NIV', 'NKJV', 'NLT', 'NRSVUE', 'WEB',
];

// High-value per-book files to precache on activation.
// Genesis covers the default landing page; John covers the most commonly
// read book. Everything else loads on demand and caches after first open.
// 2 books × 16 translations × ~80KB avg = ~2.6MB total install payload.
const HIGH_VALUE_BOOKS = ['John', 'Genesis'];

const PER_BOOK_PRECACHE = TRANSLATIONS.flatMap(t =>
  HIGH_VALUE_BOOKS.map(b => `./translations/${t}/${b}.json`)
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

    // Precache high-value per-book files in the background after activation.
    precacheFiles();
  })());
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
});
