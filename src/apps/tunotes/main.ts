import { createAppFooter } from '../../shared/ui/app-footer.ts';
import { createAppHeader } from '../../shared/ui/app-header.ts';
import { createAreaNavigation } from '../../shared/ui/area-navigation.ts';
import './styles.css';
import './workspace.css';
import './mode-selectors.css';
import './multiplayer-toolbar.css';
import { el } from '../../shared/ui/components.ts';
import { practiceView } from './ui/practice-view.ts';
import { multiplayerView } from './ui/multiplayer-view.ts';
import { playSurface } from './ui/play-surface.ts';
import { onUnmount } from '../../shared/ui/unmount.ts';
import { prepareOffline } from '../../distribution/offline.ts';
import { tunotes } from '../../distribution/identity.ts';

export function mountNotes(root: HTMLElement) {
  const home = el('main', 'notes-home');
  home.id = 'home';
  home.tabIndex = -1;
  const header = createAppHeader('tuNotes', 'Read Notes with a friend.');
  header.append(createAreaNavigation('tunotes'));
  const workspace = el('div', 'notes-workspace');
  const workspaceHeader = el('div', 'notes-workspace-header');
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
        if (!multiplayer) { multiplayer = multiplayerView(practice.store); multiplayerPanel.append(multiplayer.node); }
      }
      if (index < 2) practice.enter();
      practice.node.hidden = index >= 2;
      views.forEach((view,i) => { view.hidden = i !== index; links[i]!.setAttribute('aria-pressed',String(i === index)); });
      if (index === 2) multiplayer!.enter();
      current = index;
    });
    navigation.append(control); return control;
  });
  workspaceHeader.append(navigation);
  const fullscreen = el('button','control notes-fullscreen','Enter fullscreen'); fullscreen.type = 'button';
  fullscreen.hidden = true;
  const fullscreenStatus = el('p','fullscreen-status'); fullscreenStatus.setAttribute('role','status');
  fullscreen.addEventListener('click',async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      fullscreenStatus.textContent = '';
    } catch { fullscreenStatus.textContent = 'Fullscreen is unavailable in this browser.'; }
  });
  const updateFullscreen = () => { fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; };
  document.addEventListener('fullscreenchange',updateFullscreen);
  workspaceHeader.append(fullscreen,fullscreenStatus);
  const offline = el('p');
  offline.id = 'offline-status';
  prepareOffline(offline, tunotes);
  const footer = createAppFooter({ app: tunotes, status: offline });
  workspace.append(workspaceHeader, ...views);
  home.append(header, workspace, footer);
  root.append(home);
  const stopFitting = playSurface(home,practice.options);
  const dispose = () => { stopFitting(); document.removeEventListener('fullscreenchange',updateFullscreen); practice.dispose(); multiplayer?.dispose(); };
  const stopWatching = onUnmount(home, dispose);
  return () => { stopWatching(); dispose(); home.remove(); };
}
mountNotes(document.querySelector<HTMLElement>('#app')!);
