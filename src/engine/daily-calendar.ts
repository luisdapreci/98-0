import { DRAFT_SLOTS, playerIdentity } from './draft.ts';
import type { DraftSlot } from './draft.ts';
import type { Coach, EraDecade, Player } from './types.ts';

export const DAILY_CALENDAR_VERSION = 'calendar-1';
export const DAILY_CALENDAR_START = '2026-09-16';
const DAY_MS = 86_400_000;

export interface DailyChallenge {
  readonly id: string;
  readonly name: string;
  readonly restriction: string;
  readonly coachId?: string;
  readonly decades?: readonly EraDecade[];
  readonly franchises?: readonly string[];
  readonly fixedPlayer?: { readonly id: string; readonly slot: DraftSlot };
}

export const DAILY_CALENDAR: readonly DailyChallenge[] = [
  { id: 'triangle-test', name: 'Triangle Test', restriction: 'Phil Jackson', coachId: 'phil_jackson' },
  { id: 'nba-on-nbc', name: 'NBA on NBC', restriction: '1990s + 2000s', decades: ['1990s', '2000s'] },
  { id: 'banner-battle', name: 'Banner Battle', restriction: 'Celtics + Lakers', franchises: ['BOS', 'LAL'] },
  { id: 'seven-seconds', name: 'Seven Seconds', restriction: "Mike D'Antoni", coachId: 'mike_dantoni' },
  { id: 'three-point-revolution', name: 'Three-Point Revolution', restriction: '2010s + 2020s', decades: ['2010s', '2020s'] },
  { id: 'texas-triangle', name: 'Texas Triangle', restriction: 'Spurs + Mavericks + Rockets', franchises: ['SAS', 'DAL', 'HOU'] },
  { id: 'build-around-shaq', name: 'Build Around Shaq', restriction: "Lakers 2000s Shaquille O'Neal at C", fixedPlayer: { id: 'onealsh01_LAL_2000s', slot: 'C' } },
  { id: 'bad-boys-blueprint', name: 'Bad Boys Blueprint', restriction: 'Chuck Daly', coachId: 'chuck_daly' },
  { id: 'old-school', name: 'Old School', restriction: '1960s + 1970s + 1980s', decades: ['1960s', '1970s', '1980s'] },
  { id: 'bad-blood', name: 'Bad Blood', restriction: 'Bulls + Pistons', franchises: ['CHI', 'DET'] },
  { id: 'motion-required', name: 'Motion Required', restriction: 'Steve Kerr', coachId: 'steve_kerr' },
  { id: 'changing-of-the-guard', name: 'Changing of the Guard', restriction: '2000s + 2010s', decades: ['2000s', '2010s'] },
  { id: 'california-circuit', name: 'California Circuit', restriction: 'Lakers + Clippers + Warriors + Kings', franchises: ['LAL', 'LAC', 'GSW', 'SAC'] },
  { id: 'currys-supporting-cast', name: "Curry's Supporting Cast", restriction: 'Warriors 2010s Stephen Curry at PG', fixedPlayer: { id: 'curryst01_GSW_2010s', slot: 'PG' } },
  { id: 'nellie-ball', name: 'Nellie Ball', restriction: 'Don Nelson', coachId: 'don_nelson' },
  { id: 'showtime-years', name: 'Showtime Years', restriction: '1980s only', decades: ['1980s'] },
  { id: 'subway-series', name: 'Subway Series', restriction: 'Knicks + Nets', franchises: ['NYK', 'BKN'] },
  { id: 'the-spurs-way', name: 'The Spurs Way', restriction: 'Gregg Popovich', coachId: 'gregg_popovich' },
  { id: 'turn-of-the-millennium', name: 'Turn of the Millennium', restriction: '2000s only', decades: ['2000s'] },
  { id: 'sunshine-state', name: 'Sunshine State', restriction: 'Heat + Magic', franchises: ['MIA', 'ORL'] },
  { id: 'the-jordan-assignment', name: 'The Jordan Assignment', restriction: 'Bulls 1990s Michael Jordan at SG', fixedPlayer: { id: 'jordami01_CHI_1990s', slot: 'SG' } },
  { id: 'showtime-to-grind', name: 'Showtime to Grind', restriction: 'Pat Riley', coachId: 'pat_riley' },
  { id: 'the-nineties', name: 'The Nineties', restriction: '1990s only', decades: ['1990s'] },
  { id: 'northwest-connection', name: 'Northwest Connection', restriction: 'Trail Blazers + SuperSonics/Thunder + Jazz', franchises: ['POR', 'OKC', 'UTA'] },
  { id: 'grit-required', name: 'Grit Required', restriction: 'Larry Brown', coachId: 'larry_brown' },
  { id: 'present-tense', name: 'Present Tense', restriction: '2020s only', decades: ['2020s'] },
  { id: 'expansion-generation', name: 'Expansion Generation', restriction: 'Raptors + Grizzlies', franchises: ['TOR', 'MEM'] },
  { id: 'manu-off-the-bench', name: 'Manu off the Bench', restriction: 'Spurs 2000s Manu Ginobili at 6TH', fixedPlayer: { id: 'ginobma01_SAS_2000s', slot: 'SIXTH' } },
];

export function dailyChallengeDate(index: number): string {
  return new Date(Date.parse(`${DAILY_CALENDAR_START}T00:00:00.000Z`) + index * DAY_MS).toISOString().slice(0, 10);
}

export function challengeForDate(date: string): DailyChallenge | null {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('Invalid Daily date.');
  const index = (timestamp - Date.parse(`${DAILY_CALENDAR_START}T00:00:00.000Z`)) / DAY_MS;
  return DAILY_CALENDAR[index] ?? null;
}

export function challengePlayers(challenge: DailyChallenge | null, players: readonly Player[]): readonly Player[] {
  if (!challenge) return players;
  return players.filter((player) => (!challenge.decades || challenge.decades.includes(player.decade))
    && (!challenge.franchises || challenge.franchises.includes(player.franchise)));
}

export function validateChallenge(challenge: DailyChallenge, players: readonly Player[], coaches: readonly Coach[]): void {
  if (challenge.coachId && !coaches.some((coach) => coach.id === challenge.coachId)) throw new Error('Unknown Daily coach.');
  const fixed = challenge.fixedPlayer;
  const fixedPlayer = fixed ? players.find((player) => player.id === fixed.id) : undefined;
  if (fixed && (!fixedPlayer || (fixed.slot !== 'SIXTH' && !fixedPlayer.eligiblePositions.includes(fixed.slot))))
    throw new Error('Invalid Daily fixed player.');
  const pool = challengePlayers(challenge, players).filter((player) => !fixedPlayer || playerIdentity(player) !== playerIdentity(fixedPlayer));
  const slots = DRAFT_SLOTS.filter((slot) => slot !== fixed?.slot);
  for (const slot of slots) {
    const identities = new Set(pool.filter((player) => slot === 'SIXTH' || player.eligiblePositions.includes(slot)).map(playerIdentity));
    if (identities.size < slots.length) throw new Error(`Daily pool cannot guarantee completion at ${slot}.`);
  }
}