import { meters } from './meter.ts';
import { button, el, field, select } from '../../../shared/ui/components.ts';
import type { DottedQuarterConvention } from '../../count-writing/evaluation.ts';
import { linePlacementOptions, sustainAppearanceOptions } from '../../count-writing/presentation.ts';
import type { CountPresentation, LinePlacement, SustainAppearance } from '../../count-writing/presentation.ts';
import type { OffbeatSymbol } from '../../count-writing/input.ts';
import { settingsGroups } from './settings-catalog.ts';
import { generationIssue, ingredients, enableMeter } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import type { Setting } from './settings-catalog.ts';

export const dottedConventionOptions = [
  { value: 'review', label: 'Teacher review — accept both provisionally' },
  { value: 'required', label: 'Require internal &' },
  { value: 'optional', label: 'Internal & is optional' },
] as const;

function placeholder(setting: Setting): HTMLElement {
  const row = el('div', 'setting-row');
  row.dataset.setting = setting.id;
  row.dataset.availability = setting.availability ?? 'planned';
  const label = el('div', 'setting-heading');
  const title = el('h3', '', setting.label); title.id = `setting-${setting.id}`;
  const status = setting.availability === 'decision' ? 'To be decided' : setting.availability === 'deferred' ? 'Outside this release' : 'Not available yet';
  const badge = el('span', 'availability', status);
  badge.id = `status-${setting.id}`;
  label.append(title, badge); row.append(label);
  const hint = el('p', 'setting-hint', setting.hint ?? (setting.availability === 'decision' ? 'Behavior and defaults still need review.' : 'This control will be available in a later version.'));
  hint.id = `hint-${setting.id}`;
  const describe = (control: HTMLElement) => control.setAttribute('aria-describedby', `${badge.id} ${hint.id}`);
  if (setting.kind === 'select' || setting.kind === 'checklist') {
    const group = el('fieldset', 'settings-options');
    group.append(el('legend', 'sr-only', setting.label));
    describe(group);
    for (const option of setting.options ?? []) {
      const optionLabel = el('label', 'setting-option');
      const input = el('input');
      input.type = setting.kind === 'select' ? 'radio' : 'checkbox';
      input.name = `setting-${setting.id}`;
      input.disabled = true; input.checked = setting.value === option;
      input.dataset.setting = setting.id; describe(input);
      optionLabel.append(input, el('span', '', option)); group.append(optionLabel);
    }
    row.append(group);
  } else if (setting.kind === 'check') {
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.disabled = true;
    checkbox.checked = setting.checked ?? false;
    checkbox.indeterminate = setting.checked === undefined;
    checkbox.setAttribute('aria-labelledby', title.id); describe(checkbox);
    row.append(checkbox);
  } else if (setting.kind === 'number') {
    const input = el('input', 'control'); input.type = 'number'; input.disabled = true; input.placeholder = 'Not set';
    input.setAttribute('aria-labelledby', title.id); describe(input); row.append(input);
  } else if (setting.kind === 'action') {
    const action = button(setting.label); action.disabled = true; describe(action); row.append(action);
  }
  row.append(hint);
  return row;
}

