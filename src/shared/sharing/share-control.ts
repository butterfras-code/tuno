import QRCode from 'qrcode';
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
  const header = el('div','activity-share-header');
  const heading = el('h2','','Share activity');
  const close = el('button','control activity-share-close','×'); close.type = 'button';
  close.setAttribute('aria-label','Close'); close.addEventListener('click',() => dialog.close());
  header.append(heading,close);
  const summary = el('p','activity-share-summary');
  const hint = el('p','activity-share-hint');
  const body = el('div','activity-share-body');
  const linkSection = el('div','activity-share-link-section');
  const instructions = el('p','','Paste the link into your LMS or send it to a student. They can open the activity and start.');
  const link = el('textarea','activity-share-url'); link.readOnly = true; link.rows = 2; link.setAttribute('aria-label','Activity link');
  const details = el('details','activity-share-details'); details.append(el('summary','','View activity link'),link);
  const status = el('p','activity-share-status'); status.setAttribute('role','status');
  const actions = el('div','activity-share-actions');
  const copy = el('button','control control--primary','Copy link'); copy.type = 'button';
  async function copyLink() {
    try { await navigator.clipboard.writeText(link.value); status.textContent = 'Link copied.'; }
    catch { status.textContent = 'Copy the selected link.'; details.open = true; link.focus(); link.select(); }
  }
  copy.addEventListener('click',copyLink); actions.append(copy);
  const system = el('button','control','Share…'); system.type = 'button';
  if (navigator.share) {
    system.addEventListener('click',async () => { if (!link.value) return; try { await navigator.share({title:summary.textContent ?? 'Activity',url:link.value}); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) status.textContent = 'Sharing is unavailable. Use Copy link.'; } }); actions.append(system);
  }
  const qrSection = el('div','activity-share-qr-section');
  const qr = el('img','activity-share-qr'); qr.alt = 'Scan to open this activity'; qr.hidden = true;
  const qrStatus = el('p','activity-share-qr-status'); qrStatus.setAttribute('role','status');
  const download = el('a','control activity-share-download','Download QR code'); download.hidden = true;
  download.download = `${adapter.app}-activity-qr.png`;
  qrSection.append(el('h3','','Scan to open'),qr,qrStatus,download);
  linkSection.append(el('h3','','Send a link'),instructions,actions,details,status);
  body.append(linkSection,qrSection); dialog.append(header,summary,body,hint);
  let generation = 0;
  dialog.addEventListener('close',() => { if (!dialog.open) generation++; });
  button.addEventListener('click',async () => {
    // Capture synchronously; compression must not capture subsequent edits.
    const current = ++generation;
    status.textContent = ''; link.value = ''; copy.disabled = true; system.disabled = true;
    details.open = false; qr.hidden = true; qr.removeAttribute('src'); download.hidden = true; download.removeAttribute('href');
    qrStatus.textContent = 'Creating QR code…'; body.hidden = true;
    try {
      const value = adapter.validate(structuredClone(capture())); summary.textContent = adapter.describe(value); hint.textContent = [notice(),location.hostname !== 'tuno.cc' ? 'This link uses the current preview or local host. Create classroom links on tuno.cc.' : ''].filter(Boolean).join(' ');
      hint.hidden = !hint.textContent;
      dialog.showModal();
      const url = await activityUrl(location.href,adapter,value);
      if (current !== generation) return;
      link.value = url; copy.disabled = false; system.disabled = false; body.hidden = false;
      try {
        const png = await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:4,scale:8});
        if (current !== generation) return;
        qr.src = png; qr.hidden = false; download.href = png; download.hidden = false; qrStatus.textContent = '';
      } catch {
        if (current === generation) qrStatus.textContent = 'A QR code could not be created for this activity. Use Copy link instead.';
      }
    } catch (error) {
      if (current !== generation) return;
      if (!dialog.open) dialog.showModal();
      summary.textContent = error instanceof Error ? error.message : 'This activity cannot be shared.'; hint.hidden = true;
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
