import { DAILY_MODE, dailyCommitmentKey, dailySeed, dailyStatus, validateDailyAttempt } from '../engine/daily';
import type { DailyEntry } from '../engine/daily';
import type { RunSave } from '../engine/run';

export const DAILY_STORAGE_KEY = '98-0-daily-v1';

export function readDailyEntries(): DailyEntry[] {
  const raw = localStorage.getItem(DAILY_STORAGE_KEY);
  if (raw === null) return [];
  const entries: DailyEntry[] = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('Daily records are invalid.');
  const identities = new Set<string>();
  const dates = new Set<string>();
  for (const entry of entries) {
    validateDailyAttempt(entry.attempt);
    if (identities.has(entry.attempt.attemptId)) throw new Error('Duplicate Daily attempt.');
    identities.add(entry.attempt.attemptId);
    if (entry.attempt.kind === 'local') {
      const key = dailyCommitmentKey(entry.attempt);
      if (dates.has(key)) throw new Error('Duplicate Daily date.');
      dates.add(key);
    }
    const result = entry.result;
    if (!result) continue;
    if (JSON.stringify(result.attempt) !== JSON.stringify(entry.attempt)
      || result.seed !== dailySeed(entry.attempt.date, entry.attempt.version) || result.iqMode !== DAILY_MODE
      || result.status !== dailyStatus(entry.attempt, result.completedAt)
      || !Number.isInteger(result.wins) || result.wins < 0 || result.wins > 82
      || !Number.isInteger(result.pointDifferential) || Math.abs(result.pointDifferential) > 8200
      || !Number.isInteger(result.longestWinStreak) || result.longestWinStreak < 0 || result.longestWinStreak > result.wins)
      throw new Error('Invalid Daily result.');
  }
  return entries;
}

export function writeDailyEntries(entries: DailyEntry[]): void {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(entries));
}

export function recordDailyResult(run: RunSave): DailyEntry[] {
  const entries = readDailyEntries();
  if (!run.daily || !run.season) return entries;
  const entry = entries.find((candidate) => candidate.attempt.attemptId === run.daily!.attemptId);
  if (!entry) throw new Error('The original Daily commitment is missing. Local results cannot be recorded.');
  if (!entry.result) {
    const completedAt = Date.now();
    entry.result = {
      attempt: entry.attempt, seed: run.seed, iqMode: DAILY_MODE, completedAt,
      status: dailyStatus(entry.attempt, completedAt), wins: run.season.wins,
      pointDifferential: run.season.pointDifferential, longestWinStreak: run.season.longestStreak,
    };
    writeDailyEntries(entries);
  }
  return entries;
}