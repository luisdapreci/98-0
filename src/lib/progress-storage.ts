import { emptyProgress, recordProgress } from '../engine/progress';
import type { Progress, RunSummary } from '../engine/progress';
import type { RunSave } from '../engine/run';

export const PROGRESS_STORAGE_KEY = '98-0-progress-v1';

function isSummary(value: unknown): value is RunSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as RunSummary;
  const record = (value: { wins: number; losses: number } | undefined) => !!value
    && Number.isInteger(value.wins) && value.wins >= 0 && Number.isInteger(value.losses) && value.losses >= 0;
  return typeof summary.id === 'string' && Number.isFinite(summary.completedAt)
    && ['no', 'mid', 'hi'].includes(summary.mode) && typeof summary.engineVersion === 'string'
    && typeof summary.coach?.name === 'string' && typeof summary.coach?.systemName === 'string'
    && Array.isArray(summary.lineup) && summary.lineup.length === 6
    && summary.lineup.every((player) => player && ['slot', 'id', 'name', 'franchise', 'decade'].every((key) => typeof player[key as keyof typeof player] === 'string'))
    && record(summary.season) && summary.season.wins + summary.season.losses === 82
    && Number.isFinite(summary.season.differential) && Number.isInteger(summary.season.streak)
    && (summary.daily === null || (!!summary.daily && /^\d{4}-\d{2}-\d{2}$/.test(summary.daily.date) && ['local', 'practice'].includes(summary.daily.kind)))
    && ['pending', 'missed', 'complete'].includes(summary.postseasonStatus)
    && (summary.postseasonStatus === 'complete'
      ? !!summary.postseason && record(summary.postseason.playIn) && record(summary.postseason.playoffs)
        && typeof summary.postseason.champion === 'boolean' && typeof summary.postseason.isPerfectRun === 'boolean'
        && (summary.postseason.eliminatedRound === null || ['playIn', 'round1', 'round2', 'conferenceFinals', 'finals'].includes(summary.postseason.eliminatedRound))
      : summary.postseason === null);
}

export function readProgress(): Progress {
  const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (raw === null) return emptyProgress();
  const saved = JSON.parse(raw) as Progress;
  if (!saved || saved.version !== 1 || typeof saved.almanacUnlocked !== 'boolean'
    || !Array.isArray(saved.runs) || saved.runs.length > 50 || !saved.runs.every(isSummary)
    || !saved.bests || typeof saved.bests !== 'object' || Array.isArray(saved.bests)
    || Object.entries(saved.bests).some(([mode, best]) => !['no', 'mid', 'hi'].includes(mode) || !best
      || ![best.record, best.differential, best.streak].every((summary) => isSummary(summary) && summary.mode === mode))) {
    throw new Error('Saved progress is unreadable. Existing data has not been cleared.');
  }
  return saved;
}

export async function saveProgress(run: RunSave | null, seasonRevealed: boolean, postseasonRevealed: boolean): Promise<Progress> {
  const update = () => {
    const previous = readProgress();
    const next = run ? recordProgress(previous, run, seasonRevealed, postseasonRevealed) : previous;
    if (next !== previous) localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    return next;
  };
  return navigator.locks ? navigator.locks.request(PROGRESS_STORAGE_KEY, update) : update();
}