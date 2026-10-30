import { parseArgs } from 'node:util';
import { primaryViewports, viewportProfiles } from './viewport-profiles.mjs';

export const captureProfiles = Object.freeze([
  ...viewportProfiles,
  { id: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false, provisional: false },
]);

export function captureOptions(args, scenarios) {
  const { values } = parseArgs({ args, options: {
    replace: { type: 'boolean' }, new: { type: 'boolean' },
    only: { type: 'string' }, profiles: { type: 'string' },
    output: { type: 'string', default: 'screenshots' },
    jobs: { type: 'string', default: '2' },
    'no-build': { type: 'boolean' }, list: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.replace && values.new) throw new Error('Choose either --replace or --new.');
  const jobs = Number(values.jobs);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error('--jobs must be an integer from 1 to 8.');
  const split = value => value.split(',').map(part => part.trim());
  const select = (tokens, collection, match, label) => {
    for (const token of tokens) if (!collection.some(item => match(item, token))) throw new Error(`Unknown ${label}: ${token}. Use --list to see available choices.`);
    return collection.filter(item => tokens.some(token => match(item, token)));
  };
  const profiles = values.profiles ? select(split(values.profiles), captureProfiles, (profile, token) =>
    token === 'all' || profile.id === token || token === 'primary' && primaryViewports.some(p => p.id === profile.id), 'profile') : captureProfiles;
  const groups = {
    notes: s => s.route === '/notes/', uno234: s => s.id.startsWith('uno234-'),
    fingering: s => ['trumpet', 'violin'].includes(s.id),
    configurator: s => /configurator|presets/.test(s.id),
  };
  const selected = values.only ? select(split(values.only), scenarios, (s, token) =>
    s.id === token || Boolean(groups[token]?.(s)), 'scenario') : scenarios;
  const captures = profiles.flatMap(profile => selected.filter(s => !s.matches || s.matches(profile)).map(scenario => ({ profile, scenario })));
  if (!captures.length) throw new Error('No captures match this scenario/profile combination. Trumpet needs phone-landscape; violin needs a portrait touch profile.');
  return { ...values, jobs, profiles, scenarios: selected, captures };
}
