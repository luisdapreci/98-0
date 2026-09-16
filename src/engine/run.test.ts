import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { availablePlayers, availableSlots, createDraft } from './draft.ts';
import { applyDraftAction, balanceForRun, createRun, finishSeason, recoverRun, startSeason } from './run.ts';
import { BALANCE_RULES_V1, BALANCE_RULES_V2, BALANCE_RULES_V3, calculateSynergy } from './math.ts';
import { advancePlayback, restorePlayback, visibleStandings } from './playback.ts';
import { aggregateSeason, sampleOutcome, SCORE_RULES_V1, SCORE_RULES_V3, simulateSeason } from './season.ts';
import type { RunData } from './run.ts';
import type { TeamLineup } from './types.ts';
import { lineupForUsagePolicy, usageBaseCap, usageCapForLineup } from './usage-policy.ts';
import { seasonForQualification } from './postseason-policy.ts';

const data: RunData = {
  players: JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')),
  coaches: JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')),
  opponents: JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool,
};

function readyRun(engineVersion = 'season-3') {
  let run = createRun('run-fixture', data.coaches);
  run = { ...run, engineVersion, scoreVersion: engineVersion === 'season-1' ? SCORE_RULES_V1.version : SCORE_RULES_V3.version };
  run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  for (let round = 0; round < 6; round++) {
    run = applyDraftAction(run, { type: 'SPIN' }, data.players);
    if (round === 0) {
      run = applyDraftAction(run, { type: 'REROLL', kind: 'team' }, data.players);
      run = applyDraftAction(run, { type: 'REROLL', kind: 'era' }, data.players);
    }
    const player = availablePlayers(run.draft, data.players).find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
    run = applyDraftAction(run, { type: 'PICK', id: player.id, slot: availableSlots(run.draft.lineup, player)[0]! }, data.players);
    assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, run);
  }
  return run;
}

test('draft actions and saved random state resume identically after each pick', () => {
  const run = readyRun();
  assert.equal(run.phase, 'DRAFT_READY');
  assert.equal(run.draft.phase, 'COMPLETE');
  assert.equal(run.season, null);
  assert.deepEqual(run, readyRun());
  assert.equal(startSeason(createRun('early', data.coaches)).phase, 'DRAFTING');
});

test('start is idempotent, freezes inputs, and interrupted/completed seasons survive JSON reload', () => {
  const ready = readyRun();
  const running = startSeason(ready);
  assert.equal(running.phase, 'SEASON_RUNNING');
  assert.notEqual(running.frozenLineup, ready.draft.lineup);
  assert.equal(startSeason(running), running);
  const recovered = recoverRun(JSON.parse(JSON.stringify({ run: running })), data, 'unused');
  assert.deepEqual(recovered.run, running);
  const complete = finishSeason(recovered.run!, data.opponents);
  assert.equal(complete.phase, 'SEASON_COMPLETE');
  assert.equal(complete.season!.gameLog.length, 82);
  assert.equal(finishSeason(complete, data.opponents), complete);
  assert.equal(startSeason(complete), complete);
  assert.equal(applyDraftAction(complete, { type: 'SPIN' }, data.players), complete);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, complete);
  assert.deepEqual(finishSeason(startSeason(ready), data.opponents), complete);
});

test('legacy drafts retain offers, picks and rerolls without claiming prior seeded replay', () => {
  for (const draft of [createDraft(data.coaches, () => 0), readyRun().draft]) {
    const recovered = recoverRun({ draft }, data, 'legacy-seed');
    assert.ok(recovered.notice?.includes('Previous draft restored'));
    assert.deepEqual(recovered.run!.draft, draft);
    assert.deepEqual(recovered.run!.legacyDraft, draft);
    assert.deepEqual(recoverRun({ run: recovered.run }, data, 'unused').run, recovered.run);
  }
});

