import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_THEME_ID,
  THEMES,
  getThemeDefinition,
  isThemeId,
} from '../src/shared/theme/registry.ts';
import {
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  cycleTheme,
  getTheme,
  resetThemeForTests,
  resolveStoredTheme,
  setTheme,
  subscribeTheme,
} from '../src/shared/theme/state.ts';
import { pickAsset } from '../src/shared/theme/assets.ts';

function memory(initial: string | null = null) {
  let value = initial;
  return {
    getItem(key: string) {
      assert.equal(key, THEME_STORAGE_KEY);
      return value;
    },
    setItem(key: string, next: string) {
      assert.equal(key, THEME_STORAGE_KEY);
      value = next;
    },
  };
}

test('theme registry validates known ids and resolves definitions safely', () => {
  assert.ok(THEMES.some(t => t.id === 'default'));
  assert.ok(THEMES.some(t => t.id === 'fireside'));
  assert.equal(isThemeId('default'), true);
  assert.equal(isThemeId('fireside'), true);
  assert.equal(isThemeId('nonexistent'), false);
  assert.equal(isThemeId(null), false);
  assert.equal(getThemeDefinition('default').themeColor, '#f4efe7');
  assert.equal(getThemeDefinition('fireside').themeColor, '#f5efe6');
});

test('stored theme falls back to initial theme, respects opt-out, and supports query override', () => {
  assert.equal(resolveStoredTheme(memory(null)), INITIAL_THEME_ID);
  assert.equal(resolveStoredTheme(memory('default')), 'default');
  assert.equal(resolveStoredTheme(memory('fireside')), 'fireside');
  assert.equal(resolveStoredTheme(memory('invalid-value')), INITIAL_THEME_ID);
  assert.equal(resolveStoredTheme(memory('fireside'), '?theme=default'), 'default');
  assert.equal(resolveStoredTheme(memory('default'), '?theme=fireside'), 'fireside');
  assert.equal(resolveStoredTheme(memory('default'), '?theme=unknown'), 'default');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(resolveStoredTheme(blocked), INITIAL_THEME_ID);
});

test('theme cycling and subscriptions notify listeners and revert cleanly to default', () => {
  resetThemeForTests('fireside');
  const seen: string[] = [];
  const stop = subscribeTheme(theme => seen.push(theme));
  assert.equal(getTheme(), 'fireside');
  assert.equal(cycleTheme(), 'default');
  assert.equal(getTheme(), 'default');
  assert.equal(cycleTheme(), 'fireside');
  setTheme('default', false);
  stop();
  setTheme('fireside', false);
  assert.deepEqual(seen, ['default', 'fireside', 'default']);
});

test('applyThemeToDocument toggles data-theme and meta theme-color cleanly', () => {
  const attrs = new Map<string, string>();
  const meta = { content: '#f4efe7' };
  const fakeDoc = {
    documentElement: {
      dataset: new Proxy<Record<string, string>>({}, {
        set(_t, prop, value) { attrs.set(`data-${String(prop)}`, String(value)); return true; },
      }),
      removeAttribute(name: string) { attrs.delete(name); },
    },
    querySelector(selector: string) {
      return selector === 'meta[name="theme-color"]' ? meta : null;
    },
  } as unknown as Document;

  applyThemeToDocument('fireside', fakeDoc);
  assert.equal(attrs.get('data-theme'), 'fireside');
  assert.equal(meta.content, '#f5efe6');

  applyThemeToDocument('default', fakeDoc);
  assert.equal(attrs.has('data-theme'), false);
  assert.equal(meta.content, '#f4efe7');
});

test('pickAsset selects theme-specific variant and falls back to default', () => {
  const variants = { default: 'default.svg', fireside: 'fireside.svg' } as const;
  assert.equal(pickAsset(variants, 'fireside'), 'fireside.svg');
  assert.equal(pickAsset(variants, 'default'), 'default.svg');
  assert.equal(pickAsset({ default: 'only-default.svg' }, 'fireside'), 'only-default.svg');
});
