import './styles.css';
import projectLicense from '../../../LICENSE.txt';
import { el } from '../../shared/ui/components.ts';
import { practiceView } from './ui/practice-view.ts';
import { multiplayerView } from './ui/multiplayer-view.ts';
import { onUnmount } from '../../shared/ui/unmount.ts';
import { prepareOffline } from '../../distribution/offline.ts';
import { createReleaseControls } from '../../distribution/release.ts';
import { tunotes } from '../../distribution/identity.ts';

export function mountNotes(root: HTMLElement) {
  const home = el('main', 'notes-home');
  home.id = 'home';
  home.tabIndex = -1;
  const header = el('header','app-header');
  const brand = el('div','brand'); brand.append(el('h1', 'wordmark', 'tuNotes'), el('p', 'tagline', 'Read music with a friend.'));
  header.append(brand);
  const practice = practiceView();
  const practicePanel = el('section'); practicePanel.append(practice.node);
  const challenge = el('section','notes-challenge'); challenge.hidden = true;
  const multiplayerPanel = el('section'); multiplayerPanel.hidden = true;
  let multiplayer: ReturnType<typeof multiplayerView> | undefined;
  const navigation = el('nav','focus-navigation'); navigation.setAttribute('aria-label','tuNotes modes');
  const views = [practicePanel,challenge,multiplayerPanel,practice.options];
  let current = 0;
  const links = ['Practice','Challenge','Multi Player','Options'].map((label,index) => {
    const control = el('button','control',label); control.type = 'button';
    views[index]!.id = `notes-${label.toLowerCase()}`;
    control.setAttribute('aria-controls',views[index]!.id); control.setAttribute('aria-pressed',String(index === 0));
    control.addEventListener('click',() => {
      if (control.getAttribute('aria-pressed') === 'true') return;
      if (current === 2) multiplayer?.leave(index === 3);
      else practice.leave();
      if (index < 2) { practice.setActivity(index === 1 ? 'challenge' : 'practice'); views[index]!.append(practice.node); }
      if (index === 2) {
        if (!multiplayer) { multiplayer = multiplayerView(practice.store, () => links[0]!.click()); multiplayerPanel.append(multiplayer.node); }
      }
      if (index < 2) practice.enter();
      practice.node.hidden = index >= 2;
      views.forEach((view,i) => { view.hidden = i !== index; links[i]!.setAttribute('aria-pressed',String(i === index)); });
      if (index === 2) multiplayer!.enter();
      current = index;
    });
    navigation.append(control); return control;
  });
  header.append(navigation);
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
    notices);
  home.append(header, ...views, footer);
  root.append(home);
  const dispose = () => { practice.dispose(); multiplayer?.dispose(); };
  const stopWatching = onUnmount(home, dispose);
  return () => { stopWatching(); dispose(); home.remove(); };
}
mountNotes(document.querySelector<HTMLElement>('#app')!);
