import { rhythmPresetPicker } from './preset-picker.ts';
import { countingPreferencesUrl } from '../../../music/counting/link.ts';
import { meters, meterPolicy } from './meter.ts';
import { renderTimeSignature, renderRhythmSymbol, renderRhythmPattern } from './notation.ts';
import { button, el, field, select, segmentedOption } from '../../../shared/ui/components.ts';
import { captureCountingPreferences, countingPreferenceOptions } from '../../../music/counting/preferences.ts';
import type { CountingPreferences } from '../../../music/counting/preferences.ts';
import { generationIssue, ingredients, enableMeter, sixteenthPatterns, selectedSixteenthPatterns } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import { generationLevels, teachingPresetLabel, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from './teaching-presets.ts';

function unavailableReason(reason: string): string {
  if (/Missing pattern support(?: in [\d/]+)?: uil-\d-figures\./.test(reason)) return 'The exact rhythm figures for this level are not enforced yet.';
  if (reason.includes('uil-rest-and-tie-policy')) return 'Rest and tie permissions still need review.';
  if (reason.includes('triplet-eighth')) return 'Complete sounded eighth triplets require a supported quarter-note meter.';
  if (reason.includes('cut-time')) return 'Cut time is not supported yet.';
  if (reason.includes('paired-eighths')) return 'Complete eighth-note pairs are not supported in this configuration.';
  if (reason.includes('no-quarter-rest-beat-one')) return 'The downbeat quarter-rest restriction is not supported in this configuration.';
  return reason;
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
  const intro = el('p', 'settings-intro', 'Choose a rhythm preset in the exercise header for rhythm ingredients. Tempo, play style and metronome are beside the performance pad. Choose writing preferences here.');
  const savedNote = el('p', 'setting-hint');
  const updateSavedNote = () => { savedNote.textContent = `${callbacks.isLinked() ? 'Linked counting preferences and your edits stay in this session until you choose Save as my defaults.' : 'Preferences are saved automatically in this browser.'} Counting changes apply on New exercise. Current music, answers and results are kept.`; };
  updateSavedNote();
  const newExercise = button('New exercise', callbacks.newExercise, true);
  const settingsActions = el('div', 'actions settings-actions'); settingsActions.append(newExercise);
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Counting preferences'); heading.id = 'available-settings';
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading);
  const activeControls = el('div', 'settings-live-controls');
  let counting = callbacks.initialCounting;
  const countingControls = new Map<keyof CountingPreferences, HTMLInputElement | HTMLSelectElement>();
  const countingGroup = el('fieldset', 'counting-settings-group'); countingGroup.append(el('legend', '', 'Counting'));
  const longNotesGroup = el('fieldset', 'counting-settings-group'); longNotesGroup.append(el('legend', '', 'Long Notes'));
  const longNoteKeys = new Set<keyof CountingPreferences>(['longNotes', 'showDurationLine', 'linePlacement', 'internalAppearance']);
  const addCountingField = (key: Exclude<keyof CountingPreferences, 'version'>, input: HTMLInputElement | HTMLSelectElement) => {
    const control = field(labels[key], input);
    if (key === 'longNotes') {
      const hint = el('p', 'setting-hint', 'Add counts inside long notes and rests.'); hint.id = 'subdivide-hint';
      input.setAttribute('aria-describedby', hint.id); control.append(hint);
    }
    (longNoteKeys.has(key) ? longNotesGroup : countingGroup).append(control);
  };
  activeControls.append(countingGroup, longNotesGroup);
  const labels = { longNotes: 'Subdivide', dotted: 'Dotted subdivision', includeRests: 'Include rests', showDurationLine: 'Show connecting line', linePlacement: 'Line placement', internalAppearance: 'Internal count appearance', restAppearance: 'Rest appearance', vocabulary: 'Vocabulary', offbeat: 'Offbeat display' };
  function change(key: keyof CountingPreferences, value: string | boolean) {
    counting = captureCountingPreferences({ ...counting, [key]: value }); callbacks.counting(counting);
    updateSavedNote();
    shareStatus.textContent = ''; fallback.hidden = true;
  }
  for (const key of ['longNotes', 'dotted', 'includeRests', 'showDurationLine'] as const) {
    const input = el('input'); input.type = 'checkbox'; input.checked = counting[key]; input.dataset.countingPreference = key;
    input.addEventListener('change', () => change(key, input.checked)); countingControls.set(key, input); addCountingField(key, input);
  }
  for (const key of ['linePlacement', 'internalAppearance', 'restAppearance', 'vocabulary', 'offbeat'] as const) {
    const input = select(countingPreferenceOptions[key].map(value => ({ value, label: value === 'numbers' ? '1 e & a' : value === 'syllables' ? '1 ta-te-ta' : value[0]!.toUpperCase() + value.slice(1) })), value => change(key, value));
    input.value = counting[key]; input.dataset.countingPreference = key; countingControls.set(key, input); addCountingField(key, input);
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
  const countingHelp = el('details', 'counting-help');
  countingHelp.append(el('summary', '', 'Counting and keyboard help'));
  countingHelp.append(el('p', 'setting-hint', 'All counting choices apply on New exercise, including vocabulary and appearance. R toggles Rest and C toggles Connect for the selected group. If the connecting line is hidden and internal count appearance is unchanged, Connect is not used or checked. Type t then a/e for ta/te; l and i enter la and li.'));
  activeControls.append(countingHelp);
  let draft: GenerationSettings | undefined;
  let generation = structuredClone(callbacks.initialGeneration);
  generation.sixteenthPatterns = selectedSixteenthPatterns(generation);
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
      for (const ingredient of ingredients.filter(i => !['sixteenth', 'dotted-eighth'].includes(i.id) && i.event.type === value && (i.event.kind === 'rest') === rest)) {
        const { label, input } = segmentedOption({ label: ingredient.label, content: renderRhythmSymbol(ingredient.event), type: 'checkbox', value: ingredient.id,
          checked: generation.ingredients.includes(ingredient.id), changed: () => {
            generation = { ...generation, ingredients: ingredients.filter(i => (vocabulary.querySelector<HTMLInputElement>(`[data-ingredient="${i.id}"]`)?.checked ?? generation.ingredients.includes(i.id))).map(i => i.id) };
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
  const groupingOptions = el('div', 'sixteenth-grouping-options');
  for (const pattern of sixteenthPatterns) {
    const { label, input } = segmentedOption({ label: pattern.label, content: renderRhythmPattern(pattern.events), type: 'checkbox', value: pattern.id,
      checked: selectedSixteenthPatterns(generation).includes(pattern.id), changed: () => {
        const selected = sixteenthPatterns.filter(p => groupingOptions.querySelector<HTMLInputElement>(`[data-sixteenth-pattern="${p.id}"]`)!.checked).map(p => p.id);
        generation = { ...generation, sixteenthPatterns: selected,
          ingredients: [...generation.ingredients.filter(id => !['sixteenth', 'dotted-eighth'].includes(id)),
            ...(selected.length ? ['sixteenth' as const] : []), ...(selected.includes('dotted-8-16') ? ['dotted-eighth' as const] : [])] };
        generationChanged();
      } });
    input.dataset.sixteenthPattern = pattern.id;
    label.title = pattern.label;
    groupingOptions.append(label);
  }
  vocabulary.querySelector('[data-value="16th"] .ingredient-row')!.append(groupingOptions);
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
    if (!draft) callbacks.generation(structuredClone(generation));
    renderTeachingPreset();
  }
  const exerciseControls = el('div', 'settings-live-controls shared-exercise-settings');
  const teachingStatus = el('p', 'setting-hint'); teachingStatus.setAttribute('role', 'status');
  const teachingAttribution = el('p', 'setting-hint');
  const teachingDetails = el('details'); teachingDetails.append(el('summary', '', 'Source and pattern requirements'));
  const teachingEvidence = el('div', 'setting-hint'); teachingDetails.append(teachingEvidence);
  function applySelectedLevel(value: string) {
    const definition = generationLevels.find(p => p.id === value);
    if (!definition) return;
    const result = applyTeachingPreset(generation, definition, undefined, instrumentScope.value as 'general' | 'percussion');
    if (!result.supported) { teachingStatus.textContent = `Unavailable: ${result.reasons.map(unavailableReason).join(' ')}`; return; }
    generation = result.settings;
    generation.sixteenthPatterns = selectedSixteenthPatterns(generation);
    syncGenerationControls();
    generationChanged(false);
  }
  function syncGenerationControls() {
    lengthField.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = Number(input.value) === generation.measures; });
    meterField.querySelectorAll<HTMLInputElement>('[data-meter]').forEach(input => { input.checked = (generation.meters ?? []).includes(input.dataset.meter as typeof meters[number]); });
    vocabulary.querySelectorAll<HTMLInputElement>('[data-ingredient]').forEach(input => { input.checked = generation.ingredients.includes(input.dataset.ingredient as typeof generation.ingredients[number]); });
    groupingOptions.querySelectorAll<HTMLInputElement>('[data-sixteenth-pattern]').forEach(input => { input.checked = selectedSixteenthPatterns(generation).some(id => id === input.dataset.sixteenthPattern); });
    patternFields.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = Boolean(generation[input.dataset.generationKey as 'allowUnintuitiveNotation' | 'ties' | 'syncopation']); });
  }
  const instrumentScope = select([{ value: 'general', label: 'General' }, { value: 'percussion', label: 'Percussion' }]);
  instrumentScope.dataset.setting = 'instrument-scope';
  const applyPreset = button('Apply level', () => applySelectedLevel(generation.teachingPreset?.id ?? ''));
  applyPreset.dataset.setting = 'apply-teaching-preset';
  function renderTeachingPreset() {
    instrumentScope.value = generation.teachingPreset?.scope ?? 'general';
    presetTrigger.textContent = 'Choose rhythms';
    presetTrigger.setAttribute('aria-haspopup', 'dialog'); presetTrigger.setAttribute('aria-controls', 'custom-exercise');
    teachingAttribution.textContent = `${teachingPresetLabel(generation.teachingPreset)} · for next exercise`;
    if (generation.teachingPreset?.customized && generation.teachingPreset.id.startsWith('uil-')) teachingAttribution.textContent += '. Customized vocabulary; one supported meter per exercise. Reapply a level for verified figure practice.';
    const definition = generationLevels.find(p => p.id === generation.teachingPreset?.id);
    teachingEvidence.replaceChildren();
    if (!definition) { teachingStatus.textContent = 'Choose a level or customize the musical settings. Use preset starts a new exercise when these settings change.'; applyPreset.disabled = true; return; }
    const result = resolveTeachingPreset(definition, undefined, instrumentScope.value as 'general' | 'percussion');
    applyPreset.disabled = !result.supported;
    if (!result.supported) teachingDetails.open = true;
    const unavailable = result.supported ? [] : [...new Set(result.reasons.map(unavailableReason))];
    teachingStatus.textContent = result.supported ? 'Available: verified note-only figures for the selected instrument scope. Rest/tie permissions remain unresolved; customization retains source attribution. Use preset starts a new exercise when these settings change.' : `Unavailable: ${unavailable.slice(0, 2).join(' ')} See all requirements below.`;
    if (!definition.source) {
      teachingStatus.textContent = result.supported ? 'Available: Uno practice configuration. Use preset starts a new exercise when these settings change.' : `Unavailable: ${unavailable.join(' ')}`;
      const settings = definition.recommended;
      teachingEvidence.append(el('p', '', `Time signatures: ${settings.meters!.join(', ')}. One selected meter per exercise; your chosen length is preserved.`),
        el('p', '', `Ingredients: ${ingredients.filter(i => settings.ingredients.includes(i.id)).map(i => i.label).join(', ')}.`),
        el('p', '', `Ties: ${settings.ties ? 'on' : 'off'}. Syncopation: ${settings.syncopation ? 'on' : 'off'}. Unintuitive notation: ${settings.allowUnintuitiveNotation ? 'on' : 'off'}.`),
        el('p', '', 'Only ingredients compatible with the chosen meter are generated. Whole notes require 4/4; sixteenths, dotted eighths and triplets use simple meters.'));
      return;
    }
    const source = el('a', '', `Official criteria · ${definition.source.revision} · retrieved ${definition.source.retrieved}`); source.href = definition.source.url;
    teachingEvidence.append(source, el('p', '', `Official meters: ${definition.officialMeters.map(m => m === 'cut-time' ? 'cut time (2/2)' : m).join(', ')}. Official within-piece changes: ${definition.meterChanges}. Short practice uses one meter and preserves your chosen length. UIL IV is figure practice, not fulfillment of the composition-level meter-change requirement.`));
    for (const figure of definition.figures) {
      const link = el('a', '', `${figure.events.join(' ')} (${figure.scope})`); link.href = figure.url;
      const row = el('p'); row.append(link); teachingEvidence.append(row);
    }
    teachingEvidence.append(el('p', '', [...definition.restrictions, ...definition.unresolved].join(' ')));
    if (!result.supported) teachingEvidence.append(el('p', '', unavailable.join(' ')));
  }
  const teachingField = el('div', 'level-configuration');
  const presetTrigger = button('Choose preset…'); presetTrigger.classList.add('rhythm-preset-trigger');
  const triggerField = el('div', 'field'); triggerField.append(el('span', 'field-label', 'Rhythm preset'), presetTrigger);
  teachingField.append(triggerField);
  teachingDetails.append(teachingStatus, applyPreset, el('p', 'setting-hint', 'Uno levels are practice configurations. UIL levels retain their qualified scope; they are not complete composition validators or UIL endorsements. Meters remain editable. No requirement that every allowed figure appear.'));
  teachingAttribution.id = 'pending-level';
  presetTrigger.setAttribute('aria-describedby', teachingAttribution.id);
  teachingField.append(teachingAttribution);
  teachingDetails.dataset.levelDetails = '';
  renderTeachingPreset();
  exerciseControls.append(meterField, lengthField, vocabulary, patternFields, generationStatus);
  const presetChooser = rhythmPresetPicker({ editor: exerciseControls, details: teachingDetails, current: () => generation,
    choose: (id, scope) => { instrumentScope.value = scope; applySelectedLevel(id); },
    customize: () => { generation = customizeTeachingPreset(generation); generationChanged(false); },
  });
  available.append(activeHeader, activeControls);
  page.append(intro, savedNote, settingsActions, available);
  const back = el('a', 'control control--primary', 'Back to Uno234'); back.href = '#practice';
  const footer = el('div', 'settings-footer'); footer.append(back); page.append(footer);
  updateGenerationStatus();
  let locked = false;
  return {
    page,
    exerciseControls,
    presetChooser: presetChooser.node,
    validGeneration: () => !generationIssue(generation),
    presetTrigger,
    beginPresetSelection() { draft = structuredClone(generation); presetChooser.open(); },
    finishPresetSelection(accept: boolean) {
      if (!draft) return;
      if (!accept) generation = draft;
      draft = undefined;
      syncGenerationControls();
      if (accept) generationChanged(false);
      else { updateGenerationStatus(); renderTeachingPreset(); }
    },
    levelField: teachingField,
    levelDetails: teachingDetails,
    setLocked: (active: boolean) => {
      locked = active;
      page.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('.settings-live input, .settings-live select, .settings-actions button').forEach(control => { control.disabled = active; });
      presetTrigger.disabled = active;
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
