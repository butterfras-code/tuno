import { button, el, row } from '../ui/components.ts';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function createReleaseControls() {
  const node = el('section', 'release-controls');
  node.setAttribute('aria-label', 'Keep tUno');
  const version = document.querySelector<HTMLMetaElement>('meta[name="tuno-version"]')?.content;
  const release = document.querySelector<HTMLMetaElement>('meta[name="tuno-release"]')?.content;
  const label = el('p', 'small muted', `tUno ${release ?? 'development'} · Build ${version ?? 'unknown'}`);
  const downloadPath = document.querySelector<HTMLMetaElement>('meta[name="tuno-download"]')?.content;
  if (location.protocol === 'file:' || !downloadPath) {
    node.append(label);
    return node;
  }
  const download = el('a', 'control', 'Download offline HTML');
  download.href = downloadPath;
  download.download = `tuno-${version}.html`;
  const result = el('p', 'small');
  result.setAttribute('role', 'status');
  let downloading = false;
  download.addEventListener('click', (event) => {
    event.preventDefault();
    if (downloading) return;
    downloading = true;
    download.setAttribute('aria-disabled', 'true');
    void (async () => {
      try {
        // Native browser downloads can bypass the worker. Fetch its cached bytes first.
        const response = await fetch(downloadPath);
        if (!response.ok) throw Error('Download unavailable');
        const url = URL.createObjectURL(await response.blob());
        const save = el('a');
        save.href = url;
        save.download = download.download;
        save.hidden = true;
        document.body.append(save);
        save.click();
        save.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        result.textContent = 'Offline copy prepared. Keep the downloaded HTML file to practice later.';
      } catch {
        result.textContent = 'Offline copy is unavailable. Reconnect and try the download again.';
      } finally {
        downloading = false;
        download.removeAttribute('aria-disabled');
      }
    })();
  });
  let prompt: InstallPrompt | undefined;
  const install = button('Install tUno', () => {
    const request = prompt;
    if (!request) return;
    prompt = undefined;
    install.hidden = true;
    void (async () => {
      try {
        await request.prompt();
        const choice = await request.userChoice;
        result.textContent = choice.outcome === 'accepted' ? 'Installation requested.' : 'Installation cancelled. You can keep practicing here.';
      } catch { result.textContent = 'Installation could not start. Use your browser’s install menu if available.'; }
    })();
  });
  install.hidden = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    install.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    prompt = undefined;
    install.hidden = true;
    result.textContent = 'tUno installed.';
  });
  node.append(row(download, install), result, label);
  return node;
}
