import type { PostseasonGame, SeasonGame } from './types.ts';

export interface SeasonPlayback {
  runId: string;
  revealed: number;
  overtimePeriod: number | null;
}

export function restorePlayback(saved: unknown, runId: string, games: readonly Pick<SeasonGame, 'overtime'>[]): SeasonPlayback {
  const total = games.length;
  const fallback = { runId, revealed: 0, overtimePeriod: null };
  if (saved === undefined || saved === null) return { ...fallback, revealed: total };
  if (!saved || typeof saved !== 'object') return fallback;
  const value = saved as Partial<SeasonPlayback>;
  if (value.runId !== runId || !Number.isInteger(value.revealed) || value.revealed! < 0 || value.revealed! > total) return fallback;
  const periods = games[value.revealed!]?.overtime.length ?? 0;
  const overtimePeriod = Number.isInteger(value.overtimePeriod) && value.overtimePeriod! >= 0 && value.overtimePeriod! < periods
    ? value.overtimePeriod! : null;
  return { runId, revealed: value.revealed!, overtimePeriod };
}

export function advancePlayback(playback: SeasonPlayback, games: readonly Pick<SeasonGame, 'overtime'>[]): SeasonPlayback {
  const game = games[playback.revealed];
  if (!game) return playback;
  if (game.overtime.length > 0) {
    const period = playback.overtimePeriod === null ? 0 : playback.overtimePeriod + 1;
    if (period < game.overtime.length) return { ...playback, overtimePeriod: period };
  }
  return { ...playback, revealed: playback.revealed + 1, overtimePeriod: null };
}

export function visibleStandings<Game extends Pick<SeasonGame, 'won' | 'userScore' | 'oppScore' | 'gameNumber'>>(games: readonly Game[], revealed: number) {
  const gameLog = games.slice(0, revealed);
  let wins = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let pointDifferential = 0;
  let firstLoss: Game | null = null;
  for (const game of gameLog) {
    if (game.won) { wins++; currentStreak++; }
    else { currentStreak = 0; firstLoss ??= game; }
    longestStreak = Math.max(longestStreak, currentStreak);
    pointDifferential += game.userScore - game.oppScore;
  }
  return { gameLog, wins, losses: gameLog.length - wins, currentStreak, longestStreak, pointDifferential, firstLoss };
}

export function isPerfectSeasonChase(revealed: number, losses: number, total: number): boolean {
  return revealed >= 50 && revealed < total && losses === 0;
}

export function finishSeriesPlayback(playback: SeasonPlayback, games: readonly PostseasonGame[]): SeasonPlayback {
  const round = games[playback.revealed]?.round;
  if (!round) return playback;
  let revealed = playback.revealed;
  while (games[revealed]?.round === round) revealed++;
  return { ...playback, revealed, overtimePeriod: null };
}

export function postseasonStory(games: readonly PostseasonGame[], revealed: number, undefeated: boolean) {
  const visible = games.slice(0, revealed);
  const next = games[revealed];
  const round = next?.round ?? visible.at(-1)?.round;
  const series = visible.filter((game) => game.round === round);
  const wins = series.filter((game) => game.won).length;
  const losses = series.length - wins;
  const elimination = !!next && (round === 'playIn' || losses === 3);
  const clincher = !!next && (round === 'playIn' || wins === 3);
  const stakes = !next ? null : round === 'playIn' ? 'One game. Win to enter the bracket.'
    : wins === 3 && losses === 3 ? round === 'finals' ? 'Game 7. One game for the championship.' : 'Game 7. Win or go home.'
      : elimination ? `Down ${wins}-${losses}. Elimination game ${next.isHome ? 'at home' : 'on the road'}.`
        : clincher ? round === 'finals' ? 'Win to become champions.' : round === 'conferenceFinals' ? 'Win to reach the Finals.' : 'Win to advance.'
          : `Game ${next.seriesGame}. ${wins === losses ? `Series tied ${wins}-${losses}.` : wins > losses ? `You lead ${wins}-${losses}.` : `You trail ${wins}-${losses}.`}`;
  const moments: { round: PostseasonGame['round']; text: string }[] = [];
  for (const completedRound of new Set(visible.map((game) => game.round))) {
    const played = visible.filter((game) => game.round === completedRound);
    const victories = played.filter((game) => game.won).length;
    if (completedRound !== 'playIn' && victories === 4) {
      if (played.length === 4) moments.push({ round: completedRound, text: 'A clean sweep. Four wins, no losses.' });
      if (played.slice(0, 4).filter((game) => game.won).length === 1)
        moments.push({ round: completedRound, text: 'From 1-3 down to a series victory.' });
      if (played.length === 7) moments.push({ round: completedRound, text: 'Survived Game 7.' });
    }
    for (const game of played.filter((game) => game.won && game.overtime.length))
      moments.push({ round: completedRound, text: `Game ${game.seriesGame}: overtime escape, ${game.userScore}-${game.oppScore}.` });
  }
  const closest = visible.reduce<PostseasonGame | null>((best, game) =>
    !best || Math.abs(game.margin) < Math.abs(best.margin) ? game : best, null);
  return { round, wins, losses, stakes, elimination, clincher, moments, closest,
    seriesStart: !!next && series.length === 0,
    perfectAlive: undefeated && visible.every((game) => game.won),
    bracketWins: visible.filter((game) => game.round !== 'playIn' && game.won).length };
}

export function lossExplanations(game: Pick<SeasonGame, 'won' | 'evaluation' | 'context'>): string[] {
  if (game.won) return [];
  const { synergy, fatigueModifier, winProbability } = game.evaluation;
  const candidates = [
    {
      impact: synergy.ortgTeam * (1 - synergy.phiUsg),
      text: `Usage overload applied a ${((1 - synergy.phiUsg) * 100).toFixed(1)}% offensive penalty.`,
    },
    {
      impact: synergy.ortgTeam * synergy.phiUsg * -synergy.spacingModifier,
      text: `Poor spacing applied a ${(-synergy.spacingModifier * 100).toFixed(1)}% modifier to the whole offense.`,
    },
    {
      impact: -fatigueModifier,
      text: `This back-to-back second leg applied ${fatigueModifier.toFixed(2)} net rating from fatigue, after bench relief.`,
    },
    {
      impact: synergy.drtgTeam - 110,
      text: `Your defensive rating was ${synergy.drtgTeam.toFixed(2)}, above the 110 baseline. Lower is better.`,
    },
    {
      impact: game.context.opponentNetRating - synergy.netRating,
      text: `The opponent's base net rating exceeded yours by ${(game.context.opponentNetRating - synergy.netRating).toFixed(2)}, before game-day adjustments.`,
    },
  ];
  const explanations = candidates.filter((candidate) => candidate.impact >= 1)
    .sort((first, second) => second.impact - first.impact).slice(0, 3).map((candidate) => candidate.text);
  if (explanations.length) return explanations;
  return [winProbability > 0.5 ? 'You were favored, but upsets happen.'
    : winProbability === 0.5 ? 'The pre-game matchup was even. Either team could win.'
      : 'The pre-game matchup favored the opponent. No additional major model disadvantage was identified.'];
}