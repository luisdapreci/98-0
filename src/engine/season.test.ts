import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { availablePlayers, availableSlots, createDraft, draftPlayer, selectCoach, spinDraft } from './draft.ts';
import { calculateWinProbability, evaluateGame } from './math.ts';
import { randomStream } from './random.ts';
import { qualificationWinsForEngine, seasonForQualification } from './postseason-policy.ts';
import { aggregateSeason, generateSchedule, postseasonEntry, sampleOutcome, SCORE_RULES, simulateSeason } from './season.ts';
import type { ScoreRules } from './season.ts';
import type { Coach, GameOutcome, OpponentPool, Player } from './types.ts';

const players = JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')) as Player[];
const coaches = JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')) as Coach[];
const pool = JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool as OpponentPool;

function completeDraft() {
  const random = randomStream('fixture', 'draft').next;
  let draft = createDraft(coaches, random);
  draft = selectCoach(draft, draft.offers[0]!.id);
  for (let round = 0; round < 6; round++) {
    draft = spinDraft(draft, players, random);
    const player = availablePlayers(draft, players).find((candidate) => availableSlots(draft.lineup, candidate).length)!;
    draft = draftPlayer(draft, players, player.id, availableSlots(draft.lineup, player)[0]!);
  }
  return draft.lineup;
}

function checkScore(game: GameOutcome, rules: ScoreRules = SCORE_RULES) {
  for (const score of [game, game.regulation, ...game.overtime]) {
    for (const value of [score.userScore, score.oppScore]) assert.ok(Number.isInteger(value) && value >= 0);
  }
  assert.notEqual(game.userScore, game.oppScore);
  assert.equal(game.userScore > game.oppScore, game.won);
  assert.equal(game.margin, game.userScore - game.oppScore);
  assert.equal(game.userScore, game.regulation.userScore + game.overtime.reduce((sum, period) => sum + period.userScore, 0));
  assert.equal(game.oppScore, game.regulation.oppScore + game.overtime.reduce((sum, period) => sum + period.oppScore, 0));
  if (game.overtime.length) {
    assert.equal(game.regulation.userScore, game.regulation.oppScore);
    assert.ok(game.overtime.length <= rules.maxOvertimePeriods);
    for (const period of game.overtime.slice(0, -1)) assert.equal(period.userScore, period.oppScore);
    assert.ok(Math.abs(game.margin) <= rules.overtimeMaxMargin);
  } else assert.ok(Math.abs(game.margin) <= rules.maxMargin);
  assert.equal(game.events.includes('OVERTIME'), game.overtime.length > 0);
  assert.equal(game.events.includes('ONE_POINT_FINISH'), Math.abs(game.margin) === 1);
}

test('schedule preserves exact tiers, venues and disjoint B2Bs with rest and seeded replay', () => {
  let firstPair = false;
  let lastPair = false;
  let adjacentPairs = false;
  for (let seed = 0; seed < 100; seed++) {
    const games = generateSchedule(String(seed), pool);
    assert.equal(games.length, 82);
    assert.equal(games.filter((game) => game.isHome).length, 41);
    assert.deepEqual(Object.keys(pool).map((tier) => games.filter((game) => game.opponent.tier === tier).length), [15, 25, 30, 12]);
    assert.equal(games.filter((game) => game.isBackToBack).length, 14);
    assert.equal(games[0]!.isBackToBack, false);
    const pairs = new Map<number, typeof games>();
    for (const [index, game] of games.entries()) {
      assert.equal(game.gameNumber, index + 1);
      assert.equal(game.isBackToBack, game.leg === 2);
      if (game.pairId !== null) pairs.set(game.pairId, [...(pairs.get(game.pairId) ?? []), game]);
      else assert.equal(game.leg, null);
      if (index > 0) assert.equal(game.day - games[index - 1]!.day, game.leg === 2 ? 1 : 2);
      if (game.leg === 1 && games[index - 1]?.leg === 2) adjacentPairs = true;
    }
    assert.equal(pairs.size, 14);
    for (const pair of pairs.values()) {
      assert.equal(pair.length, 2);
      assert.deepEqual(pair.map((game) => game.leg), [1, 2]);
      assert.equal(pair[1]!.day, pair[0]!.day + 1);
      assert.equal(pair[1]!.gameNumber, pair[0]!.gameNumber + 1);
    }
    firstPair ||= games[0]!.leg === 1;
    lastPair ||= games[81]!.leg === 2;
    assert.deepEqual(generateSchedule(String(seed), pool), games);
  }
  assert.ok(firstPair && lastPair && adjacentPairs);
  assert.throws(() => generateSchedule('bad', { ...pool, LOTTERY: [] }));
  const changedPool = { ...pool, CONTENDER: pool.CONTENDER.map((opponent) => ({ ...opponent, netRating: 100 })) };
  const placement = (source: OpponentPool) => generateSchedule('independent', source).map(({ day, pairId, leg, isHome }) => ({ day, pairId, leg, isHome }));
  assert.deepEqual(placement(pool), placement(changedPool));
});

