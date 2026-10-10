import { button, el, field, select } from '../../shared/ui/components.ts';
import { countWritingFixtures } from './fixtures.ts';
import type { DottedQuarterConvention } from './evaluation.ts';
import { settingsGroups } from './settings-catalog.ts';
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
  fixture: (id: string) => void;
  convention: (value: DottedQuarterConvention) => void;
}) {
  const page = el('section', 'rhythm-settings'); page.id = 'settings-view'; page.setAttribute('aria-label', 'Rhythm settings');
  const intro = el('p', 'settings-intro', 'Set up Count Writing now, and explore the settings planned for the rhythm activities. Unavailable controls are shown for review and do not change your exercises.');
  const available = el('section', 'card settings-live'); available.setAttribute('aria-labelledby', 'available-settings');
  const heading = el('h2', '', 'Available now'); heading.id = 'available-settings';
  const activeBadge = el('span', 'availability availability--active', 'Applies immediately');
  const activeHeader = el('div', 'setting-heading'); activeHeader.append(heading, activeBadge);
  const activeControls = el('div', 'settings-live-controls');
  const fixture = select(countWritingFixtures.map(f => ({ value: f.id, label: f.label })), callbacks.fixture);
  fixture.dataset.setting = 'review-exercise';
  const fixtureField = field('Practice exercise', fixture);
  const fixtureHint = el('p', 'setting-hint', 'Changing exercise clears the current answer.'); fixtureHint.id = 'settings-fixture-hint';
  fixture.setAttribute('aria-describedby', fixtureHint.id); fixtureField.append(fixtureHint);
  const convention = select(dottedConventionOptions, value => callbacks.convention(value as DottedQuarterConvention));
  convention.dataset.setting = 'dotted-quarter-convention';
  const conventionField = field('Dotted-quarter internal &', convention);
  const conventionHint = el('p', 'setting-hint', 'Applies when an exercise contains a dotted quarter. Your answer stays intact; check again after changing the rule.');
  conventionHint.id = 'settings-convention-hint'; convention.setAttribute('aria-describedby', conventionHint.id); conventionField.append(conventionHint);
  activeControls.append(fixtureField, conventionField);
  available.append(activeHeader, activeControls, el('p', 'setting-hint', 'Changes last in this tab only. Reloading resets settings and answers.'));
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
    const section = el('details', 'settings-group'); section.dataset.group = group.id;
    section.addEventListener('toggle', () => { expand.textContent = sections.every(s => s.open) ? 'Collapse all groups' : 'Expand all groups'; });
    const summary = el('summary');
    const title = el('h2', '', group.title);
    summary.append(title, el('span', 'group-count', `${group.settings.length} settings`));
    const content = el('div', 'settings-group-body');
    content.append(el('p', 'group-description', group.description));
    group.settings.forEach(setting => content.append(placeholder(setting)));
    section.append(summary, content); page.append(section); sections.push(section);
  }
  const back = el('a', 'control control--primary', 'Back to Count Writing'); back.href = '#practice';
  const footer = el('div', 'settings-footer'); footer.append(back); page.append(footer);
  return { page, sync: (fixtureId: string, value: DottedQuarterConvention) => { fixture.value = fixtureId; convention.value = value; } };
}
