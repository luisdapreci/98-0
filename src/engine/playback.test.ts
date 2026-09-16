import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePlayback, isPerfectSeasonChase, lossExplanations, restorePlayback, visibleStandings } from './playback.ts';
import type { SeasonGame } from './types.ts';

const games = [
  { gameNumber: 1, won: true, userScore: 101, oppScore: 100, overtime: [] },
  { gameNumber: 2, won: false, userScore: 110, oppScore: 112, overtime: [{ userScore: 5, oppScore: 5 }, { userScore: 5, oppScore: 7 }] },
  { gameNumber: 3, won: true, userScore: 100, oppScore: 90, overtime: [] },
] as SeasonGame[];

test('playback reveals regulation and tied extra periods without changing results', () => {
  const before = JSON.stringify(games);
  let playback = { runId: 'test', revealed: 0, overtimePeriod: null } as ReturnType<typeof restorePlayback>;
  playback = advancePlayback(playback, games);
  assert.equal(playback.revealed, 1);
  playback = advancePlayback(playback, games);
  assert.deepEqual(playback, { runId: 'test', revealed: 1, overtimePeriod: 0 });
  playback = advancePlayback(playback, games);
  assert.equal(playback.overtimePeriod, 1);
  playback = advancePlayback(playback, games);
  assert.equal(playback.revealed, 2);
  playback = advancePlayback(playback, games);
  assert.equal(advancePlayback(playback, games), playback);
  assert.equal(JSON.stringify(games), before);
});

test('visible standings never include future losses, scores or streaks', () => {
  const first = visibleStandings(games, 1);
  assert.equal(first.wins, 1);
  assert.equal(first.losses, 0);
  assert.equal(first.firstLoss, null);
  assert.equal(first.pointDifferential, 1);
  const complete = visibleStandings(games, 3);
  assert.equal(complete.wins, 2);
  assert.equal(complete.losses, 1);
  assert.equal(complete.firstLoss?.gameNumber, 2);
  assert.equal(complete.pointDifferential, 9);
  assert.equal(complete.currentStreak, 1);
  assert.equal(complete.longestStreak, 1);
});

test('restore preserves valid cursors, keeps legacy finals and resets malformed cursors without spoilers', () => {
  assert.equal(restorePlayback({ runId: 'test', revealed: 1 }, 'test', games).revealed, 1);
  assert.equal(restorePlayback({ runId: 'test', revealed: 0 }, 'test', games).revealed, 0);
  assert.equal(restorePlayback({ runId: 'test', revealed: 1, overtimePeriod: 1 }, 'test', games).overtimePeriod, 1);
  assert.equal(restorePlayback({ runId: 'test', revealed: 1, overtimePeriod: 2 }, 'test', games).overtimePeriod, null);
  assert.equal(restorePlayback(null, 'test', games).revealed, 3);
  assert.equal(restorePlayback(undefined, 'test', games).revealed, 3);
  for (const saved of [{}, { runId: 'other', revealed: 0 }, { runId: 'test', revealed: -1 }, { runId: 'test', revealed: 4 }, { runId: 'test', revealed: 1.5 }]) {
    assert.equal(restorePlayback(saved, 'test', games).revealed, 0);
  }
});

test('perfect-season tension starts at 50 revealed wins and ends at a loss or season completion', () => {
  assert.equal(isPerfectSeasonChase(49, 0, 82), false);
  assert.equal(isPerfectSeasonChase(50, 0, 82), true);
  assert.equal(isPerfectSeasonChase(81, 0, 82), true);
  assert.equal(isPerfectSeasonChase(50, 1, 82), false);
  assert.equal(isPerfectSeasonChase(82, 0, 82), false);
});

test('loss explanations use recorded disadvantages, never fill slots or explain a win', () => {
  const game = {
    ...games[1], context: { opponentNetRating: 0 },
    evaluation: { winProbability: 0.8, fatigueModifier: 0, synergy: {
      ortgTeam: 110, phiUsg: 1, spacingModifier: 0.05, drtgTeam: 100, netRating: 15,
    } },
  } as SeasonGame;
  assert.deepEqual(lossExplanations(game), ['You were favored, but upsets happen.']);
  assert.deepEqual(lossExplanations({ ...game, won: true }), []);
  game.evaluation.synergy.phiUsg = 0.8;
  assert.equal(lossExplanations(game).length, 1);
  assert.match(lossExplanations(game)[0]!, /20.0%/);
  game.evaluation.synergy.spacingModifier = -0.15;
  game.evaluation.fatigueModifier = -5;
  game.evaluation.synergy.drtgTeam = 113;
  game.context.opponentNetRating = 20;
  const explanations = lossExplanations(game);
  assert.equal(explanations.length, 3);
  assert.match(explanations[1]!, /15.0%/);
  assert.match(explanations[2]!, /-5.00/);
  assert.doesNotMatch(explanations.join(' '), /turnovers|buzzer|shot poorly/i);
});