import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compareDailyRecords, dailyCommitmentKey, dailyPriorities, dailyRoll, dailySeed, dailyStatus, utcDate } from './daily.ts';
import type { DailyAttempt } from './daily.ts';
import { availablePlayers, availableSlots, DRAFT_SLOTS, playerIdentity, rollOptions } from './draft.ts';
import { applyDraftAction, createDailyRun, finishSeason, playersForRun, recoverRun, selectIQMode, startSeason } from './run.ts';
import type { RunData } from './run.ts';
import { generateSchedule } from './season.ts';
import { DAILY_CALENDAR, DAILY_CALENDAR_VERSION, calendarVersionForDate, challengeForDate, challengePlayers, challengeFixedPlayers, dailyChallengeDate, validateChallenge } from './daily-calendar.ts';
import { DAILY_ROTATION_START, DAILY_ROTATION_VERSION, rotationCycle, rotationDate, rotationSchedule, rotatingChallengeForDate } from './daily-calendar.ts';

const data: RunData = {
  players: JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')),
  coaches: JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')),
  opponents: JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool,
};
const attempt: DailyAttempt = { version: 'daily-1', date: '2026-09-16',
  startedAt: Date.parse('2026-09-16T12:00:00Z'), kind: 'local', attemptId: 'daily-test' };

test('UTC rotation restarts September 17 and cycles without repeats or stored state', () => {
  const ids = DAILY_CALENDAR.map((challenge) => challenge.id).sort();
  assert.equal(rotationDate(0), DAILY_ROTATION_START);
  assert.equal(rotatingChallengeForDate('2026-09-16'), null);
  assert.throws(() => rotatingChallengeForDate('2026-02-30'));
  assert.throws(() => rotationCycle(-1));
  assert.throws(() => rotationCycle(0.5));
  assert.throws(() => rotationDate(0.5));
  for (let cycle = 0; cycle < 200; cycle++) {
    const order = rotationCycle(cycle);
    assert.deepEqual(order.map((challenge) => challenge.id).sort(), ids);
    assert.deepEqual(rotationCycle(cycle), order);
    if (cycle) {
      assert.notEqual(rotationCycle(cycle - 1).at(-1)!.id, order[0]!.id);
      assert.notDeepEqual(rotationCycle(cycle - 1), order);
    }
    const start = cycle * 56;
    assert.equal(rotatingChallengeForDate(rotationDate(start)), order[0]);
    assert.equal(rotatingChallengeForDate(rotationDate(start + 55)), order[55]);
    assert.deepEqual(rotationSchedule(rotationDate(start + 28)).map((entry) => entry.challenge), order);
  }
  assert.ok(rotatingChallengeForDate('2400-02-29'));
  assert.equal(utcDate(Date.parse('2026-09-16T20:00:00-04:00')), DAILY_ROTATION_START);
  assert.equal(utcDate(Date.parse('2026-09-17T02:00:00+02:00')), DAILY_ROTATION_START);
});

test('Challenge filters use raw record boundaries and validate fixed identities, slots and allowances', () => {
  const base = { id: 'probe', name: 'Probe', restriction: 'Probe' };
  const player = data.players[0]!;
  for (const stat of ['pts', 'usgPct', 'threePtAttempts'] as const) {
    const value = stat === 'pts' ? 20 : stat === 'usgPct' ? 25 : 1;
    const samples = [-0.01, 0, 0.01].map((offset) => ({ ...player, stats: { ...player.stats, [stat]: value + offset } }));
    for (const operator of ['lt', 'lte', 'gte'] as const) {
      const filtered = challengePlayers({ ...base, statFilter: { stat, value, operator } }, samples);
      assert.deepEqual(filtered, operator === 'lt' ? [samples[0]] : operator === 'lte' ? samples.slice(0, 2) : samples.slice(1));
    }
  }
  const duo = { ...base, fixedPlayers: [{ id: 'onealsh01_LAL_2000s', slot: 'C' as const }, { id: 'curryst01_GSW_2010s', slot: 'PG' as const }] };
  validateChallenge(duo, data.players, data.coaches);
  assert.equal(challengeFixedPlayers(duo).length, 2);
  assert.throws(() => validateChallenge({ ...duo, fixedPlayers: [duo.fixedPlayers[0]!, duo.fixedPlayers[0]!] }, data.players, data.coaches));
  assert.throws(() => validateChallenge({ ...duo, fixedPlayers: [duo.fixedPlayers[0]!, { id: 'onealsh01_ORL_1990s', slot: 'SIXTH' }] }, data.players, data.coaches));
  assert.throws(() => validateChallenge({ ...base, rerolls: { team: -1, era: 0 } }, data.players, data.coaches));
  assert.throws(() => validateChallenge({ ...base, eligiblePosition: 'C' }, data.players, data.coaches));
  validateChallenge({ ...base, eligiblePosition: 'C', fixedPlayer: { id: 'barnesc01_TOR_2020s', slot: 'PG' } }, data.players, data.coaches);
  assert.ok(challengePlayers({ ...base, eligiblePosition: 'C' }, data.players).every((candidate) => candidate.eligiblePositions.includes('C')));
});

