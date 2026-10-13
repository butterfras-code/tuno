import { meters } from './meter.ts';
import { button, el, field, select } from '../../../shared/ui/components.ts';
import type { DottedQuarterConvention } from '../../count-writing/evaluation.ts';
import { linePlacementOptions, sustainAppearanceOptions } from '../../count-writing/presentation.ts';
import type { CountPresentation, LinePlacement, SustainAppearance } from '../../count-writing/presentation.ts';
import type { OffbeatSymbol, CountingSystem } from '../../count-writing/input.ts';
import { settingsGroups } from './settings-catalog.ts';
import { generationIssue, ingredients, enableMeter } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import type { Setting } from './settings-catalog.ts';
import { teachingPresets, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from './teaching-presets.ts';

export const dottedConventionOptions = [
  { value: 'review', label: 'Teacher review — accept both provisionally' },
  { value: 'required', label: 'Require internal &' },
  { value: 'optional', label: 'Internal & is optional' },
] as const;

function unavailableReason(reason: string): string {
  if (/Missing pattern support(?: in [\d/]+)?: uil-\d-figures\./.test(reason)) return 'The exact rhythm figures for this level are not enforced yet.';
  if (reason.includes('uil-rest-and-tie-policy')) return 'Rest and tie permissions still need review.';
  if (reason.includes('triplet-eighth')) return 'Eighth-note triplets are not available yet.';
  if (reason.includes('cut-time')) return 'Cut time is not supported yet.';
  if (reason.includes('paired-eighths')) return 'Complete eighth-note pairs are not supported in this configuration.';
  if (reason.includes('no-quarter-rest-beat-one')) return 'The downbeat quarter-rest restriction is not supported in this configuration.';
  return reason;
}

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
  metronomeField: HTMLElement;
  playField: HTMLElement;
  newExercise: () => void;
  generation: (value: GenerationSettings) => void;
  system: (value: CountingSystem) => void;
  offbeat: (value: OffbeatSymbol) => void;
  placement: (value: LinePlacement) => void;
  appearance: (value: SustainAppearance) => void;
  convention: (value: DottedQuarterConvention) => void;
}) {
  const page = el('section', 'rhythm-settings'); page.id = 'settings-view'; page.setAttribute('aria-label', 'Rhythm settings');
  const intro = el('p', 'settings-intro', 'Use Customize… in the exercise header for rhythm ingredients. Choose performance settings and writing preferences here.');
  const savedNote = el('p', 'setting-hint', 'Preferences are saved automatically in this browser. Exercise settings apply on New exercise. New exercise clears both responses and returns to practice.');
  const newExercise = button('New exercise', callbacks.newExercise, true);
  const settingsActions = el('div', 'actions settings-actions'); settingsActions.append(newExercise);
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Available now'); heading.id = 'available-settings';
  const activeBadge = el('span', 'availability availability--active', 'Working controls');
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading, activeBadge);
  const activeControls = el('div', 'settings-live-controls');
  const offbeat = select([{ value: '&', label: 'Numbers with &' }, { value: '+', label: 'Numbers with +' }], value => callbacks.offbeat(value as OffbeatSymbol));
  offbeat.dataset.setting = 'offbeat-symbol';
  const system = select([{ value: 'numbers', label: '1 e & a' }, { value: 'syllables', label: '1 ta-te-ta' }], value => callbacks.system(value as CountingSystem));
  system.dataset.setting = 'count-system';
  const systemField = field('Counting system', system);
  systemField.append(field('Offbeat symbol · 1 e & a', offbeat));
  systemField.append(el('p', 'setting-hint', 'Choose 1 e & a or 1 ta-te-ta. Type t then a/e for ta/te. Triplets use 1 la li in both systems; type l for la and i for li. The independent &/+ preference is retained. System changes translate unambiguous tokens, clear ambiguous tokens and require Check again. In 6/8 every eighth has a fixed number 1–6; this preference is saved for simple meters.'));
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
  const length = select([1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} ${n === 1 ? 'measure' : 'measures'}` })), value => { generation = { ...generation, measures: Number(value) }; generationChanged(false); });
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
  meterField.append(el('p', 'setting-hint', 'Each new exercise uses one selected time signature for all measures. Enabling a time signature enables quarter notes in simple meters or eighth notes in 6/8. Selected ingredients that do not fit that meter are skipped. Sixteenth notes/rests, dotted eighth notes and triplet eighths are retained but omitted in 6/8. In 6/8, count 1–6 on eighths with two dotted-quarter performance beats.'));
  const lengthField = field('Exercise length', length);
  lengthField.append(el('p', 'setting-hint', 'Default: 2 measures. Applies on New exercise; keeps the current answer.'));
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
  const notationField = el('div'); notationField.append(notationOption, el('p', 'setting-hint', 'Off by default. Quarter and half rests start on whole beats. Dotted quarter rests in simple meters are used only when this option and their ingredient checkbox are enabled. Applies on New exercise; keeps your answer.'));
  notationToggle.addEventListener('change', () => { generation = { ...generation, allowUnintuitiveNotation: notationToggle.checked }; generationChanged(); });
  const patternFields = el('div');
  for (const [key, label, hint] of [
    ['ties', 'Ties', 'Permit one chain of 2–3 enabled written note segments, including across barlines. Continuations are not attacks.'],
    ['syncopation', 'Syncopation', 'Permit at most one off-pulse attack per measure sustained across the next pulse: a quarter in simple meters, a dotted quarter in 6/8. Sounds ending at that pulse remain available when off.'],
  ] as const) {
    const option = el('label', 'setting-option'); const toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = Boolean(generation[key]); toggle.dataset.setting = key;
    option.append(toggle, el('span', '', label));
    patternFields.append(option, el('p', 'setting-hint', `${hint} Off by default; applies on New exercise and keeps the current answer.`));
    toggle.addEventListener('change', () => { generation = { ...generation, [key]: toggle.checked }; generationChanged(); });
  }
  const generationStatus = el('p', 'setting-hint'); generationStatus.setAttribute('role', 'status');
  function generationChanged(customize = true) {
    if (customize) generation = customizeTeachingPreset(generation);
    const issue = generationIssue(generation);
    newExercise.disabled = Boolean(issue);
    generationStatus.textContent = issue ?? 'Ready for New exercise. Only compatible checked ingredients are used; each exercise uses one selected time signature.';
    callbacks.generation(structuredClone(generation));
    teachingPicker.value = generation.teachingPreset?.id ?? '';
    renderTeachingPreset();
  }
  generationStatus.textContent = '4/4 by default. Only compatible checked ingredients are used; each exercise uses one selected time signature. Changes apply on New exercise.';
  const exerciseControls = el('div', 'settings-live-controls shared-exercise-settings');
  const teachingPicker = select([{ value: '', label: 'Custom' }, ...teachingPresets.map(p => ({ value: p.id, label: `${p.label}${resolveTeachingPreset(p).supported ? ' · note-only practice' : ' · unavailable'}` }))], value => {
    if (!value) {
      const { teachingPreset: _source, restrictions: _restrictions, ...custom } = generation;
      generation = custom; generationChanged(false);
    } else { applySelectedLevel(); renderTeachingPreset(); }
  });
  teachingPicker.dataset.setting = 'teaching-preset';
  const teachingStatus = el('p', 'setting-hint'); teachingStatus.setAttribute('role', 'status');
  const teachingAttribution = el('p', 'setting-hint');
  const teachingDetails = el('details'); teachingDetails.append(el('summary', '', 'Source and pattern requirements'));
  const teachingEvidence = el('div', 'setting-hint'); teachingDetails.append(teachingEvidence);
  function applySelectedLevel() {
    const definition = teachingPresets.find(p => p.id === teachingPicker.value);
    if (!definition) return;
    const result = applyTeachingPreset(generation, definition);
    if (!result.supported) { teachingStatus.textContent = `Unavailable: ${result.reasons.map(unavailableReason).join(' ')}`; return; }
    generation = result.settings;
    length.value = String(generation.measures);
    meterField.querySelectorAll<HTMLInputElement>('[data-meter]').forEach(input => { input.checked = (generation.meters ?? []).includes(input.dataset.meter as typeof meters[number]); });
    vocabulary.querySelectorAll<HTMLInputElement>('[data-ingredient]').forEach(input => { input.checked = generation.ingredients.includes(input.dataset.ingredient as typeof generation.ingredients[number]); });
    notationToggle.checked = generation.allowUnintuitiveNotation;
    patternFields.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = Boolean(generation[input.dataset.setting as 'ties' | 'syncopation']); });
    generationChanged(false);
  }
  const applyPreset = button('Apply level', applySelectedLevel);
  applyPreset.dataset.setting = 'apply-teaching-preset';
  function renderTeachingPreset() {
    for (const definition of teachingPresets) {
      const option = [...teachingPicker.options].find(o => o.value === definition.id)!;
      option.textContent = `${definition.label}${generation.teachingPreset?.id === definition.id && generation.teachingPreset.customized ? ' · customized' : resolveTeachingPreset(definition).supported ? ' · note-only practice' : ' · unavailable'}`;
    }
    const active = teachingPresets.find(p => p.id === generation.teachingPreset?.id);
    teachingAttribution.textContent = active ? `${active.label}${generation.teachingPreset?.customized ? ' · customized' : ' · note-only practice'} · next exercise.` : 'Custom · pending settings. New exercise generates from these settings.';
    const definition = teachingPresets.find(p => p.id === teachingPicker.value);
    teachingEvidence.replaceChildren();
    if (!definition) { teachingStatus.textContent = 'Choose a level or customize the musical settings. Changes apply on New exercise.'; applyPreset.disabled = true; return; }
    const result = resolveTeachingPreset(definition);
    applyPreset.disabled = !result.supported;
    if (!result.supported) teachingDetails.open = true;
    const unavailable = result.supported ? [] : [...new Set(result.reasons.map(unavailableReason))];
    teachingStatus.textContent = result.supported ? 'Available: general note figures only, no rests, ties or percussion-specific figures. Applying updates pending settings and keeps both responses.' : `Unavailable: ${unavailable.slice(0, 2).join(' ')} See all requirements below.`;
    const source = el('a', '', `Official criteria · ${definition.source.revision} · retrieved ${definition.source.retrieved}`); source.href = definition.source.url;
    teachingEvidence.append(source, el('p', '', `Official meters: ${definition.officialMeters.map(m => m === 'cut-time' ? 'cut time (2/2)' : m).join(', ')}. Official within-piece changes: ${definition.meterChanges}. Short practice uses one meter and preserves your chosen length.`));
    for (const figure of definition.figures) {
      const link = el('a', '', `${figure.events.join(' ')} (${figure.scope})`); link.href = figure.url;
      const row = el('p'); row.append(link); teachingEvidence.append(row);
    }
    teachingEvidence.append(el('p', '', definition.restrictions.join(' ')));
    if (!result.supported) teachingEvidence.append(el('p', '', unavailable.join(' ')));
  }
  teachingPicker.value = generation.teachingPreset?.id ?? '';
  const teachingField = el('div', 'level-configuration');
  teachingField.append(field('Level', teachingPicker));
  teachingDetails.append(teachingStatus, applyPreset, el('p', 'setting-hint', 'UIL-derived rhythm practice, not a complete composition validator or UIL endorsement. Meters remain editable. No requirement that every allowed figure appear.'));
  teachingAttribution.id = 'pending-level';
  teachingPicker.setAttribute('aria-describedby', teachingAttribution.id);
  teachingField.append(teachingAttribution, teachingDetails);
  renderTeachingPreset();
  exerciseControls.append(meterField, lengthField, vocabulary, notationField, patternFields, generationStatus);
  activeControls.append(systemField, conventionField, placementField, appearanceField);
  const restRule = el('section', 'setting-row');
  restRule.dataset.setting = 'rest-grouping';
  restRule.setAttribute('aria-labelledby', 'setting-rest-grouping');
  const restHeading = el('div', 'setting-heading');
  const restTitle = el('h3', '', 'Rest parentheses'); restTitle.id = 'setting-rest-grouping';
  restHeading.append(restTitle, el('span', 'availability availability--active', 'Current rule'));
  restRule.append(restHeading, el('p', 'setting-hint', 'Use one complete pair of parentheses per written rest, enclosing all its required or entered counts. A half rest encloses both beats and its duration line: (1 2). Two quarter rests use separate pairs: (1) (2). Groups cannot overlap or nest. This rule is fixed in the current prototype.'));
  const performanceControls = el('div', 'settings-live-controls performance-settings');
  performanceControls.append(callbacks.playField, callbacks.metronomeField);
  available.append(activeHeader, el('h3', '', 'Performance'), performanceControls, el('h3', '', 'Writing preferences'), activeControls, restRule, el('p', 'setting-hint', 'Preferences are saved for this browser. Preferences persist across reloads; responses belong to the current exercise.'));
  const browse = el('div', 'settings-browse');
  browse.append(el('h2', '', 'Planned settings'));
  const sections: HTMLDetailsElement[] = [];
  const expand = button('Expand all groups', () => {
    const open = sections.some(section => !section.open);
    sections.forEach(section => { section.open = open; });
    expand.textContent = open ? 'Collapse all groups' : 'Expand all groups';
  });
  browse.append(expand);
  const planned = el('details', 'planned-settings');
  planned.append(el('summary', '', 'Future options'), browse, el('p', 'setting-hint', 'These options are planned or still being decided. They do not change your exercises.'));
  page.append(intro, savedNote, settingsActions, available, planned);
  for (const group of settingsGroups) {
    const plannedSettings = group.settings.filter(setting => !['count-system', 'passage-length', 'meter-pool', 'beat-grouping', 'activity-mode', 'performance-input'].includes(setting.id));
    const section = el('details', 'settings-group'); section.dataset.group = group.id;
    section.addEventListener('toggle', () => { expand.textContent = sections.every(s => s.open) ? 'Collapse all groups' : 'Expand all groups'; });
    const summary = el('summary');
    const title = el('h2', '', group.title);
    summary.append(title, el('span', 'group-count', `${plannedSettings.length} settings`));
    const content = el('div', 'settings-group-body');
    content.append(el('p', 'group-description', group.description));
    plannedSettings.forEach(setting => content.append(placeholder(setting)));
    section.append(summary, content); planned.append(section); sections.push(section);
  }
  const back = el('a', 'control control--primary', 'Back to Uno234'); back.href = '#practice';
  const footer = el('div', 'settings-footer'); footer.append(back); page.append(footer);
  generationStatus.textContent = generationIssue(generation) ?? 'Ready for New exercise.'; newExercise.disabled = Boolean(generationIssue(generation));
  let locked = false;
  return {
    page,
    exerciseControls,
    levelField: teachingField,
    setLocked: (active: boolean) => {
      locked = active;
      page.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('.settings-live input, .settings-live select, .settings-actions button').forEach(control => { control.disabled = active; });
      teachingPicker.disabled = active;
      applyPreset.disabled = active;
      exerciseControls.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(control => { control.disabled = active; });
      if (!active) { newExercise.disabled = Boolean(generationIssue(generation)); renderTeachingPreset(); }
    },
    sync: (value: DottedQuarterConvention, presentation: CountPresentation, symbol: OffbeatSymbol, compound = false, countingSystem: CountingSystem = 'numbers') => {
      system.disabled = convention.disabled = locked || compound;
      system.value = countingSystem; offbeat.disabled = locked || compound || countingSystem === 'syllables';
      offbeat.value = symbol; convention.value = value;
      placement.value = presentation.linePlacement; appearance.value = presentation.sustainAppearance;
    },
  };
}