test('malformed saves, invalid versions, actions, scores and totals recover without crashing', () => {
  const complete = finishSeason(startSeason(readyRun()), data.opponents);
  const invalid: unknown[] = [{}, { draft: {} }, { run: {} }, { draft: { ...complete.draft, rerolls: { team: -1, era: 1 } } }];
  for (const mutate of [
    (run: typeof complete) => { run.engineVersion = 'future'; },
    (run: typeof complete) => { run.draftRandomState++; },
    (run: typeof complete) => { run.actions[0] = { type: 'COACH', id: 'missing' }; },
    (run: typeof complete) => { run.frozenLineup!.PG!.stats.pts++; },
    (run: typeof complete) => { run.season!.wins++; },
    (run: typeof complete) => { run.season!.gameLog[0]!.userScore = -1; },
    (run: typeof complete) => { run.season!.gameLog[0]!.evaluation.deltaRating++; },
    (run: typeof complete) => { run.season!.gameLog[0]!.isBackToBack = true; },
    (run: typeof complete) => { run.season!.gameLog.pop(); },
  ]) {
    const run = structuredClone(complete);
    mutate(run);
    invalid.push({ run });
  }
  for (const saved of invalid) {
    const recovered = recoverRun(saved, data, 'replacement');
    assert.equal(recovered.run, null);
    assert.ok(recovered.notice);
  }
});

test('full season playback and restored cursors match instant results without changing the run', () => {
  const run = finishSeason(startSeason(readyRun()), data.opponents);
  const before = JSON.stringify(run);
  const games = run.season!.gameLog;
  let playback = { runId: run.id, revealed: 0, overtimePeriod: null } as ReturnType<typeof restorePlayback>;
  while (playback.revealed < games.length) {
    playback = advancePlayback(playback, games);
    const saved = JSON.parse(JSON.stringify({ run, playback }));
    assert.deepEqual(restorePlayback(saved.playback, run.id, games), playback);
    assert.equal(visibleStandings(games, playback.revealed).gameLog.length, playback.revealed);
  }
  const visible = visibleStandings(games, playback.revealed);
  for (const key of ['wins', 'losses', 'pointDifferential', 'currentStreak', 'longestStreak'] as const) {
    assert.equal(visible[key], run.season![key]);
  }
  assert.equal(visible.firstLoss?.gameNumber ?? null, run.season!.firstLoss);
  assert.deepEqual(recoverRun({ run, playback }, data, 'unused').run, run);
  assert.equal(JSON.stringify(run), before);
});

test('new runs use released scores while v1 drafts and interrupted seasons retain their pinned rules', () => {
  const fresh = createRun('new-version', data.coaches);
  assert.equal(fresh.engineVersion, 'season-6');
  assert.equal(fresh.scoreVersion, SCORE_RULES_V3.version);
  const oldDraft = { ...fresh, engineVersion: 'season-1', scoreVersion: SCORE_RULES_V1.version };
  assert.deepEqual(recoverRun({ run: oldDraft }, data, 'unused').run, oldDraft);
  const oldReady = readyRun('season-1');
  const oldRunning = startSeason(oldReady);
  const restored = recoverRun(JSON.parse(JSON.stringify({ run: oldRunning })), data, 'unused').run!;
  assert.deepEqual(restored, oldRunning);
  const oldComplete = finishSeason(restored, data.opponents);
  assert.deepEqual(oldComplete.season, simulateSeason(oldRunning.frozenLineup!, data.opponents, oldRunning.seed, SCORE_RULES_V1));
  assert.deepEqual(recoverRun({ run: oldComplete }, data, 'unused').run, oldComplete);
  const current = finishSeason(startSeason(readyRun('season-2')), data.opponents);
  assert.deepEqual(current.season, simulateSeason(current.frozenLineup!, data.opponents, current.seed, SCORE_RULES_V3));
  assert.notDeepEqual(current.season, oldComplete.season);
  assert.deepEqual(current.season!.gameLog.map((game) => [game.won, game.evaluation, game.day, game.opponent, game.isHome]),
    oldComplete.season!.gameLog.map((game) => [game.won, game.evaluation, game.day, game.opponent, game.isHome]));
  for (const engineVersion of ['season-1', 'season-2', 'season-3']) {
    const scoreVersion = engineVersion === 'season-1' ? SCORE_RULES_V3.version : SCORE_RULES_V1.version;
    assert.equal(recoverRun({ run: { ...current, engineVersion, scoreVersion } }, data, 'unused').run, null);
  }
});

