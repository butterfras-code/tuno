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
  const tailSide = group('uno-tail-side');
  const tail = group('uno-tail');
  tail.append(paths[1]!);
  tailSide.append(tail);
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
  // Both head poses share the same feature order: face, ears, eyebrows, eyes.
  const features = (face: Element, pivots: [string, string]) => {
    const parts = [...face.children];
    const wrap = (index: number, name: string) => {
      const layer = group(name);
      parts[index]!.replaceWith(layer);
      layer.append(parts[index]!);
      return layer;
    };
    const ears = [wrap(1, 'uno-ear uno-ear-left'), wrap(2, 'uno-ear uno-ear-right')];
    ears.forEach((ear, index) => { ear.style.transformOrigin = pivots[index]!; });
    const brows = [wrap(3, 'uno-eyebrow'), wrap(4, 'uno-eyebrow')];
    return { ears, brows };
  };
  const faces = [features(front, ['105.938px 60.9375px', '187.5px 60.9375px']),
    features(left.firstElementChild!, ['50px 31px', '118px 28px'])];
  // Figma head bounds in the 320px source, scaled to the retained 300px sit.
  for (const [key, value] of Object.entries({ x: 68.4375, y: 33.75, width: 150, height: 136.875 })) left.setAttribute(key, String(value));
  head.append(front, left);
  sit.append(paths[0]!, tailSide, body, paws, beg, paths[6]!, paths[7]!, head);
  svg.replaceChildren(sit);
  const rest = el('img', 'uno-rest');
  Object.assign(rest, { src: restAsset, alt: '', draggable: false });
  const bone = el('img', 'uno-reward');
  Object.assign(bone, { src: boneAsset, alt: '', draggable: false });
  node.append(svg, rest, bone);
  let nod: Animation | undefined;
  let flight: Animation | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const accent = (strength: number) => {
    const amount = reduced.matches ? 0 : Math.max(0, Math.min(1, strength));
    for (const { ears, brows } of faces) {
      brows.forEach(brow => { brow.style.transform = amount ? `translateY(${-5 * amount}px)` : ''; });
      ears.forEach((ear, index) => {
        ear.style.transform = amount ? `translateY(${3 * amount}px) rotate(${(index === 0 ? -12 : 12) * amount}deg)` : '';
      });
    }
  };
  reduced.addEventListener('change', () => { nod?.cancel(); flight?.cancel(); accent(0); });
  return {
    node,
    accent,
    pose(value: UnoPose) { if (node.dataset.pose !== value) node.dataset.pose = value; },
    tail(angle: number, playing: boolean, mirrored = false) {
      node.classList.toggle('uno-playing', playing);
      tail.style.transform = `rotate(${reduced.matches ? 0 : angle}deg)`;
      tailSide.style.transform = mirrored && !reduced.matches ? 'scaleX(-1)' : '';
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
