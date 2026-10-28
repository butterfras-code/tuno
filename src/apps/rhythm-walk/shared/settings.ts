import { note } from '../../../music/measure.ts';
import { renderCountingPreview } from './counting-preview.ts';
import { rhythmPresetPicker } from './preset-picker.ts';
import { meters, meterPolicy } from './meter.ts';
import { renderTimeSignature, renderRhythmSymbol, renderRhythmPattern } from './notation.ts';
import { button, el, select, segmentedOption } from '../../../shared/ui/components.ts';
import { captureCountingPreferences } from '../../../music/counting/preferences.ts';
import type { CountingPreferences } from '../../../music/counting/preferences.ts';
import { generationIssue, ingredients, enableMeter, sixteenthPatterns, selectedSixteenthPatterns } from './generation.ts';
import type { GenerationSettings } from './generation.ts';
import { generationLevels, teachingPresetLabel, resolveTeachingPreset, applyTeachingPreset, customizeTeachingPreset } from './teaching-presets.ts';

/** Fixed count labels for the compact notation selectors. */
function addSelectorCounts(example: SVGElement, counts: readonly (readonly [number, string])[]) {
  for (const [x, token] of counts) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    for (const [key, attribute] of Object.entries({ x: String(x), y: '142', 'font-size': '36', 'font-family': 'var(--font-body)', 'font-weight': '400', 'text-anchor': 'middle', fill: 'currentColor' })) text.setAttribute(key, attribute);
    text.textContent = token; example.append(text);
  }
}

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
  const newExercise = button('New exercise', callbacks.newExercise);
  const available = el('section', 'card settings-live'); available.setAttribute('aria-label', 'Counting preferences');
  const activeControls = el('div', 'settings-live-controls');
  let counting = callbacks.initialCounting;
  let savedCounting = callbacks.initialCounting;
  const preview = el('div', 'counting-preview');
  const previewScroll = el('div', 'counting-preview-scroll');
  preview.append(previewScroll);
  const saveStatus = el('p', 'setting-hint'); saveStatus.setAttribute('role', 'status');
  const save = button('Save', () => {
    savedCounting = counting;
    callbacks.counting(counting);
    refreshChoices();
    saveStatus.textContent = 'Saved.';
  }, true);
  save.dataset.saveCounting = '';
  const saveActions = el('div', 'actions counting-save'); saveActions.append(save, newExercise, saveStatus);
  const positionInputs: HTMLInputElement[] = [];
  const appearances = { above: 'raised', below: 'lowered', beside: 'unchanged' } as const;
  const restInputs: HTMLInputElement[] = [];
  const vocabularyInputs: HTMLInputElement[] = [];
  const dottedInputs: HTMLInputElement[] = [];
  const countingGroup = el('fieldset', 'counting-settings-group'); countingGroup.append(el('legend', '', 'Counting'));
  const longNotesGroup = el('fieldset', 'counting-settings-group'); longNotesGroup.append(el('legend', '', 'Subdivision'));
  activeControls.append(countingGroup, longNotesGroup);
  function change(key: keyof CountingPreferences, value: string | boolean, extra: Partial<CountingPreferences> = {}) {
    counting = captureCountingPreferences({ ...counting, ...extra, [key]: value });
    saveStatus.textContent = ''; refreshChoices();
  }
  const dottedGroup = el('fieldset', 'settings-pill-field segmented-field dotted-subdivision-field');
  dottedGroup.append(el('legend', '', 'Dotted Notes'));
  const dottedSegments = el('div', 'pill-selector counting-pill-options notation-pill-options dotted-subdivision-options');
  for (const subdivide of [true, false]) {
    const example = renderRhythmPattern([note('quarter', { dots: 1 })]);
    example.setAttribute('viewBox', '0 32 112 120');
    if (!subdivide) {
      const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      glyph.setAttribute('transform', 'translate(32 0)'); glyph.append(...example.childNodes); example.append(glyph);
    }
    addSelectorCounts(example, subdivide ? [[22, '1'], [54, '+'], [86, '2']] : [[54, '1']]);
    const { label, input } = segmentedOption({
      label: subdivide ? 'Subdivide dotted notes: 1 + 2' : 'Do not subdivide dotted notes: 1',
      content: example, type: 'radio', name: 'dotted-subdivision', value: String(subdivide), checked: counting.dotted === subdivide,
      changed: () => change('dotted', subdivide),
    });
    label.className = 'control pill-option'; input.dataset.countingPreference = 'dotted';
    dottedInputs.push(input); dottedSegments.append(label);
  }
  dottedGroup.append(dottedSegments);
  const restGroup = el('fieldset', 'settings-pill-field rest-style-field segmented-field');
  restGroup.append(el('legend', '', 'Rests'));
  const restSegments = el('div', 'pill-selector counting-pill-options rest-style-options');
  for (const value of ['parentheses', 'slashes', 'blank'] as const) {
    const symbol = el('span', `rest-style-symbol${value === 'slashes' ? ' rest-slashed' : value === 'blank' ? ' rest-style-blank' : ''}`, value === 'parentheses' ? '(1)' : value === 'slashes' ? '1' : 'Blank');
    const { label, input } = segmentedOption({
      label: value === 'parentheses' ? 'Counts in parentheses' : value === 'slashes' ? 'Counts with slashes' : 'Blank',
      content: symbol, type: 'radio', name: 'counting-rest-style', value,
      checked: (counting.includeRests ? counting.restAppearance : 'blank') === value,
      changed: () => change('includeRests', value !== 'blank', value === 'blank' ? {} : { restAppearance: value }),
    });
    label.className = 'control pill-option';
    input.dataset.restStyle = value;
    if (value !== 'blank') input.dataset.countingPreference = 'restAppearance';
    restInputs.push(input); restSegments.append(label);
  }
  restGroup.append(restSegments); countingGroup.append(restGroup);
  const vocabularyGroup = el('fieldset', 'settings-pill-field segmented-field counting-style-field');
  vocabularyGroup.append(el('legend', '', 'Syllables'));
  const vocabularySegments = el('div', 'pill-selector counting-pill-options notation-pill-options counting-style-options');
  for (const value of ['&', '+', 'te'] as const) {
    const example = renderRhythmPattern([note('eighth'), note('eighth')]);
    example.setAttribute('viewBox', '0 32 104 120');
    addSelectorCounts(example, [[22, '1'], [66, value]]);
    const { label, input } = segmentedOption({
      label: `1 ${value}`, content: example, type: 'radio', name: 'counting-style', value,
      checked: (counting.vocabulary === 'syllables' ? 'te' : counting.offbeat) === value,
      changed: () => change('vocabulary', value === 'te' ? 'syllables' : 'numbers', value === 'te' ? {} : { offbeat: value }),
    });
    label.className = 'control pill-option'; input.dataset.countingStyle = value;
    vocabularyInputs.push(input); vocabularySegments.append(label);
  }
  vocabularyGroup.append(vocabularySegments); countingGroup.append(vocabularyGroup, restGroup);
  for (const kind of ['subdivision', 'connection'] as const) {
    const group = el('fieldset', `settings-pill-field segmented-field ${kind}-position-field`);
    group.append(el('legend', '', kind === 'subdivision' ? 'Long Notes' : 'Connecting line'));
    const options = el('div', `pill-selector counting-pill-options position-pill-options ${kind}-position-options`);
    for (const position of ['none', 'above', 'below', 'beside'] as const) {
      const name = position[0]!.toUpperCase() + position.slice(1);
      const content = el('span', 'position-choice-content');
      const example = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      example.setAttribute('viewBox', '0 0 112 64'); example.setAttribute('aria-hidden', 'true');
      const count = (x: number, y: number, text: string, size = 26) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        for (const [key, value] of Object.entries({x:String(x),y:String(y),'font-size':String(size),'font-family':'var(--font-body)','text-anchor':'middle',fill:'currentColor'})) node.setAttribute(key,value);
        node.textContent=text; example.append(node);
      };
      count(kind === 'subdivision' && position === 'none' ? 56 : 22, 42, '1');
      if (kind === 'connection' || position !== 'none') count(86, kind === 'subdivision' && position === 'above' ? 25 : kind === 'subdivision' && position === 'below' ? 56 : 42, '2', kind === 'subdivision' && ['above','below'].includes(position) ? 20 : 26);
      if (kind === 'connection' && position !== 'none') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const y = position === 'above' ? 12 : position === 'below' ? 56 : 34;
        for (const [key,value] of Object.entries({x1:position === 'beside'?'38':'22',x2:position === 'beside'?'72':'86',y1:String(y),y2:String(y),stroke:'currentColor','stroke-width':'2'})) line.setAttribute(key,value);
        example.append(line);
      }
      content.append(example, el('span', '', name));
      const {label,input} = segmentedOption({ label:name, content, type:'radio', name:`${kind}-position`, value:position, checked:false,
        changed:() => {
          if (kind === 'subdivision') change('longNotes', position !== 'none', position === 'none' ? {} : {internalAppearance:appearances[position]});
          else change('showDurationLine', position !== 'none', position === 'none' ? {} : {linePlacement:position});
        },
      });
      label.className='control pill-option';
      if (kind === 'subdivision') input.dataset.subdivisionStyle=position; else input.dataset.connectionStyle=position;
      positionInputs.push(input); options.append(label);
    }
    group.append(options);
    longNotesGroup.append(group);
  }
  longNotesGroup.append(dottedGroup);
  function refreshChoices() {
    dottedInputs.forEach(input => { input.checked = input.value === String(counting.dotted); });
    restInputs.forEach(input => { input.checked = (counting.includeRests ? counting.restAppearance : 'blank') === input.value; });
    vocabularyInputs.forEach(input => { input.checked = (counting.vocabulary === 'syllables' ? 'te' : counting.offbeat) === input.value; });
    positionInputs.forEach(input => {
      if (input.dataset.subdivisionStyle) input.checked = counting.longNotes ? input.value !== 'none' && appearances[input.value as keyof typeof appearances] === counting.internalAppearance : input.value === 'none';
      else input.checked = input.value === (counting.showDurationLine ? counting.linePlacement : 'none');
    });
    previewScroll.replaceChildren(renderCountingPreview(counting));
    save.disabled = JSON.stringify(counting) === JSON.stringify(savedCounting);
  }
  refreshChoices();
  const adopt = button('Save as my defaults', () => {
    try {
      savedCounting = counting; callbacks.counting(counting); callbacks.saveCountingDefaults(); refreshChoices(); adopt.hidden = true;
      saveStatus.textContent = 'Saved as your defaults.';
    } catch { saveStatus.textContent = 'Could not save defaults in this browser. Settings remain session-only.'; }
  });
  adopt.hidden = !callbacks.isLinked();
  saveActions.insertBefore(adopt, saveStatus);
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
    teachingStatus.textContent = result.supported ? 'Available: figures and rests for the selected instrument scope. I–II allow quarter rests except on beat 1; III–IV also allow eighth rests and rests on beat 1. Exercise rest limits apply. Ties require customization. Use preset starts a new exercise when these settings change.' : `Unavailable: ${unavailable.slice(0, 2).join(' ')} See all requirements below.`;
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
  const triggerField = el('div', 'field'); triggerField.append(presetTrigger);
  teachingField.append(triggerField);
  teachingDetails.append(teachingStatus, applyPreset, el('p', 'setting-hint', 'Uno levels are practice configurations. UIL levels retain their qualified scope; they are not complete composition validators or UIL endorsements. Meters remain editable. No requirement that every allowed figure appear.'));
  teachingAttribution.id = 'pending-level';
  teachingAttribution.hidden = true;
  presetTrigger.setAttribute('aria-describedby', teachingAttribution.id);
  teachingField.append(teachingAttribution);
  teachingDetails.dataset.levelDetails = '';
  renderTeachingPreset();
  exerciseControls.append(meterField, lengthField, vocabulary, patternFields, generationStatus);
  const presetChooser = rhythmPresetPicker({ editor: exerciseControls, details: teachingDetails, current: () => generation,
    choose: (id, scope) => { instrumentScope.value = scope; applySelectedLevel(id); },
    customize: () => { generation = customizeTeachingPreset(generation); generationChanged(false); },
  });
  available.append(preview, activeControls, saveActions);
  page.append(available);
  updateGenerationStatus();
  return {
    page,
    countingSelection: () => counting,
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
      page.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(control => { control.disabled = active; });
      presetTrigger.disabled = active;
      applyPreset.disabled = active;
      exerciseControls.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(control => { control.disabled = active; });
      save.disabled = active || JSON.stringify(counting) === JSON.stringify(savedCounting);
      if (!active) { refreshChoices(); newExercise.disabled = Boolean(generationIssue(generation)); renderTeachingPreset(); }
    },
    sync: (value: CountingPreferences) => {
      // Keep an unsaved draft across navigation and exercise redraws.
      if (JSON.stringify(value) !== JSON.stringify(savedCounting)) {
        counting = value; savedCounting = value;
        refreshChoices();
      }
    },
  };
}
