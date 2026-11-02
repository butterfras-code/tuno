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
let appName = '';
let dismissed = new Set<ServiceWorker>();
let checking = false;
let applying = false;
let lastChecked = 0;
let message = '';
const failedChecks = new Set<ServiceWorkerRegistration>();
const downloaded = new Map<ServiceWorkerRegistration, ServiceWorker>();

function registrations() {
  if (!registration) return [];
  return includeSuite && suiteRegistration && suiteRegistration !== registration
    ? [suiteRegistration, registration] : [registration];
}
const pendingUpdates = () => registrations().flatMap(value => value.waiting ? [{ registration: value, worker: value.waiting }] : []);
function availableUpdates() {
  const values = registrations();
  const reload = values.filter(value => location.href.startsWith(value.scope)).sort((a, b) => b.scope.length - a.scope.length)[0];
  const candidate = reload && (reload.waiting ?? downloaded.get(reload));
  // A companion update cannot fix a failed download for the actual reload URL.
  if (reload && failedChecks.has(reload) && (!candidate || candidate.state === 'redundant')) return [];
  return values.flatMap(value => {
    const worker = value.waiting ?? downloaded.get(value);
    return worker && worker.state !== 'redundant' ? [{ registration: value, worker }] : [];
  });
}

function waitForInstall(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', changed);
    };
    const changed = () => {
      if (worker.state === 'redundant') { finish(); reject(Error('Update installation failed')); }
      else if (worker.state === 'installed' || worker.state === 'activated') { finish(); resolve(); }
    };
    const timeout = setTimeout(() => { finish(); reject(Error('Update installation timed out')); }, 45000);
    worker.addEventListener('statechange', changed);
    changed();
  });
}

async function checkForUpdates(manual = false) {
  if (!registration || checking || applying) return;
  if (!manual && (document.hidden || Date.now() - lastChecked < CHECK_INTERVAL)) return;
  if (!navigator.onLine) {
    message = 'You’re offline. Reconnect to check for updates.';
    notify(); return;
  }
  checking = true;
  lastChecked = Date.now();
  message = 'Checking for updates…';
  notify();
  try {
    const results = await Promise.allSettled(registrations().map(async value => {
      try {
        await value.update();
        if (value.installing) await waitForInstall(value.installing);
        failedChecks.delete(value);
      } catch (error) { failedChecks.add(value); throw error; }
    }));
    if (results.some(result => result.status === 'rejected')) throw Error('Update check failed');
    message = availableUpdates().length ? 'A new version is ready.' : 'You’re up to date.';
    if (manual) dismissed.clear();
  } catch {
    message = 'Couldn’t check or download the update. Try again when connected.';
  } finally { checking = false; notify(); }
}

/** Tuner navigation spans its directory worker and the suite's Tone/Tempo cache. */
export function watchForUpdates(value: ServiceWorkerRegistration, app: AppIdentity, primary = true) {
  if (primary) {
    registration = value;
    appName = app.name;
    includeSuite = app.id === 'tuno';
  } else suiteRegistration = value;
  const expectedVersion = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-version"]`)?.content;
  const verifyVersion = () => {
    if (!primary || !expectedVersion || !value.active) return;
    const active = value.active;
    void requestUpdate(active, 'CHECK_OFFLINE').then(result => {
      if (result.version && result.version !== expectedVersion) { downloaded.set(value, active); notify(); }
    }).catch(() => { /* The offline status owns verification failures. */ });
  };
  const observe = (worker: ServiceWorker | null) => {
    if (!worker) return;
    const updating = Boolean(value.active);
    const changed = () => {
      // A worker can activate naturally while this document still runs old JS.
      // Keep offering a reload after activation, without forcing one mid-practice.
      if (updating && ['installed', 'activating', 'activated'].includes(worker.state)) downloaded.set(value, worker);
      if (worker.state === 'activated') verifyVersion();
      notify();
    };
    worker.addEventListener('statechange', changed);
    changed();
  };
  if (value.waiting) downloaded.set(value, value.waiting);
  observe(value.installing);
  value.addEventListener('updatefound', () => { observe(value.installing); notify(); });
  verifyVersion();
  notify();
  void checkForUpdates();
}

window.addEventListener('online', () => { lastChecked = 0; void checkForUpdates(); });
window.addEventListener('pageshow', () => void checkForUpdates());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdates(); });
setInterval(() => void checkForUpdates(), CHECK_INTERVAL);