test('conditional scores preserve wins and losses for even, favored, underdog and extreme matchups', () => {
  for (const deltaRating of [-1e6, -20, 0, 20, 1e6]) {
    const winProbability = calculateWinProbability(deltaRating);
    for (const outcome of [0, 0.999999]) {
      for (const scoreDraw of [0, 0.5, 0.999999]) {
        const game = sampleOutcome({ winProbability, deltaRating }, () => outcome, () => scoreDraw);
        assert.equal(game.won, outcome < winProbability);
        checkScore(game);
      }
    }
  }
  const favoredWin = sampleOutcome({ deltaRating: 20, winProbability: calculateWinProbability(20) }, () => 0, () => 0.5);
  const upsetWin = sampleOutcome({ deltaRating: -20, winProbability: calculateWinProbability(-20) }, () => 0, () => 0.5);
  assert.ok(favoredWin.margin > upsetWin.margin);
});

test('sampled win and overtime frequencies match inputs, with deterministic score replay', () => {
  for (const winProbability of [0.2, 0.5, 0.8]) {
    const evaluation = { winProbability, deltaRating: 10.5 * Math.log(winProbability / (1 - winProbability)) };
    const outcome = randomStream('frequency', `outcome/${winProbability}`);
    const score = randomStream('frequency', `score/${winProbability}`);
    let wins = 0;
    let overtime = 0;
    for (let index = 0; index < 20000; index++) {
      const game = sampleOutcome(evaluation, outcome.next, score.next);
      wins += Number(game.won);
      overtime += Number(game.overtime.length > 0);
      checkScore(game);
    }
    assert.ok(Math.abs(wins / 20000 - winProbability) < 0.015);
    assert.ok(Math.abs(overtime / 20000 - SCORE_RULES.overtimeProbability * 4 * winProbability * (1 - winProbability)) < 0.008);
  }
});

test('a legal draft finishes all 82 games with exact aggregation and single-application ratings', () => {
  const lineup = completeDraft();
  const before = structuredClone(lineup);
  const season = simulateSeason(lineup, pool, 'full-season');
  assert.deepEqual(season, simulateSeason(lineup, pool, 'full-season'));
  assert.deepEqual(season, JSON.parse(JSON.stringify(season)));
  assert.deepEqual(lineup, before);
  assert.equal(season.wins + season.losses, 82);
  assert.equal(season.wins, season.gameLog.filter((game) => game.won).length);
  assert.equal(season.pointDifferential, season.gameLog.reduce((sum, game) => sum + game.margin, 0));
  assert.equal(season.firstLoss, season.gameLog.find((game) => !game.won)?.gameNumber ?? null);
  assert.ok(season.firstLoss !== null && season.firstLoss < 82);
  for (const game of season.gameLog) {
    checkScore(game);
    assert.deepEqual(game.evaluation, evaluateGame(lineup, game.context));
  }
  const pattern = season.gameLog.slice(0, 8).map((game, index) => ({ ...game, won: [true, true, false, true, true, true, false, true][index]! }));
  const result = aggregateSeason(pattern);
  assert.equal(result.longestStreak, 3);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.firstLoss, 3);
  assert.equal(result.isUndefeated, false);
  assert.throws(() => simulateSeason({ ...lineup, SIXTH: null }, pool, 'incomplete'));
  assert.throws(() => simulateSeason({ ...lineup, SIXTH: lineup.PG }, pool, 'duplicate'));
  const perfect = aggregateSeason(season.gameLog.map((game) => ({ ...game, won: true })));
  assert.equal(perfect.isUndefeated, true);
  assert.equal(perfect.longestStreak, 82);
  assert.equal(perfect.firstLoss, null);
});

test('qualification thresholds describe entry without claiming postseason wins', () => {
  for (const [wins, entry] of [[59, 'MISSED'], [60, 'PLAY_IN'], [64, 'PLAY_IN'], [65, 'FOURTH_SEED'],
    [69, 'FOURTH_SEED'], [70, 'SECOND_SEED'], [74, 'SECOND_SEED'], [75, 'FIRST_SEED'], [81, 'FIRST_SEED'], [82, 'FIRST_SEED']] as const)
    assert.equal(postseasonEntry(wins), entry);
});

