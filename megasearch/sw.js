const BUILD_ID = "125564e72aecc898623140f6794f315fa40c88c0";
const CACHE_NAME = `esv-bible-${BUILD_ID}`;

// App shell JS modules (everything under the root except vendor/):
// network-first, bypass the browser HTTP cache entirely so refreshes
// always run the latest deployed code.
// vendor/ files are third-party SDKs that never change for a given
// version — they go through the cache-first path below.
const APP_SHELL_PATTERN = /^(?!\..*\/vendor\/).*\.(js|mjs)$/;

// Firebase RTDB paths that are safe to cache indefinitely.
// Bible text, translation index, and search index never change for a given
// translation. Only user-specific paths (/users/) must always be live.
function isFirebaseCacheable(url) {
  if (!url.hostname.endsWith('.firebaseio.com')) return false;
  const p = url.pathname;
  // Never cache user account data.
  if (p.startsWith('/users/')) return false;
  // Cache Bible text, translation index, and search index.
  if (p.startsWith('/translations/')) return true;
  if (p.startsWith('/translationIndex')) return true;
  if (p.startsWith('/searchIndex/')) return true;
  return false;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete caches from previous builds.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();

    // Only broadcast RELOAD when this SW is replacing a *different* build.
    // If BUILD_ID hasn't changed (e.g. same deploy, page refresh), skip the
    // reload — otherwise every refresh triggers a redundant page reload.
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    for (const client of allClients) {
      client.postMessage({ type: 'NEW_BUILD', buildId: BUILD_ID });
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

  // App shell JS: network-first, bypass the browser HTTP cache entirely.
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

  // Everything else (vendor JS, JSON data files, CSS, fonts, images): cache-first.
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
