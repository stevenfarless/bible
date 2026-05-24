const BUILD_ID = "6de1702aa33009c5a5b9b59e598a665ae110b9f7";
const CACHE_NAME = `esv-bible-${BUILD_ID}`;

// App shell JS modules — always fetched from the network so a refresh
// always runs the latest deployed code. Never serve these from cache.
const APP_SHELL_PATTERN = /\.(js|mjs)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const hadPreviousCache = keys.some(k => k !== CACHE_NAME && k.startsWith('esv-bible-'));
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    if (hadPreviousCache) {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'NEW_VERSION', buildId: BUILD_ID });
      }
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache the service worker script itself.
  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never cache Firebase RTDB requests — always fetch live data.
  if (url.hostname.endsWith('.firebaseio.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell JS: network-first, no caching.
  // This ensures a refresh always executes the latest deployed code.
  if (APP_SHELL_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Offline fallback only — return cached copy if network is unreachable.
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
        const resp = await fetch(event.request);
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

  // Everything else (JSON data files, CSS, fonts, images): cache-first.
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
