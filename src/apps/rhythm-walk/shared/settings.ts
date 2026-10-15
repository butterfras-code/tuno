import { countingPreferencesUrl } from '../../../music/counting/link.ts';
import { meters, meterPolicy } from './meter.ts';
import { renderTimeSignature, renderRhythmSymbol } from './notation.ts';
import { button, el, field, select, segmentedOption } from '../../../shared/ui/components.ts';
import { captureCountingPreferences, countingPreferenceOptions } from '../../../music/counting/preferences.ts';
import type { CountingPreferences } from '../../../music/counting/preferences.ts';
import { settingsGroups } from './settings-catalog.ts';
import { generationIssue, ingredients, enableMeter } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import type { Setting } from './settings-catalog.ts';
import { generationLevels, teachingPresetLabel, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from './teaching-presets.ts';

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
  newExercise: () => void;
  generation: (value: GenerationSettings) => void;
  initialCounting: CountingPreferences;
  counting: (value: CountingPreferences) => void;
  isLinked: () => boolean;
  saveCountingDefaults: () => void;
}) {
  const page = el('section', 'rhythm-settings'); page.id = 'settings-view'; page.setAttribute('aria-label', 'Rhythm settings');
  const intro = el('p', 'settings-intro', 'Use Customize… in the exercise header for rhythm ingredients. Tempo, play style and metronome are beside the performance pad. Choose writing preferences here.');
  const savedNote = el('p', 'setting-hint');
  const updateSavedNote = () => { savedNote.textContent = `${callbacks.isLinked() ? 'Linked counting preferences and your edits stay in this session until you choose Save as my defaults.' : 'Preferences are saved automatically in this browser.'} Counting changes apply on New exercise. Current music, answers and results are kept.`; };
  updateSavedNote();
  const newExercise = button('New exercise', callbacks.newExercise, true);
  const settingsActions = el('div', 'actions settings-actions'); settingsActions.append(newExercise);
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Available now'); heading.id = 'available-settings';
  const activeBadge = el('span', 'availability availability--active', 'Working controls');
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading, activeBadge);
  const activeControls = el('div', 'settings-live-controls');
  let counting = callbacks.initialCounting;
  const countingControls = new Map<keyof CountingPreferences, HTMLInputElement | HTMLSelectElement>();
  const labels = { longNotes: 'Long-note subdivision', dotted: 'Dotted subdivision', includeRests: 'Include rests', showDurationLine: 'Show duration line', linePlacement: 'Line placement', internalAppearance: 'Internal-count appearance', restAppearance: 'Rest appearance', vocabulary: 'Vocabulary', offbeat: 'Offbeat display' };
  function change(key: keyof CountingPreferences, value: string | boolean) {
    counting = captureCountingPreferences({ ...counting, [key]: value }); callbacks.counting(counting);
    updateSavedNote();
    shareStatus.textContent = ''; fallback.hidden = true;
  }
  for (const key of ['longNotes', 'dotted', 'includeRests', 'showDurationLine'] as const) {
    const input = el('input'); input.type = 'checkbox'; input.checked = counting[key]; input.dataset.countingPreference = key;
    input.addEventListener('change', () => change(key, input.checked)); countingControls.set(key, input); activeControls.append(field(labels[key], input));
  }
  for (const key of ['linePlacement', 'internalAppearance', 'restAppearance', 'vocabulary', 'offbeat'] as const) {
    const input = select(countingPreferenceOptions[key].map(value => ({ value, label: value === 'numbers' ? '1 e & a' : value === 'syllables' ? '1 ta-te-ta' : value[0]!.toUpperCase() + value.slice(1) })), value => change(key, value));
    input.value = counting[key]; input.dataset.countingPreference = key; countingControls.set(key, input); activeControls.append(field(labels[key], input));
  }
  const share = el('div', 'counting-share');
  const shareHint = el('p', 'setting-hint', 'Share the counting preferences currently selected here, including pending changes. The current exercise is unchanged.');
  const shareStatus = el('p', 'setting-hint'); shareStatus.setAttribute('role', 'status');
  const fallback = el('div'); fallback.hidden = true;
  const linkInput = el('input'); linkInput.type = 'text'; linkInput.readOnly = true;
  linkInput.addEventListener('focus', () => linkInput.select());
  fallback.append(field('Counting preferences link', linkInput));
  const copy = button('Copy counting preferences link', async () => {
    const url = countingPreferencesUrl(location.href, counting);
    linkInput.value = url; fallback.hidden = true;
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = 'Counting preferences link copied.';
    } catch {
      shareStatus.textContent = 'Could not copy automatically. Select and copy the link below.';
      fallback.hidden = false; linkInput.focus(); linkInput.select();
    }
  });
  const adopt = button('Save as my defaults', () => {
    try {
      callbacks.saveCountingDefaults(); updateSavedNote(); adopt.hidden = true;
      shareStatus.textContent = 'Selected counting preferences saved as your browser defaults. Current exercise unchanged.';
    } catch { shareStatus.textContent = 'Could not save defaults in this browser. Your counting preferences remain session-only.'; }
  });
  adopt.hidden = !callbacks.isLinked();
  share.append(shareHint, copy, adopt, shareStatus, fallback);
  activeControls.append(share);
  activeControls.append(el('p', 'setting-hint', 'All counting choices apply on New exercise, including vocabulary and appearance. R toggles Rest and D toggles Duration for the selected unit. Hidden lines with unchanged internal counts disable duration entry and assessment. Type t then a/e for ta/te; l and i enter la and li.'));
  let generation = structuredClone(callbacks.initialGeneration);
  const lengthField = el('fieldset', 'exercise-length segmented-field');
  lengthField.dataset.setting = 'exercise-length';
  lengthField.append(el('legend', '', 'Measures'));
  const lengthSegments = el('div', 'segmented-options');
  for (const measures of [1, 2, 3, 4]) {
    const { label } = segmentedOption({
      label: `${measures} ${measures === 1 ? 'measure' : 'measures'}`,
      content: el('span', 'length-segment-number', String(measures)),
      type: 'radio', name: 'exercise-length', value: String(measures), checked: generation.measures === measures,
      changed: input => { generation = { ...generation, measures: Number(input.value) }; generationChanged(false); },
    });
    lengthSegments.append(label);
  }
  lengthField.append(lengthSegments);
  const meterField = el('fieldset', 'active-meters segmented-field');
  meterField.append(el('legend', '', 'Allowed Time Signatures'));
  const meterSegments = el('div', 'segmented-options');
  for (const meter of meters) {
    const { label, input } = segmentedOption({ label: meter, content: renderTimeSignature(meterPolicy(meter).meter), type: 'checkbox', value: meter,
      checked: (generation.meters ?? [generation.meter ?? '4/4']).includes(meter), changed: input => {
      if (input.checked) generation = enableMeter(generation, meter);
      else {
        const { meter: _legacy, ...current } = generation;
        generation = { ...current, meters: (generation.meters ?? [generation.meter ?? '4/4']).filter(value => value !== meter) };
      }
      vocabulary.querySelectorAll<HTMLInputElement>('[data-ingredient]').forEach(control => { control.checked = generation.ingredients.includes(control.dataset.ingredient as typeof generation.ingredients[number]); });
      generationChanged();
    } });
    input.dataset.meter = meter;
    meterSegments.append(label);
  }
  meterField.append(meterSegments);
  const vocabulary = el('div', 'active-ingredients');
  const vocabularyHeadings = el('div', 'ingredient-headings');
  vocabularyHeadings.append(el('h3', '', 'Allowed Notes'), el('h3', '', 'Allowed Rests'));
  vocabulary.append(vocabularyHeadings);
  for (const [value, name] of [['whole', 'Whole'], ['half', 'Half'], ['quarter', 'Quarter'], ['eighth', 'Eighth'], ['16th', 'Sixteenth']] as const) {
    const valueRow = el('div', 'ingredient-value-row'); valueRow.dataset.value = value;
    for (const rest of [false, true]) {
      const row = el('div', 'ingredient-row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `${name} ${rest ? 'rests' : 'notes'}`);
      for (const ingredient of ingredients.filter(i => i.event.type === value && (i.event.kind === 'rest') === rest)) {
        const { label, input } = segmentedOption({ label: ingredient.label, content: renderRhythmSymbol(ingredient.event), type: 'checkbox', value: ingredient.id,
          checked: generation.ingredients.includes(ingredient.id), changed: () => {
            generation = { ...generation, ingredients: ingredients.filter(i => vocabulary.querySelector<HTMLInputElement>(`[data-ingredient="${i.id}"]`)!.checked).map(i => i.id) };
            generationChanged();
          },
        });
        input.dataset.ingredient = ingredient.id;
        label.classList.add('ingredient-toggle'); label.title = ingredient.label;
        row.append(label);
      }
      valueRow.append(row);
    }
    vocabulary.append(valueRow);
  }
  const patternFields = el('div', 'segmented-options pattern-toggles');
  for (const [key, id, title] of [
    ['allowUnintuitiveNotation', 'unintuitive-notation', 'Unusual Notation'],
    ['ties', 'ties', 'Ties'],
    ['syncopation', 'syncopation', 'Syncopation'],
  ] as const) {
    const { label, input } = segmentedOption({ label: title, content: el('span', '', title), type: 'checkbox', value: id,
      checked: Boolean(generation[key]), changed: input => { generation = { ...generation, [key]: input.checked }; generationChanged(); },
    });
    input.dataset.setting = id; input.dataset.generationKey = key;
    patternFields.append(label);
  }
  const generationStatus = el('p', 'setting-hint'); generationStatus.setAttribute('role', 'status');
  function updateGenerationStatus() {
    const issue = generationIssue(generation);
    generationStatus.textContent = issue ?? '';
    generationStatus.hidden = !issue;
    newExercise.disabled = Boolean(issue);
  }
  function generationChanged(customize = true) {
    if (customize) generation = customizeTeachingPreset(generation);
    updateGenerationStatus();
    callbacks.generation(structuredClone(generation));
    teachingPickers.forEach(picker => { picker.value = generation.teachingPreset?.id ?? ''; });
    renderTeachingPreset();
  }
  const exerciseControls = el('div', 'settings-live-controls shared-exercise-settings');
  const levelOptions = [{ value: '', label: 'Custom' }, ...generationLevels.map(p => ({ value: p.id, label: resolveTeachingPreset(p).supported ? teachingPresetLabel({ id: p.id, version: p.version, customized: false }) : `${p.label} · unavailable` }))];
  function chooseLevel(value: string) {
    teachingPickers.forEach(picker => { picker.value = value; });
    if (!value) {
      const { teachingPreset: _source, restrictions: _restrictions, ...custom } = generation;
      generation = custom; generationChanged(false);
    } else { applySelectedLevel(value); renderTeachingPreset(); }
  }
  const teachingPickers = [select(levelOptions, chooseLevel), select(levelOptions, chooseLevel)];
  const [teachingPicker, customTeachingPicker] = teachingPickers as [HTMLSelectElement, HTMLSelectElement];
  teachingPickers.forEach(picker => { picker.dataset.setting = 'teaching-preset'; picker.value = generation.teachingPreset?.id ?? ''; });
  customTeachingPicker.autofocus = true;
  const customLevelField = field('Level', customTeachingPicker); customLevelField.classList.add('custom-level-field');
  const customLevelStatus = el('p', 'setting-hint'); customLevelStatus.id = 'custom-level-status'; customLevelStatus.setAttribute('role', 'status');
  customTeachingPicker.setAttribute('aria-describedby', customLevelStatus.id);
  customLevelField.append(customLevelStatus);
  const teachingStatus = el('p', 'setting-hint'); teachingStatus.setAttribute('role', 'status');
  const teachingAttribution = el('p', 'setting-hint');
  const teachingDetails = el('details'); teachingDetails.append(el('summary', '', 'Source and pattern requirements'));
  const teachingEvidence = el('div', 'setting-hint'); teachingDetails.append(teachingEvidence);
  function applySelectedLevel(value: string) {
    const definition = generationLevels.find(p => p.id === value);
    if (!definition) return;
    const result = applyTeachingPreset(generation, definition);
    if (!result.supported) { teachingStatus.textContent = `Unavailable: ${result.reasons.map(unavailableReason).join(' ')}`; return; }
    generation = result.settings;
    lengthField.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = Number(input.value) === generation.measures; });
    meterField.querySelectorAll<HTMLInputElement>('[data-meter]').forEach(input => { input.checked = (generation.meters ?? []).includes(input.dataset.meter as typeof meters[number]); });
    vocabulary.querySelectorAll<HTMLInputElement>('[data-ingredient]').forEach(input => { input.checked = generation.ingredients.includes(input.dataset.ingredient as typeof generation.ingredients[number]); });
    patternFields.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = Boolean(generation[input.dataset.generationKey as 'allowUnintuitiveNotation' | 'ties' | 'syncopation']); });
    generationChanged(false);
  }
  const applyPreset = button('Apply level', () => applySelectedLevel(teachingPicker.value));
  applyPreset.dataset.setting = 'apply-teaching-preset';
  function renderTeachingPreset() {
    for (const definition of generationLevels) {
      const label = resolveTeachingPreset(definition).supported ? teachingPresetLabel({ id: definition.id, version: definition.version, customized: generation.teachingPreset?.id === definition.id && generation.teachingPreset.customized }) : `${definition.label} · unavailable`;
      teachingPickers.forEach(picker => { [...picker.options].find(o => o.value === definition.id)!.textContent = label; });
    }
    const active = generationLevels.find(p => p.id === generation.teachingPreset?.id);
    teachingAttribution.textContent = active ? `${teachingPresetLabel(generation.teachingPreset)} · next exercise.` : 'Custom · pending settings. New exercise generates from these settings.';
    const definition = generationLevels.find(p => p.id === teachingPicker.value);
    customLevelStatus.hidden = true; customLevelStatus.textContent = '';
    teachingEvidence.replaceChildren();
    if (!definition) { teachingStatus.textContent = 'Choose a level or customize the musical settings. Changes apply on New exercise.'; applyPreset.disabled = true; return; }
    const result = resolveTeachingPreset(definition);
    applyPreset.disabled = !result.supported;
    if (!result.supported) teachingDetails.open = true;
    const unavailable = result.supported ? [] : [...new Set(result.reasons.map(unavailableReason))];
    if (!result.supported) { customLevelStatus.hidden = false; customLevelStatus.textContent = `Unavailable: ${unavailable.join(' ')}`; }
    teachingStatus.textContent = result.supported ? 'Available: general note figures only, no rests, ties or percussion-specific figures. Applying updates pending settings and keeps both responses.' : `Unavailable: ${unavailable.slice(0, 2).join(' ')} See all requirements below.`;
    if (!definition.source) {
      teachingStatus.textContent = result.supported ? 'Available: Uno practice configuration. Changes apply on New exercise and keep both responses.' : `Unavailable: ${unavailable.join(' ')}`;
      const settings = definition.recommended;
      teachingEvidence.append(el('p', '', `Time signatures: ${settings.meters!.join(', ')}. One selected meter per exercise; your chosen length is preserved.`),
        el('p', '', `Ingredients: ${ingredients.filter(i => settings.ingredients.includes(i.id)).map(i => i.label).join(', ')}.`),
        el('p', '', `Ties: ${settings.ties ? 'on' : 'off'}. Syncopation: ${settings.syncopation ? 'on' : 'off'}. Unintuitive notation: ${settings.allowUnintuitiveNotation ? 'on' : 'off'}.`),
        el('p', '', 'Only ingredients compatible with the chosen meter are generated. Whole notes require 4/4; sixteenths, dotted eighths and triplets use simple meters.'));
      return;
    }
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
  teachingDetails.append(teachingStatus, applyPreset, el('p', 'setting-hint', 'Uno levels are practice configurations. UIL levels retain their qualified scope; they are not complete composition validators or UIL endorsements. Meters remain editable. No requirement that every allowed figure appear.'));
  teachingAttribution.id = 'pending-level';
  teachingPicker.setAttribute('aria-describedby', teachingAttribution.id);
  teachingField.append(teachingAttribution, teachingDetails);
  renderTeachingPreset();
  exerciseControls.append(customLevelField, meterField, lengthField, vocabulary, patternFields, generationStatus);
  available.append(activeHeader, el('h3', '', 'Writing preferences · next exercise'), activeControls);
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
  updateGenerationStatus();
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
    sync: (value: CountingPreferences) => {
      counting = value;
      countingControls.forEach((control, key) => { if (control instanceof HTMLInputElement) control.checked = Boolean(value[key]); else control.value = String(value[key]); control.disabled = locked; });
    },
  };
}
