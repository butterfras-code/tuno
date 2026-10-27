import { el } from '../ui/components.ts';
import { activityUrl, ordinaryUrl } from './activity-link.ts';
import type { ActivityAdapter, ActivityLink } from './activity-link.ts';
import './sharing.css';

export function shareControl<T>(adapter: ActivityAdapter<T>, capture: () => T, notice: () => string = () => '') {
  const node = el('div','activity-share');
  const button = el('button','control activity-share-button'); button.type = 'button';
  button.setAttribute('aria-label','Share activity'); button.title = 'Share activity';
  const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('viewBox','0 0 24 24'); icon.setAttribute('aria-hidden','true'); icon.setAttribute('class','activity-share-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d','M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7');
  path.setAttribute('fill','none'); path.setAttribute('stroke','currentColor'); path.setAttribute('stroke-width','1.8'); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
  icon.append(path); button.append(icon,el('span','activity-share-label','Share activity'));
  const dialog = el('dialog','activity-share-dialog'); dialog.setAttribute('aria-label','Share activity');
  const heading = el('h2','','Share activity'); const summary = el('p'); const hint = el('p','muted');
  const link = el('textarea','control'); link.readOnly = true; link.rows = 3; link.setAttribute('aria-label','Activity link');
  const status = el('p'); status.setAttribute('role','status');
  const actions = el('div','activity-share-actions');
  const copy = el('button','control','Copy link'); copy.type = 'button';
  const close = el('button','control','Close'); close.type = 'button'; close.addEventListener('click',() => dialog.close());
  async function copyLink() {
    try { await navigator.clipboard.writeText(link.value); status.textContent = 'Link copied.'; }
    catch { status.textContent = 'Copy the selected link below.'; link.focus(); link.select(); }
  }
  copy.addEventListener('click',copyLink); actions.append(copy);
  if (navigator.share) {
    const system = el('button','control','Share…'); system.type = 'button';
    system.addEventListener('click',async () => { if (!link.value) return; try { await navigator.share({title:summary.textContent ?? 'Activity',url:link.value}); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) status.textContent = 'Sharing is unavailable. Use Copy link.'; } }); actions.append(system);
  }
  actions.append(close); dialog.append(heading,summary,hint,link,status,actions);
  button.addEventListener('click',async () => {
    // Capture synchronously; compression must not capture subsequent edits.
    status.textContent = ''; link.value = ''; copy.disabled = true;
    try {
      const value = adapter.validate(structuredClone(capture())); summary.textContent = adapter.describe(value); hint.textContent = [notice(),location.hostname !== 'tuno.cc' ? 'This link uses the current preview or local host. Create classroom links on tuno.cc.' : ''].filter(Boolean).join(' ');
      dialog.showModal();
      link.value = await activityUrl(location.href,adapter,value); copy.disabled = false;
    } catch (error) {
      if (!dialog.open) dialog.showModal();
      summary.textContent = ''; hint.textContent = ''; status.textContent = error instanceof Error ? error.message : 'This activity cannot be shared.';
    }
  });
  node.append(button,dialog); return node;
}
export function sharedActivityNotice<T>(link: ActivityLink<T>, adapter: ActivityAdapter<T>): HTMLElement {
  const node = el('section',`shared-activity-notice${link.kind === 'error' ? ' shared-activity-error' : ''}`); node.setAttribute('aria-label','Shared activity');
  if (link.kind === 'none') { node.hidden = true; return node; }
  const message = el('p','',link.kind === 'error' ? link.message : `Shared activity · ${adapter.describe(link.value)}`);
  if (link.kind === 'error') message.setAttribute('role','alert'); else message.title = message.textContent ?? '';
  const leave = el('a','control shared-activity-leave',link.kind === 'error' ? 'Open app normally' : 'Leave'); leave.href = ordinaryUrl(location.href); if (link.kind === 'loaded') leave.setAttribute('aria-label','Leave shared activity');
  node.append(message,leave); return node;
}
