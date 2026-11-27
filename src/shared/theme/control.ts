import { button } from '../ui/components.ts';
import { onUnmount } from '../ui/unmount.ts';
import { THEMES, getThemeDefinition, type ThemeId } from './registry.ts';
import { cycleTheme, getTheme, subscribeTheme } from './state.ts';

/**
 * Shared footer theme switch.
 * With two themes (Default + one seasonal theme), acts as a clear Holiday theme On/Off toggle.
 * When additional themes are registered in THEMES, automatically displays the active theme label and cycles.
 */
export function createThemeControl(): HTMLButtonElement {
  const control = button('', () => { cycleTheme(); });
  control.classList.add('theme-toggle');
  const sync = (theme: ThemeId) => {
    const def = getThemeDefinition(theme);
    if (THEMES.length === 2) {
      const on = theme !== 'default';
      control.textContent = on ? 'Holiday theme: On' : 'Holiday theme: Off';
      control.setAttribute('aria-pressed', String(on));
      control.setAttribute('aria-label', on ? 'Turn off holiday theme and return to default appearance' : 'Turn on Fireside holiday theme');
    } else {
      control.textContent = `Theme: ${def.label}`;
      control.removeAttribute('aria-pressed');
      control.setAttribute('aria-label', `Current theme: ${def.label}. Activate to switch themes.`);
    }
  };
  sync(getTheme());
  const unsubscribe = subscribeTheme(sync);
  onUnmount(control, unsubscribe);
  return control;
}
