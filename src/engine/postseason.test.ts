import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BALANCE_RULES_V3, evaluateGame } from './math.ts';
import { drawPostseasonPath, PLAYOFF_ROUNDS, playoffVenue, simulatePostseason } from './postseason.ts';
import { advancePlayback, restorePlayback } from './playback.ts';
import { seasonForQualification } from './postseason-policy.ts';
import { aggregateSeason, SCORE_RULES_V1, SCORE_RULES_V3, simulateSeason } from './season.ts';
import type { Coach, OpponentPool, Player, PlayoffPool, PostseasonEntry, TeamLineup } from './types.ts';

const players: Player[] = JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8'));
const coaches: Coach[] = JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8'));
const opponents: { regularSeasonPool: OpponentPool; playoffPool: PlayoffPool } = JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8'));
const lineup: TeamLineup = { PG: null, SG: null, SF: null, PF: null, C: null, SIXTH: null, coach: coaches[0]! };
const identities = new Set<string>();
for (const slot of ['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH'] as const) {
  const player = players.find((candidate) => !identities.has(candidate.id.split('_')[0]!)
    && (slot === 'SIXTH' || candidate.eligiblePositions.includes(slot)))!;
  lineup[slot] = player;
  identities.add(player.id.split('_')[0]!);
}
const baseline = simulateSeason(lineup, opponents.regularSeasonPool, 'playoffs-fixture');
function seasonWithWins(wins: number, version = 'season-7') {
  return seasonForQualification(aggregateSeason(baseline.gameLog.map((game, index) => ({ ...game, won: index < wins }))), version);
}
function poolAtRating(netRating: number): PlayoffPool {
  const pool = structuredClone(opponents.playoffPool);
  for (const round of PLAYOFF_ROUNDS) pool[round] = pool[round].map((opponent) => ({ ...opponent, netRating }));
  return pool;
}

test('all seed boundaries, home sequences and home-only bonuses follow the saved entry policy', () => {
  for (const [wins, entry] of [[44, 'MISSED'], [45, 'PLAY_IN'], [64, 'PLAY_IN'], [65, 'FOURTH_SEED'], [69, 'FOURTH_SEED'], [70, 'SECOND_SEED'], [74, 'SECOND_SEED'], [75, 'FIRST_SEED'], [81, 'FIRST_SEED'], [82, 'FIRST_SEED']] as [number, PostseasonEntry][]) {
    assert.equal(seasonWithWins(wins).postseasonEntry, entry);
    if (entry === 'MISSED') continue;
    const venues = Array.from({ length: 7 }, (_, index) => playoffVenue(entry, wins, 'finals', index + 1));
    assert.deepEqual(venues.map((venue) => venue.isHome), wins >= 70
      ? [true, true, false, false, true, false, true] : [false, false, true, true, false, true, false]);
    for (const venue of venues) assert.equal(venue.seedHomeBonus, venue.isHome && wins >= 75 ? wins === 82 ? 2 : 1 : 0);
    assert.deepEqual(playoffVenue(entry, wins, 'playIn', 1), { isHome: false, seedHomeBonus: 0 });
  }
  assert.equal(seasonWithWins(44, 'season-6').postseasonEntry, 'PLAY_IN');
  assert.equal(seasonWithWins(59, 'season-4').postseasonEntry, 'MISSED');
});

test('complete paths are seeded, exact-squad unique, backtrack from dead ends and reject impossible pools', () => {
  for (let index = 0; index < 100; index++) {
    const seed = `path-${index}`;
    const path = drawPostseasonPath(opponents.playoffPool, 'PLAY_IN', seed);
    assert.equal(new Set(path.map((entry) => entry.opponent.id)).size, 5);
    assert.deepEqual(drawPostseasonPath(opponents.playoffPool, 'PLAY_IN', seed), path);
  }
  const first = opponents.playoffPool.round1[0]!;
  const second = opponents.playoffPool.round1[1]!;
  const pool = { ...opponents.playoffPool, round1: [first, second], round2: [first] };
  assert.equal(drawPostseasonPath(pool, 'FOURTH_SEED', 'backtracking')[0]!.opponent.id, second.id);
  assert.throws(() => drawPostseasonPath({ ...pool, round1: [first] }, 'FOURTH_SEED', 'impossible'), /No complete/);
});

