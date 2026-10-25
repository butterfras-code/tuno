import { el } from '../../../shared/ui/components.ts';

function verticalBounds(element: SVGGraphicsElement) {
  const box = element.getBBox();
  const transforms = element.transform.baseVal;
  let matrix = new DOMMatrix();
  for (let i = 0; i < transforms.numberOfItems; i++) matrix = matrix.multiply(transforms.getItem(i).matrix);
  const ys = [box.x, box.x + box.width].flatMap(x => [box.y, box.y + box.height].map(y => {
    const point = new DOMPoint(x, y);
    return point.matrixTransform(matrix).y;
  }));
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
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
  let animation: Animation | undefined;
  let variation = { x: 0, y: 0, angle: 0 };
  const place = (staff: SVGSVGElement) => {
    const x = staff.viewBox.baseVal.width / 2 + variation.x;
    text.setAttribute('x', String(x));
    text.setAttribute('y', '0');
    text.setAttribute('transform', `rotate(${variation.angle} ${x} 0)`);
    if (!text.textContent) return;
    const bounds = verticalBounds(text);
    const notes = [...staff.querySelectorAll<SVGGraphicsElement>('.notehead, .note-accidental, .ledger')].map(verticalBounds);
    const top = Math.min(...notes.map(note => note.top));
    const bottom = Math.max(...notes.map(note => note.bottom));
    const view = staff.viewBox.baseVal;
    const clamp = (y: number) => Math.max(view.y + 6 - bounds.top, Math.min(y, view.y + view.height - 6 - bounds.bottom));
    // Use the band furthest from the note, including its accidental and ledgers.
    const below = (top + bottom) / 2 <= 100;
    let y = clamp((below ? 170 : 30) + variation.y);
    if (below) y = Math.max(y, bottom + 10 - bounds.top);
    else y = Math.min(y, top - 10 - bounds.bottom);
    text.setAttribute('y', String(y));
    text.setAttribute('transform', `rotate(${variation.angle} ${x} ${y})`);
  };
  const clear = () => {
    animation?.cancel(); animation = undefined;
    text.textContent = ''; node.textContent = '';
  };
  return {
    node, clear,
    mount(staff: SVGSVGElement) {
      if (text.parentNode !== staff) { staff.append(text); place(staff); }
    },
    show(message: string, correct: boolean, duration = 1000) {
      clear();
      text.textContent = message;
      text.dataset.correct = String(correct);
      node.textContent = message;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      variation = { x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 10, angle: reduced ? 0 : (Math.random() - 0.5) * 8 };
      if (text.ownerSVGElement) place(text.ownerSVGElement);
      animation = text.animate([
        { opacity: reduced ? 0.65 : 0, offset: 0 },
        { opacity: 0.65, offset: 0.12 },
        { opacity: 0.65, offset: reduced ? 0.99 : 0.7 },
        { opacity: 0, offset: 1 },
      ], { duration, fill: 'forwards' });
    },
  };
}
