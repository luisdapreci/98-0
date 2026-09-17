import { calculateWinProbability } from './math.ts';
import { evaluateGame } from './iq-math.ts';
import type { BalanceRules } from './iq-math.ts';
import { randomStream, shuffle } from './random.ts';
import { rivalryEvidence } from './rivalry.ts';
import { requireCompleteLineup, sampleOutcome } from './season.ts';
import type { ScoreRules } from './season.ts';
import type { PlayoffPool, PlayoffRound, PostseasonEntry, PostseasonGame, PostseasonResult, SeasonResult, TeamLineup } from './types.ts';

export const POSTSEASON_VERSION = 'postseason-1';
export const PLAYOFF_ROUNDS: readonly PlayoffRound[] = ['playIn', 'round1', 'round2', 'conferenceFinals', 'finals'];
export const ROUND_LABELS: Record<PlayoffRound, string> = {
  playIn: 'PLAY-IN', round1: 'ROUND 1', round2: 'ROUND 2', conferenceFinals: 'CONFERENCE FINALS', finals: 'FINALS',
};
export const ROUND_MULTIPLIERS: Record<PlayoffRound, number> = {
  playIn: 0.9, round1: 1, round2: 1.05, conferenceFinals: 1.1, finals: 1.15,
};

export function playoffVenue(entry: PostseasonEntry, wins: number, round: PlayoffRound, seriesGame: number) {
  if (entry === 'MISSED' || !Number.isInteger(seriesGame) || seriesGame < 1 || seriesGame > (round === 'playIn' ? 1 : 7))
    throw new Error('Invalid postseason venue request.');
  const favored = entry === 'FIRST_SEED' || entry === 'SECOND_SEED';
  const sequence = favored ? [true, true, false, false, true, false, true] : [false, false, true, true, false, true, false];
  const isHome = round !== 'playIn' && sequence[seriesGame - 1]!;
  return { isHome, seedHomeBonus: isHome && entry === 'FIRST_SEED' ? wins === 82 ? 2 : 1 : 0 };
}

export function drawPostseasonPath(pool: PlayoffPool, entry: PostseasonEntry, seed: string): PostseasonResult['path'] {
  if (entry === 'MISSED') throw new Error('This season did not qualify.');
  const rounds = PLAYOFF_ROUNDS.slice(entry === 'PLAY_IN' ? 0 : 1);
  const candidates = rounds.map((round) => {
    const opponents = pool[round];
    if (!opponents?.length || opponents.some((opponent) => !opponent.id || !opponent.franchise || !Number.isFinite(opponent.netRating)))
      throw new Error(`Invalid postseason pool: ${round}.`);
    return shuffle([...opponents], randomStream(seed, `${POSTSEASON_VERSION}/path/${round}`).next);
  });
  const path: PostseasonResult['path'] = [];
  const used = new Set<string>();
  function visit(index: number): boolean {
    if (index === rounds.length) return true;
    for (const opponent of candidates[index]!) {
      if (used.has(opponent.id)) continue;
      used.add(opponent.id);
      path.push({ round: rounds[index]!, opponent: { ...opponent } });
      if (visit(index + 1)) return true;
      path.pop();
      used.delete(opponent.id);
    }
    return false;
  }
  if (!visit(0)) throw new Error('No complete no-repeat postseason path exists.');
  return path;
}

export function simulatePostseason(lineup: TeamLineup, pool: PlayoffPool, seed: string, season: SeasonResult,
  scoreRules: ScoreRules, balance: BalanceRules, rivalries = false): PostseasonResult {
  requireCompleteLineup(lineup);
  if (!season.qualified || season.postseasonEntry === 'MISSED' || season.gameLog.length !== 82)
    throw new Error('A completed qualifying regular season is required.');
  const result: PostseasonResult = {
    version: POSTSEASON_VERSION, entry: season.postseasonEntry,
    path: drawPostseasonPath(pool, season.postseasonEntry, seed), series: [],
    playIn: { wins: 0, losses: 0 }, playoffs: { wins: 0, losses: 0 },
    champion: false, isPerfectRun: false, eliminatedRound: null, gameLog: [],
  };
  for (const { round, opponent } of result.path) {
    const series = { round, opponent, wins: 0, losses: 0, advanced: false, gameLog: [] as PostseasonGame[] };
    const needed = round === 'playIn' ? 1 : 4;
    while (series.wins < needed && series.losses < needed) {
      const seriesGame = series.gameLog.length + 1;
      const { isHome, seedHomeBonus } = playoffVenue(result.entry, season.wins, round, seriesGame);
      const opponentMultiplier = ROUND_MULTIPLIERS[round];
      const context = { opponentNetRating: opponent.netRating * opponentMultiplier, isHome, isBackToBack: false };
      const base = evaluateGame(lineup, context, balance);
      const deltaRating = base.deltaRating + seedHomeBonus;
      const evaluation = { ...base, deltaRating, winProbability: calculateWinProbability(deltaRating) };
      const stream = `${POSTSEASON_VERSION}/${round}/${seriesGame}`;
      const outcome = sampleOutcome(evaluation, randomStream(seed, `${stream}/outcome`).next,
        randomStream(seed, `${stream}/score`).next, scoreRules);
      const game: PostseasonGame = {
        ...outcome, opponent: { ...opponent }, round, seriesGame, opponentMultiplier, seedHomeBonus,
        gameNumber: result.gameLog.length + 1, day: season.gameLog.at(-1)!.day + 2 * (result.gameLog.length + 1),
        isHome, isBackToBack: false, pairId: null, leg: null, context, evaluation,
        ...(rivalries ? { rivalry: rivalryEvidence(lineup, opponent.franchise) } : {}),
      };
      series.gameLog.push(game);
      result.gameLog.push(game);
      const record = round === 'playIn' ? result.playIn : result.playoffs;
      if (game.won) { series.wins++; record.wins++; }
      else { series.losses++; record.losses++; }
    }
    series.advanced = series.wins === needed;
    result.series.push(series);
    if (!series.advanced) { result.eliminatedRound = round; break; }
  }
  result.champion = result.playoffs.wins === 16;
  result.isPerfectRun = season.wins === 82 && season.losses === 0 && result.entry !== 'PLAY_IN'
    && result.champion && result.playoffs.losses === 0;
  return result;
}