test('released maximum margins and six-period overtime survive recovery and playback but exceed v1 limits', () => {
  const run = finishSeason(startSeason(readyRun()), data.opponents);
  const log = run.season!.gameLog;
  const draws = [
    () => 0,
    [0.99, 0.5, 0.5, 1 - Number.EPSILON],
    [0, 0.5, 0.5, 0.99, 0.5, 0.5, 1 - Number.EPSILON],
  ];
  for (const [index, source] of draws.entries()) {
    const random = typeof source === 'function' ? source : () => source.shift()!;
    log[index] = { ...log[index]!, ...sampleOutcome(log[index]!.evaluation, () => 0, random, SCORE_RULES_V3) };
  }
  assert.equal(log[0]!.overtime.length, 6);
  assert.equal(Math.abs(log[1]!.margin), 100);
  assert.equal(Math.abs(log[2]!.margin), 30);
  run.season = aggregateSeason(log);
  const before = JSON.stringify(run);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, run);
  let playback = { runId: run.id, revealed: 0, overtimePeriod: null } as ReturnType<typeof restorePlayback>;
  for (let period = 0; period < 6; period++) {
    playback = advancePlayback(playback, log);
    assert.equal(playback.overtimePeriod, period);
    assert.equal(playback.revealed, 0);
    assert.deepEqual(restorePlayback(JSON.parse(JSON.stringify(playback)), run.id, log), playback);
  }
  assert.equal(advancePlayback(playback, log).revealed, 1);
  assert.equal(JSON.stringify(run), before);
  const oldVersion = { ...run, engineVersion: 'season-1', scoreVersion: SCORE_RULES_V1.version };
  assert.equal(recoverRun({ run: oldVersion }, data, 'unused').run, null);
});

test('season-3 applies core offense while both older engines preserve ratings, saves and playback', () => {
  for (const version of ['season-1', 'season-2', 'season-3']) {
    const ready = readyRun(version);
    const running = startSeason(ready);
    assert.deepEqual(recoverRun({ run: running }, data, 'unused').run, running);
    const complete = finishSeason(running, data.opponents);
    const balance = version === 'season-3' ? BALANCE_RULES_V2 : BALANCE_RULES_V1;
    assert.equal(balanceForRun(complete), balance);
    assert.deepEqual(complete.season, simulateSeason(complete.frozenLineup!, data.opponents, complete.seed,
      version === 'season-1' ? SCORE_RULES_V1 : SCORE_RULES_V3, balance));
    assert.deepEqual(complete.season!.gameLog[0]!.evaluation.synergy, calculateSynergy(ready.draft.lineup, balanceForRun(ready)));
    const before = JSON.stringify(complete);
    assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, complete);
    let cursor = restorePlayback({ runId: complete.id, revealed: 0, overtimePeriod: null }, complete.id, complete.season!.gameLog);
    while (cursor.revealed < 82) cursor = advancePlayback(cursor, complete.season!.gameLog);
    assert.equal(JSON.stringify(complete), before);
    if (version === 'season-2') {
      assert.equal(recoverRun({ run: { ...complete, engineVersion: 'season-3' } }, data, 'unused').run, null);
    }
  }
});

