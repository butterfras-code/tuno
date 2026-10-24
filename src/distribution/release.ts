import { tuno, type AppIdentity } from './identity.ts';
import { button, el } from '../shared/ui/components.ts';
import { onUnmount } from '../shared/ui/unmount.ts';
import './release.css';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let prompt: InstallPrompt | undefined;
let installing = false;
let installed = matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
let message = installed ? 'This app is running as an installed app.' : '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
// Capture once at module load, including before installation panels are opened.
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  prompt = event as InstallPrompt;
  installed = false;
  notify();
});
window.addEventListener('appinstalled', () => {
  prompt = undefined;
  installed = true;
  message = 'App installed. Wait for “Offline ready” before practicing without a connection.';
  notify();
});

/** Called directly from a click to preserve the browser's user activation. */
function requestInstall(fallback: () => void) {
  if (installing) return;
  const request = prompt;
  if (!request || installed) { fallback(); return; }
  prompt = undefined;
  installing = true;
  notify();
  void (async () => {
    try {
      await request.prompt();
      const choice = await request.userChoice;
      message = choice.outcome === 'accepted' ? 'Installation requested.' : 'Installation cancelled. You can keep practicing here.';
    } catch {
      message = 'Installation could not start. Use your browser’s install menu if available.';
    } finally {
      installing = false;
      notify();
      fallback();
    }
  })();
}

function createReleaseControls(app: AppIdentity = tuno) {
  const node = el('section', 'release-controls');
  node.setAttribute('aria-label', `Keep ${app.name}`);
  const help = el('div', 'install-help');
  const guidance = el('p', '', 'Look for Install or Add to Home Screen in your browser’s menu. You can also look for an install icon like this in the address bar: ');
  // A small vector example stays crisp at any zoom; browser icons vary.
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 32 32');
  icon.setAttribute('class', 'install-icon');
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', 'Install icon: a downward arrow into a computer screen');
  const path = document.createElementNS(icon.namespaceURI, 'path');
  path.setAttribute('d', 'M11 5H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2v-6M16 2v14m-6-6 6 6 6-6M11 29h10m-5-5v5');
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linejoin', 'round');
  icon.append(path); guidance.append(icon);
  help.append(guidance,
    el('p', '', 'On iPhone or iPad, open the Share menu in Safari and choose Add to Home Screen. On Mac, Safari offers File → Add to Dock. The wording and icon vary by browser.'),
    el('p', '', 'If your browser does not offer installation, you can still practice here and bookmark this page.'),
    el('p', '', 'Open the tool online first and wait for “Offline ready” before using it without a connection. Clearing site data removes offline access; reopen online to prepare it again.'));
  const result = el('p', 'small'); result.setAttribute('role', 'status');
  const install = button(`Install ${app.name}`, () => requestInstall(() => {
    help.hidden = false;
    help.tabIndex = -1;
    help.focus();
  }));
  const update = () => {
    install.hidden = installed;
    install.disabled = installing;
    result.textContent = message;
  };
  listeners.add(update); onUnmount(node, () => listeners.delete(update)); update();
  node.append(install, result, help);
  const version = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-version"]`)?.content;
  const release = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-release"]`)?.content;
  if (version) node.append(el('p', 'small muted', `${app.name} ${release ?? 'development'} · Build ${version}`));
  return node;
}

/** Install directly where supported; otherwise open accessible browser guidance. */
export function createInstallControl(app: AppIdentity = tuno, details: HTMLElement[] = []) {
  const wrapper = el('div', 'install-control');
  const dialog = el('dialog', 'install-dialog');
  const heading = el('h2', '', `Install ${app.name}`);
  heading.id = `install-${app.id}-heading`;
  heading.tabIndex = -1;
  heading.autofocus = true;
  dialog.id = `install-${app.id}`;
  dialog.setAttribute('aria-labelledby', heading.id);
  const close = button('Close', () => dialog.close());
  dialog.append(heading, createReleaseControls(app), ...details, close);
  const trigger = button('Install', () => requestInstall(() => { if (!dialog.open) dialog.showModal(); }));
  trigger.className = 'install-link';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialog.id);
  dialog.addEventListener('close', () => trigger.focus());
  wrapper.append(trigger, dialog);
  return wrapper;
}
