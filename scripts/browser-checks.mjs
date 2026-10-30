import { readdirSync } from 'node:fs';

export const browserEngines = ['chromium', 'firefox'];

// Explicit classification: discovering a file never silently enables or omits it.
export const browserChecks = [
  { file: 'viewport-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'activity-sharing-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'counting-plan-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'layout-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'tempo-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'animation-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'offline-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'site-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'suite-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'audio-render-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'performance-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'release-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'pwa-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'dual-app-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-stage2-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-storage-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-fingering-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-microphone-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-input-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-key-layout-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-guidance-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-feedback-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-range-picker-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-saved-presets-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-configurator-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-preset-preview-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-custom-editor-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-adaptive-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-ui-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-practice-layout-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-mode-layout-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-misses-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-challenge-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-multiplayer-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-viewport-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'counting-corrections-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'performance-follow-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'responsive-workspace-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'rhythm-patterns-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'rhythm-preset-picker-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'rhythm-source-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'rhythm-uil-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-mobile-layout-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-entry-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'notes-results-browser-check.mjs', status: 'active', engines: ['chromium', 'firefox'] },
  { file: 'count-writing-browser-check.mjs', status: 'retired', engines: [], reason: 'Historical endpoint editor; replaced by counting-plan-browser-check and counting-corrections-browser-check.' },
  { file: 'count-writing-meters-browser-check.mjs', status: 'retired', engines: [], reason: 'Historical endpoint editor; replaced by counting-plan-browser-check and counting-corrections-browser-check.' },
  { file: 'count-writing-practice-browser-check.mjs', status: 'retired', engines: [], reason: 'Historical endpoint editor; replaced by counting-plan-browser-check and counting-corrections-browser-check.' },
  { file: 'count-writing-ties-browser-check.mjs', status: 'retired', engines: [], reason: 'Historical endpoint editor; replaced by counting-plan-browser-check and counting-corrections-browser-check.' },
  { file: 'ui-refinements-browser-check.mjs', status: 'retired', engines: [], reason: 'Historical before/after UI snapshot with removed setup tabs and layout assumptions; current contracts live in notes-practice-layout-browser-check, notes-entry-browser-check, notes-mobile-layout-browser-check and responsive-workspace-browser-check.' },
];

export function validateBrowserChecks(entries = browserChecks, files = readdirSync(new URL('./', import.meta.url), { recursive: true }).map(file => file.replaceAll('\\', '/'))) {
  const checks = files.filter(file => /(?:browser-check|offline-check|audio-render-check|performance-check)\.mjs$/.test(file));
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.file)) throw Error(`Duplicate browser check: ${entry.file}`);
    seen.add(entry.file);
    if (!checks.includes(entry.file)) throw Error(`Registered browser check is missing or misnamed: ${entry.file}`);
    if (!['active', 'retired'].includes(entry.status)) throw Error(`Unclassified status: ${entry.file}`);
    if (!Array.isArray(entry.engines) || new Set(entry.engines).size !== entry.engines.length || entry.engines.some(engine => !browserEngines.includes(engine))) throw Error(`Invalid engines: ${entry.file}`);
    if (entry.status === 'active' && !entry.engines.length) throw Error(`Active check needs an engine: ${entry.file}`);
    if (entry.status === 'retired' && (entry.engines.length || !entry.reason?.trim())) throw Error(`Retired check needs a reason and no engines: ${entry.file}`);
    if (entry.status === 'active' && entry.engines.length !== browserEngines.length && !entry.reason?.trim()) throw Error(`Limited engine support needs a reason: ${entry.file}`);
  }
  const missing = checks.filter(file => !seen.has(file));
  if (missing.length) throw Error(`Unclassified browser checks: ${missing.join(', ')}`);
}

export function browserPlan(engines = browserEngines, entries = browserChecks) {
  for (const engine of engines) if (!browserEngines.includes(engine)) throw Error(`Unsupported browser: ${engine}`);
  return engines.flatMap(engine => entries.filter(entry => entry.status === 'active' && entry.engines.includes(engine)).map(entry => ({ engine, file: entry.file })));
}