test('season-4 raises usage tolerance while preserving coaches, all older saves and canonical lineups', () => {
  const ready = readyRun('season-4');
  const snapshot = structuredClone(ready);
  assert.equal(usageBaseCap('season-4'), 135);
  for (const version of ['season-1', 'season-2', 'season-3']) {
    assert.equal(usageBaseCap(version), 115);
    assert.equal(lineupForUsagePolicy(ready.draft.lineup, version), ready.draft.lineup);
  }
  const adapted = lineupForUsagePolicy(ready.draft.lineup, ready.engineVersion);
  assert.equal(usageCapForLineup(ready.draft.lineup, 'season-4'), usageCapForLineup(ready.draft.lineup, 'season-3') + 20);
  const preview = calculateSynergy(adapted, balanceForRun(ready));
  const old = calculateSynergy(ready.draft.lineup, BALANCE_RULES_V2);
  for (const key of ['usgTeam', 'ortgTeam', 'drtgTeam', 'spacingRating', 'spacingModifier', 'sixthManFRF', 'depthBonus'] as const)
    assert.equal(preview[key], old[key]);
  assert.ok(preview.phiUsg >= old.phiUsg);
  const running = startSeason(ready);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: running })), data, 'unused').run, running);
  const complete = finishSeason(running, data.opponents);
  assert.deepEqual(complete.frozenLineup, ready.draft.lineup);
  assert.deepEqual(complete.season, simulateSeason(adapted, data.opponents, ready.seed, SCORE_RULES_V3, BALANCE_RULES_V2));
  assert.deepEqual(complete.season!.gameLog[0]!.evaluation.synergy, preview);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, complete);
  assert.deepEqual(ready, snapshot);
  assert.equal(recoverRun({ run: { ...complete, scoreVersion: SCORE_RULES_V1.version } }, data, 'unused').run, null);
  const lineup = structuredClone(ready.draft.lineup);
  lineup.coach = { ...lineup.coach!, modifiers: [] };
  lineup.SIXTH = null;
  for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) lineup[position]!.stats.usgPct = 134.5 / 5;
  assert.equal(calculateSynergy(lineupForUsagePolicy(lineup, 'season-4'), BALANCE_RULES_V2).phiUsg, 1);
  assert.ok(calculateSynergy(lineup, BALANCE_RULES_V2).phiUsg < 0.85);
  for (const [usage, expected] of [[85, 1.03], [95, 1], [115, 1], [135, 1], [140, 0.96], [200, 0.5]]) {
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) lineup[position]!.stats.usgPct = usage! / 5;
    assert.ok(Math.abs(calculateSynergy(lineupForUsagePolicy(lineup, 'season-4'), BALANCE_RULES_V2).phiUsg - expected!) < 1e-10);
  }
  lineup.coach.modifiers = [{ stat: 'usgCap', delta: 5 }];
  for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) lineup[position]!.stats.usgPct = 28;
  assert.equal(usageCapForLineup(lineup, 'season-4'), 140);
  assert.equal(calculateSynergy(lineupForUsagePolicy(lineup, 'season-4'), BALANCE_RULES_V2).phiUsg, 1);
});

test('season-5 preserves gameplay and saves while applying historical postseason entry', () => {
  const ready = readyRun('season-5');
  assert.equal(usageBaseCap(ready.engineVersion), 135);
  assert.equal(balanceForRun(ready), BALANCE_RULES_V2);
  const running = startSeason(ready);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: running })), data, 'unused').run, running);
  const current = finishSeason(running, data.opponents);
  const legacy = finishSeason({ ...running, engineVersion: 'season-4' }, data.opponents);
  assert.deepEqual(current.season!.gameLog, legacy.season!.gameLog);
  assert.deepEqual(current.frozenLineup, legacy.frozenLineup);
  assert.deepEqual(current.season, seasonForQualification(legacy.season!, 'season-5'));
  for (const run of [current, legacy])
    assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, run);
  for (const wins of [39, 40, 43, 59, 60]) {
    const gameLog = current.season!.gameLog.map((game, index) => ({
      ...game, ...sampleOutcome(game.evaluation, () => index < wins ? 0 : 1 - Number.EPSILON, () => 0.5, SCORE_RULES_V3),
    }));
    const oldSeason = aggregateSeason(gameLog);
    const newSeason = seasonForQualification(oldSeason, 'season-5');
    assert.equal(newSeason.qualified, wins >= 40);
    assert.equal(oldSeason.qualified, wins >= 60);
    for (const run of [{ ...current, season: newSeason }, { ...legacy, season: oldSeason }])
      assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, run);
    const corrupted = { ...current, season: { ...newSeason, qualified: !newSeason.qualified } };
    assert.equal(recoverRun({ run: corrupted }, data, 'unused').run, null);
  }
  assert.equal(recoverRun({ run: { ...current, scoreVersion: SCORE_RULES_V1.version } }, data, 'unused').run, null);
});

