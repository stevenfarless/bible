const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `bible-${BUILD_ID}`;

// App shell assets (JS modules + CSS): network-first, bypass the browser
// HTTP cache entirely so style and code changes deploy immediately.
// vendor/ files are third-party SDKs that never change for a given
// version — they go through the cache-first path below.
const APP_SHELL_PATTERN = /^(?!\..*\/vendor\/).*\.(js|mjs|css)$/;

// Translation bible.json files to precache on install.
// These are large and slow to fetch cold; having them warm makes every
// new-build first load fast.
const TRANSLATION_FILES = [
  './translations/index.json',
  './translations/ASV/ASV_bible.json',
  './translations/BLB/BLB_bible.json',
  './translations/BSB/BSB_bible.json',
  './translations/KJV/KJV_bible.json',
  './translations/LEB/LEB_bible.json',
  './translations/MSB/MSB_bible.json',
  './translations/NET/NET_bible.json',
  './translations/WEB/WEB_bible.json',
];

// BSB structure files (per-book JSON) that appear frequently in cache logs.
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

async function precacheTranslations() {
  const cache = await caches.open(CACHE_NAME);
  // Fetch all translation files in parallel, ignoring individual failures
  // so a single slow file doesn't block the rest.
  await Promise.allSettled(
    [...TRANSLATION_FILES, ...BSB_STRUCTURE_FILES].map(async (url) => {
      try {
        const cached = await cache.match(url);
        if (cached) return; // already warm from a previous request this session
        const resp = await fetch(url);
        if (resp && resp.status === 200) {
          await cache.put(url, resp);
        }
      } catch {
        // Network unavailable — skip silently; cache-first fetch will retry.
      }
    })
  );
}

self.addEventListener('install', (event) => {
  // skipWaiting so the new SW activates immediately.
  self.skipWaiting();

  // Precache the app shell synchronously so the SW is useful right away.
  // Translation files are large; precache them in the background after
  // activation instead (see 'activate' handler below).
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        './',
        './translations/index.json',
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete caches from previous builds.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();

    // Broadcast new build to all open windows.
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    for (const client of allClients) {
      client.postMessage({ type: 'NEW_BUILD', buildId: BUILD_ID });
    }

    // Precache all translation files in the background after activation.
    // This doesn't block activation — it runs concurrently.
    precacheTranslations();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache the service worker script or version.txt — always network.
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.txt')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Firebase RTDB — cacheable Bible data goes cache-first;
  // everything else (user data, auth) bypasses the cache entirely.
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

  // App shell JS + CSS: network-first, bypass the browser HTTP cache entirely.
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
