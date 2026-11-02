/* Generated version and scope keep independent app installations isolated. */
const VERSION = '__BUILD_VERSION__';
const PREFIX = `__APP_ID__:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const INTEGRITY = __RESOURCE_INTEGRITY__;
const requestFor = (url) => new Request(url, { cache: 'reload', integrity: INTEGRITY[new URL(url).href.slice(self.registration.scope.length)] });
const RESOURCES = Object.keys(INTEGRITY).map((path) => new URL(path, self.registration.scope).href);
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
  // Updates wait for tabs to close unless the user explicitly applies one below.
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
  if (__EXCLUDED_PATHS__.some(path => url.pathname.startsWith(scope.pathname + path))) return;
  const key = url.origin + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
  if (!RESOURCES.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (!cached) return fetch(event.request);
    // Hosts can redirect index.html to the scope root during precaching.
    // Navigation requests use redirect: 'manual' and reject a followed redirect.
    // Rebuild the verified cached response to remove its redirect history.
    if (cached.redirected && event.request.redirect !== 'follow') {
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
    }
    return cached;
  })());
});
self.addEventListener('message', (event) => {
  if (['CHECK_UPDATE_CLIENTS', 'APPLY_UPDATE'].includes(event.data?.type) && event.ports[0] && event.source?.id) {
    event.waitUntil((async () => {
      const waiting = self.registration.waiting;
      if (!waiting) { event.ports[0].postMessage({ status: 'not-ready' }); return; }
      // Ask the ACTIVE worker: its default client list includes only windows it
      // controls, so sibling apps with more-specific registrations do not block.
      const windows = await self.clients.matchAll({ type: 'window' });
      if (windows.some(client => client.id !== event.source.id)) {
        event.ports[0].postMessage({ status: 'other-tabs' }); return;
      }
      if (event.data.type === 'CHECK_UPDATE_CLIENTS') {
        event.ports[0].postMessage({ status: 'allowed' }); return;
      }
      waiting.postMessage({ type: 'ACTIVATE_UPDATE' }, [event.ports[0]]);
    })());
    return;
  }
  // Only the active worker can authorize activation after checking its clients.
  if (event.data?.type === 'ACTIVATE_UPDATE' && event.ports[0]
    && event.source?.scriptURL === self.registration.active?.scriptURL
    && event.source?.state === 'activated') {
    event.ports[0].postMessage({ status: 'activating' });
    event.waitUntil(self.skipWaiting());
    return;
  }
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
      event.ports[0].postMessage({ ready: entries.every(Boolean), version: VERSION, appId: '__APP_ID__' });
    } catch {
      event.ports[0].postMessage({ ready: false, version: VERSION, appId: '__APP_ID__' });
    }
  })());
});
