import { previewGroups } from '../engine/preview.ts';
import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { pitchLabel } from '../domain/notation.ts';
import { clefForPitch } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import { renderStaff } from './staff.ts';
import { button } from './setup.ts';
export interface PreviewExposure { shown: boolean; skipped: boolean; completed: boolean }
/** Own all callbacks; finishing a preview can never start play without a user action. */
export function notePreview(preset: Preset, begin: (exposure: PreviewExposure) => void) {
  const node = el('section','note-preview');
  const heading = el('h2','','Meet your notes'); heading.tabIndex = -1;
  const status = el('p'); status.setAttribute('role','status');
  const gallery = el('div','preview-gallery');
  const dog = animatedUno(); dog.pose('rest');
  const toy = el('span','preview-toy'); toy.setAttribute('aria-hidden','true');
  toy.append(el('span','toy-ball'),el('span','toy-streamer one'),el('span','toy-streamer two'),el('span','toy-streamer three'));
  let disposed = false, completed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: Animation | undefined;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const cards: HTMLElement[] = [];
  for (const [index,group] of previewGroups(preset).entries()) {
    const section = el('section','preview-group'); section.setAttribute('aria-label',`Note group ${index+1}`);
    for (const pitch of group) {
      const card = el('figure','preview-note');
      const staff = renderStaff(pitch,clefForPitch(preset,pitch),preset.key); staff.classList.replace('staff','preview-staff');
      card.append(staff,el('figcaption','',`${pitchLabel(pitch)} · ${clefForPitch(preset,pitch)}`));
      section.append(card); cards.push(card);
    }
    gallery.append(section);
  }
  const cancel = () => { clearTimeout(timer); flight?.cancel(); flight = undefined; };
  const dispose = () => { if (disposed) return; disposed = true; cancel(); media.removeEventListener('change',replay); dog.dispose(); };
  const enter = (skipped: boolean) => { if (disposed) return; const exposure = { shown: true, skipped, completed }; dispose(); begin(exposure); };
  const start = button('Start',() => enter(false));
  const again = button('Replay',() => replay());
  const skip = button('Skip',() => enter(true));
  const controls = el('div','control-row'); controls.append(start,again,skip);
  const finish = () => {
    completed = true; start.disabled = false; again.disabled = false;
    status.textContent = 'You’ve met your notes. Start when you’re ready, or replay.';
    dog.pose('catch');
    if (media.matches) { toy.hidden = true; dog.pose('happy'); return; }
    dog.node.append(toy); toy.style.left = '52%'; toy.style.top = '42%'; toy.hidden = false;
    flight = toy.animate([{ transform: 'translate(-100px,-100px) rotate(-30deg)' },{ transform: 'translate(0,0) rotate(20deg)' }],{ duration: 600, easing: 'ease-out', fill: 'forwards' });
    timer = setTimeout(() => { if (!disposed) { toy.hidden = true; dog.pose('happy'); } },600);
  };
  function replay() {
    if (disposed) return; cancel(); dog.pose('rest'); toy.hidden = true;
    start.disabled = true; again.disabled = true;
    for (const card of cards) card.classList.remove('revealed');
    if (media.matches) { for (const card of cards) card.classList.add('revealed'); finish(); return; }
    let index = 0;
    const reveal = () => {
      if (disposed) return;
      const card = cards[index];
      if (!card) { finish(); return; }
      card.classList.add('revealed'); card.append(toy); toy.hidden = false;
      const note = card.querySelector('.notehead')!.getBoundingClientRect(), bounds = card.getBoundingClientRect();
      const scale = bounds.width / card.offsetWidth || 1;
      toy.style.left = `${(note.left + note.width/2 - bounds.left)/scale - 11}px`;
      toy.style.top = `${(note.top - bounds.top)/scale - 23}px`;
      status.textContent = `Note ${index+1} of ${cards.length}: ${card.querySelector('figcaption')!.textContent}`;
      // A group scroll occurs only at its first note and does not move keyboard focus.
      if (index % 4 === 0) card.parentElement!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      flight = toy.animate([{ transform: 'translate(-55px,-38px) rotate(-20deg)' },{ transform: 'translate(0,0) rotate(15deg)', offset: .65 },{ transform: 'translate(12px,-12px) rotate(0)' }],{ duration: 750, easing: 'ease-out' });
      index++; timer = setTimeout(reveal,950);
    };
    reveal();
  }
  node.append(heading,el('p','muted','Read from low to high. This introduction is silent and does not count as practice.'),status,controls,gallery,dog.node);
  media.addEventListener('change',replay);
  return { node, dispose, start: () => { heading.focus(); replay(); } };
}
