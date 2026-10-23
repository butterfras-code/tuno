/** Bottom stickiness is allowed only where the dock cannot cover the score or
 * panel controls. Normal flow reserves its space, including on short screens. */
export function keepCountingDockClear(area: HTMLElement, preceding: HTMLElement, dock: HTMLElement) {
  let frame = 0;
  function update() {
    frame = 0;
    const viewport = window.visualViewport;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
    const requiredBottom = preceding.getBoundingClientRect().bottom + 8 + dock.getBoundingClientRect().height;
    // Reserve a bottom-docked workspace only when the initial reading area fits.
    // Document coordinates keep this decision stable while the page is scrolled.
    area.classList.toggle('dock-roomy', requiredBottom + window.scrollY <= bottom);
    const canStick = area.classList.contains('editing-counts') &&
      window.matchMedia('(max-width: 768px)').matches &&
      requiredBottom <= bottom;
    area.classList.toggle('dock-can-stick', canStick);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  const observer = new ResizeObserver(schedule);
  observer.observe(area); observer.observe(preceding); observer.observe(dock);
  if (area.parentElement) observer.observe(area.parentElement);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  schedule();
}
