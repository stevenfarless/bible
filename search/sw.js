const BUILD_ID = "7d13f9be6be8be7caa7cfb6de4ca32f4240b9cce";
const CACHE_NAME = `esv-bible-${BUILD_ID}`;

// App shell JS modules — always fetched from the network so a refresh
// always runs the latest deployed code. Never serve these from cache.
const APP_SHELL_PATTERN = /\.(js|mjs)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete any caches from previous versions.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
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

  // App shell JS: network-first, bypass the browser HTTP cache entirely.
  // cache: 'no-store' prevents the browser's memory/disk cache from
  // satisfying the fetch before it reaches the network.
  if (APP_SHELL_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' })).catch(async () => {
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
        // cache: 'no-store' bypasses Brave iOS shields and the browser HTTP
        // cache so the fresh HTML (with the updated ?v=<SHA> script src) is
        // always fetched from the network on every load.
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
