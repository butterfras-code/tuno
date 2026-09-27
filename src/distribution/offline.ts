import { tuno, type AppIdentity } from './identity.ts';
/** Portable files never register a worker or request hosted resources. */
export function prepareOffline(status: HTMLElement, app: AppIdentity = tuno) {
  status.setAttribute('role', 'status');
  if (location.protocol === 'file:') {
    status.textContent = 'Self-contained offline file';
    return;
  }
  if (!HOSTED_OFFLINE_ENABLED) {
    status.textContent = 'Development build · Offline preparation disabled';
    return;
  }
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'Offline preparation unavailable in this browser';
    return;
  }
  const expectedVersion = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-version"]`)?.content;
  let registration: ServiceWorkerRegistration | undefined;
  let checking = false;
  async function check() {
    if (checking || !registration) return;
    const worker = navigator.serviceWorker.controller;
    if (!worker || worker.scriptURL !== new URL('./sw.js', location.href).href) return;
    checking = true;
    try {
      const result = await new Promise<{ ready: boolean; version: string; appId: string }>((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => { channel.port1.close(); reject(Error('Timed out')); }, 3000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout); channel.port1.close(); resolve(event.data);
        };
        worker.postMessage({ type: 'CHECK_OFFLINE', appId: app.id }, [channel.port2]);
      });
      status.textContent = result.appId === app.id && result.ready && result.version === expectedVersion
        ? 'Offline ready' : 'Offline preparation incomplete · Reopen online to retry';
      if (registration.waiting) status.textContent += ` · Update downloaded. Close all ${app.name} tabs after practice to apply it.`;
    } catch {
      status.textContent = 'Offline preparation could not be verified · Reopen online to retry';
    } finally { checking = false; }
  }
  status.textContent = 'Preparing offline use…';
  navigator.serviceWorker.addEventListener('controllerchange', () => void check());
  window.addEventListener('pageshow', () => void check());
  window.addEventListener('offline', () => void check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  void navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((value) => {
    registration = value;
    const observe = (worker: ServiceWorker | null) => worker?.addEventListener('statechange', () => {
      if (worker.state === 'redundant' && !registration?.active) status.textContent = 'Offline preparation failed · Reopen online to retry';
      void check();
    });
    observe(value.installing);
    value.addEventListener('updatefound', () => observe(value.installing));
    void check();
  }).catch(() => { status.textContent = 'Offline preparation failed · Reopen online to retry'; });
}
