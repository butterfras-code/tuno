import './styles.css';
import projectLicense from '../../../LICENSE.txt';
import { el } from '../../shared/ui/components.ts';
import { practiceView } from './ui/practice-view.ts';
import { onUnmount } from '../../shared/ui/unmount.ts';
import { prepareOffline } from '../../distribution/offline.ts';
import { createReleaseControls } from '../../distribution/release.ts';
import { tunotes } from '../../distribution/identity.ts';

export function mountNotes(root: HTMLElement) {
  const home = el('main', 'notes-home');
  home.id = 'home';
  home.tabIndex = -1;
  const header = el('header');
  header.append(el('h1', '', 'tuNotes'), el('p', 'tagline', 'Read music with a friend.'));
  const practice = practiceView();
  const footer = el('footer');
  const offline = el('p');
  offline.id = 'offline-status';
  prepareOffline(offline, tunotes);
  const notices = el('details');
  const source = el('a', '', 'Source code for this version');
  source.href = document.querySelector<HTMLMetaElement>('meta[name="tunotes-source"]')?.content ?? 'https://github.com/butterfras-code/tuno';
  notices.append(el('summary', '', 'About tuNotes and licenses'),
    el('p', '', 'Copyright © 2026 Justin Butterfras. Code and original artwork are licensed under GNU GPLv3. No warranty.'),
    source, el('pre', '', projectLicense), el('h2', '', 'Bundled font licenses'), el('pre', '', FONT_LICENSES));
  footer.append(offline, createReleaseControls(tunotes),
    el('p', '', 'No account, microphone, or saved progress is needed for this preview.'),
    el('p', '', 'tUno is our separate tuner, reference tone, and metronome. Each downloaded app works on its own.'), notices);
  home.append(header, practice.node, footer);
  root.append(home);
  const stopWatching = onUnmount(home, practice.dispose);
  return () => { stopWatching(); practice.dispose(); home.remove(); };
}
mountNotes(document.querySelector<HTMLElement>('#app')!);
