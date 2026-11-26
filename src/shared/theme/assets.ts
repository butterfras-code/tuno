import type { ThemeId } from './registry.ts';
import { getTheme } from './state.ts';

/** Per-asset lookup map so each app only bundles the SVGs it actually imports. */
export type ThemedAssetVariants = Readonly<{ default: string } & Partial<Record<ThemeId, string>>>;

export function pickAsset(variants: ThemedAssetVariants, theme: ThemeId = getTheme()): string {
  return variants[theme] ?? variants.default;
}
