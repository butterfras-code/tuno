import { readActivityLink } from '../../shared/sharing/activity-link.ts';
import { shareControl, sharedActivityNotice } from '../../shared/sharing/share-control.ts';
import { notesAdapter } from './sharing.ts';
import type { ActivityLink } from '../../shared/sharing/activity-link.ts';
import type { NotesActivity } from './sharing.ts';
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
import { connectNotesStore } from './persistence/session.ts';
import type { NotesSession } from './persistence/session.ts';
import { savingNotice } from './ui/saving-notice.ts';

export async function mountNotes(root: HTMLElement, linked: ActivityLink<NotesActivity> = {kind:'none'}) {
  if (linked.kind === 'error') { root.append(sharedActivityNotice(linked,notesAdapter)); return () => {}; }
  let session: NotesSession | undefined;
  let leftPage = false;
  const suspend = () => { leftPage = true; session?.close(); };
  window.addEventListener('pagehide', suspend);
  document.addEventListener('freeze', suspend);
  let storage: Storage | undefined;
  let locks: LockManager | undefined;
  try { storage = window.localStorage; locks = navigator.locks; } catch { /* Safe memory-only fallback. */ }
  session = await connectNotesStore(storage, locks);
  if (leftPage) session.close();
  if (!root.isConnected) {
    session.close(); window.removeEventListener('pagehide', suspend); document.removeEventListener('freeze', suspend);
    return () => {};
  }
  const home = el('main', 'notes-home');
  home.id = 'home';
  home.tabIndex = -1;
  const header = createAppHeader('tuNotes', 'Read Notes with a friend.');
  header.append(createAreaNavigation('tunotes'));
  const workspace = el('div', 'notes-workspace');
  const workspaceHeader = el('div', 'notes-workspace-header');
  const practice = practiceView(session.store, linked.kind === 'loaded');
  const saving = savingNotice(session.store);
  header.append(saving.node);
  const practicePanel = el('section'); practicePanel.append(practice.node);
  const challenge = el('section','notes-challenge'); challenge.hidden = true;
  const multiplayerPanel = el('section'); multiplayerPanel.hidden = true;
  let multiplayer: ReturnType<typeof multiplayerView> | undefined;
  const navigation = el('nav','focus-navigation'); navigation.setAttribute('aria-label','tuNotes modes');
  const views = [practicePanel,challenge,multiplayerPanel,practice.options];
  let current = 0;
  let activityIndex = 0;
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
      if (index !== 3) activityIndex = index;
    });
    navigation.append(control); return control;
  });
  workspaceHeader.append(navigation,shareControl(notesAdapter,() => activityIndex === 2 ? multiplayer!.captureActivity() : practice.captureActivity()));
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
  workspaceHeader.prepend(sharedActivityNotice(linked,notesAdapter));
  home.append(header, workspace, footer);
  if (linked.kind === 'loaded') {
    const value = linked.value;
    if (value.mode === 'multiplayer') { links[2]!.click(); multiplayer!.loadActivity(value); }
    else { if (value.mode === 'challenge') links[1]!.click(); practice.loadActivity(value); }
  }
  root.append(home);
  const stopFitting = playSurface(home,practice.options);
  const dispose = () => {
    stopFitting(); document.removeEventListener('fullscreenchange',updateFullscreen); practice.dispose(); multiplayer?.dispose();
    session.close(); saving.dispose();
    window.removeEventListener('pagehide', suspend); document.removeEventListener('freeze', suspend);
  };
  const stopWatching = onUnmount(home, dispose);
  return () => { stopWatching(); dispose(); home.remove(); };
}
void readActivityLink(location.href,notesAdapter).then(link => mountNotes(document.querySelector<HTMLElement>('#app')!,link));