test('The published calendars have 56 distinct restrictions, proven completion coverage and no wraparound', () => {
  assert.equal(DAILY_CALENDAR.length, 56);
  assert.equal(new Set(DAILY_CALENDAR.map((challenge) => challenge.id)).size, 56);
  assert.equal(new Set(DAILY_CALENDAR.map((challenge) =>
    JSON.stringify({ pool: challengePlayers(challenge, data.players).map((player) => player.id).sort(),
      fixed: challengeFixedPlayers(challenge), coach: challenge.coachId, rerolls: challenge.rerolls ?? { team: 1, era: 1 } }))).size, 56);
  for (const [index, challenge] of DAILY_CALENDAR.entries()) {
    assert.equal(challengeForDate(dailyChallengeDate(index)), challenge);
    validateChallenge(challenge, data.players, data.coaches);
  }
  assert.equal(challengeForDate(dailyChallengeDate(-1)), null);
  assert.equal(challengeForDate(dailyChallengeDate(56)), null);
  assert.equal(dailyChallengeDate(28), '2026-10-14');
  assert.equal(dailyChallengeDate(55), '2026-11-10');
  assert.equal(calendarVersionForDate(dailyChallengeDate(27)), 'calendar-1');
  assert.equal(calendarVersionForDate(dailyChallengeDate(28)), 'calendar-2');
  assert.throws(() => challengeForDate('2026-02-30'));
  assert.throws(() => validateChallenge(DAILY_CALENDAR[0]!, data.players.slice(0, 5), data.coaches));
});

test('Daily date, mode and rules are pinned with a strict UTC grace deadline', () => {
  const attempt: DailyAttempt = { version: 'daily-1', date: '2026-09-16',
    startedAt: Date.parse('2026-09-16T23:59:59Z'), kind: 'local', attemptId: 'first' };
  assert.equal(utcDate(attempt.startedAt), '2026-09-16');
  assert.match(dailySeed(attempt.date, 'daily-2'), /mid:iq-1:season-7/);
  assert.notEqual(dailySeed(attempt.date, 'daily-2'), dailySeed('2026-09-17', 'daily-2'));
  assert.throws(() => dailySeed('2026-02-30'));
  assert.equal(dailyStatus(attempt, Date.parse('2026-09-17T23:59:59.999Z')), 'local');
  assert.equal(dailyStatus(attempt, Date.parse('2026-09-18T00:00:00Z')), 'late');
  assert.equal(dailyStatus({ ...attempt, kind: 'practice' }, Date.parse('2026-09-18T00:00:00Z')), 'practice');
  assert.throws(() => dailyStatus(attempt, attempt.startedAt - 1));
});

test('Daily priority streams are addressed independently by round and action', () => {
  const seed = dailySeed('2026-09-16', 'daily-2');
  const before = dailyPriorities(seed, 2, 'spin', data.players);
  dailyPriorities(seed, 1, 'team', data.players);
  dailyPriorities(seed, 1, 'era', data.players);
  assert.deepEqual(dailyPriorities(seed, 2, 'spin', data.players), before);
  assert.deepEqual(dailyPriorities(seed, 2, 'spin', [...data.players].reverse()), before);
  assert.notDeepEqual(dailyPriorities(seed, 2, 'team', data.players), before);
  assert.notDeepEqual(dailyPriorities(seed, 3, 'spin', data.players), before);
});

