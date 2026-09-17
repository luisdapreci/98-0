import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compareDailyRecords, dailyPriorities, dailyRoll, dailySeed, dailyStatus, utcDate } from './daily.ts';
import type { DailyAttempt } from './daily.ts';
import { availablePlayers, availableSlots, DRAFT_SLOTS, playerIdentity, rollOptions } from './draft.ts';
import { applyDraftAction, createDailyRun, finishSeason, playersForRun, recoverRun, selectIQMode, startSeason } from './run.ts';
import type { RunData } from './run.ts';
import { generateSchedule } from './season.ts';
import { DAILY_CALENDAR, DAILY_CALENDAR_VERSION, challengeForDate, dailyChallengeDate, validateChallenge } from './daily-calendar.ts';

const data: RunData = {
  players: JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')),
  coaches: JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')),
  opponents: JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool,
};
const attempt: DailyAttempt = { version: 'daily-1', date: '2026-09-16',
  startedAt: Date.parse('2026-09-16T12:00:00Z'), kind: 'local', attemptId: 'daily-test' };

test('The published calendar has 28 distinct restrictions, proven completion coverage and no wraparound', () => {
  assert.equal(DAILY_CALENDAR.length, 28);
  assert.equal(new Set(DAILY_CALENDAR.map((challenge) => challenge.id)).size, 28);
  assert.equal(new Set(DAILY_CALENDAR.map(({ coachId, decades, franchises, fixedPlayer }) =>
    JSON.stringify({ coachId, decades: decades && [...decades].sort(), franchises: franchises && [...franchises].sort(), fixedPlayer }))).size, 28);
  for (const [index, challenge] of DAILY_CALENDAR.entries()) {
    assert.equal(challengeForDate(dailyChallengeDate(index)), challenge);
    validateChallenge(challenge, data.players, data.coaches);
  }
  assert.equal(challengeForDate(dailyChallengeDate(-1)), null);
  assert.equal(challengeForDate(dailyChallengeDate(28)), null);
  assert.throws(() => challengeForDate('2026-02-30'));
  assert.throws(() => validateChallenge(DAILY_CALENDAR[0]!, data.players.slice(0, 5), data.coaches));
});

test('Daily date, mode and rules are pinned with a strict UTC grace deadline', () => {
  const attempt: DailyAttempt = { version: 'daily-1', date: '2026-09-16',
    startedAt: Date.parse('2026-09-16T23:59:59Z'), kind: 'local', attemptId: 'first' };
  assert.equal(utcDate(attempt.startedAt), '2026-09-16');
  assert.match(dailySeed(attempt.date), /mid:iq-1:season-7/);
  assert.notEqual(dailySeed(attempt.date), dailySeed('2026-09-17'));
  assert.throws(() => dailySeed('2026-02-30'));
  assert.equal(dailyStatus(attempt, Date.parse('2026-09-17T23:59:59.999Z')), 'local');
  assert.equal(dailyStatus(attempt, Date.parse('2026-09-18T00:00:00Z')), 'late');
  assert.equal(dailyStatus({ ...attempt, kind: 'practice' }, Date.parse('2026-09-18T00:00:00Z')), 'practice');
  assert.throws(() => dailyStatus(attempt, attempt.startedAt - 1));
});

test('Daily priority streams are addressed independently by round and action', () => {
  const seed = dailySeed('2026-09-16');
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
  const record = { attempt, seed: dailySeed(attempt.date), iqMode: 'mid' as const, completedAt: attempt.startedAt,
    status: 'local' as const, wins: 60, pointDifferential: 200, longestWinStreak: 10 };
  assert.equal(compareDailyRecords(record, { ...record, completedAt: record.completedAt + 1 }), 0);
  assert.ok(compareDailyRecords(record, { ...record, wins: 59, pointDifferential: 900 }) < 0);
  assert.ok(compareDailyRecords(record, { ...record, pointDifferential: 199 }) < 0);
  assert.ok(compareDailyRecords(record, { ...record, longestWinStreak: 9 }) < 0);
  assert.throws(() => compareDailyRecords(record, { ...record, seed: dailySeed('2026-09-17') }));
});

test('All 28 themed Dailies enforce restrictions and replay complete drafts and seasons', () => {
  for (const [index, challenge] of DAILY_CALENDAR.entries()) {
    const date = dailyChallengeDate(index);
    const themed: DailyAttempt = { version: 'daily-2', calendarVersion: DAILY_CALENDAR_VERSION, challengeId: challenge.id,
      date, startedAt: Date.parse(`${date}T12:00:00Z`), kind: 'local', attemptId: `theme-${index}` };
    for (const reverse of [false, true]) {
      let run = createDailyRun(themed, data.coaches, data.players);
      const pool = playersForRun(run, data.players);
      const initial = structuredClone(run);
      assert.equal(run.seed, dailySeed(date));
      assert.deepEqual(createDailyRun({ ...themed, kind: 'practice', attemptId: 'practice' }, data.coaches, data.players).draft, run.draft);
      assert.deepEqual(recoverRun({ run }, data, 'unused').run, run);
      assert.equal(run.draft.offers.length, challenge.coachId ? 1 : 3);
      if (challenge.coachId) {
        assert.equal(run.draft.offers[0]!.id, challenge.coachId);
        assert.throws(() => applyDraftAction(run, { type: 'COACH', id: data.coaches.find((coach) => coach.id !== challenge.coachId)!.id }, data.players));
      }
      const fixed = challenge.fixedPlayer;
      if (fixed) assert.equal(run.draft.lineup[fixed.slot]!.id, fixed.id);
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
        const player = reverse ? candidates.at(-1)! : candidates[0]!;
        const slots = availableSlots(run.draft.lineup, player);
        const slot = reverse ? slots.at(-1)! : slots[0]!;
        run = applyDraftAction(run, { type: 'PICK', id: player.id, slot }, data.players);
        if (fixed) assert.equal(run.draft.lineup[fixed.slot]!.id, fixed.id);
        assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run })), data, 'unused').run, JSON.parse(JSON.stringify(run)));
      }
      assert.equal(run.actions.filter((action) => action.type === 'PICK').length, fixed ? 5 : 6);
      assert.equal(new Set(DRAFT_SLOTS.map((slot) => playerIdentity(run.draft.lineup[slot]!))).size, 6);
      assert.equal(run.draftRandomState, initial.draftRandomState);
      const complete = finishSeason(startSeason(run), data.opponents);
      assert.deepEqual(recoverRun(JSON.parse(JSON.stringify({ run: complete })), data, 'unused').run, JSON.parse(JSON.stringify(complete)));
      assert.deepEqual(generateSchedule(initial.seed, data.opponents), generateSchedule(complete.seed, data.opponents));
      for (const patch of [{ challengeId: DAILY_CALENDAR[(index + 1) % 28]!.id }, { calendarVersion: 'future' }, { date: dailyChallengeDate(index + 1) }])
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
  assert.throws(() => dailySeed(dailyChallengeDate(28)));
  assert.throws(() => dailySeed(dailyChallengeDate(-1)));
  assert.doesNotThrow(() => dailySeed('2026-12-31', 'daily-1'));
});