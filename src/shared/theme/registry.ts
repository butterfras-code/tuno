export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly label: string;
  readonly shortLabel: string;
  readonly themeColor: string;
}

/**
 * Declarative suite theme registry (pure metadata — safe for Node tests without asset loaders).
 * Adding a new theme later only requires adding a ThemeDefinition here,
 * a matching html[data-theme='<id>'] block in themes.css, and optional asset overrides in assets.ts.
 */
export const THEMES = [
  {
    id: 'default',
    label: 'Default',
    shortLabel: 'Off',
    themeColor: '#f4efe7',
  },
  {
    id: 'fireside',
    label: 'Fireside Holiday',
    shortLabel: 'On',
    themeColor: '#f5efe6',
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

/** Active default when a user has not chosen a preference yet. Flip to 'default' off-season. */
export const INITIAL_THEME_ID: ThemeId = 'fireside';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some(theme => theme.id === value);
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find(theme => theme.id === id) ?? THEMES[0];
}