export function createSettingsPage(callbacks: {
  initialGeneration: GenerationSettings;
  newExercise: () => void;
  generation: (value: GenerationSettings) => void;
  offbeat: (value: OffbeatSymbol) => void;
  placement: (value: LinePlacement) => void;
  appearance: (value: SustainAppearance) => void;
  convention: (value: DottedQuarterConvention) => void;
}) {
  const page = el('section', 'rhythm-settings'); page.id = 'settings-view'; page.setAttribute('aria-label', 'Rhythm settings');
  const intro = el('p', 'settings-intro', 'Configure Rhythm Walk once for Write Counts, Tap Rhythms, or Both. Unavailable controls are shown for review and do not change your exercises.');
  const savedNote = el('p', 'setting-hint', 'Preferences are saved automatically in this browser. Exercise settings apply to your next exercise. New Exercise uses these settings, clears both responses, and returns to practice. Preferences persist across reloads; responses belong to the current exercise.');
  const newExercise = button('New Exercise', callbacks.newExercise, true);
  const settingsActions = el('div', 'actions settings-actions'); settingsActions.append(newExercise);
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Available now'); heading.id = 'available-settings';
  const activeBadge = el('span', 'availability availability--active', 'Working controls');
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading, activeBadge);
  const activeControls = el('div', 'settings-live-controls');
  const offbeat = select([{ value: '&', label: 'Numbers with &' }, { value: '+', label: 'Numbers with +' }], value => callbacks.offbeat(value as OffbeatSymbol));
  offbeat.dataset.setting = 'count-system';
  const systemField = field('Counting system', offbeat);
  systemField.append(el('p', 'setting-hint', 'In simple meters, either + or & enters the chosen offbeat symbol. Changing it preserves your answer. In 6/8 every eighth has a fixed number 1–6; this preference is saved for simple meters.'));
  const convention = select(dottedConventionOptions, value => callbacks.convention(value as DottedQuarterConvention));
  convention.dataset.setting = 'dotted-quarter-convention';
  const conventionField = field('Dotted-quarter internal &', convention);
  const conventionHint = el('p', 'setting-hint', 'Applies to dotted-quarter sounding durations in simple meters. In 6/8 all six numbers are required; this preference has no effect. Your answer stays intact; check again after changing the rule.');
  conventionHint.id = 'settings-convention-hint'; convention.setAttribute('aria-describedby', conventionHint.id); conventionField.append(conventionHint);
  const placement = select(linePlacementOptions, value => callbacks.placement(value as LinePlacement));
  placement.dataset.setting = 'line-anchor';
  const placementField = field('Duration-line placement', placement);
  const placementHint = el('p', 'setting-hint', 'Switching to beside counts defaults sustained counts to raised and smaller. You can then choose any appearance.');
  placementHint.id = 'settings-placement-hint';
  placement.setAttribute('aria-describedby', placementHint.id); placementField.append(placementHint);
  const appearance = select(sustainAppearanceOptions, value => callbacks.appearance(value as SustainAppearance));
  appearance.dataset.setting = 'sustain-style';
  const appearanceField = field('Sustained-count appearance', appearance);
  const appearanceHint = el('p', 'setting-hint', 'Applies to counts inside your duration lines; the onset stays full-size. Unchanged allows lines beside counts to cross through them.');
  appearanceHint.id = 'settings-appearance-hint';
  appearance.setAttribute('aria-describedby', appearanceHint.id); appearanceField.append(appearanceHint);
  let generation = structuredClone(callbacks.initialGeneration);
  const length = select([1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} ${n === 1 ? 'measure' : 'measures'}` })), value => { generation = { ...generation, measures: Number(value) }; generationChanged(); });
  length.value = String(generation.measures); length.dataset.setting = 'exercise-length';
  const meterField = el('fieldset', 'settings-options active-meters');
  meterField.append(el('legend', '', 'Time signatures · next exercise'));
  for (const meter of meters) {
    const label = el('label', 'setting-option'); const input = el('input'); input.type = 'checkbox'; input.checked = (generation.meters ?? [generation.meter ?? '4/4']).includes(meter); input.dataset.meter = meter;
    input.addEventListener('change', () => {
      if (input.checked) generation = enableMeter(generation, meter);
      else {
        const { meter: _legacy, ...current } = generation;
        generation = { ...current, meters: (generation.meters ?? [generation.meter ?? '4/4']).filter(value => value !== meter) };
      }
      vocabulary.querySelectorAll<HTMLInputElement>('[data-ingredient]').forEach(control => { control.checked = generation.ingredients.includes(control.dataset.ingredient as typeof generation.ingredients[number]); });
      generationChanged();
    });
    label.append(input, el('span', '', meter)); meterField.append(label);
  }
  meterField.append(el('p', 'setting-hint', 'Each new exercise uses one selected time signature for all measures. Enabling a time signature enables quarter notes in simple meters or eighth notes in 6/8. Selected ingredients that do not fit that meter are skipped. In 6/8, count 1–6 on eighths with two dotted-quarter performance beats.'));
  const lengthField = field('Exercise length', length);
  lengthField.append(el('p', 'setting-hint', 'Default: 2 measures. Applies on Next exercise; keeps the current answer.'));
  const vocabulary = el('fieldset', 'settings-options active-ingredients');
  vocabulary.append(el('legend', '', 'Allowed rhythm ingredients · next exercise'));
  for (const ingredient of ingredients) {
    const label = el('label', 'setting-option'); const input = el('input'); input.type = 'checkbox'; input.checked = generation.ingredients.includes(ingredient.id); input.dataset.ingredient = ingredient.id;
    input.addEventListener('change', () => { generation = { ...generation, ingredients: ingredients.filter(i => vocabulary.querySelector<HTMLInputElement>(`[data-ingredient="${i.id}"]`)!.checked).map(i => i.id) }; generationChanged(); });
    label.append(input, el('span', '', ingredient.label)); vocabulary.append(label);
  }
  const notationOption = el('label', 'setting-option');
  const notationToggle = el('input'); notationToggle.type = 'checkbox'; notationToggle.checked = generation.allowUnintuitiveNotation; notationToggle.dataset.setting = 'unintuitive-notation';
  notationOption.append(notationToggle, el('span', '', 'Allow unintuitive notation'));
  const notationField = el('div'); notationField.append(notationOption, el('p', 'setting-hint', 'Off by default. Quarter and half rests start on whole beats. Dotted quarter rests in simple meters are used only when this option and their ingredient checkbox are enabled. Applies on Next exercise; keeps your answer.'));
  notationToggle.addEventListener('change', () => { generation = { ...generation, allowUnintuitiveNotation: notationToggle.checked }; generationChanged(); });
  const patternFields = el('div');
  for (const [key, label, hint] of [
    ['ties', 'Ties', 'Permit one chain of 2–3 enabled written note segments, including across barlines. Continuations are not attacks.'],
    ['syncopation', 'Syncopation', 'Permit at most one off-pulse attack per measure sustained across the next pulse: a quarter in simple meters, a dotted quarter in 6/8. Sounds ending at that pulse remain available when off.'],
  ] as const) {
    const option = el('label', 'setting-option'); const toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = Boolean(generation[key]); toggle.dataset.setting = key;
    option.append(toggle, el('span', '', label));
    patternFields.append(option, el('p', 'setting-hint', `${hint} Off by default; applies on Next and keeps the current answer.`));
    toggle.addEventListener('change', () => { generation = { ...generation, [key]: toggle.checked }; generationChanged(); });
  }
  const generationStatus = el('p', 'setting-hint'); generationStatus.setAttribute('role', 'status');
  function generationChanged() {
    const issue = generationIssue(generation);
    newExercise.disabled = Boolean(issue);
    generationStatus.textContent = issue ?? 'Ready for Next exercise. Only compatible checked ingredients are used; each exercise uses one selected time signature.';
    callbacks.generation(structuredClone(generation));
  }
  generationStatus.textContent = '4/4 by default. Only compatible checked ingredients are used; each exercise uses one selected time signature. Changes apply on Next exercise.';
  const exerciseControls = el('div', 'settings-live-controls shared-exercise-settings');
  exerciseControls.append(meterField, lengthField, vocabulary, notationField, patternFields, generationStatus);
  activeControls.append(systemField, conventionField, placementField, appearanceField);
  const restRule = el('section', 'setting-row');
  restRule.dataset.setting = 'rest-grouping';
  restRule.setAttribute('aria-labelledby', 'setting-rest-grouping');
  const restHeading = el('div', 'setting-heading');
  const restTitle = el('h3', '', 'Rest parentheses'); restTitle.id = 'setting-rest-grouping';
  restHeading.append(restTitle, el('span', 'availability availability--active', 'Current rule'));
  restRule.append(restHeading, el('p', 'setting-hint', 'Use one complete pair of parentheses per written rest, enclosing all its required or entered counts. A half rest encloses both beats and its duration line: (1 2). Two quarter rests use separate pairs: (1) (2). Groups cannot overlap or nest. This rule is fixed in the current prototype.'));
  available.append(activeHeader, el('h3', '', 'Exercise settings'), exerciseControls, el('h3', '', 'Writing preferences'), activeControls, restRule, el('p', 'setting-hint', 'Preferences are saved for this browser. Preferences persist across reloads; responses belong to the current exercise.'));
  const browse = el('div', 'settings-browse');
  browse.append(el('h2', '', 'Planned settings'));
  const sections: HTMLDetailsElement[] = [];
  const expand = button('Expand all groups', () => {
    const open = sections.some(section => !section.open);
    sections.forEach(section => { section.open = open; });
    expand.textContent = open ? 'Collapse all groups' : 'Expand all groups';
  });
  browse.append(expand);
  page.append(intro, savedNote, settingsActions, available, browse, el('p', 'setting-hint', '“Not available yet” marks planned controls. “To be decided” marks open choices. Unselected future options are not exercise defaults.'));
  for (const group of settingsGroups) {
    const plannedSettings = group.settings.filter(setting => !['count-system', 'passage-length', 'meter-pool', 'beat-grouping', 'activity-mode'].includes(setting.id));
    const section = el('details', 'settings-group'); section.dataset.group = group.id;
    section.addEventListener('toggle', () => { expand.textContent = sections.every(s => s.open) ? 'Collapse all groups' : 'Expand all groups'; });
    const summary = el('summary');
    const title = el('h2', '', group.title);
    summary.append(title, el('span', 'group-count', `${plannedSettings.length} settings`));
    const content = el('div', 'settings-group-body');
    content.append(el('p', 'group-description', group.description));
    plannedSettings.forEach(setting => content.append(placeholder(setting)));
    section.append(summary, content); page.append(section); sections.push(section);
  }
  const back = el('a', 'control control--primary', 'Back to Rhythm Walk'); back.href = '#practice';
  const footer = el('div', 'settings-footer'); footer.append(back); page.append(footer);
  generationStatus.textContent = generationIssue(generation) ?? 'Ready for Next exercise.'; newExercise.disabled = Boolean(generationIssue(generation));
  let locked = false;
  return {
    page,
    setLocked: (active: boolean) => {
      locked = active;
      page.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('.settings-live input, .settings-live select, .settings-actions button').forEach(control => { control.disabled = active; });
      if (!active) newExercise.disabled = Boolean(generationIssue(generation));
    },
    sync: (value: DottedQuarterConvention, presentation: CountPresentation, symbol: OffbeatSymbol, compound = false) => {
      offbeat.disabled = convention.disabled = locked || compound;
      offbeat.value = symbol; convention.value = value;
      placement.value = presentation.linePlacement; appearance.value = presentation.sustainAppearance;
    },
  };
}