test('Daily legal drafts replay at every step, keep mode locked and isolate the schedule', () => {
  const schedules = [];
  for (const rerolls of [false, true]) {
    let run = createDailyRun({ ...attempt, kind: rerolls ? 'practice' : 'local' }, data.coaches);
    assert.deepEqual(run.draft.offers, createDailyRun(attempt, data.coaches).draft.offers);
    assert.equal(selectIQMode(run, 'hi', data.coaches, 'other'), run);
    const randomState = run.draftRandomState;
    run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
    for (let round = 0; round < 6; round++) {
      run = applyDraftAction(run, { type: 'SPIN' }, data.players);
      if (round === 0 && rerolls) {
        for (const kind of ['team', 'era'] as const) {
          const before = run;
          run = applyDraftAction(run, { type: 'REROLL', kind }, data.players);
          assert.notDeepEqual(run.draft.roll, before.draft.roll);
          assert.equal(run.draft.roll![kind === 'team' ? 'decade' : 'franchise'], before.draft.roll![kind === 'team' ? 'decade' : 'franchise']);
          assert.equal(run.draft.rerolls[kind], 0);
          assert.equal(applyDraftAction(run, { type: 'REROLL', kind }, data.players), run);
        }
      }
      const player = availablePlayers(run.draft, data.players).find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
      const slot = round === 0 ? 'SIXTH' : availableSlots(run.draft.lineup, player)[0]!;
      run = applyDraftAction(run, { type: 'PICK', id: player.id, slot }, data.players);
      assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, run);
    }
    assert.equal(run.draftRandomState, randomState);
    schedules.push(generateSchedule(run.seed, data.opponents));
    const complete = finishSeason(startSeason(run), data.opponents);
    assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, complete);
    assert.deepEqual(finishSeason(startSeason(run), data.opponents), complete);
    for (const altered of [{ ...complete, seed: 'wrong' }, { ...complete, iqMode: 'hi' },
      { ...complete, daily: { ...attempt, version: 'future' } }])
      assert.equal(recoverRun({ run: altered }, data, 'unused').run, null);
  }
  assert.deepEqual(schedules[0], schedules[1]);
});

test('Daily chooses the first legal priority and keeps unavailable reroll tokens', () => {
  let run = createDailyRun(attempt, data.coaches);
  run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  const priorities = dailyPriorities(run.seed, 1, 'spin', data.players);
  const legal = rollOptions(run.draft, data.players);
  const expected = priorities.franchises.flatMap((franchise) => priorities.decades.map((decade) => ({ franchise, decade })))
    .find((roll) => legal.some((option) => option.franchise === roll.franchise && option.decade === roll.decade));
  const rolled = dailyRoll(run.draft, data.players, run.seed);
  assert.deepEqual(rolled.roll, expected);
  const singleCombo = data.players.filter((player) => player.franchise === rolled.roll!.franchise && player.decade === rolled.roll!.decade);
  assert.equal(dailyRoll(rolled, singleCombo, run.seed, 'team'), rolled);
  assert.equal(dailyRoll(rolled, singleCombo, run.seed, 'era'), rolled);
});

test('Daily records compare identical challenges and exact ties ignore submission time', () => {
  const record = { attempt, seed: dailySeed(attempt.date, attempt.version), iqMode: 'mid' as const, completedAt: attempt.startedAt,
    status: 'local' as const, wins: 60, pointDifferential: 200, longestWinStreak: 10 };
  assert.equal(compareDailyRecords(record, { ...record, completedAt: record.completedAt + 1 }), 0);
  assert.ok(compareDailyRecords(record, { ...record, wins: 59, pointDifferential: 900 }) < 0);
  assert.ok(compareDailyRecords(record, { ...record, pointDifferential: 199 }) < 0);
  assert.ok(compareDailyRecords(record, { ...record, longestWinStreak: 9 }) < 0);
  assert.throws(() => compareDailyRecords(record, { ...record, seed: dailySeed('2026-09-17') }));
});