test('historical entry qualifies at 40 only after 82 games without changing results or older rules', () => {
  const source = simulateSeason(completeDraft(), pool, 'qualification-boundaries');
  assert.equal(qualificationWinsForEngine('season-5'), 40);
  for (const version of ['season-1', 'season-2', 'season-3', 'season-4']) {
    assert.equal(qualificationWinsForEngine(version), 60);
    assert.equal(seasonForQualification(source, version), source);
  }
  for (const [wins, entry] of [[0, 'MISSED'], [39, 'MISSED'], [40, 'PLAY_IN'], [43, 'PLAY_IN'],
    [59, 'PLAY_IN'], [60, 'PLAY_IN'], [64, 'PLAY_IN'], [65, 'FOURTH_SEED'],
    [70, 'SECOND_SEED'], [75, 'FIRST_SEED'], [82, 'FIRST_SEED']] as const) {
    const legacy = aggregateSeason(source.gameLog.map((game, index) => ({ ...game, won: index < wins })));
    const before = structuredClone(legacy);
    const current = seasonForQualification(legacy, 'season-5');
    assert.equal(current.qualified, wins >= 40);
    assert.equal(current.postseasonEntry, entry);
    assert.deepEqual({ ...current, qualified: legacy.qualified, postseasonEntry: legacy.postseasonEntry }, legacy);
    assert.deepEqual(legacy, before);
    assert.equal(current.gameLog, legacy.gameLog);
  }
  const partial = aggregateSeason(source.gameLog.slice(0, 81).map((game) => ({ ...game, won: true })));
  assert.equal(seasonForQualification(partial, 'season-5').qualified, false);
  assert.equal(seasonForQualification(partial, 'season-5').postseasonEntry, 'MISSED');
});

test('score-only candidate rules preserve every winner and keep conditional matchup ordering', () => {
  const candidate = { ...SCORE_RULES, regulationScale: 7, baseline: 110, baselineSpread: 25 };
  for (const deltaRating of [-30, -10, 0, 10, 30]) {
    const evaluation = { deltaRating, winProbability: calculateWinProbability(deltaRating) };
    for (let seed = 0; seed < 100; seed++) {
      const sample = (rules: typeof candidate) => sampleOutcome(evaluation,
        randomStream(String(seed), 'outcome').next, randomStream(String(seed), 'score').next, rules);
      const original = sample(SCORE_RULES);
      const revised = sample(candidate);
      assert.equal(revised.won, original.won);
      assert.equal(revised.overtime.length, original.overtime.length);
      assert.ok(Math.abs(revised.margin) <= Math.abs(original.margin));
      checkScore(revised);
    }
  }
});

test('positive-margin rounding does not merge zero and one into one-point finishes', () => {
  const evaluation = { winProbability: 0.5, deltaRating: 0 };
  const rules = { ...SCORE_RULES, regulationOffset: 1 };
  const sample = (quantile: number, offset: number) => {
    const draws = [0.9, 0.5, 0.5, quantile];
    return sampleOutcome(evaluation, () => 0, () => draws.shift()!, { ...rules, regulationOffset: offset });
  };
  assert.equal(sample(0, 1).margin, 1);
  assert.equal(sample(0.04, 0).margin, 1);
  assert.equal(sample(0.04, 1).margin, 2);
});

test('offline calibration limits preserve scores, periods, winners and seeded replay', () => {
  for (const regulationOffset of [0, 1]) {
    const rules = { ...SCORE_RULES, regulationOffset, regulationScale: 8.25,
      baseline: 114, baselineSpread: 24, maxMargin: 100, overtimeMaxMargin: 30, maxOvertimePeriods: 6 };
    for (const deltaRating of [-1e6, -20, 0, 20, 1e6]) {
      const evaluation = { deltaRating, winProbability: calculateWinProbability(deltaRating) };
      for (const outcome of [0, 1 - Number.EPSILON]) {
        for (const scoreDraw of [0, 0.5, 1 - Number.EPSILON]) {
          const game = sampleOutcome(evaluation, () => outcome, () => scoreDraw, rules);
          checkScore(game, rules);
          assert.equal(game.won, outcome < evaluation.winProbability);
          if (scoreDraw === 0 && Math.abs(deltaRating) < 100) assert.equal(game.overtime.length, 6);
        }
      }
      const sample = (candidate: ScoreRules) => sampleOutcome(evaluation,
        randomStream(String(deltaRating), 'candidate/outcome').next,
        randomStream(String(deltaRating), 'candidate/score').next, candidate);
      assert.deepEqual(sample(rules), sample(rules));
      assert.equal(sample(rules).won, sample(SCORE_RULES).won);
    }
  }
});