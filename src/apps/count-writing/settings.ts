import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from './fixtures.ts';
import type { DottedQuarterConvention } from './evaluation.ts';
import { linePlacementOptions, sustainAppearanceOptions } from './presentation.ts';
import type { CountPresentation, LinePlacement, SustainAppearance } from './presentation.ts';
import type { OffbeatSymbol } from './input.ts';
import { settingsGroups } from './settings-catalog.ts';
import { defaultGeneration, generationIssue, ingredients } from './generation.ts';
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
  generation: (value: GenerationSettings) => void;
  offbeat: (value: OffbeatSymbol) => void;
  placement: (value: LinePlacement) => void;
  appearance: (value: SustainAppearance) => void;
  fixture: (id: string) => void;
  convention: (value: DottedQuarterConvention) => void;
}) {
  const page = el('section', 'rhythm-settings'); page.id = 'settings-view'; page.setAttribute('aria-label', 'Rhythm settings');
  const intro = el('p', 'settings-intro', 'Set up Count Writing now, and explore the settings planned for the rhythm activities. Unavailable controls are shown for review and do not change your exercises.');
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Available now'); heading.id = 'available-settings';
  const activeBadge = el('span', 'availability availability--active', 'Working controls');
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading, activeBadge);
  const activeControls = el('div', 'settings-live-controls');
  const offbeat = select([{ value: '&', label: 'Numbers with &' }, { value: '+', label: 'Numbers with +' }], value => callbacks.offbeat(value as OffbeatSymbol));
  offbeat.dataset.setting = 'count-system';
  const systemField = field('Counting system', offbeat);
  systemField.append(el('p', 'setting-hint', 'Either + or & enters the chosen offbeat symbol. Changing it preserves your answer.'));
  const fixture = select([{ value: 'generated', label: 'Generated practice' }, ...countWritingFixtures.map(f => ({ value: f.id, label: f.label }))], callbacks.fixture);
  fixture.dataset.setting = 'review-exercise';
  const fixtureField = field('Practice exercise', fixture);
  const fixtureHint = el('p', 'setting-hint', 'Changing exercise clears the current answer.'); fixtureHint.id = 'settings-fixture-hint';
  fixture.setAttribute('aria-describedby', fixtureHint.id); fixtureField.append(fixtureHint);
  const convention = select(dottedConventionOptions, value => callbacks.convention(value as DottedQuarterConvention));
  convention.dataset.setting = 'dotted-quarter-convention';
  const conventionField = field('Dotted-quarter internal &', convention);
  const conventionHint = el('p', 'setting-hint', 'Applies when an exercise contains a dotted quarter. Your answer stays intact; check again after changing the rule.');
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
  let generation = defaultGeneration();
  const length = select([1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} ${n === 1 ? 'measure' : 'measures'}` })), value => { generation = { ...generation, measures: Number(value) }; generationChanged(); });
  length.value = '2'; length.dataset.setting = 'exercise-length';
  const lengthField = field('Exercise length', length);
  lengthField.append(el('p', 'setting-hint', 'Default: 2 measures. Applies on Next exercise; keeps the current answer.'));
  const vocabulary = el('fieldset', 'settings-options active-ingredients');
  vocabulary.append(el('legend', '', 'Allowed rhythm ingredients · next exercise'));
  for (const ingredient of ingredients) {
    const label = el('label', 'setting-option'); const input = el('input'); input.type = 'checkbox'; input.checked = true; input.dataset.ingredient = ingredient.id;
    input.addEventListener('change', () => { generation = { ...generation, ingredients: ingredients.filter(i => vocabulary.querySelector<HTMLInputElement>(`[data-ingredient="${i.id}"]`)!.checked).map(i => i.id) }; generationChanged(); });
    label.append(input, el('span', '', ingredient.label)); vocabulary.append(label);
  }
  const generationStatus = el('p', 'setting-hint'); generationStatus.setAttribute('role', 'status');
  function generationChanged() {
    generationStatus.textContent = generationIssue(generation) ?? 'Ready for Next exercise. Only checked ingredients are allowed; a bar may use a subset.';
    callbacks.generation({ ...generation, ingredients: [...generation.ingredients] });
  }
  generationStatus.textContent = 'Fixed 4/4. Only checked ingredients are allowed; a bar may use a subset. Changes apply on Next exercise.';
  activeControls.append(lengthField, vocabulary, generationStatus, systemField, fixtureField, conventionField, placementField, appearanceField);
  const restRule = el('section', 'setting-row');
  restRule.dataset.setting = 'rest-grouping';
  restRule.setAttribute('aria-labelledby', 'setting-rest-grouping');
  const restHeading = el('div', 'setting-heading');
  const restTitle = el('h3', '', 'Rest parentheses'); restTitle.id = 'setting-rest-grouping';
  restHeading.append(restTitle, el('span', 'availability availability--active', 'Current rule'));
  restRule.append(restHeading, el('p', 'setting-hint', 'Use one complete pair of parentheses per written rest, enclosing all its required or entered counts. A half rest encloses both beats and its duration line: (1 2). Two quarter rests use separate pairs: (1) (2). Groups cannot overlap or nest. This rule is fixed in the current prototype.'));
  available.append(activeHeader, activeControls, restRule, el('p', 'setting-hint', 'Changes last in this tab only. Reloading resets settings and answers.'));
  const browse = el('div', 'settings-browse');
  browse.append(el('h2', '', 'Planned settings'));
  const sections: HTMLDetailsElement[] = [];
  const expand = button('Expand all groups', () => {
    const open = sections.some(section => !section.open);
    sections.forEach(section => { section.open = open; });
    expand.textContent = open ? 'Collapse all groups' : 'Expand all groups';
  });
  browse.append(expand);
  page.append(intro, available, browse, el('p', 'setting-hint', '“Not available yet” marks planned controls. “To be decided” marks open choices. Unselected future options are not exercise defaults.'));
  for (const group of settingsGroups) {
    const plannedSettings = group.settings.filter(setting => !['count-system', 'passage-length'].includes(setting.id));
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
  const back = el('a', 'control control--primary', 'Back to Count Writing'); back.href = '#practice';
  const footer = el('div', 'settings-footer'); footer.append(back); page.append(footer);
  return { page, sync: (fixtureId: string, value: DottedQuarterConvention, presentation: CountPresentation, symbol: OffbeatSymbol) => { offbeat.value = symbol; fixture.value = fixtureId; convention.value = value; placement.value = presentation.linePlacement; appearance.value = presentation.sustainAppearance; } };
}
