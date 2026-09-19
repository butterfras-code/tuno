/* Generated version and scope keep independent tUno installations isolated. */
const VERSION = '__BUILD_VERSION__';
const PREFIX = `tuno:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const INTEGRITY = __RESOURCE_INTEGRITY__;
const requestFor = (url) => new Request(url, { cache: 'reload', integrity: INTEGRITY[new URL(url).pathname.split('/').pop()] });
const RESOURCES = ['index.html', 'app.js', 'app.css'].map((path) => new URL(path, self.registration.scope).href);
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(RESOURCES.map(requestFor));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
  // Never skipWaiting: updates activate only after every existing app tab closes.
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  const key = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html'
    ? RESOURCES[0] : url.origin + url.pathname;
  if (!RESOURCES.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(key) || fetch(event.request);
  })());
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      let entries = await Promise.all(RESOURCES.map((url) => cache.match(url)));
      const missing = RESOURCES.filter((_, index) => !entries[index]);
      if (missing.length) {
        try { await cache.addAll(missing.map(requestFor)); } catch { /* Offline or different deployment: keep readiness false. */ }
        entries = await Promise.all(RESOURCES.map((url) => cache.match(url)));
      }
      event.ports[0].postMessage({ ready: entries.every(Boolean), version: VERSION });
    } catch {
      event.ports[0].postMessage({ ready: false, version: VERSION });
    }
  })());
});
