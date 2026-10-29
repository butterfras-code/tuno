import { el } from '../../../shared/ui/components.ts';

/** Fit a flexible play layout to the space left by the real navigation/footer.
 * Scale up on classroom displays; scale down only below the layout's minimum
 * usable dimensions. Transforming the stage preserves SVG and pointer geometry.
 * Setup, introduction and results retain normal document scrolling and browser text zoom.
 */
export function playSurface(home: HTMLElement, options: HTMLElement) {
  const preferenceKey = 'tunotes:classroom-display';
  let classroom = false;
  try { classroom = localStorage.getItem(preferenceKey) === 'true'; } catch { /* Session-only preference. */ }
  const label = el('label','setting');
  const setting = el('input'); setting.type = 'checkbox'; setting.checked = classroom;
  label.append(setting,document.createTextNode(' Classroom display'));
  const description = el('p','muted','Larger notes and controls during play. Saved on this display.');
  description.id = 'classroom-display-help'; setting.setAttribute('aria-describedby',description.id);
  const group = el('section','display-settings'); group.append(label,description); options.insertBefore(group,options.children[1] ?? null);
  let stage: HTMLElement | undefined, viewport: HTMLElement | undefined;
  let frame = 0, disposed = false;
  const clear = () => {
    stage?.classList.remove('play-stage','play-stage--compact','play-stage--short','play-stage--grip','play-stage--bottom');
    stage?.style.removeProperty('width'); stage?.style.removeProperty('height'); stage?.style.removeProperty('transform'); stage?.style.removeProperty('top');
    viewport?.classList.remove('play-viewport');
  };
  const fit = () => {
    frame = 0;
    const next = [...home.querySelectorAll<HTMLElement>('.practice-view[data-screen="playing"], .multiplayer-round:not([hidden])')]
      .find(node => !node.closest('[hidden]'));
    if (next !== stage) {
      clear(); stage = next;
      viewport = stage?.closest<HTMLElement>('.notes-workspace > section') ?? undefined;
      home.classList.toggle('is-playing',Boolean(stage));
      const fullscreen = home.querySelector<HTMLButtonElement>('.notes-fullscreen')!;
      fullscreen.hidden = !stage || stage.classList.contains('multiplayer-round') || !document.fullscreenEnabled;
      stage?.classList.add('play-stage'); viewport?.classList.add('play-viewport');
      // Starting after scrolling setup must not leave the play surface offscreen.
      if (stage) window.scrollTo(0,0);
    }
    if (!stage || !viewport) return;
    const multiplayer = stage.classList.contains('multiplayer-round');
    const grip = !multiplayer && Boolean(stage.querySelector('.note-entry:not([hidden])[data-input-method="fingering"]:is([data-grip-position="left"], [data-grip-position="right"])'));
    const bottom = !multiplayer && Boolean(stage.querySelector('.note-entry:not([hidden])[data-input-method="fingering"][data-grip-position="bottom"]'))
      && matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
    // Reserve the full-height hand column before measuring the remaining staff area.
    stage.classList.toggle('play-stage--grip',grip);
    stage.classList.toggle('play-stage--bottom',bottom);
    const warning = viewport.querySelector<HTMLElement>('.multiplayer-fit-warning:not([hidden])');
    const inset = warning ? warning.offsetHeight+16 : 0;
    stage.style.setProperty('--grip-top', `${viewport.getBoundingClientRect().top}px`);
    const width = viewport.clientWidth, height = viewport.clientHeight-inset;
    if (!width || !height) return;
    stage.style.top = `${inset}px`;
    const head = stage.classList.contains('multiplayer-round--head-to-head');
    const pairs = multiplayer && stage.querySelectorAll('.multiplayer-seat').length > 1;
    const portrait = width < height;
    const compact = !grip && !pairs && width < 700;
    const challenge = stage.classList.contains('challenge-active');
    // Challenge reserves a scene and feedback above the shared input panel.
    // Switch to the side-by-side layout before that stack runs out of height.
    const shortHeight = challenge ? 680 : 500;
    const short = !multiplayer && (grip || width >= 700 && height < shortHeight);
    stage.classList.toggle('play-stage--short',short);
    stage.classList.toggle('play-stage--compact',compact);
    // The staff flexes above the reserved answer rows. Below these sizes the
    // entire surface still fits, with the multiplayer warning left actionable.
    const minWidth = grip ? 560 : head ? portrait ? 440 : 1120 : pairs ? 960 : compact ? 344 : 700;
    const physicalInput = Boolean(stage.querySelector('.note-entry[data-input-method="fingering"], .note-entry[data-input-method="keyboard"]'));
    const minHeight = grip ? 240 : head ? portrait ? 1120 : 600 : short ? 280 : compact ? physicalInput ? 710 : 600 : challenge ? 600 : 560;
    const preferredWidth = classroom ? 1000 : 1280;
    const preferredHeight = classroom ? 650 : 800;
    const grow = Math.max(1,Math.min(width/preferredWidth,height/preferredHeight));
    const scale = grip || bottom ? 1 : Math.min(grow,width/minWidth,height/minHeight);
    stage.style.width = `${width/scale}px`;
    stage.style.height = `${height/scale}px`;
    stage.style.transform = grip || bottom ? 'none' : `scale(${scale})`;
  };
  const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(fit); };
  setting.addEventListener('change',() => {
    classroom = setting.checked;
    try { localStorage.setItem(preferenceKey,String(classroom)); } catch { /* Still works without storage. */ }
    schedule();
  });
  const resize = new ResizeObserver(schedule);
  resize.observe(home); resize.observe(home.querySelector('.app-header')!);
  resize.observe(home.querySelector('footer')!);
  const changes = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList'
      ? record.target instanceof Element && record.target.matches('.multiplayer-panels')
      : record.oldValue !== (record.target as Element).getAttribute(record.attributeName!))) schedule();
  });
  changes.observe(home,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','data-screen','data-input-method','data-grip-position']});
  window.addEventListener('resize',schedule);
  document.fonts.ready.then(schedule);
  schedule();
  return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); changes.disconnect(); window.removeEventListener('resize',schedule); clear(); };
}
