import { DRAFT_SLOTS } from './draft.ts';
import type { RunSave } from './run.ts';
import type { IQMode, PostseasonResult } from './types.ts';

export interface RunSummary {
  id: string;
  completedAt: number;
  mode: IQMode;
  engineVersion: string;
  coach: { name: string; systemName: string };
  lineup: { slot: string; id: string; name: string; franchise: string; decade: string }[];
  daily: { date: string; kind: 'local' | 'practice' } | null;
  season: { wins: number; losses: number; differential: number; streak: number };
  postseason: Pick<PostseasonResult, 'playIn' | 'playoffs' | 'champion' | 'isPerfectRun' | 'eliminatedRound'> | null;
  postseasonStatus: 'pending' | 'missed' | 'complete';
}

export interface Progress {
  version: 1;
  almanacUnlocked: boolean;
  runs: RunSummary[];
  bests: Partial<Record<IQMode, { record: RunSummary; differential: RunSummary; streak: RunSummary }>>;
}

export function emptyProgress(): Progress {
  return { version: 1, almanacUnlocked: false, runs: [], bests: {} };
}

export function summarizeRun(run: RunSave, completedAt: number, postseasonRevealed: boolean): RunSummary | null {
  if (!run.season || run.season.gameLog.length !== 82 || !run.frozenLineup?.coach) return null;
  const postseason = postseasonRevealed ? run.postseason : undefined;
  return {
    id: run.id, completedAt, mode: run.iqMode ?? 'mid', engineVersion: run.engineVersion,
    coach: { name: run.frozenLineup.coach.name, systemName: run.frozenLineup.coach.systemName },
    lineup: DRAFT_SLOTS.map((slot) => {
      const player = run.frozenLineup![slot]!;
      return { slot, id: player.id, name: player.name, franchise: player.franchise, decade: player.decade };
    }),
    daily: run.daily ? { date: run.daily.date, kind: run.daily.kind } : null,
    season: { wins: run.season.wins, losses: run.season.losses, differential: run.season.pointDifferential, streak: run.season.longestStreak },
    postseason: postseason ? { playIn: postseason.playIn, playoffs: postseason.playoffs, champion: postseason.champion,
      isPerfectRun: postseason.isPerfectRun, eliminatedRound: postseason.eliminatedRound } : null,
    postseasonStatus: !run.season.qualified ? 'missed' : postseason ? 'complete' : 'pending',
  };
}

export function recordProgress(progress: Progress, run: RunSave, seasonRevealed: boolean, postseasonRevealed: boolean, now = Date.now()): Progress {
  const summary = summarizeRun(run, now, postseasonRevealed);
  if (!summary) return progress;
  if (!seasonRevealed) return progress.almanacUnlocked ? progress : { ...progress, almanacUnlocked: true };
  const existing = progress.runs.find((entry) => entry.id === summary.id);
  if (existing) {
    summary.completedAt = existing.completedAt;
    if (existing.postseasonStatus === 'complete') {
      summary.postseason = existing.postseason;
      summary.postseasonStatus = 'complete';
    }
  }
  const best = progress.bests[summary.mode];
  const choose = (previous: RunSummary | undefined, metric: 'wins' | 'differential' | 'streak') => {
    if (!previous || previous.id === summary.id || summary.season[metric] > previous.season[metric]) return summary;
    return previous;
  };
  const next: Progress = {
    version: 1, almanacUnlocked: true,
    runs: [summary, ...progress.runs.filter((entry) => entry.id !== summary.id)]
      .sort((first, second) => second.completedAt - first.completedAt).slice(0, 50),
    bests: { ...progress.bests, [summary.mode]: {
      record: choose(best?.record, 'wins'), differential: choose(best?.differential, 'differential'), streak: choose(best?.streak, 'streak'),
    } },
  };
  return JSON.stringify(next) === JSON.stringify(progress) ? progress : next;
}

export function resultText(result: RunSummary): string {
  const postseason = result.postseason;
  const status = postseason?.isPerfectRun ? '98-0 PERFECT RUN' : postseason?.champion ? 'CHAMPION' : result.postseasonStatus === 'missed'
    ? 'MISSED POSTSEASON' : result.postseasonStatus === 'pending' ? 'POSTSEASON PENDING' : `ELIMINATED / ${postseason?.eliminatedRound}`;
  return [
    `98-0 / ${result.mode.toUpperCase()} IQ`,
    ...(result.daily ? [`DAILY ${result.daily.date} UTC / ${result.daily.kind.toUpperCase()}`] : []),
    status,
    `Regular season: ${result.season.wins}-${result.season.losses} / DIFF ${result.season.differential > 0 ? '+' : ''}${result.season.differential} / BEST STREAK ${result.season.streak}`,
    ...(postseason ? [`Play-in: ${postseason.playIn.wins}-${postseason.playIn.losses}`, `Playoffs: ${postseason.playoffs.wins}-${postseason.playoffs.losses}`] : []),
    `Coach: ${result.coach.name} / ${result.coach.systemName}`,
    ...result.lineup.map((player) => `${player.slot === 'SIXTH' ? '6TH' : player.slot}: ${player.name} / ${player.franchise} / ${player.decade}`),
    'LOCAL RESULT / NOT VERIFIED / NOT A RANKING',
    'Play 98-0: https://98-0.vercel.app',
  ].join('\n');
}