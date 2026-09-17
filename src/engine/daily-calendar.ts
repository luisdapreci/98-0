import { DRAFT_SLOTS, playerIdentity } from './draft.ts';
import type { DraftSlot } from './draft.ts';
import type { Coach, EraDecade, Player } from './types.ts';
import { randomStream, shuffle } from './random.ts';

export const DAILY_CALENDAR_VERSION = 'calendar-1';
export const SECOND_DAILY_CALENDAR_VERSION = 'calendar-2';
export const DAILY_ROTATION_VERSION = 'rotation-1';
export const DAILY_ROTATION_START = '2026-09-17';
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
  readonly fixedPlayers?: readonly { readonly id: string; readonly slot: DraftSlot }[];
  readonly statFilter?: { readonly stat: 'pts' | 'usgPct' | 'threePtAttempts'; readonly operator: 'lt' | 'lte' | 'gte'; readonly value: number };
  readonly eligiblePosition?: Player['eligiblePositions'][number];
  readonly rerolls?: { readonly team: number; readonly era: number };
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
  { id: 'magic-vs-bird', name: 'Magic vs. Bird', restriction: 'Celtics + Lakers / 1980s only', franchises: ['BOS', 'LAL'], decades: ['1980s'] },
  { id: 'the-last-dance', name: 'The Last Dance', restriction: 'Bulls / 1990s only', franchises: ['CHI'], decades: ['1990s'] },
  { id: 'dream-shake', name: 'Dream Shake', restriction: 'Rockets 1990s Hakeem Olajuwon at C', fixedPlayer: { id: 'olajuha01_HOU_1990s', slot: 'C' } },
  { id: 'malice-at-the-draft-table', name: 'Malice at the Draft Table', restriction: 'Pacers + Pistons', franchises: ['IND', 'DET'] },
  { id: 'seven-seconds-before-seven-seconds', name: 'Seven Seconds Before Seven Seconds', restriction: 'Red Auerbach', coachId: 'red_auerbach' },
  { id: 'the-merger-years', name: 'The Merger Years', restriction: '1970s only', decades: ['1970s'] },
  { id: 'stocktons-delivery-service', name: "Stockton's Delivery Service", restriction: 'Jazz 1990s John Stockton at PG', fixedPlayer: { id: 'stockjo01_UTA_1990s', slot: 'PG' } },
  { id: 'broad-street-basketball', name: 'Broad Street Basketball', restriction: '76ers / all eras', franchises: ['PHI'] },
  { id: 'the-king-comes-home', name: 'The King Comes Home', restriction: 'Cavaliers 2010s LeBron James at SF', fixedPlayer: { id: 'jamesle01_CLE_2010s', slot: 'SF' } },
  { id: 'princeton-principles', name: 'Princeton Principles', restriction: 'Rick Adelman', coachId: 'rick_adelman' },
  { id: 'kobe-was-a-hornet', name: 'Kobe Was a Hornet', restriction: 'Lakers 2000s Kobe Bryant at SG / remaining picks: Charlotte', fixedPlayer: { id: 'bryanko01_LAL_2000s', slot: 'SG' }, franchises: ['CHA'] },
  { id: 'portland-picks-jordan', name: 'Portland Picks Jordan', restriction: 'Bulls 1990s Michael Jordan at SG / remaining picks: Portland', fixedPlayer: { id: 'jordami01_CHI_1990s', slot: 'SG' }, franchises: ['POR'] },
  { id: 'the-thunder-stay-together', name: 'The Thunder Stay Together', restriction: 'Thunder / 2010s only', franchises: ['OKC'], decades: ['2010s'] },
  { id: 'seattle-never-left', name: 'Seattle Never Left', restriction: 'SuperSonics/Thunder / all eras', franchises: ['OKC'] },
  { id: 'shaq-meets-steph', name: 'Shaq Meets Steph', restriction: 'Lakers 2000s Shaq at C + Warriors 2010s Curry at PG / four picks remaining', fixedPlayers: [{ id: 'onealsh01_LAL_2000s', slot: 'C' }, { id: 'curryst01_GSW_2010s', slot: 'PG' }] },
  { id: 'duncan-goes-to-orlando', name: 'Duncan Goes to Orlando', restriction: 'Spurs 2000s Tim Duncan at PF / remaining picks: Orlando', fixedPlayer: { id: 'duncati01_SAS_2000s', slot: 'PF' }, franchises: ['ORL'] },
  { id: 'wades-chicago-superteam', name: 'Wade Gets His Chicago Superteam', restriction: 'Heat 2000s Dwyane Wade at SG / remaining picks: Chicago', fixedPlayer: { id: 'wadedw01_MIA_2000s', slot: 'SG' }, franchises: ['CHI'] },
  { id: 'one-florida-superteam', name: 'One Florida Superteam', restriction: 'Heat + Magic / 1990s only', franchises: ['MIA', 'ORL'], decades: ['1990s'] },
  { id: 'the-other-la-dynasty', name: 'The Other Los Angeles Dynasty', restriction: 'Clippers / all eras', franchises: ['LAC'] },
  { id: 'sloan-coaches-everybody', name: 'Sloan Coaches Everybody', restriction: 'Jerry Sloan', coachId: 'jerry_sloan' },
  { id: 'superteam-at-home', name: 'We Have a Superteam at Home', restriction: 'Raw record PPG < 20', statFilter: { stat: 'pts', operator: 'lt', value: 20 } },
  { id: 'the-ball-is-shared', name: 'The Ball Is a Shared Resource', restriction: 'Raw record USG% <= 20', statFilter: { stat: 'usgPct', operator: 'lte', value: 20 } },
  { id: 'three-point-subscription', name: 'Three-Pointers Are a Subscription', restriction: 'Raw record 3PA < 1 per game', statFilter: { stat: 'threePtAttempts', operator: 'lt', value: 1 } },
  { id: 'everybody-wants-the-ball', name: 'Everybody Wants the Ball', restriction: 'Raw record USG% >= 25', statFilter: { stat: 'usgPct', operator: 'gte', value: 25 } },
  { id: 'no-refunds', name: 'No Refunds', restriction: 'No team or era rerolls', rerolls: { team: 0, era: 0 } },
  { id: 'south-beach-group-project', name: 'South Beach Group Project', restriction: 'Erik Spoelstra', coachId: 'erik_spoelstra' },
  { id: 'the-bench-has-an-agent', name: 'The Bench Has an Agent', restriction: 'Rockets 2010s James Harden at 6TH', fixedPlayer: { id: 'hardeja01_HOU_2010s', slot: 'SIXTH' } },
  { id: 'we-only-draft-centers', name: 'We Only Draft Centers Here', restriction: 'Raptors 2020s Scottie Barnes at PG / C-eligible players only', fixedPlayer: { id: 'barnesc01_TOR_2020s', slot: 'PG' }, eligiblePosition: 'C' },
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

