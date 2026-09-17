import { DRAFT_SLOTS, rollOptions } from './draft.ts';
import type { DraftState, RerollKind } from './draft.ts';
import { DATA_VERSION, RANDOM_VERSION, randomStream, shuffle } from './random.ts';
import { QUALIFICATION_45_ENGINE_VERSION } from './engine-versions.ts';
import type { Player } from './types.ts';
import { challengeForDate, DAILY_CALENDAR_VERSION } from './daily-calendar.ts';
import type { DailyChallenge } from './daily-calendar.ts';

export const DAILY_VERSION = 'daily-2';
export const DAILY_MODE = 'mid';
const DAY_MS = 86_400_000;

interface DailyAttemptBase {
  date: string;
  startedAt: number;
  kind: 'local' | 'practice';
  attemptId: string;
}

export type DailyAttempt = DailyAttemptBase & ({ version: 'daily-1' } | {
  version: typeof DAILY_VERSION;
  calendarVersion: typeof DAILY_CALENDAR_VERSION;
  challengeId: string;
});

export interface DailyRecord {
  attempt: DailyAttempt;
  seed: string;
  iqMode: typeof DAILY_MODE;
  completedAt: number;
  status: 'local' | 'practice' | 'late';
  wins: number;
  pointDifferential: number;
  longestWinStreak: number;
}

export interface DailyEntry {
  attempt: DailyAttempt;
  result?: DailyRecord;
}

export function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function dailySeed(date: string, version: DailyAttempt['version'] = DAILY_VERSION): string {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || utcDate(start) !== date)
    throw new Error('Invalid Daily date.');
  if (version !== 'daily-1' && version !== DAILY_VERSION) throw new Error('Unsupported Daily version.');
  const challenge = version === DAILY_VERSION ? challengeForDate(date) : null;
  if (version === DAILY_VERSION && !challenge) throw new Error('No Daily challenge is published for this date.');
  return [version, date, DAILY_MODE, 'iq-1', QUALIFICATION_45_ENGINE_VERSION,
    DATA_VERSION, RANDOM_VERSION, 'conditional-score-3', 'rivalry-1',
    ...(challenge ? [DAILY_CALENDAR_VERSION, challenge.id] : [])].join(':');
}

export function challengeForAttempt(attempt: DailyAttempt): DailyChallenge | null {
  if (attempt.version === 'daily-1') return null;
  const challenge = challengeForDate(attempt.date);
  if (attempt.version !== DAILY_VERSION || attempt.calendarVersion !== DAILY_CALENDAR_VERSION
    || !challenge || attempt.challengeId !== challenge.id) throw new Error('Invalid Daily challenge.');
  return challenge;
}

export function validateDailyAttempt(attempt: DailyAttempt): void {
  dailySeed(attempt.date, attempt.version);
  challengeForAttempt(attempt);
  if (!['local', 'practice'].includes(attempt.kind)
    || !Number.isSafeInteger(attempt.startedAt) || !attempt.attemptId || attempt.attemptId.length > 200
    || (attempt.kind === 'local' && utcDate(attempt.startedAt) !== attempt.date))
    throw new Error('Invalid Daily attempt.');
}

export function dailyStatus(attempt: DailyAttempt, completedAt: number): DailyRecord['status'] {
  validateDailyAttempt(attempt);
  if (!Number.isSafeInteger(completedAt) || completedAt < attempt.startedAt)
    throw new Error('Invalid Daily completion time.');
  if (attempt.kind === 'practice') return 'practice';
  return completedAt < Date.parse(`${attempt.date}T00:00:00.000Z`) + 2 * DAY_MS ? 'local' : 'late';
}

export function dailyPriorities(seed: string, round: number, action: 'spin' | RerollKind, players: readonly Player[]) {
  const franchises = [...new Set(players.map((player) => player.franchise))].sort();
  const decades = [...new Set(players.map((player) => player.decade))].sort();
  return {
    franchises: shuffle(franchises, randomStream(seed, `daily:${round}:${action}:team`).next),
    decades: shuffle(decades, randomStream(seed, `daily:${round}:${action}:era`).next),
  };
}

export function dailyRoll(state: DraftState, players: readonly Player[], seed: string, kind?: RerollKind): DraftState {
  if (!kind && (state.phase !== 'DRAFT' || state.roll)) throw new Error('Draft the current roll before spinning again.');
  const round = DRAFT_SLOTS.filter((slot) => state.lineup[slot]).length + 1;
  const priorities = dailyPriorities(seed, round, kind ?? 'spin', players);
  const options = rollOptions(state, players, kind);
  options.sort((first, second) => priorities.franchises.indexOf(first.franchise) - priorities.franchises.indexOf(second.franchise)
    || priorities.decades.indexOf(first.decade) - priorities.decades.indexOf(second.decade));
  const roll = options[0];
  if (!roll) {
    if (kind) return state;
    throw new Error('No playable Daily options remain.');
  }
  return { ...state, roll, rerolls: kind ? { ...state.rerolls, [kind]: state.rerolls[kind] - 1 } : state.rerolls };
}

export function compareDailyRecords(first: DailyRecord, second: DailyRecord): number {
  if (first.seed !== second.seed || first.iqMode !== second.iqMode) throw new Error('Different Daily challenges cannot share a ranking.');
  return second.wins - first.wins || second.pointDifferential - first.pointDifferential
    || second.longestWinStreak - first.longestWinStreak;
}