import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { availablePlayers, availableSlots, DRAFT_SLOTS, rollOptions } from './draft.ts';
import type { DraftSlot } from './draft.ts';
import { chooseLookaheadAction, expectedSeasonWins, LOOKAHEAD_RULES, projectedChemistry } from './draft-strategy.ts';
import { BALANCE_RULES_V1, BALANCE_RULES_V2, calculateDefensiveComposite, calculateSixthManFRF, calculateSynergy } from './math.ts';
import { DATA_VERSION, ENGINE_VERSION, randomStream } from './random.ts';
import { applyDraftAction, createRun, finishSeason, startSeason } from './run.ts';
import type { RunData, RunSave } from './run.ts';
import { sampleOutcome, SCORE_RULES as RELEASED_SCORE_RULES, SCORE_RULES_V1 } from './season.ts';
import type { Player, TeamLineup } from './types.ts';

const data: RunData = {
  players: JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')),
  coaches: JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')),
  opponents: JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool,
};
const sampleSize = Number(process.argv[2] ?? 300);
assert.ok(Number.isInteger(sampleSize) && sampleSize >= 20 && sampleSize <= 10000);
const strategyVersion = 'legal-greedy-1';
const allStrategies = ['random', 'chemistry', 'reroll-aware', 'balanced', 'overloaded', 'non-shooting', 'defensive', 'bench-heavy', 'lookahead'] as const;
type Strategy = typeof allStrategies[number];
const strategies = process.argv[4] ? process.argv[4].split(',') as Strategy[] : [...allStrategies];
assert.ok(strategies.length && new Set(strategies).size === strategies.length
  && strategies.every((strategy) => allStrategies.includes(strategy)), 'Unknown or duplicate strategy.');
const seedPrefix = process.argv[5] ?? 'p3-baseline-';
const engineVersion = process.argv[6] ?? ENGINE_VERSION;
assert.ok(['season-1', 'season-2', 'season-3'].includes(engineVersion), 'Unknown engine version.');
const balance = engineVersion === 'season-3' ? BALANCE_RULES_V2 : BALANCE_RULES_V1;
const SCORE_RULES = engineVersion === 'season-1' ? SCORE_RULES_V1 : RELEASED_SCORE_RULES;
const chemistry = (lineup: TeamLineup) => projectedChemistry(lineup, balance);

function pickValue(player: Player, slot: DraftSlot, run: RunSave, strategy: Strategy): number {
  const lineup = { ...run.draft.lineup, [slot]: player };
  const fit = chemistry(lineup);
  if (strategy === 'overloaded') return player.stats.usgPct + player.overallRating * 0.1;
  if (strategy === 'non-shooting') return player.overallRating * 0.1 - player.stats.threePtAttempts * player.stats.threePtPct * 10;
  if (strategy === 'defensive') return calculateDefensiveComposite(player.stats) + fit * 0.05;
  if (strategy === 'bench-heavy' && slot === 'SIXTH') return calculateSixthManFRF(player.stats) * 100;
  if (strategy === 'balanced') return fit - Math.max(0, player.stats.usgPct - 24) * 0.5;
  return fit;
}

function choices(run: RunSave, strategy: Strategy) {
  const benchFirst = strategy === 'bench-heavy' && !run.draft.lineup.SIXTH;
  return availablePlayers(run.draft, data.players).flatMap((player) =>
    availableSlots(run.draft.lineup, player)
      .filter((slot) => !benchFirst || slot === 'SIXTH')
      .map((slot) => ({ player, slot, value: pickValue(player, slot, run, strategy) })))
    .sort((first, second) => second.value - first.value || first.player.id.localeCompare(second.player.id)
      || DRAFT_SLOTS.indexOf(first.slot) - DRAFT_SLOTS.indexOf(second.slot));
}