export function calendarVersionForDate(date: string): typeof DAILY_CALENDAR_VERSION | typeof SECOND_DAILY_CALENDAR_VERSION {
  const challenge = challengeForDate(date);
  if (!challenge) throw new Error('No Daily challenge is published for this date.');
  return DAILY_CALENDAR.indexOf(challenge) < 28 ? DAILY_CALENDAR_VERSION : SECOND_DAILY_CALENDAR_VERSION;
}

export function challengePlayers(challenge: DailyChallenge | null, players: readonly Player[]): readonly Player[] {
  if (!challenge) return players;
  return players.filter((player) => (!challenge.decades || challenge.decades.includes(player.decade))
    && (!challenge.franchises || challenge.franchises.includes(player.franchise))
    && (!challenge.eligiblePosition || player.eligiblePositions.includes(challenge.eligiblePosition))
    && (!challenge.statFilter || matchesStatFilter(player, challenge.statFilter)));
}

function matchesStatFilter(player: Player, filter: NonNullable<DailyChallenge['statFilter']>): boolean {
  const value = player.stats[filter.stat];
  if (!Number.isFinite(value)) return false;
  switch (filter.operator) {
    case 'lt': return value < filter.value;
    case 'lte': return value <= filter.value;
    case 'gte': return value >= filter.value;
    default: return false;
  }
}

