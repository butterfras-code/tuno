import { button, el, select, field } from '../../../shared/ui/components.ts';
import { renderRhythmSymbol, renderRhythmPattern } from './notation.ts';
import { ingredients } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import { generationLevels, resolveTeachingPreset } from './teaching-presets.ts';
import { profileFigures, rhythmFigures } from './figures.ts';
import type { InstrumentScope } from './figures.ts';

/** The rhythm counterpart of tuNotes' range chooser. All edits belong to its draft. */
export function rhythmPresetPicker(options: {
  editor: HTMLElement;
  details: HTMLElement;
  current: () => GenerationSettings;
  choose: (id: string, scope: InstrumentScope) => void;
  customize: () => void;
}) {
  const node = el('div', 'rhythm-preset-picker');
  const tabs = el('div', 'rhythm-preset-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Rhythm preset category');
  const panel = el('section', 'rhythm-preset-panel'); panel.id = 'rhythm-preset-panel'; panel.setAttribute('role', 'tabpanel');
  const list = el('div', 'rhythm-preset-list');
  const custom = el('div', 'rhythm-preset-custom'); custom.append(options.editor, options.details);
  const context = el('p', 'setting-hint');
  let category = 0;
  const scope = select([{ value: 'general', label: 'General' }, { value: 'percussion', label: 'Percussion' }], () => {
    const current = options.current();
    if (current.teachingPreset?.id.startsWith('uil-') && !current.teachingPreset.customized) options.choose(current.teachingPreset.id, scope.value as InstrumentScope);
    render();
  });
  const scopeField = field('UIL instrument scope', scope);
  const buttons = ["Uno’s Choice", 'UIL Sight Reading', 'Custom'].map((name, index) => {
    const tab = button(name, () => show(index)); tab.id = `rhythm-preset-tab-${index}`;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : undefined;
      if (next !== undefined) { event.preventDefault(); show(next); buttons[next]!.focus(); }
    });
    tabs.append(tab); return tab;
  });
  function show(index: number) {
    if (index === 2 && category !== 2) options.customize();
    category = index; render();
  }
  function render() {
    const current = options.current();
    buttons.forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === category)); tab.tabIndex = index === category ? 0 : -1; });
    panel.setAttribute('aria-labelledby', buttons[category]!.id);
    list.hidden = category === 2; custom.hidden = category !== 2; scopeField.hidden = category !== 1;
    context.textContent = category === 1 ? 'Allowed figures and rests' : category === 2 ? (current.teachingPreset ? `Based on ${generationLevels.find(p => p.id === current.teachingPreset?.id)?.label ?? 'your settings'}` : 'Choose the rhythms for your next exercise.') : '';
    context.hidden = !context.textContent;
    list.replaceChildren();
    if (category === 2) return;
    for (const preset of generationLevels.filter(p => Boolean(p.source) === (category === 1))) {
      const resolution = resolveTeachingPreset(preset, undefined, scope.value as InstrumentScope);
      const card = el('div', 'rhythm-preset-card'); card.dataset.presetId = preset.id;
      const selected = current.teachingPreset?.id === preset.id && !current.teachingPreset.customized;
      card.classList.toggle('is-selected', selected);
      const choose = button('', () => { options.choose(preset.id, scope.value as InstrumentScope); render(); list.querySelector<HTMLButtonElement>(`[data-preset-id="${preset.id}"] .rhythm-preset-select`)?.focus(); });
      choose.classList.add('rhythm-preset-select'); choose.disabled = !resolution.supported;
      choose.setAttribute('aria-pressed', String(selected)); choose.setAttribute('aria-label', preset.label);
      const heading = el('span', 'rhythm-preset-heading'); heading.append(el('strong', '', preset.label), el('span', 'rhythm-preset-check', selected ? '✓' : ''));
      const symbols = el('span', 'rhythm-preset-symbols');
      const settings = resolution.supported ? resolution.settings : preset.recommended;
      const previews = settings.figureProfile ? profileFigures(settings.figureProfile).map(id => ({ label: id, events: rhythmFigures[id].events })) : ingredients.filter(i => settings.ingredients.includes(i.id)).map(i => ({ label: i.label, events: [i.event] }));
      for (const preview of previews) {
        const symbol = el('span', 'rhythm-preset-symbol'); symbol.title = preview.label;
        symbol.append(preview.events.length === 1 ? renderRhythmSymbol(preview.events[0]!) : renderRhythmPattern(preview.events)); symbols.append(symbol);
      }
      const labels = previews.map(p => p.label).join(', ');
      symbols.setAttribute('aria-label', `Allowed ${preset.source ? 'figures' : 'symbols'}: ${labels}`);
      const extras = [settings.ties && 'Ties', settings.syncopation && 'Syncopation', settings.allowUnintuitiveNotation && 'Unusual notation'].filter(Boolean);
      const footer = el('span', 'rhythm-preset-meta', [...(settings.meters ?? []), ...extras].join(' · '));
      choose.setAttribute('aria-description', `${labels}. ${footer.textContent}`);
      choose.append(heading, symbols, footer);
      const edit = button('', () => { options.choose(preset.id, scope.value as InstrumentScope); show(2); buttons[2]!.focus(); });
      edit.classList.add('rhythm-preset-edit'); edit.setAttribute('aria-label', `Customize ${preset.label}`); edit.title = `Customize ${preset.label}`; edit.disabled = !resolution.supported;
      edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
      card.append(choose, edit);
      if (!resolution.supported) card.append(el('span', 'setting-hint', 'Unavailable for this scope'));
      list.append(card);
    }
  }
  panel.append(scopeField, context, list, custom); node.append(tabs, panel);
  return { node, refresh: render, open() {
    const identity = options.current().teachingPreset;
    category = !identity || identity.customized ? 2 : identity.id.startsWith('uil-') ? 1 : 0;
    scope.value = identity?.scope ?? 'general'; render();
  } };
}
