import { previewPitches } from '../engine/preview.ts';
import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { spelling } from '../domain/notation.ts';
import { clefForPitch } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import { renderPreviewStaff } from './staff.ts';
import { button } from './setup.ts';
export interface PreviewExposure { shown: boolean; skipped: boolean; completed: boolean }
/** Own all callbacks; finishing a preview can never start play without a user action. */
export function notePreview(preset: Preset, begin: (exposure: PreviewExposure) => void, showKeySignature = false) {
  const node = el('section','note-preview');
  const heading = el('h2','','Meet your notes'); heading.tabIndex = -1;
  const status = el('p'); status.setAttribute('role','status');
  const scene = el('div','preview-scene');
  const viewport = el('div','preview-staff-viewport');
  const stage = el('div','preview-staff-stage'); viewport.append(stage);
  const dog = animatedUno(); dog.pose('happy');
  const toy = el('span','preview-toy'); toy.setAttribute('aria-hidden','true');
  toy.append(el('span','toy-ball'),el('span','toy-streamer one'),el('span','toy-streamer two'),el('span','toy-streamer three'));
  scene.append(viewport,dog.node);
  let disposed = false, completed = false, noteIndex = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: Animation | undefined;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const pitches = previewPitches(preset);
  const total = pitches.length;
  const previous = button('Previous',()=>showNote(noteIndex-1,true));
  const next = button('Next',()=>showNote(noteIndex+1,true));
  const navigation = el('div','control-row preview-navigation'); navigation.append(previous,next); navigation.hidden = true;
  viewport.append(navigation);
  function showNote(index: number, labeled = false) {
    noteIndex = Math.max(0,Math.min(total-1,index));
    const pitch = pitches[noteIndex]!;
    const svg = renderPreviewStaff(pitch,clefForPitch(preset,pitch),preset.key,preset.keyless,showKeySignature);
    svg.querySelector('.preview-note')!.classList.toggle('revealed',labeled);
    svg.querySelector('.preview-note-status')!.textContent = `${noteIndex+1} of ${total}`;
    stage.replaceChildren(svg);
    previous.disabled = noteIndex===0; next.disabled = noteIndex===total-1;
  }
  const cancel = () => { clearTimeout(timer); flight?.cancel(); flight = undefined; };
  const dispose = () => { if (disposed) return; disposed = true; cancel(); media.removeEventListener('change',replay); dog.dispose(); };
  const enter = (skipped: boolean) => { if (disposed) return; const exposure = { shown: true, skipped, completed }; dispose(); begin(exposure); };
  const start = button('Start Practice',() => enter(false));
  const again = button('Replay',() => replay());
  const skip = button('Skip',() => enter(true));
  const controls = el('div','control-row'); controls.append(start,again,skip);
  const caught = () => {
    if (disposed) return;
    toy.hidden = true; dog.pose('happy'); node.classList.remove('preview-introducing');
    completed = true; start.disabled = false; again.disabled = false; again.hidden = false; skip.hidden = true; navigation.hidden = total < 2;
    status.textContent = 'You’ve met your notes. Start when you’re ready, or replay.';
  };
  const finish = () => {
    if (media.matches) { caught(); return; }
    const origin = toy.getBoundingClientRect();
    flight?.cancel();
    dog.node.append(toy); toy.style.left = '52%'; toy.style.top = '42%'; toy.hidden = false;
    const target = toy.getBoundingClientRect(), scale = dog.node.getBoundingClientRect().width / dog.node.offsetWidth || 1;
    const dx = (origin.left-target.left)/scale, dy = (origin.top-target.top)/scale;
    dog.pose('catch');
    flight = toy.animate([{ transform: `translate(${dx}px,${dy}px) rotate(-30deg)` },{ transform: 'translate(0,0) rotate(20deg)' }],{ duration: 750, easing: 'ease-out', fill: 'forwards' });
    timer = setTimeout(caught,750);
  };
  function replay() {
    if (disposed) return; cancel(); node.classList.add('preview-introducing'); dog.pose('happy'); toy.hidden = true;
    start.disabled = true; again.disabled = true; again.hidden = true; skip.hidden = false; navigation.hidden = true; status.textContent = '';
    showNote(0,media.matches);
    if (media.matches) { caught(); return; }
    let index = 0;
    const bounce = () => {
      if (disposed) return;
      if (index === total) { finish(); return; }
      flight?.cancel(); showNote(index);
      stage.append(toy); toy.hidden = false;
      const head = stage.querySelector('.notehead')!.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
      const scale = bounds.width / stage.offsetWidth || 1;
      const x = (head.left+head.width/2-bounds.left)/scale-11;
      toy.style.left = `${x}px`; toy.style.top = `${(head.top-bounds.top)/scale-22}px`;
      const left = -x-32, right = stage.offsetWidth-x+32;
      const desktop = matchMedia('(min-width: 769px)').matches;
      const apex = desktop ? -105 : -49;
      const edge = desktop ? -90 : -65;
      // Both sides of the wrap are outside the clipped staff: never fly backwards across it.
      // Each cycle enters from the left, touches the centered note, then bounces out right.
      flight = toy.animate([
        {transform:`translate(${right}px,${edge}px) rotate(20deg)`,offset:0},
        {transform:`translate(${right}px,${edge}px) rotate(20deg)`,offset:.01,easing:'steps(1,end)'},
        {transform:`translate(${left}px,${edge}px) rotate(-20deg)`,offset:.011},
        {transform:`translate(${left/2}px,${apex}px) rotate(-10deg)`,offset:.2555},
        {transform:'translate(0,0) rotate(0)',offset:.5},
        {transform:`translate(${right/2}px,${apex}px) rotate(10deg)`,offset:.75},
        {transform:`translate(${right}px,${edge}px) rotate(20deg)`,offset:1},
      ],{duration:1500,fill:'forwards'});
      timer = setTimeout(() => {
        if (disposed) return;
        stage.querySelector('.preview-note')!.classList.add('revealed');
        status.textContent = `${spelling(pitches[index]!)} · ${index+1} of ${total}`;
        index++; timer = setTimeout(bounce,750);
      },750);
    };
    bounce();
  }
  again.hidden = true;
  node.append(heading,status,controls,scene);
  media.addEventListener('change',replay);
  return { node, dispose, start: () => { heading.focus(); replay(); } };
}
