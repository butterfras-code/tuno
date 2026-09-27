import { previewGroups } from '../engine/preview.ts';
import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { pitchLabel } from '../domain/notation.ts';
import { clefForPitch } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import { renderPreviewStaff } from './staff.ts';
import { button } from './setup.ts';
export interface PreviewExposure { shown: boolean; skipped: boolean; completed: boolean }
/** Own all callbacks; finishing a preview can never start play without a user action. */
export function notePreview(preset: Preset, begin: (exposure: PreviewExposure) => void) {
  const node = el('section','note-preview');
  const heading = el('h2','','Meet your notes'); heading.tabIndex = -1;
  const status = el('p'); status.setAttribute('role','status');
  const viewport = el('div','preview-staff-viewport');
  const stage = el('div','preview-staff-stage'); viewport.append(stage);
  const dog = animatedUno(); dog.pose('rest');
  const toy = el('span','preview-toy'); toy.setAttribute('aria-hidden','true');
  toy.append(el('span','toy-ball'),el('span','toy-streamer one'),el('span','toy-streamer two'),el('span','toy-streamer three'));
  let disposed = false, completed = false, groupIndex = 0, revealed = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: Animation | undefined;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const groups = previewGroups(preset);
  const total = preset.pool.length;
  const groupStatus = el('span','preview-group-status');
  const previous = button('Previous notes',()=>showGroup(groupIndex-1));
  const next = button('Next notes',()=>showGroup(groupIndex+1));
  const navigation = el('div','control-row'); navigation.append(previous,groupStatus,next); navigation.hidden = true;
  function showGroup(index: number) {
    groupIndex = Math.max(0,Math.min(groups.length-1,index));
    const group = groups[groupIndex]!;
    const svg = renderPreviewStaff(group,clefForPitch(preset,group[0]!),preset.key);
    const before = groups.slice(0,groupIndex).flat().length;
    svg.querySelectorAll('.preview-note').forEach((note,i)=>note.classList.toggle('revealed',before+i<revealed));
    stage.replaceChildren(svg); viewport.scrollLeft = 0;
    groupStatus.textContent = `Group ${groupIndex+1} of ${groups.length} · ${clefForPitch(preset,group[0]!)}`;
    previous.disabled = groupIndex===0; next.disabled = groupIndex===groups.length-1;
  }
  const cancel = () => { clearTimeout(timer); flight?.cancel(); flight = undefined; };
  const dispose = () => { if (disposed) return; disposed = true; cancel(); media.removeEventListener('change',replay); dog.dispose(); };
  const enter = (skipped: boolean) => { if (disposed) return; const exposure = { shown: true, skipped, completed }; dispose(); begin(exposure); };
  const start = button('Start',() => enter(false));
  const again = button('Replay',() => replay());
  const skip = button('Skip',() => enter(true));
  const controls = el('div','control-row'); controls.append(start,again,skip);
  const finish = () => {
    completed = true; start.disabled = false; again.disabled = false; navigation.hidden = groups.length < 2;
    status.textContent = 'You’ve met your notes. Start when you’re ready, or replay.';
    dog.pose('catch');
    if (media.matches) { toy.hidden = true; dog.pose('happy'); return; }
    const origin = toy.isConnected && !toy.hidden ? toy.getBoundingClientRect() : undefined;
    flight?.cancel();
    dog.node.append(toy); toy.style.left = '52%'; toy.style.top = '42%'; toy.hidden = false;
    const target = toy.getBoundingClientRect(), scale = dog.node.getBoundingClientRect().width / dog.node.offsetWidth || 1;
    const dx = origin ? (origin.left-target.left)/scale : -100, dy = origin ? (origin.top-target.top)/scale : -100;
    flight = toy.animate([{ transform: `translate(${dx}px,${dy}px) rotate(-30deg)` },{ transform: 'translate(0,0) rotate(20deg)' }],{ duration: 600, easing: 'ease-out', fill: 'forwards' });
    timer = setTimeout(() => { if (!disposed) { toy.hidden = true; dog.pose('happy'); } },600);
  };
  function replay() {
    if (disposed) return; cancel(); dog.pose('rest'); toy.hidden = true;
    start.disabled = true; again.disabled = true;
    revealed = 0; navigation.hidden = true; showGroup(0);
    if (media.matches) { revealed = total; showGroup(0); finish(); return; }
    let index = 0;
    const reveal = () => {
      if (disposed) return;
      if (index === total) { finish(); return; }
      let group = 0, local = index;
      while (local >= groups[group]!.length) local -= groups[group++]!.length;
      if (group !== groupIndex) showGroup(group);
      const note = stage.querySelectorAll<SVGGElement>('.preview-note')[local]!;
      const previousBounds = !toy.isConnected || toy.hidden ? undefined : toy.getBoundingClientRect();
      flight?.cancel();
      note.classList.add('revealed'); revealed = index+1;
      stage.append(toy); toy.hidden = false;
      const head = note.querySelector('.notehead')!.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
      const scale = bounds.width / stage.offsetWidth || 1;
      toy.style.left = `${(head.left+head.width/2-bounds.left)/scale-11}px`;
      toy.style.top = `${(head.top-bounds.top)/scale-23}px`;
      const target = toy.getBoundingClientRect();
      const dx = previousBounds ? (previousBounds.left-target.left)/scale : -55;
      const dy = previousBounds ? (previousBounds.top-target.top)/scale : -38;
      viewport.scrollTo({left:Math.max(0,(head.left-bounds.left)/scale-viewport.clientWidth/2),behavior:'smooth'});
      status.textContent = `Note ${index+1} of ${total}: ${pitchLabel(groups[group]![local]!)} · ${clefForPitch(preset,groups[group]![local]!)}`;
      flight = toy.animate([{transform:`translate(${dx}px,${dy}px) rotate(-20deg)`},{transform:`translate(${dx/2}px,${Math.min(dy,0)-45}px) rotate(0)`,offset:.45},{transform:'translate(0,0) rotate(15deg)'}],{duration:750,easing:'ease-in-out'});
      index++; timer = setTimeout(reveal,950);
    };
    reveal();
  }
  node.append(heading,el('p','muted','Read from low to high. This introduction is silent and does not count as practice.'),status,controls,viewport,navigation,dog.node);
  media.addEventListener('change',replay);
  return { node, dispose, start: () => { heading.focus(); replay(); } };
}
