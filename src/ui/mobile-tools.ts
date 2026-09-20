import './mobile-tools.css';
import { TOOLS } from '../practice/state.ts';
import type { Focus } from '../practice/state.ts';
import { button, el } from './components.ts';

/** Reuse each live control panel so changing tabs never restarts audio. */
export function createMobileTools(tools: HTMLElement) {
  let selectedTool: Focus = 'tuner';
  const panels = [...tools.querySelectorAll<HTMLElement>('.tool-card')];
  const tabs = el('div', 'mobile-tool-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Practice tool controls');
  const mobile = window.matchMedia('(max-width: 650px)');
  const controls = TOOLS.map((tool, index) => {
    const tab = button(tool.id === 'tuner' ? 'Tune' : tool.id === 'tone' ? 'Tone' : 'Tempo', () => {
      selectedTool = tool.id;
      update();
    });
    tab.id = `tool-tab-${tool.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `tool-panel-${tool.id}`);
    panels[index]!.id = `tool-panel-${tool.id}`;
    tabs.append(tab);
    return tab;
  });
  tabs.addEventListener('keydown', event => {
    const index = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const next = event.key === 'ArrowRight' ? (index + 1) % controls.length
      : event.key === 'ArrowLeft' ? (index + controls.length - 1) % controls.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    controls[next]!.focus();
    controls[next]!.click();
  });
  tools.prepend(tabs);
  let previousLayout = '';
  const update = () => {
    const focus = selectedTool;
    const layout = `${mobile.matches}:${focus}`;
    if (layout === previousLayout) return;
    previousLayout = layout;
    panels.forEach((panel, index) => {
      const selected = TOOLS[index]!.id === focus;
      controls[index]!.setAttribute('aria-selected', String(selected));
      controls[index]!.tabIndex = selected ? 0 : -1;
      panel.hidden = mobile.matches && !selected;
      if (mobile.matches) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', controls[index]!.id);
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
      }
    });
  };
  mobile.addEventListener('change', update);
  update();
}
