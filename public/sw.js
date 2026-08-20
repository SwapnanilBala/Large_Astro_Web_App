importScripts('/sw-cache-policy.js');

/*
 * Editing sw-cache-policy.js alone is enough for current browsers — the update
 * algorithm re-fetches imported scripts and treats a byte change as a new
 * worker. Older engines only compared this file, so if a policy change ever
 * needs to reach everyone, touch this file too.
 */

/*
 * Cache version. Bumping it purges every earlier cache in the activate handler
 * below, which is how devices that already stored birth details under the old
 * policy get cleaned. v3 cached every successful navigation and API response,
 * including /insights?name=...&birthDate=...&birthTime=...&latitude=... — so
 * this bump is the cleanup, not just a cache-busting formality. Do not reuse an
 * old name.
 */
const CACHE_NAME = 'lagna-v4';

/*
 * Only the offline page is pre-cached. v2 also pre-cached '/', which is one of
 * the paths proxy.ts varies by User-Agent: on a handset the install-time fetch
 * follows the 307 and stores the /m document under the key '/'.
 */
const PRECACHE = ['/offline.html'];

const ORIGIN = self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** Store a response only if the policy allows it. Never blocks the response. */
function maybeCache(request, response) {
  if (!response || !response.ok || response.redirected) return;
  if (!self.isCacheable(request, ORIGIN)) return;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  /* Content-hashed build output: cache-first, since the URL changes with the
     bytes. This is the only place a cached copy is preferred over the network. */
  if (self.isCacheFirst(request, ORIGIN)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            maybeCache(request, response);
            return response;
          })
      )
    );
    return;
  }

  /* Navigations: network-first, falling back to a cached copy where the policy
     permitted one and to the offline page otherwise. A personalised URL has
     nothing cached by design, so it lands on /offline.html rather than showing
     a previous visitor's chart. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          maybeCache(request, response);
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  /* Everything else — including /api/*, which the policy never stores. Offline,
     a chart request fails rather than resolving with another profile's data. */
  event.respondWith(
    fetch(request)
      .then((response) => {
        maybeCache(request, response);
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