export function challengeFixedPlayers(challenge: DailyChallenge | null): readonly { readonly id: string; readonly slot: DraftSlot }[] {
  if (!challenge) return [];
  return [...(challenge.fixedPlayer ? [challenge.fixedPlayer] : []), ...(challenge.fixedPlayers ?? [])];
}

export function validateChallenge(challenge: DailyChallenge, players: readonly Player[], coaches: readonly Coach[]): void {
  if (challenge.coachId && !coaches.some((coach) => coach.id === challenge.coachId)) throw new Error('Unknown Daily coach.');
  if (challenge.statFilter && (!['pts', 'usgPct', 'threePtAttempts'].includes(challenge.statFilter.stat)
    || !['lt', 'lte', 'gte'].includes(challenge.statFilter.operator) || !Number.isFinite(challenge.statFilter.value)))
    throw new Error('Invalid Daily stat filter.');
  if (challenge.rerolls && [challenge.rerolls.team, challenge.rerolls.era].some((count) => count !== 0 && count !== 1))
    throw new Error('Invalid Daily reroll allowance.');
  const fixed = challengeFixedPlayers(challenge);
  const fixedIdentities = new Set<string>();
  const fixedSlots = new Set<DraftSlot>();
  for (const entry of fixed) {
    const player = players.find((candidate) => candidate.id === entry.id);
    if (!player || !DRAFT_SLOTS.includes(entry.slot) || (entry.slot !== 'SIXTH' && !player.eligiblePositions.includes(entry.slot))
      || fixedIdentities.has(playerIdentity(player)) || fixedSlots.has(entry.slot)) throw new Error('Invalid Daily fixed player.');
    fixedIdentities.add(playerIdentity(player));
    fixedSlots.add(entry.slot);
  }
  if (fixed.length >= DRAFT_SLOTS.length) throw new Error('Daily must leave a player to draft.');
  const pool = challengePlayers(challenge, players).filter((player) => !fixedIdentities.has(playerIdentity(player)));
  const slots = DRAFT_SLOTS.filter((slot) => !fixedSlots.has(slot));
  for (const slot of slots) {
    const identities = new Set(pool.filter((player) => slot === 'SIXTH' || player.eligiblePositions.includes(slot)).map(playerIdentity));
    if (identities.size < slots.length) throw new Error(`Daily pool cannot guarantee completion at ${slot}.`);
  }
}

export function rotationDate(dayIndex: number): string {
  if (!Number.isSafeInteger(dayIndex)) throw new Error('Invalid Daily day index.');
  return new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00.000Z`) + dayIndex * DAY_MS).toISOString().slice(0, 10);
}

function rotationDayIndex(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('Invalid Daily date.');
  return (timestamp - Date.parse(`${DAILY_ROTATION_START}T00:00:00.000Z`)) / DAY_MS;
}

function shuffledCycle(cycle: number): DailyChallenge[] {
  const pool = [...DAILY_CALENDAR].sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
  return shuffle(pool, randomStream(`${DAILY_ROTATION_VERSION}:${DAILY_ROTATION_START}:${cycle}`, 'daily-cycle').next);
}

export function rotationCycle(cycle: number): readonly DailyChallenge[] {
  if (!Number.isSafeInteger(cycle) || cycle < 0) throw new Error('Invalid Daily cycle.');
  const order = shuffledCycle(cycle);
  if (cycle > 0 && order[0]!.id === shuffledCycle(cycle - 1).at(-1)!.id)
    [order[0], order[1]] = [order[1]!, order[0]!];
  return order;
}

export function rotatingChallengeForDate(date: string): DailyChallenge | null {
  const dayIndex = rotationDayIndex(date);
  if (dayIndex < 0) return null;
  return rotationCycle(Math.floor(dayIndex / DAILY_CALENDAR.length))[dayIndex % DAILY_CALENDAR.length]!;
}

export function rotationSchedule(date: string): readonly { date: string; challenge: DailyChallenge }[] {
  const dayIndex = Math.max(0, rotationDayIndex(date));
  const cycle = Math.floor(dayIndex / DAILY_CALENDAR.length);
  return rotationCycle(cycle).map((challenge, index) => ({ date: rotationDate(cycle * DAILY_CALENDAR.length + index), challenge }));
}