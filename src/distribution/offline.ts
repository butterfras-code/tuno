import { tuno, type AppIdentity } from './identity.ts';
import { watchForUpdates } from './updates.ts';
/** Verify cached resources before promising offline use. */
export function prepareOffline(status: HTMLElement, app: AppIdentity = tuno, workerOptions = { worker: './sw.js', scope: './' }, primaryUpdates = true) {
  if (app.id === 'tuno' && /^\/(tone|tempo)\//.test(location.pathname)) {
    app = { id: 'suite', name: 'Practice Tools' };
    workerOptions = { worker: '/suite-sw.js', scope: '/' };
  }
  // Resolve once: History API navigation must not change the expected worker URL.
  const workerUrl = new URL(workerOptions.worker, location.href).href;
  status.setAttribute('role', 'status');
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
  let checkAgain = false;
  let synced = false;
  let updateRequestedFor: string | undefined;
  let updateSettledFor: string | undefined;
  async function check() {
    if (!registration) return;
    if (checking) { checkAgain = true; return; }
    const worker = navigator.serviceWorker.controller;
    if (!worker || worker.scriptURL !== workerUrl) return;
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
      if (result.appId === app.id && result.ready && (result.version === expectedVersion || synced)) {
        synced = true;
        status.textContent = 'Offline ready';
      } else if (result.appId === app.id && result.version !== expectedVersion && navigator.onLine
        && (registration.installing || registration.waiting || updateSettledFor !== result.version)) {
        status.textContent = 'Updating offline copy…';
        if (registration.waiting && registration.active) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        if (updateRequestedFor !== result.version) {
          updateRequestedFor = result.version;
          void registration.update().catch(() => {}).finally(() => {
            updateSettledFor = result.version;
            if (!registration?.installing && !registration?.waiting) void check();
          });
        }
      } else if (registration.installing || registration.waiting) {
        status.textContent = 'Preparing offline use…';
      } else {
        status.textContent = 'Offline preparation incomplete · Reopen online to retry';
      }
    } catch {
      status.textContent = 'Offline preparation could not be verified · Reopen online to retry';
    } finally {
      checking = false;
      if (checkAgain) { checkAgain = false; void check(); }
    }
  }
  status.textContent = 'Preparing offline use…';
  navigator.serviceWorker.addEventListener('controllerchange', () => void check());
  window.addEventListener('pageshow', () => void check());
  window.addEventListener('offline', () => void check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  void navigator.serviceWorker.register(workerUrl, { scope: workerOptions.scope, updateViaCache: 'none' }).then((value) => {
    registration = value;
    watchForUpdates(value, app, primaryUpdates);
    const observe = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        if (worker.state === 'installed' && value.active) {
          worker.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        if (worker.state === 'redundant' && !registration?.active) status.textContent = 'Offline preparation failed · Reopen online to retry';
        void check();
      };
      worker.addEventListener('statechange', onState);
      onState();
    };
    if (value.waiting && value.active) value.waiting.postMessage({ type: 'SKIP_WAITING' });
    observe(value.installing);
    value.addEventListener('updatefound', () => observe(value.installing));
    void check();
  }).catch(() => { status.textContent = 'Offline preparation failed · Reopen online to retry'; });
}