test('season-6 keeps the 135% cap and historical entry while making overload costlier', () => {
  const ready = readyRun('season-6');
  assert.equal(usageBaseCap(ready.engineVersion), 135);
  assert.equal(balanceForRun(ready), BALANCE_RULES_V3);
  assert.equal(usageCapForLineup(ready.draft.lineup, 'season-6'), usageCapForLineup(ready.draft.lineup, 'season-5'));
  const lineup = structuredClone(ready.draft.lineup);
  lineup.coach = { ...lineup.coach!, modifiers: [] };
  lineup.SIXTH = null;
  for (const [usage, expected] of [[95, 1], [135, 1], [140, 0.925], [170, 0.475], [200, 0.45]]) {
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) lineup[position]!.stats.usgPct = usage! / 5;
    const strict = calculateSynergy(lineupForUsagePolicy(lineup, 'season-6'), BALANCE_RULES_V3);
    assert.ok(Math.abs(strict.phiUsg - expected!) < 1e-10);
    assert.ok(strict.phiUsg <= calculateSynergy(lineupForUsagePolicy(lineup, 'season-5'), BALANCE_RULES_V2).phiUsg);
  }
  const adapted = lineupForUsagePolicy(ready.draft.lineup, ready.engineVersion);
  const running = startSeason(ready);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: running })), data, 'unused').run, running);
  const complete = finishSeason(running, data.opponents);
  assert.deepEqual(complete.frozenLineup, ready.draft.lineup);
  assert.deepEqual(complete.season, seasonForQualification(
    simulateSeason(adapted, data.opponents, ready.seed, SCORE_RULES_V3, BALANCE_RULES_V3), 'season-6'));
  assert.deepEqual(complete.season!.gameLog[0]!.evaluation.synergy, calculateSynergy(adapted, BALANCE_RULES_V3));
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, complete);
  const legacy = finishSeason({ ...running, engineVersion: 'season-5' }, data.opponents);
  assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: legacy })), data, 'unused').run, legacy);
  assert.equal(recoverRun({ run: { ...complete, engineVersion: 'season-5' } }, data, 'unused').run, null);
  assert.equal(recoverRun({ run: { ...complete, scoreVersion: SCORE_RULES_V1.version } }, data, 'unused').run, null);
});

test('the reference scoring-core roster usually contends for qualification without rewriting its old result', () => {
  const ids = ['brunsja01_NYK_2020s', 'tuckepj01_TOR_2010s', 'brookdi01_MEM_2010s',
    'duncati01_SAS_2000s', 'townska01_NYK_2020s', 'thompla01_IND_1990s'];
  const lineup = Object.fromEntries(['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH']
    .map((slot, index) => [slot, data.players.find((player) => player.id === ids[index])!])) as unknown as TeamLineup;
  lineup.coach = data.coaches.find((coach) => coach.id === 'gregg_popovich')!;
  const seed = '50b9c2a6-c5c3-4bf3-8497-db022533d443';
  const old = simulateSeason(lineup, data.opponents, seed, SCORE_RULES_V1, BALANCE_RULES_V1);
  assert.equal(old.wins, 53);
  assert.equal(old.pointDifferential, 626);
  const current = simulateSeason(lineup, data.opponents, seed, SCORE_RULES_V3, BALANCE_RULES_V2);
  assert.deepEqual(current, simulateSeason(lineup, data.opponents, seed, SCORE_RULES_V3, BALANCE_RULES_V2));
  const expected = current.gameLog.reduce((sum, game) => sum + game.evaluation.winProbability, 0);
  assert.ok(expected >= 60 && expected <= 63, String(expected));
  const distribution = Array<number>(83).fill(0);
  distribution[0] = 1;
  for (const game of current.gameLog) {
    const probability = game.evaluation.winProbability;
    for (let wins = 82; wins >= 0; wins--)
      distribution[wins] = distribution[wins]! * (1 - probability) + (wins ? distribution[wins - 1]! * probability : 0);
  }
  const qualified = distribution.slice(60).reduce((sum, value) => sum + value, 0);
  assert.ok(qualified >= 0.55 && qualified <= 0.75, String(qualified));
  for (const [index, game] of current.gameLog.entries()) {
    const prior = old.gameLog[index]!;
    assert.deepEqual(game.context, prior.context);
    assert.ok(game.evaluation.winProbability >= prior.evaluation.winProbability);
    if (prior.won) assert.equal(game.won, true);
    for (const key of ['drtgTeam', 'spacingModifier', 'phiUsg', 'sixthManFRF'] as const)
      assert.equal(game.evaluation.synergy[key], prior.evaluation.synergy[key]);
  }
});