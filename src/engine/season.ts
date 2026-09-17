import { DRAFT_SLOTS, playerIdentity } from './draft.ts';
import { BALANCE_RULES_V1, SIGMOID_WIDTH } from './math.ts';
import { evaluateGame } from './iq-math.ts';
import type { BalanceRules } from './iq-math.ts';
import { randomStream, shuffle } from './random.ts';
import type {
  GameEvaluation, GameOutcome, GameScore, OpponentPool, OpponentTier,
  PostseasonEntry, ScheduleEntry, SeasonGame, SeasonResult, TeamLineup,
} from './types.ts';

export const SCHEDULE_COUNTS = { CONTENDER: 15, PLAYOFF: 25, AVERAGE: 30, LOTTERY: 12 } as const;
export const SCORE_RULES_V1 = {
  version: 'conditional-score-1',
  baseline: 112,
  baselineSpread: 20,
  regulationScale: 10.5,
  regulationOffset: 0,
  maxMargin: 70,
  overtimeProbability: 0.06,
  overtimeScale: 3,
  overtimeMaxMargin: 12,
  overtimeBaseline: 10,
  overtimeSpread: 6,
  overtimeContinuation: 0.12,
  maxOvertimePeriods: 3,
} as const;

export type ScoreRules = { [Key in keyof typeof SCORE_RULES_V1]: Key extends 'version' ? string : number };
export const SCORE_RULES_V3 = {
  version: 'conditional-score-3',
  baseline: 113.445132,
  baselineSpread: 24.044916,
  regulationScale: 8,
  regulationOffset: 1,
  maxMargin: 100,
  overtimeProbability: 0.052149,
  overtimeScale: 3,
  overtimeMaxMargin: 30,
  overtimeBaseline: 9.477421,
  overtimeSpread: 6,
  overtimeContinuation: 0.119403,
  maxOvertimePeriods: 6,
} as const satisfies ScoreRules;
export const SCORE_RULES: ScoreRules = SCORE_RULES_V3;

export function generateSchedule(seed: string, pool: OpponentPool): ScheduleEntry[] {
  const opponentRandom = randomStream(seed, 'schedule/opponents').next;
  const opponents = shuffle(
    (Object.entries(SCHEDULE_COUNTS) as [OpponentTier, number][]).flatMap(([tier, count]) => {
      const choices = pool[tier];
      if (!choices?.length || choices.some((opponent) =>
        opponent.tier !== tier || !Number.isFinite(opponent.netRating)))
        throw new Error(`Invalid ${tier} opponent pool.`);
      return Array.from({ length: count }, () => choices[Math.floor(opponentRandom() * choices.length)]!);
    }),
    opponentRandom,
  );
  const venues = shuffle(Array.from({ length: 82 }, (_, index) => index < 41),
    randomStream(seed, 'schedule/venues').next);
  const blocks = shuffle([
    ...Array.from({ length: 14 }, (_, index) => index + 1),
    ...Array<number | null>(54).fill(null),
  ], randomStream(seed, 'schedule/blocks').next);
  const schedule: ScheduleEntry[] = [];
  let day = 1;
  for (const pairId of blocks) {
    for (let leg = 1; leg <= (pairId === null ? 1 : 2); leg++) {
      const index = schedule.length;
      schedule.push({
        gameNumber: index + 1,
        opponent: { ...opponents[index]! },
        isHome: venues[index]!,
        isBackToBack: leg === 2,
        day,
        pairId,
        leg: pairId === null ? null : leg as 1 | 2,
      });
      day += leg === 1 && pairId !== null ? 1 : 2;
    }
  }
  return schedule;
}

function draw(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Random value must be in [0, 1).');
  return value;
}

function conditionalMargin(delta: number, scale: number, limit: number, random: () => number, offset = 0): number {
  const quantile = draw(random);
  const logOdds = delta / scale + Math.log(quantile);
  const softplus = Math.max(0, logOdds) + Math.log1p(Math.exp(-Math.abs(logOdds)));
  const magnitude = scale * (softplus - Math.log1p(-quantile));
  return Math.max(1, Math.min(limit, Math.round(magnitude) + offset));
}

function baseline(center: number, spread: number, random: () => number): number {
  return Math.round(center + spread * (draw(random) - draw(random)));
}

function scoreAround(center: number, margin: number, won: boolean): GameScore {
  const low = Math.max(0, center - Math.floor(margin / 2));
  return won ? { userScore: low + margin, oppScore: low } : { userScore: low, oppScore: low + margin };
}

