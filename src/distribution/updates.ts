import { button, el } from '../shared/ui/components.ts';
import { onUnmount } from '../shared/ui/unmount.ts';
import type { AppIdentity } from './identity.ts';
import './updates.css';

const CHECK_INTERVAL = 5 * 60 * 1000;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
let registration: ServiceWorkerRegistration | undefined;
let suiteRegistration: ServiceWorkerRegistration | undefined;
let includeSuite = false;
let expectedVersion: string | undefined;
let checking = false;
let lastChecked = 0;
let updateReady = false;
let message = '';

function registrations() {
  if (!registration) return [];
  return includeSuite && suiteRegistration && suiteRegistration !== registration
    ? [suiteRegistration, registration] : [registration];
}

function requestOfflineStatus(worker: ServiceWorker) {
  return new Promise<{ version?: string; ready?: boolean }>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(Error('Update request timed out')); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
    worker.postMessage({ type: 'CHECK_OFFLINE' }, [channel.port2]);
  });
}

function waitForActivation(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', changed);
    };
    const changed = () => {
      if (worker.state === 'redundant') { finish(); reject(Error('Update installation failed')); }
      else if (worker.state === 'activated') { finish(); resolve(); }
    };
    const timeout = setTimeout(() => { finish(); reject(Error('Update installation timed out')); }, 45000);
    worker.addEventListener('statechange', changed);
    changed();
  });
}

async function verifyActiveVersion() {
  const active = registration?.active;
  if (!active || !expectedVersion) return;
  try {
    const result = await requestOfflineStatus(active);
    updateReady = Boolean(result.ready && result.version && result.version !== expectedVersion);
    notify();
  } catch { /* Offline status indicator handles verification errors. */ }
}

async function checkForUpdates(manual = false) {
  if (!registration || checking) return;
  if (!manual && (document.hidden || Date.now() - lastChecked < CHECK_INTERVAL)) return;
  if (!navigator.onLine) {
    if (manual) {
      message = 'You’re offline. Reconnect to check for updates.';
      notify();
    }
    return;
  }
  checking = true;
  lastChecked = Date.now();
  if (manual) {
    message = 'Checking for updates…';
    notify();
  }
  try {
    const results = await Promise.allSettled(registrations().map(async value => {
      await value.update();
      const pending = value.installing ?? value.waiting;
      if (pending) {
        if (pending.state === 'installed') pending.postMessage({ type: 'SKIP_WAITING' });
        await waitForActivation(pending);
      }
    }));
    if (results.some(result => result.status === 'rejected')) throw Error('Update check failed');
    await verifyActiveVersion();
    if (manual) {
      message = updateReady ? 'A new version is ready. Reload to switch to it.' : 'You’re up to date.';
    }
  } catch {
    if (manual) message = 'Couldn’t check or download the update. Try again when connected.';
  } finally {
    checking = false;
    notify();
  }
}

/** Keep offline caches fresh in the background without interrupting practice. */
export function watchForUpdates(value: ServiceWorkerRegistration, app: AppIdentity, primary = true) {
  if (primary) {
    registration = value;
    includeSuite = app.id === 'tuno';
    expectedVersion = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-version"]`)?.content;
  } else {
    suiteRegistration = value;
  }
  const observe = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' && primary) void verifyActiveVersion();
    });
  };
  observe(value.installing);
  value.addEventListener('updatefound', () => observe(value.installing));
  if (primary) {
    navigator.serviceWorker.addEventListener('controllerchange', () => void verifyActiveVersion());
    void verifyActiveVersion();
  }
  notify();
  void checkForUpdates();
}

window.addEventListener('online', () => { lastChecked = 0; void checkForUpdates(); });
window.addEventListener('pageshow', () => void checkForUpdates());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdates(); });
setInterval(() => void checkForUpdates(), CHECK_INTERVAL);

export function createUpdateControls(app: AppIdentity) {
  const node = el('section', 'update-controls');
  node.setAttribute('aria-label', 'Version and updates');
  const build = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-version"]`)?.content
    ?? document.querySelector<HTMLMetaElement>('meta[name="suite-version"]')?.content;
  const release = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-release"]`)?.content;
  if (build) node.append(el('p', 'update-build', `${app.name}${release ? ` ${release}` : ''} · Build ${build}`));
  const result = el('p'); result.setAttribute('role', 'status');
  const actions = el('div', 'update-actions');
  const check = button('Check for updates', () => void checkForUpdates(true));
  const reload = button('Reload', () => location.reload());
  actions.append(check, reload);
  node.append(result, actions);
  const update = () => {
    check.disabled = !registration || checking;
    reload.hidden = !updateReady;
    reload.disabled = checking;
    result.textContent = updateReady && !checking && (!message || message === 'You’re up to date.')
      ? 'A new version is ready. Reload to switch to it.' : message || (HOSTED_OFFLINE_ENABLED
      ? registration
        ? 'Live updates load automatically when online; offline copies refresh in the background.'
        : 'Update checks are preparing or unavailable in this browser.'
      : 'Development build · Update checks disabled');
  };
  listeners.add(update);
  onUnmount(node, () => listeners.delete(update));
  update();
  return node;
}