function draftStrategy(seed: string, strategy: Strategy) {
  let run = { ...createRun(seed, data.coaches), engineVersion, scoreVersion: SCORE_RULES.version };
  if (strategy === 'lookahead') {
    while (run.phase === 'DRAFTING') {
      const action = chooseLookaheadAction(run.draft, data.players, data.opponents, balance);
      const next = applyDraftAction(run, action, data.players);
      assert.notEqual(next, run);
      assert.ok(next.actions.length <= 15);
      run = next;
    }
    assert.equal(run.phase, 'DRAFT_READY');
    return finishSeason(startSeason(run), data.opponents);
  }
  const decisions = randomStream(seed, `strategy/${strategyVersion}/${strategy}`).next;
  const coach = run.draft.offers[Math.floor(decisions() * run.draft.offers.length)]!;
  run = applyDraftAction(run, { type: 'COACH', id: coach.id }, data.players);
  for (let round = 0; round < 6; round++) {
    run = applyDraftAction(run, { type: 'SPIN' }, data.players);
    let options = choices(run, strategy);
    if (strategy === 'reroll-aware') {
      for (const kind of ['team', 'era'] as const) {
        const improvement = options[0]!.value - chemistry(run.draft.lineup);
        if ((improvement < 3 || options[0]!.player.overallRating < 50)
          && rollOptions(run.draft, data.players, kind).length) {
          run = applyDraftAction(run, { type: 'REROLL', kind }, data.players);
          options = choices(run, strategy);
        }
      }
    }
    const selected = strategy === 'random' ? options[Math.floor(decisions() * options.length)]! : options[0]!;
    run = applyDraftAction(run, { type: 'PICK', id: selected.player.id, slot: selected.slot }, data.players);
  }
  assert.equal(run.phase, 'DRAFT_READY');
  return finishSeason(startSeason(run), data.opponents);
}

const rounded = (value: number) => Number(value.toFixed(4));
function meanInterval(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const radius = 1.96 * Math.sqrt(variance / values.length);
  return { mean: rounded(mean), approximate95: [rounded(mean - radius), rounded(mean + radius)] };
}
function interval(successes: number, count: number) {
  const rate = successes / count;
  const adjustment = 1.96 ** 2 / count;
  const center = (rate + adjustment / 2) / (1 + adjustment);
  const radius = 1.96 * Math.sqrt(rate * (1 - rate) / count + 1.96 ** 2 / (4 * count ** 2)) / (1 + adjustment);
  return [rounded(center - radius), rounded(center + radius)];
}
function distribution(values: number[]) {
  const ordered = [...values].sort((first, second) => first - second);
  const quantile = (fraction: number) => {
    const index = (ordered.length - 1) * fraction;
    const lower = Math.floor(index);
    return rounded(ordered[lower]! + (ordered[Math.ceil(index)]! - ordered[lower]!) * (index - lower));
  };
  return { mean: rounded(values.reduce((sum, value) => sum + value, 0) / values.length),
    min: ordered[0], p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9), p99: quantile(0.99), max: ordered.at(-1) };
}
function winsReport(values: number[]) {
  const qualified = values.filter((wins) => wins >= 60).length;
  const sorted = [...values].sort((first, second) => first - second);
  const halfWidth = 0.98 * Math.sqrt(values.length);
  return {
    count: values.length, wins: distribution(values),
    medianApprox95: [sorted[Math.max(0, Math.floor(values.length / 2 - halfWidth))],
      sorted[Math.min(values.length - 1, Math.ceil(values.length / 2 + halfWidth))]],
    qualified: qualified / values.length, qualifiedWilson95: interval(qualified, values.length),
  };
}

const strategyResults = Object.fromEntries(strategies.map((strategy) => {
  const runs = Array.from({ length: sampleSize }, (_, index) => {
    const run = draftStrategy(`${seedPrefix}${index}`, strategy);
    if (strategy === 'lookahead' && (index + 1) % 10 === 0) console.log(`lookahead: ${index + 1}/${sampleSize} drafts`);
    return run;
  });
  const byCoach: Record<string, number[]> = {};
  const byEra: Record<string, number[]> = {};
  for (const run of runs) {
    const coach = run.draft.lineup.coach!.id;
    (byCoach[coach] ??= []).push(run.season!.wins);
    const eras = new Set(DRAFT_SLOTS.map((slot) => run.draft.lineup[slot]!.decade));
    for (const era of eras) (byEra[era] ??= []).push(run.season!.wins);
  }
  const synergies = runs.map((run) => calculateSynergy(run.draft.lineup, balance));
  const observations = runs.map((run) => ({
    seed: run.seed, wins: run.season!.wins, expectedWins: expectedSeasonWins(run.draft.lineup, data.opponents, balance),
    scheduleExpectedWins: run.season!.gameLog.reduce((sum, game) => sum + game.evaluation.winProbability, 0),
    coach: run.draft.lineup.coach!.id, lineup: DRAFT_SLOTS.map((slot) => run.draft.lineup[slot]!.id),
    actions: run.actions,
  }));
  const result = {
    policyVersion: strategy === 'lookahead' ? LOOKAHEAD_RULES.version : strategyVersion,
    ...winsReport(runs.map((run) => run.season!.wins)),
    expectedWins: distribution(observations.map((run) => run.expectedWins)),
    meanExpectedWins: meanInterval(observations.map((run) => run.expectedWins)),
    winResidual: meanInterval(observations.map((run) => run.wins - run.scheduleExpectedWins)),
    observations,
    usage: distribution(synergies.map((synergy) => synergy.usgTeam)),
    spacing: distribution(synergies.map((synergy) => synergy.spacingRating)),
    defense: distribution(synergies.map((synergy) => synergy.drtgTeam)),
    benchFRF: distribution(synergies.map((synergy) => synergy.sixthManFRF)),
    byCoach: Object.fromEntries(Object.entries(byCoach).map(([coach, wins]) => [coach, winsReport(wins)])),
    byEraExposure: Object.fromEntries(Object.entries(byEra).map(([era, wins]) => [era, winsReport(wins)])),
  };
  console.log(`${strategy}: n=${sampleSize}; wins median ${result.wins.median}; qualification ${rounded(result.qualified * 100)}%; 95% CI ${result.qualifiedWilson95.map((value) => rounded(value * 100)).join('-')}%`);
  return [strategy, result];
}));

