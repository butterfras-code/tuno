import { el } from '../../shared/ui/components.ts';
import { derivePassage } from '../../music/measure.ts';
import { toNumber } from '../../music/fraction.ts';
import type { RhythmMeasure } from '../../music/measure.ts';
import { renderMeasure, responsiveNotation } from './shared/notation.ts';

/** Presentation only: the editor owns count IDs; the score owns musical time. */
export function createWritingWorkspace(passage: HTMLElement, scroll: HTMLElement, strip: HTMLElement, measures: () => readonly RhythmMeasure[]) {
  const overview = el('div', 'rhythm-overview'); overview.hidden = true;
  overview.tabIndex = 0;
  overview.setAttribute('role', 'slider');
  overview.setAttribute('aria-label', 'Visible rhythm');
  overview.setAttribute('aria-orientation', 'horizontal');
  overview.setAttribute('aria-valuemin', '0');
  overview.title = 'Drag or tap to navigate. Use arrow keys, Page Up/Down, Home or End.';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const viewport = el('span', 'rhythm-overview-window'); viewport.setAttribute('aria-hidden', 'true');
  overview.append(svg, viewport); passage.prepend(overview);
  let enabled = false, frame = 0, restore = false, resized = false;
  let presentation: 'writing' | 'performance' = 'writing';
  const savedScroll = { writing: 0, performance: 0 };
  let followFrame = 0;
  let followPoints: { time: number; x: number }[] | null = null;
  let drag: { pointer: number; offset: number } | null = null;
  const maximum = () => Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  function sync() {
    if (!enabled || !scroll.clientWidth) return;
    const width = scroll.scrollWidth;
    overview.hidden = maximum() <= 1;
    viewport.style.left = `${100 * scroll.scrollLeft / width}%`;
    viewport.style.width = `${100 * scroll.clientWidth / width}%`;
    overview.setAttribute('aria-valuemax', String(Math.round(maximum())));
    overview.setAttribute('aria-valuenow', String(Math.round(scroll.scrollLeft)));
    overview.setAttribute('aria-valuetext', `${Math.round(100 * scroll.scrollLeft / width)} to ${Math.round(100 * (scroll.scrollLeft + scroll.clientWidth) / width)} percent of exercise visible`);
  }
  function move(left: number) {
    scroll.scrollLeft = Math.max(0, Math.min(maximum(), left));
    sync();
  }
  // Reuse the engraving with the main score's exact horizontal proportions.
  // Bounded miniature glyphs stay visible even when the main score is very wide.
  function render() {
    frame = 0;
    followPoints = null;
    if (!enabled || !scroll.clientWidth) return;
    if (restore) { move(savedScroll[presentation]); restore = false; }
    if (resized) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && strip.contains(focused) && focused.hasAttribute('data-count-id')) reveal(focused);
      resized = false;
    }
    sync();
    if (overview.hidden) return;
    const origin = strip.getBoundingClientRect();
    const scale = overview.clientWidth / scroll.scrollWidth;
    const sourceMeasures = measures();
    const fragments: SVGElement[] = [];
    strip.querySelectorAll<SVGSVGElement>('.notation').forEach((source, index) => {
      const bounds = source.getBoundingClientRect();
      const copy = renderMeasure(sourceMeasures[index]!, '', { first: index === 0, last: index === sourceMeasures.length - 1 });
      const width = bounds.width * scale;
      responsiveNotation(copy)(width, .16);
      for (const node of [copy, ...copy.querySelectorAll('*')]) {
        for (const attr of [...node.attributes]) {
          if (/^(id|class|style|role|tabindex)$/.test(attr.name) || /^(aria-|data-)/.test(attr.name)) node.removeAttribute(attr.name);
        }
      }
      copy.querySelectorAll('title').forEach(title => title.remove());
      copy.setAttribute('x', String((bounds.left - origin.left) * scale));
      copy.setAttribute('y', '8');
      copy.setAttribute('width', String(width)); copy.setAttribute('height', '24');
      fragments.push(copy);
    });
    const ties = strip.querySelector<SVGSVGElement>('.passage-ties');
    const notation = strip.querySelector<SVGSVGElement>('.notation');
    if (ties && notation) {
      const copy = ties.cloneNode(true) as SVGSVGElement;
      const height = ties.getBoundingClientRect().height;
      copy.removeAttribute('class');
      copy.querySelectorAll('*').forEach(node => [...node.attributes].filter(a => a.name.startsWith('data-')).forEach(a => node.removeAttribute(a.name)));
      copy.setAttribute('viewBox', `0 0 ${scroll.scrollWidth} ${height}`);
      copy.setAttribute('preserveAspectRatio', 'none');
      copy.setAttribute('width', String(overview.clientWidth));
      const yScale = 24 / notation.getBoundingClientRect().height;
      copy.setAttribute('height', String(height * yScale));
      copy.setAttribute('y', String(8 - (notation.getBoundingClientRect().top - origin.top) * yScale));
      fragments.push(copy);
    }
    svg.setAttribute('viewBox', `0 0 ${overview.clientWidth} 46`);
    svg.replaceChildren(...fragments);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  const resize = new ResizeObserver(() => { resized = true; schedule(); }); resize.observe(scroll); resize.observe(strip);
  const mutation = new MutationObserver(schedule);
  mutation.observe(strip, { childList: true, subtree: true, attributes: true });
  scroll.addEventListener('scroll', sync, { passive: true });
  overview.addEventListener('keydown', event => {
    const steps: Record<string, number> = { ArrowLeft: -scroll.clientWidth * .15, ArrowRight: scroll.clientWidth * .15, PageUp: -scroll.clientWidth * .8, PageDown: scroll.clientWidth * .8 };
    if (event.key === 'Home' || event.key === 'End' || event.key in steps) {
      event.preventDefault();
      move(event.key === 'Home' ? 0 : event.key === 'End' ? maximum() : scroll.scrollLeft + steps[event.key]!);
    }
  });
  function coordinate(event: PointerEvent) {
    const bounds = overview.getBoundingClientRect();
    return (event.clientX - bounds.left - overview.clientLeft) / overview.clientWidth * scroll.scrollWidth;
  }
  overview.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); overview.focus({ preventScroll: true });
    const x = coordinate(event);
    drag = { pointer: event.pointerId, offset: x >= scroll.scrollLeft && x <= scroll.scrollLeft + scroll.clientWidth ? x - scroll.scrollLeft : scroll.clientWidth / 2 };
    overview.setPointerCapture(event.pointerId); move(x - drag.offset);
  });
  overview.addEventListener('pointermove', event => { if (drag?.pointer === event.pointerId) move(coordinate(event) - drag.offset); });
  overview.addEventListener('lostpointercapture', () => { drag = null; });
  function reveal(target: HTMLElement) {
    if (!enabled || !target.isConnected) return;
    restore = false; // An explicit selection takes precedence over a saved viewport.
    const bounds = scroll.getBoundingClientRect(), rect = target.getBoundingClientRect();
    const slots = [...strip.querySelectorAll<HTMLElement>('[data-count-id]')];
    const next = slots[slots.indexOf(target) + 1]?.getBoundingClientRect();
    // Reserve space for one more actual count where possible; bound unusually
    // large gaps so sparse bars do not demand excessive scrolling.
    const lookAhead = next ? Math.min(scroll.clientWidth * .3, Math.max(rect.width, next.right - rect.right)) : rect.width;
    const boundary = bounds.left + scroll.clientWidth - lookAhead;
    if (rect.left < bounds.left + 8) move(scroll.scrollLeft + rect.left - bounds.left - 8);
    else if (rect.right > boundary) move(scroll.scrollLeft + rect.right - boundary);
  }
  function stopFollowing() { cancelAnimationFrame(followFrame); followFrame = 0; }
  function startFollowing(clock: () => number, duration: number) {
    stopFollowing();
    restore = false;
    savedScroll.performance = 0;
    move(0);
    // Measure durations come from written music, including rests and ties.
    // Normalize to the captured duration so meter-specific tempo uses the transport.
    const score = derivePassage(measures());
    const length = toNumber(score.length);
    // Rebuild screen geometry after resize/engraving changes, never from tap input.
    function points() {
      if (followPoints) return followPoints;
      const origin = scroll.getBoundingClientRect().left + scroll.clientLeft - scroll.scrollLeft;
      const notation = [...strip.querySelectorAll<SVGSVGElement>('.notation')];
      const anchors: { time: number; x: number }[] = [];
      let offset = 0;
      score.measures.forEach((measure, index) => {
        const svg = notation[index];
        if (!svg) return;
        const bounds = svg.getBoundingClientRect();
        const x = bounds.left - origin;
        anchors.push({ time: offset / length * duration, x });
        offset += toNumber(measure.length);
        // Follow a whole measure at a steady pace. Event-by-event following
        // squeezes the barline gap into the final short note and visibly lunges.
        // Extend the same pace through the last bar; move() clamps at the end.
        if (index === score.measures.length - 1) anchors.push({ time: duration, x: x + bounds.width });
      });
      return followPoints = anchors;
    }
    function follow() {
      if (!enabled || presentation !== 'performance') { stopFollowing(); return; }
      const time = clock();
      if (time < 0) move(0);
      else if (maximum() > 1) {
        const anchors = points();
        const next = anchors.findIndex(point => point.time > time);
        const left = anchors[next < 0 ? anchors.length - 1 : Math.max(0, next - 1)];
        const right = anchors[next] ?? left;
        if (left && right) {
          const fraction = right.time > left.time ? Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time))) : 0;
          move(left.x + (right.x - left.x) * fraction - scroll.clientWidth / 3);
        }
      }
      followFrame = requestAnimationFrame(follow);
    }
    followPoints = null;
    followFrame = requestAnimationFrame(follow);
  }
  return {
    reveal, startFollowing, stopFollowing,
    reset() { savedScroll.writing = savedScroll.performance = 0; scroll.scrollLeft = 0; schedule(); },
    setEnabled(value: boolean, mode: 'writing' | 'performance' = 'writing') {
      if (enabled === value && presentation === mode) return;
      if (enabled) savedScroll[presentation] = scroll.scrollLeft;
      enabled = value; presentation = mode; restore = value;
      passage.classList.toggle('writing-workspace', value && mode === 'writing');
      passage.classList.toggle('performance-workspace', value && mode === 'performance');
      overview.hidden = !value;
      schedule();
    },
    destroy() { stopFollowing(); cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); scroll.removeEventListener('scroll', sync); overview.remove(); },
  };
}