export function sampleOutcome(
  evaluation: Pick<GameEvaluation, 'winProbability' | 'deltaRating'>,
  outcomeRandom: () => number,
  scoreRandom: () => number,
  rules: ScoreRules = SCORE_RULES,
): GameOutcome {
  const { winProbability, deltaRating } = evaluation;
  if (!Number.isFinite(deltaRating) || !Number.isFinite(winProbability)
    || winProbability < 0 || winProbability > 1) throw new Error('Invalid game evaluation.');
  const won = draw(outcomeRandom) < winProbability;
  const overtimeChance = rules.overtimeProbability * 4 * winProbability * (1 - winProbability);
  const isOvertime = draw(scoreRandom) < overtimeChance;
  const center = baseline(rules.baseline, rules.baselineSpread, scoreRandom);
  const selectedDelta = won ? deltaRating : -deltaRating;
  const overtime: GameScore[] = [];
  let regulation: GameScore;
  if (isOvertime) {
    regulation = { userScore: center, oppScore: center };
    for (let period = 1; period <= rules.maxOvertimePeriods; period++) {
      const continues = period < rules.maxOvertimePeriods
        && draw(scoreRandom) < rules.overtimeContinuation;
      const periodCenter = baseline(rules.overtimeBaseline, rules.overtimeSpread, scoreRandom);
      if (continues) overtime.push({ userScore: periodCenter, oppScore: periodCenter });
      else {
        const margin = conditionalMargin(selectedDelta * 5 / 48, rules.overtimeScale,
          rules.overtimeMaxMargin, scoreRandom);
        overtime.push(scoreAround(periodCenter, margin, won));
        break;
      }
    }
  } else {
    const margin = conditionalMargin(selectedDelta * (rules.regulationScale / SIGMOID_WIDTH),
      rules.regulationScale, rules.maxMargin, scoreRandom, rules.regulationOffset);
    regulation = scoreAround(center, margin, won);
  }
  const final = overtime.reduce((total, period) => ({
    userScore: total.userScore + period.userScore,
    oppScore: total.oppScore + period.oppScore,
  }), regulation);
  const margin = final.userScore - final.oppScore;
  return {
    ...final, won, margin, regulation, overtime,
    events: [...(isOvertime ? ['OVERTIME' as const] : []),
      ...(Math.abs(margin) === 1 ? ['ONE_POINT_FINISH' as const] : [])],
  };
}

export function postseasonEntry(wins: number): PostseasonEntry {
  if (wins < 60) return 'MISSED';
  if (wins < 65) return 'PLAY_IN';
  if (wins < 70) return 'FOURTH_SEED';
  if (wins < 75) return 'SECOND_SEED';
  return 'FIRST_SEED';
}

export function aggregateSeason(gameLog: SeasonGame[]): SeasonResult {
  let wins = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let pointDifferential = 0;
  let firstLoss: number | null = null;
  for (const game of gameLog) {
    pointDifferential += game.userScore - game.oppScore;
    if (game.won) {
      wins++;
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
      firstLoss ??= game.gameNumber;
    }
  }
  return {
    wins, losses: gameLog.length - wins, pointDifferential, currentStreak, longestStreak, firstLoss,
    isUndefeated: gameLog.length === 82 && wins === 82,
    qualified: gameLog.length === 82 && wins >= 60,
    postseasonEntry: gameLog.length === 82 ? postseasonEntry(wins) : 'MISSED',
    gameLog,
  };
}

export function requireCompleteLineup(lineup: TeamLineup): void {
  const identities = new Set<string>();
  for (const slot of DRAFT_SLOTS) {
    const player = lineup[slot];
    if (!player || (slot !== 'SIXTH' && !player.eligiblePositions.includes(slot))
      || identities.has(playerIdentity(player))) throw new Error('A legal six-player lineup is required.');
    identities.add(playerIdentity(player));
  }
  if (!lineup.coach) throw new Error('A selected coach is required.');
}

export function simulateSeason(lineup: TeamLineup, pool: OpponentPool, seed: string, rules: ScoreRules = SCORE_RULES, balance: BalanceRules = BALANCE_RULES_V1): SeasonResult {
  requireCompleteLineup(lineup);
  const gameLog = generateSchedule(seed, pool).map((entry): SeasonGame => {
    const context = {
      opponentNetRating: entry.opponent.netRating,
      isHome: entry.isHome,
      isBackToBack: entry.isBackToBack,
    };
    const evaluation = evaluateGame(lineup, context, balance);
    const outcome = sampleOutcome(evaluation,
      randomStream(seed, `outcome/${entry.gameNumber}`).next,
      randomStream(seed, `score/${entry.gameNumber}`).next, rules);
    return { ...entry, ...outcome, context, evaluation };
  });
  return aggregateSeason(gameLog);
}