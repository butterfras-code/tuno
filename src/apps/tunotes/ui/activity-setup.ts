import { el } from '../../../shared/ui/components.ts';

/** The shared setup layout; each activity supplies its own settings controls. */
export function activitySetup(notes: HTMLElement, settings: HTMLElement, prefix = 'activity', notesTrigger?: HTMLButtonElement) {
  const node = el('section','practice-setup activity-setup');
  const toolbar = el('div','activity-setup-toolbar');
  const tabs = el('div','practice-setup-tabs');
  toolbar.append(tabs);
  tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Activity setup');
  const panels = el('div','practice-setup-panels'); panels.append(notes,settings);
  const summary = el('p','muted practice-setup-summary');
  const buttons = [notesTrigger ?? el('button','control','Choose Notes'),el('button','control','Practice settings')];
  buttons[0]!.textContent = 'Choose Notes';
  function select(tab: 'notes' | 'settings') {
    const index = tab === 'notes' ? 0 : 1;
    [notes,settings].forEach((panel,i) => {
      panel.hidden = i !== index; buttons[i]!.setAttribute('aria-selected',String(i === index));
      buttons[i]!.tabIndex = i === index ? 0 : -1;
    });
  }
  [notes,settings].forEach((panel,i) => {
    const tab = buttons[i]!, id = i === 0 ? 'notes' : 'settings';
    tab.type = 'button'; tab.id = `${prefix}-${id}-tab`; tab.setAttribute('role','tab');
    panel.id = `${prefix}-${id}-panel`; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',tab.id);
    tab.setAttribute('aria-controls',panel.id); tab.addEventListener('click',() => select(i === 0 ? 'notes' : 'settings'));
    tab.addEventListener('keydown',event => {
      if (node.classList.contains('practice-layout')) return;
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? buttons[0]! : event.key === 'End' ? buttons[1]! : buttons[1-i]!;
      select(target === buttons[0] ? 'notes' : 'settings'); target.focus();
    });
    tabs.append(tab);
  });
  select('notes'); node.append(toolbar,panels,summary);
  return { node,select,practiceLayout: (enabled: boolean) => {
    node.classList.toggle('practice-layout',enabled); buttons[1]!.hidden = enabled;
    tabs.setAttribute('role',enabled ? 'group' : 'tablist');
    buttons[0]!.setAttribute('role',enabled ? 'button' : 'tab');
    notes.setAttribute('role',enabled ? 'region' : 'tabpanel');
    if (enabled) select('notes');
  }, summary: (text: string) => { summary.textContent = text; },
    notesLabel: (text: string) => { buttons[0]!.textContent = text; },
    settingsLabel: (text: string) => { buttons[1]!.textContent = text; },
    action: (button: HTMLElement) => toolbar.append(button) };
}
