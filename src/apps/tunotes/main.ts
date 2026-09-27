import './styles.css';
import projectLicense from '../../../LICENSE.txt';
import { el } from '../../shared/ui/components.ts';
import { animatedUno } from '../../shared/ui/uno.ts';
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
  const dog = animatedUno();
  dog.pose('rest');
  const welcome = el('section', 'welcome');
  const message = el('div');
  message.append(el('h2', '', 'A little practice. A good friend.'),
    el('p', '', 'Uno is getting ready to help you read music.'),
    el('p', 'preview', 'Technical preview · Note-reading activities are coming next.'));
  welcome.append(dog.node, message);
  const activities = el('section', 'activities');
  activities.setAttribute('aria-label', 'Planned activities');
  for (const [title, description] of [
    ['Practice', 'Get to know the notes, one at a time.'],
    ['Challenge', 'Put your reading into practice, solo or with friends.'],
    ['Flow', 'Read along at your own pace.'],
  ]) {
    const card = el('article');
    card.append(el('h2', '', title), el('p', '', description), el('p', 'muted', 'Coming in a later preview'));
    activities.append(card);
  }
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
  home.append(header, welcome, activities, footer);
  root.append(home);
  const stopWatching = onUnmount(home, dog.dispose);
  return () => { stopWatching(); dog.dispose(); home.remove(); };
}
mountNotes(document.querySelector<HTMLElement>('#app')!);
