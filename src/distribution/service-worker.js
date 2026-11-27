/* Generated version and scope keep independent app installations isolated. */
const VERSION = '__BUILD_VERSION__';
const PREFIX = `__APP_ID__:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const INTEGRITY = __RESOURCE_INTEGRITY__;
const NETWORK_TIMEOUT_MS = 4000;
const requestFor = (url) => new Request(url, { cache: 'reload', integrity: INTEGRITY[new URL(url).href.slice(self.registration.scope.length)] });
const RESOURCES = Object.keys(INTEGRITY).map((path) => new URL(path, self.registration.scope).href);

function cleanCachedResponse(cached, request) {
  // Hosts can redirect index.html to the scope root during precaching.
  // Navigation requests use redirect: 'manual' and reject a followed redirect.
  // Rebuild the verified cached response to remove its redirect history.
  if (cached.redirected && request.redirect !== 'follow') {
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: cached.headers,
    });
  }
  return cached;
}

function fetchWithTimeout(request, timeoutMs) {
  let timer;
  const network = fetch(request).then(
    (response) => { clearTimeout(timer); return response; },
    (error) => { clearTimeout(timer); throw error; },
  );
  // Suppress late rejections when the timeout wins first.
  network.catch(() => {});
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
  });
  return Promise.race([network, timeout]);
}

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
    try {
      const response = cached
        ? await fetchWithTimeout(event.request, NETWORK_TIMEOUT_MS)
        : await fetch(event.request);
      if (response.type === 'opaqueredirect' || response.ok || response.status < 500 || !cached) {
        return response;
      }
    } catch { /* Offline or network timeout: fall back to the verified precache. */ }
    if (cached) return cleanCachedResponse(cached, event.request);
    return fetch(event.request);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }
  // Backward compatibility for existing production tabs clicking the old
  // "Update and reload" button during transition to network-first updates.
  if (event.data?.type === 'ACTIVATE_UPDATE' && event.ports[0]) {
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
