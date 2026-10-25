import { el } from '../../../shared/ui/components.ts';

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
  const clear = () => {
    animation?.cancel(); animation = undefined;
    text.textContent = ''; node.textContent = '';
  };
  return {
    node, clear,
    mount(staff: SVGSVGElement) {
      text.setAttribute('x', String(staff.viewBox.baseVal.width / 2));
      if (text.parentNode !== staff) staff.append(text);
    },
    show(message: string, correct: boolean) {
      clear();
      text.textContent = message;
      text.dataset.correct = String(correct);
      node.textContent = message;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      animation = text.animate([
        { opacity: reduced ? 1 : 0, offset: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: reduced ? 0.99 : 0.7 },
        { opacity: 0, offset: 1 },
      ], { duration: 1000, fill: 'forwards' });
    },
  };
}
