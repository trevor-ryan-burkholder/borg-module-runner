// Minimal offline service worker.
// - HTML: network-first (so deploys reach users), fall back to cache.
// - Everything else (JS/CSS/JSON/img/fonts): cache-first, with background refresh.
// - Caches are versioned per build (token replaced by Vite at build time);
//   activate prunes every cache that isn't current, so old hashed asset blobs
//   from prior deploys don't accumulate forever in storage.

const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_PREFIX = 'mb-runner-';
const CACHE = `${CACHE_PREFIX}${BUILD_VERSION}`;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Pre-cache the index document into the NEW cache before activate prunes
      // the OLD cache. If the user goes offline between the new SW installing
      // and their next navigation, the activate handler would otherwise leave
      // the cache empty and the navigation would 503. Best-effort: if the
      // fetch fails (already offline), we fall through and the activate prune
      // still runs — at worst no worse than before.
      try {
        const cache = await caches.open(CACHE);
        await cache.add(new Request(self.registration.scope, { cache: 'reload' }));
      } catch { /* offline at install; activate will prune anyway */ }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Delete every prior cache from this app (and any literal-named one from
      // pre-build-stamp deploys), keeping only the active build's cache.
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && (k === 'mb-runner-v1' || k.startsWith(CACHE_PREFIX)))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Same-origin HTML: network-first.
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Same-origin assets and Google Fonts: cache-first.
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.host);
  if (sameOrigin || isFont) {
    event.respondWith(cacheFirst(req));
    return;
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Try the registration scope (the deployed base path) as a fallback for
    // client-side routing. Plain './' is resolved against the SW's own URL
    // (e.g. /borg-module-runner/sw.js), which on GitHub Pages happens to be
    // the right document — but only by accident. Scope is the contract.
    const scope = self.registration.scope;
    const fallback =
      (await cache.match(scope)) ||
      (await cache.match(new URL('./', scope))) ||
      (await cache.match('./'));
    return fallback || new Response('Offline.', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) {
    // Background refresh — don't await.
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('Offline.', { status: 503, statusText: 'Offline' });
  }
}