test('All 56 themed Dailies enforce restrictions and replay complete drafts and seasons', () => {
  for (const [index, challenge] of DAILY_CALENDAR.entries()) {
    const date = dailyChallengeDate(index);
    const themed: DailyAttempt = { version: 'daily-2', calendarVersion: calendarVersionForDate(date), challengeId: challenge.id,
      date, startedAt: Date.parse(`${date}T12:00:00Z`), kind: 'local', attemptId: `theme-${index}` };
    for (const reverse of [false, true]) {
      let run = createDailyRun(themed, data.coaches, data.players);
      const pool = playersForRun(run, data.players);
      const initial = structuredClone(run);
      assert.equal(run.seed, dailySeed(date, 'daily-2'));
      assert.deepEqual(createDailyRun({ ...themed, kind: 'practice', attemptId: 'practice' }, data.coaches, data.players).draft, run.draft);
      assert.deepEqual(recoverRun({ run }, data, 'unused').run, run);
      assert.equal(run.draft.offers.length, challenge.coachId ? 1 : 3);
      if (challenge.coachId) {
        assert.equal(run.draft.offers[0]!.id, challenge.coachId);
        assert.throws(() => applyDraftAction(run, { type: 'COACH', id: data.coaches.find((coach) => coach.id !== challenge.coachId)!.id }, data.players));
      }
      const fixedPlayers = challengeFixedPlayers(challenge);
      for (const fixed of fixedPlayers) assert.equal(run.draft.lineup[fixed.slot]!.id, fixed.id);
      assert.deepEqual(run.draft.rerolls, challenge.rerolls ?? { team: 1, era: 1 });
      run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
      while (run.phase === 'DRAFTING') {
        run = applyDraftAction(run, { type: 'SPIN' }, data.players);
        if (reverse) for (const kind of ['team', 'era'] as const) {
          const before = run;
          run = applyDraftAction(run, { type: 'REROLL', kind }, data.players);
          if (before === run) assert.equal(run.draft.rerolls[kind], before.draft.rerolls[kind]);
          else {
            assert.notEqual(run.draft.roll![kind === 'team' ? 'franchise' : 'decade'], before.draft.roll![kind === 'team' ? 'franchise' : 'decade']);
            assert.equal(run.draft.roll![kind === 'team' ? 'decade' : 'franchise'], before.draft.roll![kind === 'team' ? 'decade' : 'franchise']);
          }
        }
        if (challenge.decades) assert.ok(challenge.decades.includes(run.draft.roll!.decade));
        if (challenge.franchises) assert.ok(challenge.franchises.includes(run.draft.roll!.franchise));
        const candidates = availablePlayers(run.draft, pool).filter((player) => availableSlots(run.draft.lineup, player).length);
        const excluded = data.players.find((candidate) => !pool.some((allowed) => allowed.id === candidate.id));
        if (excluded) {
          const tampered = { ...run, draft: { ...run.draft, roll: { franchise: excluded.franchise, decade: excluded.decade } } };
          assert.throws(() => applyDraftAction(tampered, { type: 'PICK', id: excluded.id, slot: 'SIXTH' }, data.players));
        }
        const player = reverse ? candidates.at(-1)! : candidates[0]!;
        const slots = availableSlots(run.draft.lineup, player);
        const slot = reverse ? slots.at(-1)! : slots[0]!;
        run = applyDraftAction(run, { type: 'PICK', id: player.id, slot }, data.players);
        for (const fixed of fixedPlayers) assert.equal(run.draft.lineup[fixed.slot]!.id, fixed.id);
        assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, JSON.parse(JSON.stringify(run)));
      }
      assert.equal(run.actions.filter((action) => action.type === 'PICK').length, 6 - fixedPlayers.length);
      assert.equal(new Set(DRAFT_SLOTS.map((slot) => playerIdentity(run.draft.lineup[slot]!))).size, 6);
      assert.equal(run.draftRandomState, initial.draftRandomState);
      const complete = finishSeason(startSeason(run), data.opponents);
      assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, JSON.parse(JSON.stringify(complete)));
      assert.deepEqual(generateSchedule(initial.seed, data.opponents), generateSchedule(complete.seed, data.opponents));
      for (const patch of [{ challengeId: DAILY_CALENDAR[(index + 1) % 56]!.id }, { calendarVersion: 'future' },
        { calendarVersion: index < 28 ? 'calendar-2' : 'calendar-1' }, { date: dailyChallengeDate(index + 1) }])
        assert.equal(recoverRun({ run: { ...run, daily: { ...themed, ...patch } } }, data, 'unused').run, null);
    }
  }
});