test('play-in elimination, four-win termination, ring and exact 98-0 accounting remain separate', () => {
  for (const wins of [45, 65, 70, 75, 82]) {
    const season = seasonWithWins(wins);
    const victory = simulatePostseason(lineup, poolAtRating(-10000), 'victory', season, SCORE_RULES_V3, BALANCE_RULES_V3, true);
    assert.equal(victory.champion, true);
    assert.equal(victory.isPerfectRun, wins === 82);
    assert.deepEqual(victory.playoffs, { wins: 16, losses: 0 });
    assert.deepEqual(victory.playIn, { wins: wins === 45 ? 1 : 0, losses: 0 });
    assert.equal(victory.gameLog.length, wins === 45 ? 17 : 16);
    assert.equal(victory.series.length, wins === 45 ? 5 : 4);
    const defeat = simulatePostseason(lineup, poolAtRating(10000), 'defeat', season, SCORE_RULES_V1, BALANCE_RULES_V3);
    assert.equal(defeat.champion, false);
    assert.equal(defeat.isPerfectRun, false);
    assert.equal(defeat.gameLog.length, wins === 45 ? 1 : 4);
    assert.equal(defeat.eliminatedRound, wins === 45 ? 'playIn' : 'round1');
    assert.equal(defeat.playoffs.losses, wins === 45 ? 0 : 4);
  }
  assert.throws(() => simulatePostseason(lineup, opponents.playoffPool, 'missed', seasonWithWins(44), SCORE_RULES_V3, BALANCE_RULES_V3), /qualifying/);
});

test('postseason applies multipliers and context once, preserves outcomes through overtime playback and seeded replay', () => {
  let overtimeGames = 0;
  let sevenGameSeries = 0;
  for (let index = 0; index < 80; index++) {
    const seed = `postseason-${index}`;
    const season = seasonWithWins(82);
    const result = simulatePostseason(lineup, opponents.playoffPool, seed, season, SCORE_RULES_V3, BALANCE_RULES_V3, true);
    assert.deepEqual(simulatePostseason(lineup, opponents.playoffPool, seed, season, SCORE_RULES_V3, BALANCE_RULES_V3, true), result);
    for (const series of result.series) {
      assert.ok(series.wins === 4 || series.losses === 4);
      assert.ok(series.gameLog.slice(0, -1).filter((game) => game.won).length < 4);
      assert.ok(series.gameLog.slice(0, -1).filter((game) => !game.won).length < 4);
      if (series.gameLog.length === 7) sevenGameSeries++;
    }
    for (const game of result.gameLog) {
      const expected = evaluateGame(lineup, game.context, BALANCE_RULES_V3);
      assert.equal(game.context.opponentNetRating, game.opponent.netRating * game.opponentMultiplier);
      assert.equal(game.evaluation.deltaRating, expected.deltaRating + game.seedHomeBonus);
      assert.equal(game.evaluation.fatigueModifier, 0);
      assert.equal(game.isBackToBack, false);
      assert.equal(game.pairId, null);
      assert.equal(game.won, game.userScore > game.oppScore);
      assert.equal(game.margin, game.userScore - game.oppScore);
      for (const key of ['userScore', 'oppScore'] as const) {
        assert.ok(Number.isSafeInteger(game[key]) && game[key] >= 0);
        assert.equal(game[key], game.regulation[key] + game.overtime.reduce((total, period) => total + period[key], 0));
      }
      if (game.overtime.length) {
        overtimeGames++;
        assert.equal(game.regulation.userScore, game.regulation.oppScore);
        for (const period of game.overtime.slice(0, -1)) assert.equal(period.userScore, period.oppScore);
      }
    }
    const before = JSON.stringify(result);
    let cursor = { runId: seed, revealed: 0, overtimePeriod: null } as ReturnType<typeof restorePlayback>;
    while (cursor.revealed < result.gameLog.length) {
      cursor = advancePlayback(cursor, result.gameLog);
      assert.deepEqual(restorePlayback(JSON.parse(JSON.stringify(cursor)), seed, result.gameLog), cursor);
    }
    assert.equal(JSON.stringify(result), before);
  }
  assert.ok(overtimeGames > 0);
  assert.ok(sevenGameSeries > 0);
});