const pairedComparisons = Object.fromEntries(strategies.filter((strategy) => strategy !== 'lookahead'
  && strategies.includes('lookahead')).map((strategy) => {
  const reference = strategyResults[strategy]!.observations;
  const stronger = strategyResults.lookahead!.observations;
  return [strategy, {
    count: sampleSize,
    expectedWinDifference: meanInterval(stronger.map((run, index) => run.expectedWins - reference[index]!.expectedWins)),
    realizedWinDifference: meanInterval(stronger.map((run, index) => run.wins - reference[index]!.wins)),
    expectedWinImprovementShare: stronger.filter((run, index) => run.expectedWins > reference[index]!.expectedWins).length / sampleSize,
  }];
}));

const scoreResults = [0.05, 0.2, 0.5, 0.8, 0.95].map((winProbability) => {
  const outcome = randomStream('p3-score-baseline', `outcome/${winProbability}`).next;
  const scores = randomStream('p3-score-baseline', `score/${winProbability}`).next;
  const games = Array.from({ length: 100000 }, () => sampleOutcome({
    winProbability, deltaRating: 10.5 * Math.log(winProbability / (1 - winProbability)),
  }, outcome, scores));
  const wins = games.filter((game) => game.won).length;
  const overtime = games.filter((game) => game.overtime.length);
  const regulation = games.filter((game) => !game.overtime.length);
  const result = {
    inputProbability: winProbability, count: games.length, winRate: wins / games.length,
    winWilson95: interval(wins, games.length), overtimeRate: overtime.length / games.length,
    overtimeWilson95: interval(overtime.length, games.length),
    periodCounts: Array.from({ length: SCORE_RULES.maxOvertimePeriods }, (_, index) =>
      overtime.filter((game) => game.overtime.length === index + 1).length),
    finalScore: distribution(games.flatMap((game) => [game.userScore, game.oppScore])),
    regulationMargin: distribution(games.filter((game) => !game.overtime.length).map((game) => Math.abs(game.margin))),
    overtimeMargin: distribution(overtime.map((game) => Math.abs(game.margin))),
    cappedRegulationMargins: games.filter((game) => !game.overtime.length && Math.abs(game.margin) === SCORE_RULES.maxMargin).length,
    regulationCount: regulation.length,
    regulationWinMargin: distribution(regulation.filter((game) => game.won).map((game) => Math.abs(game.margin))),
    regulationLossMargin: distribution(regulation.filter((game) => !game.won).map((game) => Math.abs(game.margin))),
    overtimeCount: overtime.length,
    cappedOvertimeMargins: overtime.filter((game) => Math.abs(game.margin) === SCORE_RULES.overtimeMaxMargin).length,
    onePointRate: games.filter((game) => Math.abs(game.margin) === 1).length / games.length,
    thirtyPointRate: games.filter((game) => Math.abs(game.margin) >= 30).length / games.length,
    fiftyPointRate: games.filter((game) => Math.abs(game.margin) >= 50).length / games.length,
  };
  console.log(`p=${winProbability}: win=${rounded(result.winRate)}; OT=${rounded(result.overtimeRate)}; score median=${result.finalScore.median}; regulation margin median=${result.regulationMargin.median}; OT margin median=${result.overtimeMargin.median}`);
  return result;
});

const report = { engineVersion, balanceRules: balance, dataVersion: DATA_VERSION, scoreRules: SCORE_RULES,
  calibrationVersion: engineVersion === 'season-3' ? 'mid-iq-core-release-1' : 'p3-review-1', strategyVersion, lookaheadRules: LOOKAHEAD_RULES,
  seedPrefix, sampleSize, strategyResults, pairedComparisons, scoreResults };
if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });