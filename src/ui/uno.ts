import happyAsset from '../assets/uno-happy.svg';
import begAsset from '../assets/uno-beg.svg';
import restAsset from '../assets/uno-rest.svg';
import leftAsset from '../assets/uno-head-left.svg';
import boneAsset from '../assets/pitch-bone.svg';
import { el } from './components.ts';
import type { UnoPose } from '../practice/feedback.ts';

const ns = 'http://www.w3.org/2000/svg';
/** Parse only bundled, project-owned SVGs. No remote artwork or HTML enters this path. */
function artwork(url: string) {
  const payload = url.slice(url.indexOf(',') + 1);
  const xml = url.slice(0, url.indexOf(',')).includes(';base64') ? atob(payload) : decodeURIComponent(payload);
  const svg = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  svg.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  return document.importNode(svg, true) as unknown as SVGSVGElement;
}
function group(name: string) {
  const node = document.createElementNS(ns, 'g');
  node.setAttribute('class', name);
  return node;
}
export function animatedUno() {
  const node = el('div', 'uno uno-animated');
  node.setAttribute('aria-hidden', 'true');
  const svg = artwork(happyAsset);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const paths = [...svg.firstElementChild!.children];
  const sit = group('uno-sit');
  const tail = group('uno-tail');
  tail.append(paths[1]!);
  const body = group('uno-body');
  body.append(...paths.slice(2, 4));
  const paws = group('uno-paws');
  paws.append(paths[4]!, paths[5]!);
  const beg = group('uno-beg-paws');
  const begPaths = [...artwork(begAsset).firstElementChild!.children];
  const scaled = group('');
  scaled.setAttribute('transform', 'scale(1.376146789)');
  scaled.append(begPaths[4]!, begPaths[5]!);
  beg.append(scaled);
  const head = group('uno-head');
  const front = group('uno-head-front');
  front.append(...paths.slice(8));
  const left = artwork(leftAsset);
  left.setAttribute('class', 'uno-head-left');
  // Figma head bounds in the 320px source, scaled to the retained 300px sit.
  for (const [key, value] of Object.entries({ x: 68.4375, y: 33.75, width: 150, height: 136.875 })) left.setAttribute(key, String(value));
  head.append(front, left);
  sit.append(paths[0]!, tail, body, paws, beg, paths[6]!, paths[7]!, head);
  svg.replaceChildren(sit);
  const rest = el('img', 'uno-rest');
  Object.assign(rest, { src: restAsset, alt: '', draggable: false });
  const bone = el('img', 'uno-reward');
  Object.assign(bone, { src: boneAsset, alt: '', draggable: false });
  node.append(svg, rest, bone);
  let nod: Animation | undefined;
  let flight: Animation | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  reduced.addEventListener('change', () => { nod?.cancel(); flight?.cancel(); });
  return {
    node,
    pose(value: UnoPose) { if (node.dataset.pose !== value) node.dataset.pose = value; },
    tail(angle: number, playing: boolean) {
      node.classList.toggle('uno-playing', playing);
      tail.style.transform = `rotate(${reduced.matches ? 0 : angle}deg)`;
    },
    nod() {
      if (reduced.matches) return;
      const current = getComputedStyle(head).transform;
      nod?.cancel();
      nod = head.animate([
        { transform: current === 'none' ? 'rotate(0deg)' : current, offset: 0, easing: 'ease-out' },
        { transform: 'translateY(5.625px) rotate(10deg)', offset: 90 / 260, easing: 'ease-out' },
        { transform: 'rotate(0deg)', offset: 1 },
      ], { duration: 260 });
    },
    look(holding: boolean, angle = 0) {
      nod?.cancel();
      node.classList.toggle('uno-looking', holding);
      head.style.transform = `rotate(${holding && !reduced.matches ? angle : 0}deg)`;
    },
    catch(marker: HTMLElement) {
      flight?.cancel();
      if (reduced.matches || !node.checkVisibility()) return;
      const start = marker.getBoundingClientRect();
      const end = bone.getBoundingClientRect();
      const dx = start.left + start.width / 2 - end.left - end.width / 2;
      const dy = start.top + start.height / 2 - end.top - end.height / 2;
      flight = bone.animate([
        { transform: `translate(${dx}px, ${dy}px)`, offset: 0 },
        { transform: `translate(${dx / 2}px, ${Math.min(dy, 0) - 65}px) rotate(-15deg)`, offset: 0.5 },
        { transform: 'translate(0, 0) rotate(0deg)', offset: 1 },
      ], { duration: 450, easing: 'ease-in-out' });
    },
  };
}