test('Single-era challenges retain unavailable era rerolls and reject out-of-pool picks', () => {
  const challenge = DAILY_CALENDAR[15]!;
  const date = dailyChallengeDate(15);
  let run = createDailyRun({ version: 'daily-2', calendarVersion: DAILY_CALENDAR_VERSION, challengeId: challenge.id,
    date, startedAt: Date.parse(`${date}T00:00:00Z`), kind: 'local', attemptId: 'single-era' }, data.coaches, data.players);
  run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  run = applyDraftAction(run, { type: 'SPIN' }, data.players);
  assert.equal(applyDraftAction(run, { type: 'REROLL', kind: 'era' }, data.players), run);
  assert.equal(run.draft.rerolls.era, 1);
  const excluded = data.players.find((player) => player.decade !== '1980s')!;
  const tampered = { ...run, draft: { ...run.draft, roll: { franchise: excluded.franchise, decade: excluded.decade } } };
  assert.throws(() => applyDraftAction(tampered, { type: 'PICK', id: excluded.id, slot: 'SIXTH' }, data.players));
});

test('Legacy Daily seeds and offers are preserved; unpublished dates cannot start themed runs', () => {
  const legacy = createDailyRun(attempt, data.coaches);
  assert.equal(legacy.seed, dailySeed(attempt.date, 'daily-1'));
  assert.ok(legacy.seed.startsWith('daily-1:2026-09-16:mid:'));
  assert.equal(legacy.draft.offers.length, 3);
  assert.deepEqual(recoverRun({ run: legacy }, data, 'unused').run, legacy);
  assert.equal(dailySeed('2026-09-16', 'daily-2'), 'daily-2:2026-09-16:mid:iq-1:season-7:2026-09-14:fnv1a-mulberry32-1:conditional-score-3:rivalry-1:calendar-1:triangle-test');
  assert.throws(() => dailySeed(dailyChallengeDate(56), 'daily-2'));
  assert.throws(() => dailySeed(dailyChallengeDate(-1)));
  assert.doesNotThrow(() => dailySeed('2026-12-31', 'daily-1'));
});

test('Rotating Daily attempts replay across cycles and keep legacy commitments separate', () => {
  for (const day of [0, 1, 55, 56, 111, 112, 5600]) {
    const date = rotationDate(day);
    const challenge = rotatingChallengeForDate(date)!;
    const attempt: DailyAttempt = { version: 'daily-3', calendarVersion: DAILY_ROTATION_VERSION,
      challengeId: challenge.id, date, startedAt: Date.parse(`${date}T12:00:00Z`), kind: 'local', attemptId: `rotation-${day}` };
    let run = createDailyRun(attempt, data.coaches, data.players);
    const initial = structuredClone(run);
    assert.equal(run.seed, dailySeed(date));
    assert.deepEqual(createDailyRun({ ...attempt, kind: 'practice', attemptId: 'practice' }, data.coaches, data.players).draft, run.draft);
    run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
    while (run.phase === 'DRAFTING') {
      run = applyDraftAction(run, { type: 'SPIN' }, data.players);
      const player = availablePlayers(run.draft, playersForRun(run, data.players)).find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
      run = applyDraftAction(run, { type: 'PICK', id: player.id, slot: availableSlots(run.draft.lineup, player)[0]! }, data.players);
      assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, JSON.parse(JSON.stringify(run)));
    }
    const complete = finishSeason(startSeason(run), data.opponents);
    assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, JSON.parse(JSON.stringify(complete)));
    assert.notEqual(run.seed, dailySeed(rotationDate(day + 56)));
    assert.equal(run.draftRandomState, initial.draftRandomState);
    for (const patch of [{ calendarVersion: 'calendar-1' }, { calendarVersion: 'rotation-future' }, { challengeId: 'invalid' }, { date: rotationDate(day + 1) }])
      assert.equal(recoverRun({ run: { ...run, daily: { ...attempt, ...patch } } }, data, 'unused').run, null);
  }
  assert.notEqual(dailyCommitmentKey({ date: DAILY_ROTATION_START, version: 'daily-3' }), dailyCommitmentKey({ date: DAILY_ROTATION_START, version: 'daily-2' }));
  assert.equal(dailyCommitmentKey({ date: DAILY_ROTATION_START, version: 'daily-1' }), dailyCommitmentKey({ date: DAILY_ROTATION_START, version: 'daily-2' }));
  assert.throws(() => dailySeed('2026-09-16'));
  assert.doesNotThrow(() => dailySeed('2400-02-29'));
});