async function applyUpdate() {
  if (!availableUpdates().length || applying || checking) return;
  applying = true;
  message = 'Preparing to update…';
  notify();
  try {
    // A companion cache may still be installing when the first one is ready.
    await Promise.all(registrations().map(value => value.installing ? waitForInstall(value.installing) : undefined));
    const reloadRegistration = await navigator.serviceWorker.getRegistration(location.href);
    if (!reloadRegistration || (failedChecks.has(reloadRegistration) && !reloadRegistration.waiting
      && downloaded.get(reloadRegistration) !== reloadRegistration.active)) throw Error('Reload cache is not ready');
    // Storage may have been evicted since installation. Never replace a working
    // version with an incomplete cache, especially when applying offline.
    for (const { worker } of availableUpdates()) {
      if (!(await requestUpdate(worker, 'CHECK_OFFLINE')).ready) throw Error('Update cache is incomplete');
    }
    const pending = pendingUpdates();
    // Check every affected scope before changing either cache. Otherwise a Tone
    // or Tempo tab could keep the root cache old after the tune worker updates.
    for (const { registration: value, worker } of pending) {
      if (worker.state === 'activated') continue;
      if (!value.active) throw Error('No active worker');
      const result = await requestUpdate(value.active, 'CHECK_UPDATE_CLIENTS');
      if (result.status === 'other-tabs') {
        message = 'Close other tabs or app windows for this tool, then try Update and reload again. Your practice here stays open.';
        return;
      }
      if (result.status !== 'allowed' && value.active !== worker) throw Error('Update no longer ready');
    }
    message = 'Updating… This page will reload.';
    notify();
    for (const { registration: value, worker } of pending) {
      if (worker.state === 'activated') continue;
      if (!value.active) throw Error('No active worker');
      const result = await requestUpdate(value.active, 'APPLY_UPDATE');
      if (result.status === 'other-tabs') {
        message = 'Close other tabs or app windows for this tool, then try Update and reload again. Your practice here stays open.';
        return;
      }
      if (result.status !== 'activating' && value.active !== worker) throw Error('Update no longer ready');
      await waitForActivation(worker);
    }
    location.reload();
  } catch {
    message = 'Couldn’t apply the update. Try again, or close this tool’s tabs and reopen it online.';
  } finally {
    applying = false;
    notify();
  }
}

function requestUpdate(worker: ServiceWorker, type: string) {
  return new Promise<{ status?: string; version?: string; ready?: boolean }>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(Error('Update request timed out')); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
    worker.postMessage({ type }, [channel.port2]);
  });
}

function waitForActivation(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', changed);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
    };
    const changed = () => {
      if (worker.state !== 'activated') return;
      // Activation and controllerchange can arrive in either order.
      if (navigator.serviceWorker.controller?.scriptURL === worker.scriptURL
        && navigator.serviceWorker.controller !== worker) return;
      finish(); resolve();
    };
    const timeout = setTimeout(() => { finish(); reject(Error('Activation timed out')); }, 15000);
    worker.addEventListener('statechange', changed);
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    changed();
  });
}

function subscribe(node: HTMLElement, update: () => void) {
  listeners.add(update);
  onUnmount(node, () => listeners.delete(update));
  update();
}

/** An in-flow notice never covers practice controls or steals focus. */
export function createUpdateNotice() {
  const node = el('section', 'update-notice');
  node.setAttribute('aria-label', 'App update');
  const copy = el('div', 'update-copy');
  copy.setAttribute('role', 'status');
  const title = el('strong');
  const detail = el('p');
  copy.append(title, detail);
  const actions = el('div', 'update-actions');
  const update = button('Update and reload', () => void applyUpdate());
  const later = button('Later', () => {
    dismissed = new Set(availableUpdates().map(value => value.worker));
    notify();
    const heading = document.querySelector<HTMLHeadingElement>('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  });
  actions.append(update, later);
  node.append(copy, actions);
  subscribe(node, () => {
    const pending = availableUpdates();
    node.hidden = !applying && !pending.some(value => !dismissed.has(value.worker));
    const heading = pending.length || applying ? `A new version of ${appName} is ready` : '';
    const description = !pending.length && !applying ? '' : applying || message.includes('Close other') || message.startsWith('Couldn’t apply')
      ? message : 'Reload when you’re ready. Saved settings and progress stay on this device; current practice restarts.';
    if (title.textContent !== heading) title.textContent = heading;
    if (detail.textContent !== description) detail.textContent = description;
    update.disabled = applying || checking;
    later.disabled = applying;
  });
  return node;
}

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
  const update = button('Update and reload', () => void applyUpdate());
  actions.append(check, update);
  node.append(result, actions);
  subscribe(node, () => {
    check.disabled = !registration || checking || applying;
    update.hidden = !availableUpdates().length;
    update.disabled = applying || checking;
    result.textContent = availableUpdates().length && !checking && !applying && (!message || message === 'You’re up to date.')
      ? 'A new version is ready.' : message || (HOSTED_OFFLINE_ENABLED
      ? registration ? 'Check whether a newer version is available.' : 'Update checks are preparing or unavailable in this browser.'
      : 'Development build · Update checks disabled');
  });
  return node;
}
