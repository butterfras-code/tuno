/* Retirement update for the former root-scoped tUno worker.
 * Keep this URL available for returning installations. Do not skipWaiting or
 * claim clients: existing sessions and offline caches survive until tabs close.
 * No fetch handler: this worker must never serve a sibling application's pages.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const rootScope = new URL('/', self.location.origin).href;
    if (self.registration.scope !== rootScope) return;
    const prefix = `tuno:${rootScope}:`;
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix)) await caches.delete(key);
    }
    await self.registration.unregister();
  })());
});
