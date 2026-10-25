import { el } from '../../../shared/ui/components.ts';

export const positivePhrases = ['Correct!', 'Great!', 'Yes!', 'Way to go!', 'You got it!', "That’s right!", "That’s a W!"];

export function celebrationMessage(reward: { treat: boolean; text: string }, announcement: string, ordinary: string) {
  const messages = [...(reward.treat ? ['A treat for Uno!'] : []), ...(announcement ? [announcement] : [])];
  return messages.length ? messages.join('\n') : reward.text || ordinary;
}

function boundsOf(element: SVGGraphicsElement) {
  const box = element.getBBox();
  const transforms = element.transform.baseVal;
  let matrix = new DOMMatrix();
  for (let i = 0; i < transforms.numberOfItems; i++) matrix = matrix.multiply(transforms.getItem(i).matrix);
  const points = [box.x, box.x + box.width].flatMap(x => [box.y, box.y + box.height].map(y => {
    const point = new DOMPoint(x, y);
    return point.matrixTransform(matrix);
  }));
  return { top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)), left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)) };
}

/** Feedback follows the staff geometry, independently of answer pacing. */
export function answerFeedback() {
  const node = el('span', 'answer-feedback-announcement');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.classList.add('answer-feedback');
  text.setAttribute('y', '100');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('aria-hidden', 'true');
  const layer = document.createElementNS(text.namespaceURI, 'g');
  layer.append(text);
  const root = document.createElementNS(text.namespaceURI, 'g');
  root.classList.add('answer-feedback-layer');
  // Keep fading feedback above new prompts without rectangular cutouts.
  root.append(layer);
  let animation: Animation | undefined;
  let staff: SVGSVGElement | undefined;
  let anchor: DOMMatrix | undefined;
  // Keep the activation's coordinates relative to the panel, even when the next
  // prompt has a different viewBox or the controls change the staff's height.
  const restorePosition = () => {
    const matrix = staff?.getScreenCTM();
    const frame = staff?.parentElement?.getBoundingClientRect();
    if (!matrix || !frame || !anchor) return;
    const current = new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
    const fixed = current.inverse().multiply(new DOMMatrix().translate(frame.left, frame.top)).multiply(anchor);
    layer.setAttribute('transform', `matrix(${fixed.a} ${fixed.b} ${fixed.c} ${fixed.d} ${fixed.e} ${fixed.f})`);
  };
  const resize = new ResizeObserver(restorePosition);
  let previousPhrase = '';
  let variation = { x: 0, y: 0, angle: 0 };
  const place = (staff: SVGSVGElement) => {
    const x = staff.viewBox.baseVal.width / 2 + variation.x;
    text.setAttribute('x', String(x));
    text.setAttribute('y', '0');
    text.setAttribute('transform', `rotate(${variation.angle} ${x} 0)`);
    if (!text.textContent) return;
    const notes = [...staff.querySelectorAll<SVGGraphicsElement>('.notehead, .note-accidental, .ledger')].map(boundsOf);
    const top = Math.min(...notes.map(note => note.top));
    const bottom = Math.max(...notes.map(note => note.bottom));
    const view = staff.viewBox.baseVal;
    const first = view.y + 6, last = view.y + view.height - 6;
    const belowStart = Math.max(first, bottom + 10), aboveEnd = Math.min(last, top - 10);
    const below = last - belowStart >= aboveEnd - first;
    const bandTop = below ? belowStart : first, bandBottom = below ? last : aboveEnd;
    const lines = [...text.querySelectorAll('tspan')];
    // Fit longer announcements inside the available band without covering notation.
    let size = 28, bounds;
    do {
      text.style.fontSize = `${size}px`;
      lines.forEach((line, index) => {
        line.setAttribute('x', String(x));
        line.setAttribute('dy', String(index === 0 ? -(lines.length - 1) * size * 0.6 : size * 1.2));
      });
      bounds = boundsOf(text);
      size--;
    } while (size >= 10 && (bounds.bottom - bounds.top > bandBottom - bandTop || bounds.left < 8 || bounds.right > view.width - 8));
    const y = Math.max(bandTop - bounds.top, Math.min((below ? 170 : 30) + variation.y, bandBottom - bounds.bottom));
    text.setAttribute('y', String(y));
    text.setAttribute('transform', `rotate(${variation.angle} ${x} ${y})`);
  };
  const clear = () => {
    animation?.cancel(); animation = undefined;
    resize.disconnect(); anchor = undefined; layer.removeAttribute('transform');
    text.textContent = ''; node.textContent = '';
  };
  const show = (message: string, correct: boolean, duration = 1000) => {
    clear();
    const lines: string[] = [];
    for (const paragraph of message.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        if (line && line.length + word.length + 1 > 25) { lines.push(line); line = ''; }
        line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
    }
    lines.forEach((line, index) => {
      const span = document.createElementNS(text.namespaceURI, 'tspan');
      span.textContent = line + (index < lines.length - 1 ? ' ' : '');
      text.append(span);
    });
    text.dataset.correct = String(correct);
    node.textContent = message;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    variation = { x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 10, angle: reduced ? 0 : (Math.random() - 0.5) * 8 };
    if (staff) {
      place(staff);
      const matrix = staff.getScreenCTM(), frame = staff.parentElement!.getBoundingClientRect();
      if (matrix) anchor = new DOMMatrix().translate(-frame.left, -frame.top).multiply(matrix);
      resize.observe(staff);
    }
    animation = text.animate([
      { opacity: reduced ? 0.65 : 0, offset: 0 },
      { opacity: 0.65, offset: 0.12 },
      { opacity: 0.65, offset: reduced ? 0.99 : 0.7 },
      { opacity: 0, offset: 1 },
    ], { duration, fill: 'forwards' });
  };
  return {
    node, clear, show,
    mount(next: SVGSVGElement) {
      staff = next;
      if (root.parentNode !== staff) {
        staff.append(root);
        if (anchor) { restorePosition(); resize.disconnect(); resize.observe(staff); }
        else place(staff);
      }
    },
    celebrate(reward: { treat: boolean; text: string }, announcement = '') {
      if (!reward.text && !reward.treat && !announcement) {
        const choices = positivePhrases.filter(phrase => phrase !== previousPhrase);
        previousPhrase = choices[Math.floor(Math.random() * choices.length)]!;
      }
      show(celebrationMessage(reward, announcement, previousPhrase), true, announcement ? 2500 : reward.text ? 1800 : 1000);
    },
  };
}
