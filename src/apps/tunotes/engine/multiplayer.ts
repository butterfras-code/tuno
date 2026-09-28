import type { ChallengeRules } from './challenge.ts';
import { Challenge } from './challenge.ts';

export type Format = 'turns' | 'pairs' | 'head-to-head';
export interface PlayerEntry { id: string; name: string }
export interface Standing { player: PlayerEntry; session: Challenge; rank?: number }

/** Roster order is the only scheduling input. No participant is replayed in an odd heat. */
export function schedule<T>(roster: readonly T[], format: Format): T[][] {
  if (roster.length < 1 || roster.length > 8) throw new Error('Choose 1–8 players.');
  const width = format === 'turns' ? 1 : 2;
  const heats: T[][] = [];
  for (let i = 0; i < roster.length; i += width) heats.push(roster.slice(i, i + width));
  return heats;
}

export function canPair(width: number, height: number) { return width >= 960 && height >= 600; }

/** Exact, unrounded ties share rank; participation rows retain roster order. */
export function standings(entries: readonly { player: PlayerEntry; session: Challenge }[], rules: ChallengeRules): Standing[] {
  const qualified = entries.filter(e => e.session.qualified);
  qualified.sort((a,b) => rules.goal === 'timed' ? b.session.score - a.session.score : Math.floor(a.session.activeMs) - Math.floor(b.session.activeMs));
  const ranked = qualified.map((e,i) => ({ ...e, rank: i && (rules.goal === 'timed' ? e.session.score === qualified[i-1]!.session.score : Math.floor(e.session.activeMs) === Math.floor(qualified[i-1]!.session.activeMs)) ? undefined : i+1 }));
  let lastRank = 0;
  for (const row of ranked) { if (row.rank === undefined) row.rank = lastRank; else lastRank = row.rank; }
  return [...ranked,...entries.filter(e => !e.session.qualified)];
}

export function displayNames(players: readonly PlayerEntry[]) {
  const counts = new Map<string,number>();
  for (const player of players) counts.set(player.name, (counts.get(player.name) ?? 0) + 1);
  return new Map(players.map((player,index) => [player.id, counts.get(player.name)! > 1 ? `${player.name} · Seat ${index+1}` : player.name]));
}
