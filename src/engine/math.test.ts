import { parseResearchJson } from './research-files.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BALANCE_RULES_V1, BALANCE_RULES_V2, BALANCE_RULES_V3, calculateTeamOffense,
  calculateDefensiveComposite, calculateOffensiveContribution, calculateSixthManFRF,
  calculateSpacing, calculateUsageModifier, calculateWinProbability,
  normalizeStats, STARTER_POSITIONS,
} from './math.ts';
import { calculateDefenseBreakdown, calculateSynergy, evaluateGame } from './iq-math.ts';
import type { Coach, OpponentPool, Player, PlayerStats, TeamLineup } from './types.ts';
import { SCHEDULE_COUNTS } from './season.ts';
import { evaluateRosterCandidate, INITIAL_ROSTER_BALANCE } from './roster-balance.ts';
import { evaluatePossessionBudget, evaluatePossessionOffense } from './possession-prototype.ts';
import { evaluateLineupOffense } from './lineup-prototype.ts';
import { evaluateRoleAllocation } from './role-allocation.ts';

const baseStats: PlayerStats = {
  pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, fgPct: 0.5,
  threePtPct: 0.4, threePtAttempts: 3, usgPct: 20, dbpm: 1, eraPaceFactor: 1,
};

test('No IQ removes chemistry and coach effects while retaining individual and bench ability', () => {
  const rules = { ...BALANCE_RULES_V3, version: 'no-iq-1', chemistry: 'none' as const };
  const player = { id: 'test', stats: baseStats } as Player;
  const lineup: TeamLineup = { PG: player, SG: player, SF: player, PF: player, C: player, SIXTH: player,
    coach: { id: 'coach', modifiers: [{ stat: 'fgPct', delta: 0.1 }, { stat: 'threePtPct', delta: 0.1 },
      { stat: 'dbpm', delta: 3 }, { stat: 'pace', delta: 10 }, { stat: 'usgCap', delta: 50 }] } as Coach };
  const context = { opponentNetRating: 5, isHome: true, isBackToBack: true };
  const evaluation = evaluateGame(lineup, context, rules);
  assert.deepEqual(evaluation, evaluateGame({ ...lineup, coach: null }, context, rules));
  const changed = { ...player, stats: { ...baseStats, usgPct: 50, threePtAttempts: 30, threePtPct: 0.9 } };
  const noFit = evaluateGame({ ...lineup, PG: changed, SIXTH: changed }, context, rules);
  assert.equal(noFit.deltaRating, evaluation.deltaRating);
  assert.equal(noFit.synergy.phiUsg, 1);
  assert.equal(noFit.synergy.spacingModifier, 0);
  const defender = { ...player, stats: { ...baseStats, dbpm: 5 } };
  assert.equal(evaluateGame({ ...lineup, PG: defender }, context, rules).deltaRating,
    evaluateGame({ ...lineup, C: defender }, context, rules).deltaRating);
  assert.ok(evaluateGame({ ...lineup, PG: defender }, context, rules).deltaRating > evaluation.deltaRating);
  assert.ok(evaluateGame({ ...lineup, PG: { ...player, stats: { ...baseStats, pts: 30 } } }, context, rules).deltaRating > evaluation.deltaRating);
  assert.ok(evaluateGame({ ...lineup, SIXTH: null }, context, rules).deltaRating < evaluation.deltaRating);
  assert.equal(evaluation.homeCourtBonus, 3);
  assert.equal(evaluation.coachPaceModifier, 0);
  assert.equal(evaluation.synergy.drtgTeam, calculateDefenseBreakdown(lineup, rules).total);
});

test('core offense preserves legacy averages, rewards supporting talent and is position independent', () => {
  const contributions = Object.freeze([20, 4, 7, 18, 16]);
  close(calculateTeamOffense(contributions, BALANCE_RULES_V1), 108);
  close(calculateTeamOffense(contributions, BALANCE_RULES_V2), 95 + 0.2 * 13 + 0.8 * 18);
  assert.equal(calculateTeamOffense([...contributions].reverse(), BALANCE_RULES_V2), calculateTeamOffense(contributions, BALANCE_RULES_V2));
  for (let index = 0; index < 5; index++) {
    const stronger = [...contributions];
    stronger[index]! += 1;
    assert.ok(calculateTeamOffense(stronger, BALANCE_RULES_V2) > calculateTeamOffense(contributions, BALANCE_RULES_V2));
  }
  close(calculateTeamOffense([15, 15, 15, 15, 15], BALANCE_RULES_V2), 110);
  for (const weight of [-1, 2, NaN])
    assert.throws(() => calculateTeamOffense(contributions, { ...BALANCE_RULES_V2, version: 'invalid', coreOffenseWeight: weight }));
  assert.throws(() => calculateTeamOffense([1, 2]));
});

test('offline possession accounting conserves opportunities and separates points from turnovers', () => {
  const inputs = Array.from({ length: 5 }, (_, index) => ({ id: `player${index}`, points: 24,
    fieldGoalAttempts: 18, freeThrowAttempts: 4, turnovers: 3 }));
  const snapshot = structuredClone(inputs);
  const result = evaluatePossessionBudget(inputs);
  close(result.pointsPer100UsedEnds, 100 * 24 / (18 + 0.44 * 4 + 3));
  close(result.shotEnds + result.turnoverEnds, 100);
  close(result.players.reduce((sum, player) => sum + player.allocatedEnds, 0), 100);
  assert.deepEqual(inputs, snapshot);
  for (let index = 0; index < 5; index++) {
    const scoring = structuredClone(inputs);
    scoring[index]!.points += 1;
    assert.ok(evaluatePossessionBudget(scoring).pointsPer100UsedEnds > result.pointsPer100UsedEnds);
    const turnovers = structuredClone(inputs);
    turnovers[index]!.turnovers += 1;
    assert.ok(evaluatePossessionBudget(turnovers).pointsPer100UsedEnds < result.pointsPer100UsedEnds);
    assert.ok(evaluatePossessionBudget(turnovers, [0.2, 0.2, 0.2, 0.2, 0.2]).pointsPer100UsedEnds < result.pointsPer100UsedEnds);
  }
  close(evaluatePossessionBudget([...inputs].reverse()).pointsPer100UsedEnds, result.pointsPer100UsedEnds);
  close(evaluatePossessionBudget(inputs.map((input) => ({ ...input, points: input.points * 2,
    fieldGoalAttempts: input.fieldGoalAttempts * 2, freeThrowAttempts: input.freeThrowAttempts * 2,
    turnovers: input.turnovers * 2 }))).pointsPer100UsedEnds, result.pointsPer100UsedEnds);
  close(evaluatePossessionBudget(inputs, [1, 0, 0, 0, 0]).pointsPer100UsedEnds, result.pointsPer100UsedEnds);
  for (const value of [null, NaN, -1, Infinity])
    assert.throws(() => evaluatePossessionBudget(inputs.map((input, index) => index ? input : { ...input, turnovers: value })), /Observed/);
  for (const shares of [[1], [0, 0, 0, 0, 0], [1.1, -0.1, 0, 0, 0], [NaN, 0, 0, 0, 0]])
    assert.throws(() => evaluatePossessionBudget(inputs, shares), /shares/);
  assert.throws(() => evaluatePossessionBudget(inputs.slice(1)), /Five distinct/);
  assert.throws(() => evaluatePossessionBudget(inputs.map((input) => ({ ...input, id: 'same' }))), /Five distinct/);
  assert.throws(() => evaluatePossessionBudget(inputs.map((input) => ({ ...input, fieldGoalAttempts: 0, freeThrowAttempts: 0 }))), /exposure/);
  close(evaluatePossessionBudget(inputs.map((input) => ({ ...input, turnovers: 0 }))).turnoverEnds, 0);
});

test('possession offense v2 conserves net possessions without regression weights or duplicate scoring bonuses', () => {
  const inputs = Array.from({ length: 5 }, (_, index) => ({ id: `player${index}`, points: 18,
    fieldGoalAttempts: 14, freeThrowAttempts: 0, turnovers: 2, offensiveRebounds: 1, threePointAttempts: 4 }));
  const policy = { referencePossessionsPer36: 75, maxWorkloadMultiplier: null as number | null };
  const snapshot = structuredClone(inputs);
  const result = evaluatePossessionOffense(inputs, policy);
  close(result.pointsPer100Possessions!, 120);
  close(result.workloadMultiplier, 1);
  close(result.shotEnds + result.turnoverEnds - result.reboundContinuations, 100);
  close(result.players.reduce((sum, player) => sum + player.points, 0), 120);
  close(evaluatePossessionOffense([...inputs].reverse(), policy).pointsPer100Possessions!, 120);
  close(evaluatePossessionOffense(inputs.map((input) => ({ ...input, threePointAttempts: 8 })), policy).pointsPer100Possessions!, 120);
  close(evaluatePossessionOffense(inputs.map((input) => ({ ...input, assists: 100 })), policy).pointsPer100Possessions!, 120);
  const zeroRebounds = inputs.map((input) => ({ ...input, offensiveRebounds: 0 }));
  close(evaluatePossessionOffense(zeroRebounds, policy).pointsPer100Possessions!, evaluatePossessionBudget(inputs).pointsPer100UsedEnds);
  for (let index = 0; index < 5; index++) {
    const replace = (field: 'points' | 'turnovers' | 'offensiveRebounds') => inputs.map((input, position) =>
      position === index ? { ...input, [field]: input[field] + 1 } : input);
    assert.ok(evaluatePossessionOffense(replace('points'), policy).pointsPer100Possessions! > 120);
    assert.ok(evaluatePossessionOffense(replace('turnovers'), policy).pointsPer100Possessions! < 120);
    assert.ok(evaluatePossessionOffense(replace('offensiveRebounds'), policy).pointsPer100Possessions! > 120);
  }
  const half = inputs.map((input) => ({ ...input, points: 9, fieldGoalAttempts: 7, turnovers: 1,
    offensiveRebounds: 0.5, threePointAttempts: 2 }));
  close(evaluatePossessionOffense(half, policy).pointsPer100Possessions!, 120);
  close(evaluatePossessionOffense(half, policy).workloadMultiplier, 2);
  const shortfall = evaluatePossessionOffense(half, { ...policy, maxWorkloadMultiplier: 1.25 });
  assert.equal(shortfall.status, 'workload-shortfall');
  assert.equal(shortfall.pointsPer100Possessions, null);
  close(shortfall.unconstrainedPointsPer100Possessions, 120);
  assert.deepEqual(inputs, snapshot);
  for (const value of [null, NaN, Infinity, -1]) for (const field of ['offensiveRebounds', 'threePointAttempts'] as const)
    assert.throws(() => evaluatePossessionOffense(inputs.map((input, index) => index ? input : { ...input, [field]: value }), policy), /Observed/);
  assert.throws(() => evaluatePossessionOffense(inputs.map((input) => ({ ...input, threePointAttempts: 15 })), policy), /Three-point/);
  assert.throws(() => evaluatePossessionOffense(inputs.map((input) => ({ ...input, offensiveRebounds: 20 })), policy), /possession/);
  assert.throws(() => evaluatePossessionOffense(inputs, { ...policy, referencePossessionsPer36: 0 }), /reference/);
  assert.throws(() => evaluatePossessionOffense(inputs, { ...policy, maxWorkloadMultiplier: NaN }), /reference/);
});

test('offline lineup allocation exposes workload expansion, turnover costs and unfilled capacity', () => {
  const inputs = Array.from({ length: 5 }, (_, index) => ({ id: `player${index}`, shotWorkloadRatio: 1,
    trueShootingDelta: 0, turnoverRateRatio: 1, assistRateRatio: 1 }));
  const policy = { referenceShotPointsPerEnd: 1.1, referenceTurnoverShare: 0.12,
    turnoverShotResponse: 0, capacityMultiplier: null as number | null };
  const snapshot = structuredClone(inputs);
  for (const response of [0, 0.5, 1]) {
    for (const capacity of [null, 1, 1.25]) {
      const result = evaluateLineupOffense(inputs, { ...policy, turnoverShotResponse: response, capacityMultiplier: capacity });
      close(result.shotEnds, 88);
      close(result.turnoverEnds, 12);
      close(result.pointsOnAllocatedEvents, 96.8);
      close(result.maxWorkloadMultiplier, 1);
      assert.equal(result.status, 'fully-allocated');
    }
  }
  const lowVolume = inputs.map((input) => ({ ...input, shotWorkloadRatio: 0.5 }));
  const expanded = evaluateLineupOffense(lowVolume, policy);
  close(expanded.maxWorkloadMultiplier, 2);
  const capped = evaluateLineupOffense(lowVolume, { ...policy, capacityMultiplier: 1 });
  close(capped.shotEnds, 44);
  close(capped.turnoverEnds, 12);
  close(capped.unallocatedEnds, 44);
  assert.equal(capped.status, 'capacity-shortfall');
  const mixed = inputs.map((input, index) => ({ ...input, shotWorkloadRatio: index ? 2 : 0.5 }));
  const reallocated = evaluateLineupOffense(mixed, { ...policy, capacityMultiplier: 1 }, [0.2, 0.2, 0.2, 0.2, 0.2]);
  close(reallocated.players[0]!.allocatedShots, 8.8);
  close(reallocated.players[1]!.allocatedShots, 19.8);
  close(reallocated.unallocatedEnds, 0);
  const response = evaluateLineupOffense(lowVolume, { ...policy, turnoverShotResponse: 1 });
  assert.ok(response.turnoverEnds > expanded.turnoverEnds);
  close(response.shotEnds + response.turnoverEnds, 100);
  for (let index = 0; index < 5; index++) {
    const stronger = inputs.map((input, position) => position === index ? { ...input, trueShootingDelta: 0.01 } : input);
    assert.ok(evaluateLineupOffense(stronger, policy).pointsOnAllocatedEvents > 96.8);
    const sloppier = inputs.map((input, position) => position === index ? { ...input, turnoverRateRatio: 1.5 } : input);
    for (const turnoverShotResponse of [0, 0.5, 1])
      assert.ok(evaluateLineupOffense(sloppier, { ...policy, turnoverShotResponse }).pointsOnAllocatedEvents < 96.8);
  }
  close(evaluateLineupOffense([...mixed].reverse(), policy).pointsOnAllocatedEvents,
    evaluateLineupOffense(mixed, policy).pointsOnAllocatedEvents);
  close(evaluateLineupOffense(inputs.map((input) => ({ ...input, assistRateRatio: 2 })), policy).pointsOnAllocatedEvents, 96.8);
  close(evaluateLineupOffense(inputs.map((input) => ({ ...input, turnoverRateRatio: 0 })), policy).turnoverEnds, 0);
  assert.deepEqual(inputs, snapshot);
  assert.throws(() => evaluateLineupOffense(inputs.slice(1), policy), /Five distinct/);
  assert.throws(() => evaluateLineupOffense(inputs.map((input) => ({ ...input, id: 'same_era' })), policy), /Five distinct/);
  for (const value of [null, NaN, Infinity, -1])
    assert.throws(() => evaluateLineupOffense(inputs.map((input, index) => index ? input : { ...input, turnoverRateRatio: value }), policy), /Observed/);
  assert.throws(() => evaluateLineupOffense(inputs.map((input) => ({ ...input, shotWorkloadRatio: 0 })), policy), /exposure/);
  assert.throws(() => evaluateLineupOffense(inputs, { ...policy, capacityMultiplier: 0 }), /capacity/);
  assert.throws(() => evaluateLineupOffense(inputs, { ...policy, turnoverShotResponse: 2 }), /response/);
  assert.throws(() => evaluateLineupOffense(inputs, policy, [1, 0, 0, 0]), /shares/);
  assert.throws(() => evaluateLineupOffense(inputs.map((input) => ({ ...input, turnoverRateRatio: 100 })), policy), /budget/);
  assert.throws(() => evaluateLineupOffense(inputs.map((input) => ({ ...input, shotWorkloadRatio: 1e-320 })), policy), /Finite/);
  for (let sample = 0; sample < 40; sample++) {
    const lineup = inputs.map((input, index) => ({ ...input,
      shotWorkloadRatio: 0.1 + ((sample * 7 + index * 11) % 30) / 10,
      turnoverRateRatio: ((sample * 3 + index * 7) % 25) / 10,
      trueShootingDelta: -0.1 + ((sample + index) % 15) / 50 }));
    for (const turnoverShotResponse of [0, 0.5, 1]) for (const capacityMultiplier of [null, 1, 1.25, 1.5]) {
      const settings = { ...policy, turnoverShotResponse, capacityMultiplier };
      for (const shares of [undefined, [0.2, 0.2, 0.2, 0.2, 0.2], [1, 0, 0, 0, 0]]) {
        const result = evaluateLineupOffense(lineup, settings, shares);
        close(result.shotEnds + result.turnoverEnds + result.unallocatedEnds, 100);
        close(result.pointsOnAllocatedEvents, result.players.reduce((sum, player) => sum + player.points, 0));
        for (const player of result.players) {
          assert.ok(Number.isFinite(player.workloadMultiplier) && player.workloadMultiplier >= 0);
          if (capacityMultiplier !== null) assert.ok(player.workloadMultiplier <= capacityMultiplier + 1e-10);
          close(player.turnoverEnds, player.observedTurnovers * (1 - turnoverShotResponse + turnoverShotResponse * player.workloadMultiplier));
          if (!player.requestedShotShare) close(player.allocatedShots, 0);
        }
        const reverse = evaluateLineupOffense([...lineup].reverse(), settings, shares ? [...shares].reverse() : undefined);
        close(reverse.pointsOnAllocatedEvents, result.pointsOnAllocatedEvents);
        close(reverse.unallocatedEnds, result.unallocatedEnds);
      }
    }
  }
});

test('dual role allocation conserves independent budgets and retains passing turnover exposure', () => {
  const inputs = Array.from({ length: 5 }, (_, index) => ({ id: `player${index}`, shotWorkloadRatio: 1,
    trueShootingDelta: 0, turnoverRateRatio: 1, assistRateRatio: 1 }));
  const policy = { referenceShotPointsPerEnd: 1.1, referenceTurnoverShare: 0.12,
    shotTurnoverFraction: 0.5, passingTurnoverFraction: 0.5,
    shotCapacityMultiplier: null as number | null, passingCapacityMultiplier: null as number | null };
  const snapshot = structuredClone(inputs);
  const neutral = evaluateRoleAllocation(inputs, policy);
  close(neutral.shotEnds, 88);
  close(neutral.turnoverEnds, 12);
  close(neutral.passingUnits, 100);
  close(neutral.pointsOnAllocatedEvents, 96.8);
  const shots = [0.1, 0.225, 0.225, 0.225, 0.225];
  const retained = evaluateRoleAllocation(inputs, policy, { shots, passing: [0.4, 0.15, 0.15, 0.15, 0.15] });
  const compressed = evaluateRoleAllocation(inputs, policy, { shots, passing: shots });
  close(retained.players[0]!.allocatedShots, compressed.players[0]!.allocatedShots);
  close(retained.players[0]!.shotWorkloadMultiplier, 0.5);
  close(retained.players[0]!.passingWorkloadMultiplier!, 2);
  close(compressed.players[0]!.passingWorkloadMultiplier!, 0.5);
  close(retained.players[0]!.turnoverEnds, 3);
  close(compressed.players[0]!.turnoverEnds, 1.2);
  close(retained.pointsOnAllocatedEvents, compressed.pointsOnAllocatedEvents);
  const lowPassing = inputs.map((input) => ({ ...input, assistRateRatio: 0.5 }));
  const missingPassing = evaluateRoleAllocation(lowPassing, { ...policy, passingCapacityMultiplier: 1 });
  close(missingPassing.unallocatedPassing, 50);
  close(missingPassing.unallocatedEnds, 0);
  assert.equal(missingPassing.status, 'role-shortfall');
  const none = evaluateRoleAllocation(inputs.map((input) => ({ ...input, assistRateRatio: 0, turnoverRateRatio: 0 })), policy);
  close(none.unallocatedPassing, 100);
  close(none.passingUnits, 0);
  close(none.pointsOnAllocatedEvents, 110);
  assert.ok(none.players.every((player) => player.passingWorkloadMultiplier === null));
  assert.throws(() => evaluateRoleAllocation(inputs.map((input) => ({ ...input, assistRateRatio: 0 })), policy), /Unsupported passing/);
  for (const fraction of [NaN, Infinity, -1, 1.1])
    assert.throws(() => evaluateRoleAllocation(inputs, { ...policy, passingTurnoverFraction: fraction }), /fractions/);
  assert.throws(() => evaluateRoleAllocation(inputs, policy, { passing: [1, 0] }), /shares/);
  assert.throws(() => evaluateRoleAllocation(inputs, { ...policy, passingCapacityMultiplier: 0 }), /capacity/);
  assert.throws(() => evaluateRoleAllocation(inputs.map((input) => ({ ...input, assistRateRatio: 1e-320 })), policy), /Finite/);
  assert.throws(() => evaluateRoleAllocation(inputs.map((input) => ({ ...input, assistRateRatio: 0.01 })), policy), /budget/);
  const concentrated = evaluateRoleAllocation(inputs, policy, { shots: [1, 0, 0, 0, 0], passing: [0, 1, 0, 0, 0] });
  close(concentrated.players[0]!.allocatedPassing, 0);
  close(concentrated.players[1]!.allocatedShots, 0);
  close(concentrated.players[1]!.allocatedPassing, 100);
  const passingCapped = evaluateRoleAllocation(inputs, { ...policy, passingCapacityMultiplier: 1 }, { passing: [0.6, 0.1, 0.1, 0.1, 0.1] });
  for (const player of passingCapped.players) close(player.allocatedPassing, 20);
  assert.deepEqual(inputs, snapshot);
  for (let sample = 0; sample < 24; sample++) {
    const lineup = inputs.map((input, index) => ({ ...input,
      shotWorkloadRatio: 0.5 + ((sample * 3 + index * 7) % 20) / 10,
      assistRateRatio: 0.5 + ((sample * 5 + index * 3) % 25) / 10,
      turnoverRateRatio: ((sample * 7 + index * 11) % 20) / 10 }));
    for (const [shotTurnoverFraction, passingTurnoverFraction] of [[1, 0], [0.5, 0], [0.5, 0.5], [0.25, 0.5]] as const)
      for (const cap of [null, 1, 1.25]) for (const explicit of [false, true]) {
        const settings = { ...policy, shotTurnoverFraction, passingTurnoverFraction, shotCapacityMultiplier: cap, passingCapacityMultiplier: cap };
        const shares = explicit ? { shots: [0.1, 0.2, 0.3, 0.2, 0.2], passing: [0.4, 0.2, 0.2, 0.1, 0.1] } : {};
        const result = evaluateRoleAllocation(lineup, settings, shares);
        close(result.shotEnds + result.turnoverEnds + result.unallocatedEnds, 100);
        close(result.passingUnits + result.unallocatedPassing, 100);
        for (const player of result.players) {
          close(player.turnoverEnds, player.observedTurnovers * (1 - shotTurnoverFraction - passingTurnoverFraction
            + shotTurnoverFraction * player.shotWorkloadMultiplier + passingTurnoverFraction * player.passingWorkloadMultiplier!));
          if (cap !== null) {
            assert.ok(player.shotWorkloadMultiplier <= cap + 1e-10);
            assert.ok(player.passingWorkloadMultiplier! <= cap + 1e-10);
          }
        }
        const reverse = evaluateRoleAllocation([...lineup].reverse(), settings, explicit
          ? { shots: [...shares.shots!].reverse(), passing: [...shares.passing!].reverse() } : {});
        close(reverse.pointsOnAllocatedEvents, result.pointsOnAllocatedEvents);
        close(reverse.unallocatedPassing, result.unallocatedPassing);
        if (passingTurnoverFraction === 0) {
          const original = evaluateLineupOffense(lineup, { referenceShotPointsPerEnd: policy.referenceShotPointsPerEnd,
            referenceTurnoverShare: policy.referenceTurnoverShare, turnoverShotResponse: shotTurnoverFraction, capacityMultiplier: cap }, shares.shots);
          close(result.pointsOnAllocatedEvents, original.pointsOnAllocatedEvents);
          close(result.turnoverEnds, original.turnoverEnds);
        }
      }
  }
});

test('dual role study reproduces separate capacity ledgers without counting passing as scoring events', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const report = load('docs/research/mid-iq/MID_IQ_ROLE_ALLOCATION_1.json');
  const original = load('docs/research/mid-iq/MID_IQ_LINEUP_PROTOTYPE_1.json');
  assert.equal(report.scope, 'exposed-dual-role-allocation-sensitivity');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  for (const [field, path] of Object.entries({ implementationSha256: './role-allocation.ts', evaluatorSha256: './calibrate-roles.ts' }))
    assert.equal(createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex'), report[field]);
  const inputs = new Map<string, Parameters<typeof evaluateRoleAllocation>[0][number]>(original.players.map(
    (player: Parameters<typeof evaluateRoleAllocation>[0][number]) => [player.id, player]));
  const splits = [{ id: 'shot-only', shot: 1, passing: 0 }, { id: 'half-fixed', shot: 0.5, passing: 0 },
    { id: 'split-roles', shot: 0.5, passing: 0.5 }, { id: 'mixed-fixed', shot: 0.25, passing: 0.5 }];
  const caps = [{ id: 'uncapped', shots: null, passing: null }, { id: 'shot-1.25', shots: 1.25, passing: null },
    { id: 'passing-1.25', shots: null, passing: 1.25 }, { id: 'both-1.25', shots: 1.25, passing: 1.25 },
    { id: 'both-1.5', shots: 1.5, passing: 1.5 }];
  const allocations = ['observed', 'lead-passer-half', 'equal-shots'];
  assert.equal(report.protocol.referenceSeason, 2020);
  assert.deepEqual(report.protocol.turnoverSplits, splits);
  assert.deepEqual(report.protocol.capacityPairs, caps);
  assert.deepEqual(report.protocol.allocations, allocations);
  assert.equal(report.supportedRosters, 30);
  assert.equal(report.evaluatedScenarios, 1800);
  assert.deepEqual(report.rows.map((row: { id: string }) => row.id), original.rows.map((row: { id: string }) => row.id));
  const baseline = load('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json').seasons.find((row: { season: number }) => row.season === 2020);
  let evaluated = 0;
  for (const [index, row] of report.rows.entries()) {
    const source = original.rows[index];
    assert.equal('expectedWins' in row, false);
    if (source.status === 'unsupported-data') {
      assert.equal(row.status, source.status);
      assert.deepEqual(row.unsupportedIds, source.unsupportedIds);
      assert.equal(row.scenarios, undefined);
      continue;
    }
    assert.deepEqual(row.playerIds, source.playerIds);
    assert.equal(row.coachId, source.coachId);
    const starters = (row.playerIds as string[]).slice(0, 5).map((id) => inputs.get(id)!);
    const lead = [...starters].sort((first, second) => second.assistRateRatio! - first.assistRateRatio!
      || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0))[0]!;
    assert.equal(row.leadPasserId, lead.id);
    const otherDemand = starters.filter((player) => player.id !== lead.id).reduce((sum, player) => sum + player.assistRateRatio!, 0);
    assert.deepEqual(row.scenarios.map((scenario: { turnoverSplit: string; capacityPair: string; allocation: string }) =>
      `${scenario.turnoverSplit}:${scenario.capacityPair}:${scenario.allocation}`),
    splits.flatMap((split) => caps.flatMap((cap) => allocations.map((allocation) => `${split.id}:${cap.id}:${allocation}`))));
    for (const scenario of row.scenarios) {
      evaluated++;
      assert.equal(scenario.status, 'evaluated');
      const split = splits.find((split) => split.id === scenario.turnoverSplit)!;
      const cap = caps.find((cap) => cap.id === scenario.capacityPair)!;
      const shares = scenario.allocation === 'lead-passer-half' ? { passing: starters.map((player) => player.id === lead.id
        ? 0.5 : 0.5 * player.assistRateRatio! / otherDemand) }
        : scenario.allocation === 'equal-shots' ? { shots: [0.2, 0.2, 0.2, 0.2, 0.2] } : {};
      const settings = { referenceShotPointsPerEnd: baseline.shotPointsPerEnd, referenceTurnoverShare: baseline.turnoverShare,
        shotTurnoverFraction: split.shot, passingTurnoverFraction: split.passing, shotCapacityMultiplier: cap.shots, passingCapacityMultiplier: cap.passing };
      const result: ReturnType<typeof evaluateRoleAllocation> = scenario.result;
      const replayShares = shares.passing ? { passing: result.players.map((player) => player.requestedPassingShare) } : shares;
      assert.deepEqual(result, evaluateRoleAllocation(starters, settings, replayShares));
      const shotDemand = starters.reduce((sum, player) => sum + player.shotWorkloadRatio!, 0);
      const passDemand = starters.reduce((sum, player) => sum + player.assistRateRatio!, 0);
      let points = 0, shots = 0, passing = 0, turnovers = 0;
      for (const [position, input] of starters.entries()) {
        const player = result.players[position]!;
        assert.equal(player.id, input.id);
        close(player.observedShots, 20 * (1 - baseline.turnoverShare) * input.shotWorkloadRatio!);
        close(player.observedPassing, 20 * input.assistRateRatio!);
        close(player.observedTurnovers, 20 * baseline.turnoverShare * input.turnoverRateRatio!);
        close(player.requestedShotShare, shares.shots?.[position] ?? input.shotWorkloadRatio! / shotDemand);
        close(player.requestedPassingShare, shares.passing?.[position] ?? input.assistRateRatio! / passDemand);
        close(player.shotWorkloadMultiplier, player.allocatedShots / player.observedShots);
        close(player.passingWorkloadMultiplier!, player.allocatedPassing / player.observedPassing);
        close(player.fixedTurnovers, player.observedTurnovers * (1 - split.shot - split.passing));
        close(player.shotLinkedTurnovers, player.observedTurnovers * split.shot * player.shotWorkloadMultiplier);
        close(player.passingLinkedTurnovers, player.observedTurnovers * split.passing * player.passingWorkloadMultiplier!);
        close(player.turnoverEnds, player.fixedTurnovers + player.shotLinkedTurnovers + player.passingLinkedTurnovers);
        close(player.shotPointsPerEnd, baseline.shotPointsPerEnd + 2 * input.trueShootingDelta!);
        close(player.points, player.allocatedShots * player.shotPointsPerEnd);
        if (cap.shots === null) assert.equal(player.shotCapacity, null);
        else { close(player.shotCapacity!, cap.shots * player.observedShots); assert.ok(player.allocatedShots <= player.shotCapacity! + 1e-8); }
        if (cap.passing === null) assert.equal(player.passingCapacity, null);
        else { close(player.passingCapacity!, cap.passing * player.observedPassing); assert.ok(player.allocatedPassing <= player.passingCapacity! + 1e-8); }
        shots += player.allocatedShots;
        passing += player.allocatedPassing;
        turnovers += player.turnoverEnds;
        points += player.points;
      }
      close(result.shotEnds, shots);
      close(result.turnoverEnds, turnovers);
      close(result.pointsOnAllocatedEvents, points);
      close(result.passingUnits, passing);
      close(shots + turnovers + result.unallocatedEnds, 100);
      close(passing + result.unallocatedPassing, 100);
      assert.equal(result.status, result.unallocatedEnds > 1e-8 || result.unallocatedPassing > 1e-8 ? 'role-shortfall' : 'fully-allocated');
      for (const role of ['shots', 'passing']) {
        const records = result.players.map((player) => role === 'shots'
          ? { amount: player.allocatedShots, capacity: player.shotCapacity, weight: player.requestedShotShare }
          : { amount: player.allocatedPassing, capacity: player.passingCapacity, weight: player.requestedPassingShare });
        const level = Math.max(...records.map((record) => record.amount / record.weight));
        for (const record of records) {
          if ((role === 'shots' ? result.unallocatedEnds : result.unallocatedPassing) > 1e-8) close(record.amount, record.capacity!);
          if (record.capacity === null || record.amount < record.capacity - 1e-8) close(record.amount / record.weight, level);
        }
      }
    }
  }
  assert.equal(evaluated, 1800);
});

test('lineup study preserves peak rates, complete policy grids and capped allocation ledgers', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const report = load('docs/research/mid-iq/MID_IQ_LINEUP_PROTOTYPE_1.json');
  const audit = load('docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json');
  const era = load('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json');
  const catalog = load('data/reference/mid-iq-roster-benchmarks.json');
  assert.equal(report.scope, 'exposed-lineup-allocation-sensitivity');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  for (const [field, path] of Object.entries({ implementationSha256: './lineup-prototype.ts', evaluatorSha256: './calibrate-lineups.ts' }))
    assert.equal(createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex'), report[field]);
  interface Baseline { season: number; shotPointsPerEnd: number; turnoverShare: number | null;
    totals: { turnovers: number | null; minutes: number } }
  const baselines = new Map<number, Baseline>(era.seasons.map((row: Baseline) => [row.season, row]));
  assert.equal(report.players.length, 4411);
  assert.equal(report.supportedPlayers, 3697);
  let readyCount = 0;
  for (const [index, input] of report.players.entries()) {
    const peak = audit.players[index];
    const context = era.players[index];
    assert.equal(input.id, peak.id);
    assert.equal(input.id, context.id);
    assert.deepEqual(input.peakYears, peak.peakYears);
    close(input.shotWorkloadRatio, context.shotWorkloadRatio);
    close(input.trueShootingDelta, context.trueShootingDelta);
    close(input.assistRateRatio, context.assistRateRatio);
    let observed = 0, expected = 0;
    let ready = peak.ready;
    for (const selected of peak.selected) {
      const baseline = baselines.get(selected.season)!;
      if (selected.stats.turnovers === null || baseline.totals.turnovers === null) ready = false;
      else {
        observed += selected.games * selected.stats.turnovers;
        expected += selected.games * selected.stats.minutes * baseline.totals.turnovers / baseline.totals.minutes;
      }
    }
    assert.equal(input.ready, ready && expected > 0);
    if (input.ready) { readyCount++; close(input.turnoverRateRatio, observed / expected); }
    else assert.equal(input.turnoverRateRatio, null);
  }
  assert.equal(readyCount, report.supportedPlayers);
  type Input = Parameters<typeof evaluateLineupOffense>[0][number] & { ready: boolean };
  const inputs = new Map<string, Input>(report.players.map((input: Input) => [input.id, input]));
  const rosterIds = new Map<string, string[]>(catalog.rosters.map((row: { id: string; players: string[] }) => [row.id, row.players]));
  const slots = ['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH'];
  for (const variant of catalog.variants) rosterIds.set(variant.id, rosterIds.get(variant.parent)!
    .map((id, index) => variant.replace[slots[index]!] ?? id));
  assert.deepEqual(report.rows.map((row: { id: string }) => row.id), [...rosterIds.keys()]);
  assert.equal(report.supportedRosters, 30);
  assert.deepEqual(report.rows.filter((row: { status: string }) => row.status === 'unsupported-data').map((row: { id: string }) => row.id), ['E05', 'F06']);
  for (const row of report.rows) {
    const ids = rosterIds.get(row.id)!;
    const unsupported = ids.filter((id) => !inputs.get(id)!.ready);
    assert.equal('expectedWins' in row, false);
    if (unsupported.length) {
      assert.equal(row.status, 'unsupported-data');
      assert.deepEqual(row.unsupportedIds, unsupported);
      assert.equal(row.scenarios, undefined);
      continue;
    }
    assert.deepEqual(row.playerIds, ids);
    assert.equal(row.scenarios.length, 72);
    const expectedKeys = [1990, 2010, 2020].flatMap((year) => [0, 0.5, 1].flatMap((response) => [null, 1, 1.25, 1.5]
      .flatMap((cap) => ['observed', 'equal'].map((allocation) => JSON.stringify([year, response, cap, allocation])))));
    assert.deepEqual(row.scenarios.map((scenario: { referenceSeason: number; turnoverShotResponse: number; capacityMultiplier: number | null; allocation: string }) =>
      JSON.stringify([scenario.referenceSeason, scenario.turnoverShotResponse, scenario.capacityMultiplier, scenario.allocation])), expectedKeys);
    for (const scenario of row.scenarios) {
      const baseline = baselines.get(scenario.referenceSeason)!;
      const result: ReturnType<typeof evaluateLineupOffense> = scenario.result;
      const starters = ids.slice(0, 5).map((id) => inputs.get(id)!);
      const response = scenario.turnoverShotResponse;
      const cap = scenario.capacityMultiplier;
      const settings = { referenceShotPointsPerEnd: baseline.shotPointsPerEnd, referenceTurnoverShare: baseline.turnoverShare!,
        turnoverShotResponse: response, capacityMultiplier: cap };
      assert.deepEqual(result, evaluateLineupOffense(starters, settings, scenario.allocation === 'equal' ? [0.2, 0.2, 0.2, 0.2, 0.2] : undefined));
      const nominalShots = starters.map((input) => 20 * (1 - baseline.turnoverShare!) * input.shotWorkloadRatio!);
      const demand = nominalShots.reduce((sum, value) => sum + value, 0);
      const levels: number[] = [];
      let points = 0, shots = 0, turnovers = 0;
      for (const [index, input] of starters.entries()) {
        const player = result.players[index];
        assert.ok(player);
        assert.equal(player.id, input.id);
        const nominalTurnovers = 20 * baseline.turnoverShare! * input.turnoverRateRatio!;
        const weight = scenario.allocation === 'equal' ? 0.2 : nominalShots[index]! / demand;
        const multiplier = player.allocatedShots / nominalShots[index]!;
        close(player.requestedShotShare, weight);
        close(player.observedShots, nominalShots[index]!);
        close(player.observedTurnovers, nominalTurnovers);
        close(player.workloadMultiplier, multiplier);
        close(player.fixedTurnovers, nominalTurnovers * (1 - response));
        close(player.shotLinkedTurnovers, nominalTurnovers * response * multiplier);
        close(player.points, player.allocatedShots * (baseline.shotPointsPerEnd + 2 * input.trueShootingDelta!));
        if (cap !== null) {
          assert.ok(player.shotCapacity !== null);
          close(player.shotCapacity, cap * nominalShots[index]!);
          assert.ok(multiplier <= cap + 1e-10);
        }
        else assert.equal(player.shotCapacity, null);
        levels.push(player.allocatedShots / weight);
        shots += player.allocatedShots;
        turnovers += nominalTurnovers * (1 - response + response * multiplier);
        points += player.points;
      }
      close(result.shotEnds, shots);
      close(result.turnoverEnds, turnovers);
      close(result.pointsOnAllocatedEvents, points);
      close(result.shotEnds + result.turnoverEnds + result.unallocatedEnds, 100);
      close(result.maxWorkloadMultiplier, Math.max(...result.players.map((player: { workloadMultiplier: number }) => player.workloadMultiplier)));
      assert.equal(result.status, result.unallocatedEnds > 1e-8 ? 'capacity-shortfall' : 'fully-allocated');
      const level = Math.max(...levels);
      for (const [index, player] of result.players.entries()) {
        if (result.status === 'capacity-shortfall') {
          assert.notEqual(player.shotCapacity, null);
          close(player.allocatedShots, player.shotCapacity!);
        }
        if (player.shotCapacity === null || player.allocatedShots < player.shotCapacity - 1e-8) close(levels[index]!, level);
      }
    }
  }
});

test('possession audit preserves selected peaks and pooled counts without filling missing turnovers', () => {
  const audit = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json', import.meta.url), 'utf8'));
  const stored: Player[] = parseResearchJson(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8'));
  const byId = new Map(stored.map((player) => [player.id, player]));
  let ready = 0;
  assert.equal(audit.players.length, stored.length);
  assert.deepEqual(audit.joinIssues, []);
  for (const entry of audit.players) {
    const player = byId.get(entry.id)!;
    assert.ok(player);
    assert.deepEqual(entry.peakYears, player.peakYears);
    assert.equal(entry.selected.length, player.peakYears.length);
    const totals: Record<string, number | null> = {};
    for (const field of Object.keys(entry.aggregate.totals)) {
      let missing = false;
      let total = 0;
      for (const row of entry.selected) {
        assert.ok(entry.peakYears.includes(row.season));
        assert.ok(row.csvLine > 1);
        if (row.stats[field] === null) missing = true;
        else total += row.games * row.stats[field];
      }
      totals[field] = missing ? null : total;
      if (missing) assert.equal(entry.aggregate.totals[field], null);
      else close(entry.aggregate.totals[field], total);
      if (field !== 'minutes') {
        if (missing) assert.equal(entry.aggregate.per36[field], null);
        else close(entry.aggregate.per36[field], total * 36 / entry.aggregate.totals.minutes);
      }
    }
    let legacyPoints = 0;
    for (const row of entry.selected) legacyPoints += row.stats.points * row.games * row.stats.minutes;
    assert.ok(Math.abs(legacyPoints / totals.minutes! - player.stats.pts) <= 0.05000001);
    const isReady = ['minutes', 'points', 'assists', 'fieldGoalAttempts', 'freeThrowAttempts', 'turnovers']
      .every((field) => totals[field] !== null);
    assert.equal(entry.ready, isReady);
    if (isReady) {
      ready++;
      close(entry.aggregate.turnoverShare,
        totals.turnovers! / (totals.fieldGoalAttempts! + 0.44 * totals.freeThrowAttempts! + totals.turnovers!));
    } else {
      assert.equal(entry.aggregate.turnoverShare, null);
      assert.equal(entry.aggregate.usedEndsPer36, null);
    }
  }
  assert.equal(ready, 3697);
  assert.equal(audit.readyPlayers, ready);
});

test('era baselines reproduce season rates and exposure-weighted peak comparisons without imputing history', () => {
  const report = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json', import.meta.url), 'utf8'));
  const audit = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json', import.meta.url), 'utf8'));
  assert.equal(report.scope, 'offline-season-context-audit');
  for (const [path, hash] of Object.entries(report.sourceSha256)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  }
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../scripts/data_pipeline/audit_era_baselines.py', import.meta.url)))
    .digest('hex'), report.implementationSha256);
  interface SeasonContext {
    season: number; shotPointsPerEnd: number; shotEndsPer36: number; assistsPer36: number;
    usedEndsPer36: number | null; turnoverShare: number | null;
  }
  const seasons = new Map<number, SeasonContext>();
  assert.equal(report.seasons.length, 67);
  for (const row of report.seasons) {
    seasons.set(row.season, row);
    const totals = row.totals;
    const shots = totals.fieldGoalAttempts + 0.44 * totals.freeThrowAttempts;
    close(row.shotPointsPerEnd, totals.points / shots);
    close(row.trueShootingProxy, totals.points / (2 * shots));
    close(row.shotEndsPer36, 36 * shots / totals.minutes);
    close(row.assistsPer36, 36 * totals.assists / totals.minutes);
    close(row.playerMinutesToRegulationRatio, totals.minutes / row.regulationPlayerMinutes);
    assert.equal(row.sourceCsvLines.length, row.playerTeamRows);
    assert.equal(new Set(row.sourceCsvLines).size, row.playerTeamRows);
    if (row.season < 1978) {
      assert.equal(totals.turnovers, null);
      assert.equal(row.turnoverShare, null);
      assert.equal(row.usedEndsPer36, null);
    } else {
      close(row.turnoverShare, totals.turnovers / (shots + totals.turnovers));
      close(row.usedEndsPer36, 36 * (shots + totals.turnovers) / totals.minutes);
    }
  }
  assert.equal(report.players.length, audit.players.length);
  let turnoverComparisons = 0;
  for (let index = 0; index < report.players.length; index++) {
    const player = report.players[index];
    const input = audit.players[index];
    assert.equal(player.id, input.id);
    assert.deepEqual(player.peakYears, input.peakYears);
    let points = 0, shots = 0, assists = 0, expectedPoints = 0, expectedShots = 0, expectedAssists = 0;
    let used = 0, turnovers = 0, expectedUsed = 0, expectedTurnovers = 0;
    let turnoverAvailable = true;
    for (const row of input.selected) {
      const baseline = seasons.get(row.season)!;
      const minutes = row.games * row.stats.minutes;
      const shotEnds = row.games * (row.stats.fieldGoalAttempts + 0.44 * row.stats.freeThrowAttempts);
      points += row.games * row.stats.points;
      shots += shotEnds;
      assists += row.games * row.stats.assists;
      expectedPoints += shotEnds * baseline.shotPointsPerEnd;
      expectedShots += minutes * baseline.shotEndsPer36 / 36;
      expectedAssists += minutes * baseline.assistsPer36 / 36;
      if (row.stats.turnovers === null || baseline.turnoverShare === null || baseline.usedEndsPer36 === null) turnoverAvailable = false;
      else {
        const turnoverEnds = row.games * row.stats.turnovers;
        used += shotEnds + turnoverEnds;
        turnovers += turnoverEnds;
        expectedUsed += minutes * baseline.usedEndsPer36 / 36;
        expectedTurnovers += (shotEnds + turnoverEnds) * baseline.turnoverShare;
      }
    }
    close(player.shotEfficiencyRatio, points / expectedPoints);
    close(player.trueShootingDelta, (points - expectedPoints) / (2 * shots));
    close(player.shotWorkloadRatio, shots / expectedShots);
    close(player.assistRateRatio, assists / expectedAssists);
    assert.equal(player.turnoverComparisonAvailable, turnoverAvailable);
    if (turnoverAvailable) {
      turnoverComparisons++;
      close(player.usedWorkloadRatio, used / expectedUsed);
      close(player.turnoverShareDelta, (turnovers - expectedTurnovers) / used);
    } else {
      assert.equal(player.usedWorkloadRatio, null);
      assert.equal(player.turnoverShareDelta, null);
    }
  }
  assert.equal(report.shootingComparablePlayers, 4411);
  assert.equal(report.turnoverComparablePlayers, turnoverComparisons);
  assert.equal(turnoverComparisons, 3697);
});

test('workload study reproduces consecutive controls, clustered slopes and denominator sensitivity', () => {
  const report = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json', import.meta.url), 'utf8'));
  assert.equal(report.scope, 'observational-season-associations');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../scripts/data_pipeline/audit_workload.py', import.meta.url)))
    .digest('hex'), report.implementationSha256);
  interface Observation {
    playerId: string; season: number; workload: number; shooting: number; turnovers: number;
  }
  interface SeasonObservation extends Observation {
    age: number; games: number; minutes: number; minutesPerGame: number; teams: string[];
  }
  interface Pair extends Observation { beforeSeason: number; sameTeam: boolean; stable: boolean; minutesRatio: number }
  const seasons: SeasonObservation[] = report.seasonObservations;
  const pairs: Pair[] = report.consecutivePairs;
  const byKey = new Map(seasons.map((row) => [`${row.playerId}:${row.season}`, row]));
  assert.equal(byKey.size, seasons.length);
  assert.equal(seasons.length, 15082);
  assert.equal(pairs.length, 11775);
  let expectedPairs = 0;
  for (const row of seasons) {
    assert.ok(row.games >= 20 && row.minutes >= 500);
    assert.ok(row.season >= 1978 && row.season <= 2026);
    close(row.minutesPerGame, row.minutes / row.games);
    if (byKey.has(`${row.playerId}:${row.season - 1}`)) expectedPairs++;
  }
  assert.equal(pairs.length, expectedPairs);
  assert.equal(new Set(pairs.map((row) => `${row.playerId}:${row.season}`)).size, pairs.length);
  for (const pair of pairs) {
    const before = byKey.get(`${pair.playerId}:${pair.beforeSeason}`)!;
    const after = byKey.get(`${pair.playerId}:${pair.season}`)!;
    assert.equal(pair.season, pair.beforeSeason + 1);
    for (const field of ['workload', 'shooting', 'turnovers'] as const) close(pair[field], after[field] - before[field]);
    const sameTeam = before.teams.length === 1 && after.teams.length === 1 && before.teams[0] === after.teams[0];
    close(pair.minutesRatio, after.minutesPerGame / before.minutesPerGame);
    assert.equal(pair.sameTeam, sameTeam);
    assert.equal(pair.stable, sameTeam && before.age >= 20 && before.age <= 34 && after.age >= 20 && after.age <= 34
      && pair.minutesRatio >= 0.8 && pair.minutesRatio <= 1.2);
  }
  const regression = (rows: Observation[], outcome: 'shooting' | 'turnovers') => {
    const count = rows.length;
    const meanX = rows.reduce((sum, row) => sum + row.workload, 0) / count;
    const meanY = rows.reduce((sum, row) => sum + row[outcome], 0) / count;
    const sumXX = rows.reduce((sum, row) => sum + (row.workload - meanX) ** 2, 0);
    const slope = rows.reduce((sum, row) => sum + (row.workload - meanX) * (row[outcome] - meanY), 0) / sumXX;
    const intercept = meanY - slope * meanX;
    const clusters = new Map<string, number>();
    for (const row of rows) clusters.set(row.playerId, (clusters.get(row.playerId) ?? 0)
      + (row.workload - meanX) * (row[outcome] - intercept - slope * row.workload));
    const correction = clusters.size / (clusters.size - 1) * (count - 1) / (count - 2);
    const standardError = Math.sqrt(correction * [...clusters.values()].reduce((sum, score) => sum + score ** 2, 0) / sumXX ** 2);
    return { slope, intercept, standardError, players: clusters.size };
  };
  interface Summary { observations: number; players: number; slope: number; intercept: number;
    clusterStandardError: number; slopeInterval95: number[]; percentagePointsPerQuarterWorkload: number }
  const verify = (rows: Observation[], summaries: Record<'shooting' | 'turnovers', Summary>) => {
    for (const outcome of ['shooting', 'turnovers'] as const) {
      const actual = regression(rows, outcome);
      const saved = summaries[outcome];
      assert.equal(saved.observations, rows.length);
      assert.equal(saved.players, actual.players);
      close(saved.slope, actual.slope);
      close(saved.intercept, actual.intercept);
      close(saved.clusterStandardError, actual.standardError);
      close(saved.slopeInterval95[0]!, actual.slope - 1.96 * actual.standardError);
      close(saved.slopeInterval95[1]!, actual.slope + 1.96 * actual.standardError);
      close(saved.percentagePointsPerQuarterWorkload, actual.slope * 25);
    }
  };
  const stable = pairs.filter((pair) => pair.stable);
  verify(seasons, report.summaries.crossSection);
  verify(pairs, report.summaries.consecutiveChanges);
  verify(pairs.filter((pair) => pair.sameTeam), report.summaries.sameTeamChanges);
  verify(stable, report.summaries.stableChanges);
  for (const era of report.eraSensitivity)
    verify(stable.filter((pair) => pair.beforeSeason >= era.years[0] && pair.season <= era.years[1]), era);
  for (const group of report.stableDirectionalGroups) {
    const rows = stable.filter((pair) => (pair.workload <= -0.2 ? 'decreased' : pair.workload >= 0.2 ? 'increased' : 'similar') === group.direction);
    assert.equal(group.pairs, rows.length);
    close(group.meanWorkloadChange, rows.reduce((sum, row) => sum + row.workload, 0) / rows.length);
    close(group.meanShootingChange, rows.reduce((sum, row) => sum + row.shooting, 0) / rows.length);
    close(group.meanTurnoverChange, rows.reduce((sum, row) => sum + row.turnovers, 0) / rows.length);
  }
  const era = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json', import.meta.url), 'utf8'));
  const baselines = new Map<number, { turnoverShare: number; shotEndsPer36: number }>(
    era.seasons.map((row: { season: number; turnoverShare: number; shotEndsPer36: number }) => [row.season, row]));
  const fixedTurnovers = stable.map((pair) => {
    const before = byKey.get(`${pair.playerId}:${pair.beforeSeason}`)!;
    const after = byKey.get(`${pair.playerId}:${pair.season}`)!;
    const base = baselines.get(before.season)!;
    const next = baselines.get(after.season)!;
    const share = before.turnovers + base.turnoverShare;
    const fixedRate = before.workload * base.shotEndsPer36 * share / (1 - share);
    const nextShare = fixedRate / (after.workload * next.shotEndsPer36 + fixedRate);
    return { ...pair, turnovers: nextShare - share - (next.turnoverShare - base.turnoverShare) };
  });
  close(regression(fixedTurnovers, 'turnovers').slope * 25, -2.8182578053967617);
});

test('offense predictions preserve held-out identities, training-only fits and paired error evidence', () => {
  const report = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_OFFENSE_PREDICTION_1.json', import.meta.url), 'utf8'));
  assert.equal(report.scope, 'offline-next-season-prediction');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../scripts/data_pipeline/predict_offense.py', import.meta.url)))
    .digest('hex'), report.implementationSha256);
  assert.equal(report.protocol.trainingLastTargetSeason, 2012);
  assert.equal(report.protocol.ridgeAlpha, 1);
  interface Observation {
    playerId: string; beforeSeason: number; season: number;
    features: Record<string, number>; targets: Record<string, number>;
  }
  const rows: Observation[] = report.observations;
  const context = ['age', 'ageSquared', 'minutesPerGame', 'games'];
  const profile = ['workload', 'shooting', 'turnovers'];
  const modelNames = ['mean', 'context', 'persistence', 'laggedOutcome', 'profile', 'profileAndAssists'];
  const heldOut = (identity: string) => BigInt(`0x${createHash('sha256').update(identity).digest('hex')}`) % 5n === 0n;
  const workload = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json', import.meta.url), 'utf8'));
  const seasons = new Map<string, Record<string, number>>(workload.seasonObservations.map(
    (row: { playerId: string; season: number }) => [`${row.playerId}:${row.season}`, row]));
  assert.equal(rows.length, workload.consecutivePairs.length);
  for (const [index, row] of rows.entries()) {
    const pair = workload.consecutivePairs[index];
    assert.equal(row.playerId, pair.playerId);
    assert.equal(row.beforeSeason, pair.beforeSeason);
    assert.equal(row.season, pair.season);
    const before = seasons.get(`${row.playerId}:${row.beforeSeason}`)!;
    const after = seasons.get(`${row.playerId}:${row.season}`)!;
    for (const field of ['age', 'minutesPerGame', 'games', 'workload', 'shooting']) close(row.features[field]!, before[field]!);
    close(row.features.ageSquared!, before.age! ** 2);
    close(row.targets.shooting!, after.shooting!);
    assert.deepEqual(Object.keys(row.features), [...context, ...profile, 'assists']);
  }
  const measure = (actual: number[], predictions: number[]) => ({
    rmse: Math.sqrt(actual.reduce((sum, value, index) => sum + (predictions[index]! - value) ** 2, 0) / actual.length),
    mae: actual.reduce((sum, value, index) => sum + Math.abs(predictions[index]! - value), 0) / actual.length,
  });
  const checkMetrics = (actual: number[], predictions: number[], saved: { rmse: number; mae: number }) => {
    const measured = measure(actual, predictions);
    close(saved.rmse, measured.rmse);
    close(saved.mae, measured.mae);
  };
  assert.deepEqual(Object.keys(report.evaluations), ['unseenPlayers', 'futureSeasons', 'unseenFuturePlayers']);
  for (const name of Object.keys(report.evaluations)) {
    const evaluation = report.evaluations[name];
    const trainingIndices = rows.flatMap((row, index) => row.season <= 2012 && (name === 'futureSeasons' || !heldOut(row.playerId)) ? [index] : []);
    const testIndices = rows.flatMap((row, index) => (name === 'unseenPlayers' ? row.season <= 2012 && heldOut(row.playerId)
      : row.season > 2012 && (name === 'futureSeasons' || heldOut(row.playerId))) ? [index] : []);
    assert.deepEqual(evaluation.trainingIndices, trainingIndices);
    assert.deepEqual(evaluation.testIndices, testIndices);
    const training = trainingIndices.map((index) => rows[index]!);
    const testing = testIndices.map((index) => rows[index]!);
    const trainingPlayers = new Set(training.map((row) => row.playerId));
    assert.equal(evaluation.trainingPlayers, trainingPlayers.size);
    assert.equal(evaluation.testPlayers, new Set(testing.map((row) => row.playerId)).size);
    if (name !== 'futureSeasons') assert.ok(testing.every((row) => !trainingPlayers.has(row.playerId)));
    for (const outcome of ['shooting', 'turnovers']) {
      const results = evaluation.outcomes[outcome];
      const actual = testing.map((row) => row.targets[outcome]!);
      assert.deepEqual(Object.keys(results.models), modelNames);
      for (const model of modelNames) {
        const saved = results.models[model];
        const fields: string[] = saved.fields;
        const expectedFields = ['mean', 'persistence'].includes(model) ? [] : [...context,
          ...(model === 'context' ? [] : model === 'laggedOutcome' ? [outcome] : [...profile, ...(model === 'profileAndAssists' ? ['assists'] : [])])];
        assert.deepEqual(fields, expectedFields);
        let predictions: number[];
        if (model === 'mean') {
          const mean = training.reduce((sum, row) => sum + row.targets[outcome]!, 0) / training.length;
          close(saved.fit.constant, mean);
          predictions = testing.map(() => mean);
        } else if (model === 'persistence') {
          assert.equal(saved.fit, null);
          predictions = testing.map((row) => row.features[outcome]!);
        } else {
          const fit = saved.fit;
          for (const [index, field] of fields.entries()) {
            const mean = training.reduce((sum, row) => sum + row.features[field]!, 0) / training.length;
            const scale = Math.sqrt(training.reduce((sum, row) => sum + (row.features[field]! - mean) ** 2, 0) / training.length);
            close(fit.mean[index], mean);
            close(fit.scale[index], scale > 1e-12 ? scale : 1);
          }
          const design = (row: Observation) => [1, ...fields.map((field, index) => (row.features[field]! - fit.mean[index]) / fit.scale[index])];
          const predicted = (row: Observation) => design(row).reduce((sum, value, index) => sum + value * fit.coefficients[index], 0);
          const gradient = fit.coefficients.map((coefficient: number, index: number) => index === 0 ? 0 : coefficient);
          for (const row of training) {
            const residual = predicted(row) - row.targets[outcome]!;
            design(row).forEach((value, index) => { gradient[index] += value * residual; });
          }
          assert.ok(gradient.every((value: number) => Math.abs(value) < 1e-7), `${name}/${outcome}/${model}: ridge normal equations`);
          predictions = testing.map(predicted);
        }
        assert.equal(saved.predictions.length, predictions.length);
        predictions.forEach((value, index) => close(saved.predictions[index], value));
        checkMetrics(actual, predictions, saved.metrics);
      }
      for (const [candidate, reference] of [['profile', 'laggedOutcome'], ['profileAndAssists', 'profile']]) {
        const saved = results.comparisons[`${candidate}Minus${reference}`];
        const differences = actual.map((value, index) => (results.models[candidate!].predictions[index] - value) ** 2
          - (results.models[reference!].predictions[index] - value) ** 2);
        const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
        const clusters = new Map<string, number>();
        testing.forEach((row, index) => clusters.set(row.playerId, (clusters.get(row.playerId) ?? 0) + differences[index]! - mean));
        const standardError = Math.sqrt(clusters.size / (clusters.size - 1)
          * [...clusters.values()].reduce((sum, score) => sum + score ** 2, 0) / testing.length ** 2);
        close(saved.meanSquaredErrorDifference, mean);
        close(saved.playerClusterStandardError, standardError);
        close(saved.interval95[0], mean - 1.96 * standardError);
        close(saved.interval95[1], mean + 1.96 * standardError);
      }
      const expectedEras = name === 'unseenPlayers' ? [] : [[2013, 2019], [2020, 2026]];
      assert.deepEqual(results.eraSensitivity.map((era: { years: number[] }) => era.years), expectedEras);
      for (const era of results.eraSensitivity) {
        const indices = testing.flatMap((row, index) => row.season >= era.years[0] && row.season <= era.years[1] ? [index] : []);
        assert.equal(era.pairs, indices.length);
        for (const model of modelNames) checkMetrics(indices.map((index) => actual[index]!),
          indices.map((index) => results.models[model].predictions[index]), era.metrics[model]);
      }
    }
  }
});

test('role-change study preserves rate changes, cohort isolation and conditional error evidence', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const report = load('docs/research/mid-iq/MID_IQ_ROLE_CHANGE_STUDY_1.json');
  assert.equal(report.scope, 'observed-role-change-associations');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../scripts/data_pipeline/audit_role_changes.py', import.meta.url)))
    .digest('hex'), report.implementationSha256);
  interface Rates { shots: number; assists: number; turnovers: number }
  interface Observation {
    playerId: string; beforeSeason: number; season: number; sameTeam: boolean; stable: boolean; changedSingleTeamStableExposure: boolean;
    before: { rates: Rates; league: Rates; csvLines: number[] }; after: { rates: Rates; league: Rates; csvLines: number[] };
    features: Record<string, number>; target: number; fixedTurnovers: number; shotLinkedTurnovers: number;
  }
  const rows: Observation[] = report.observations;
  const workload = load('docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json');
  const era = load('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json');
  const prediction = load('docs/research/mid-iq/MID_IQ_OFFENSE_PREDICTION_1.json');
  interface Season { playerId: string; season: number; age: number; minutesPerGame: number; teams: string[];
    workload: number; turnovers: number; csvLines: number[] }
  const seasons = new Map<string, Season>(workload.seasonObservations.map((row: Season) => [`${row.playerId}:${row.season}`, row]));
  const context = ['priorShots', 'priorAssists', 'priorTurnovers', 'age', 'minutesChange'];
  const modelNames = ['fixedTurnovers', 'shotLinkedTurnovers', 'context', 'shots', 'shotsAndAssists'];
  assert.equal(rows.length, 11775);
  for (const [index, row] of rows.entries()) {
    const pair = workload.consecutivePairs[index];
    assert.equal(row.playerId, pair.playerId);
    assert.equal(row.beforeSeason, pair.beforeSeason);
    assert.equal(row.season, pair.season);
    assert.equal(row.sameTeam, pair.sameTeam);
    assert.equal(row.stable, pair.stable);
    const before = seasons.get(`${row.playerId}:${row.beforeSeason}`)!;
    const after = seasons.get(`${row.playerId}:${row.season}`)!;
    assert.equal(row.changedSingleTeamStableExposure, before.teams.length === 1 && after.teams.length === 1
      && before.teams[0] !== after.teams[0] && [before.age, after.age].every((age) => age >= 20 && age <= 34)
      && pair.minutesRatio >= 0.8 && pair.minutesRatio <= 1.2);
    for (const [saved, observed] of [[row.before, before], [row.after, after]] as const) {
      const baseline = era.seasons.find((season: { season: number }) => season.season === observed.season);
      close(saved.league.shots, baseline.shotEndsPer36);
      close(saved.league.assists, baseline.assistsPer36);
      close(saved.league.turnovers, 36 * baseline.totals.turnovers / baseline.totals.minutes);
      close(saved.rates.shots, observed.workload * saved.league.shots);
      const share = observed.turnovers + baseline.turnoverShare;
      close(saved.rates.turnovers, saved.rates.shots * share / (1 - share));
      assert.deepEqual(saved.csvLines, observed.csvLines);
    }
    close(row.before.rates.assists, prediction.observations[index].features.assists * row.before.league.assists);
    for (const [feature, field] of [['priorShots', 'shots'], ['priorAssists', 'assists'], ['priorTurnovers', 'turnovers']] as const)
      close(row.features[feature]!, row.before.rates[field] - row.before.league[field]);
    close(row.features.age!, before.age);
    close(row.features.minutesChange!, after.minutesPerGame - before.minutesPerGame);
    close(row.features.shotChange!, row.after.rates.shots - row.after.league.shots - row.features.priorShots!);
    close(row.features.assistChange!, row.after.rates.assists - row.after.league.assists - row.features.priorAssists!);
    close(row.target, row.after.rates.turnovers - row.after.league.turnovers - row.features.priorTurnovers!);
    close(row.fixedTurnovers, row.before.league.turnovers - row.after.league.turnovers);
    close(row.shotLinkedTurnovers, row.before.rates.turnovers * (row.after.rates.shots / row.before.rates.shots - 1) + row.fixedTurnovers);
    assert.deepEqual(Object.keys(row.features), [...context, 'shotChange', 'assistChange']);
  }
  const cohorts = { all: rows, sameTeam: rows.filter((row) => row.sameTeam), stable: rows.filter((row) => row.stable),
    changedSingleTeamStableExposure: rows.filter((row) => row.changedSingleTeamStableExposure) };
  interface Association { pairs: number; players: number; fields: string[]; coefficients: number[]; clusterCovariance: number[][];
    interval95: number[][]; rmse: number }
  const verifyAssociation = (selected: Observation[], saved: Association) => {
    assert.equal(saved.pairs, selected.length);
    assert.deepEqual(saved.fields, ['intercept', 'shotChange', 'assistChange']);
    const cross = Array.from({ length: 3 }, () => [0, 0, 0]);
    const gradient = [0, 0, 0];
    const scores = new Map<string, number[]>();
    let error = 0;
    for (const row of selected) {
      const design = [1, row.features.shotChange!, row.features.assistChange!];
      const residual = row.target - design.reduce((sum, value, index) => sum + value * saved.coefficients[index]!, 0);
      error += residual ** 2;
      const score = scores.get(row.playerId) ?? [0, 0, 0];
      for (let column = 0; column < 3; column++) {
        gradient[column]! += design[column]! * residual;
        score[column]! += design[column]! * residual;
        for (let other = 0; other < 3; other++) cross[column]![other]! += design[column]! * design[other]!;
      }
      scores.set(row.playerId, score);
    }
    assert.ok(gradient.every((value) => Math.abs(value) < 1e-7));
    assert.equal(saved.players, scores.size);
    close(saved.rmse, Math.sqrt(error / selected.length));
    const correction = scores.size / (scores.size - 1) * (selected.length - 1) / (selected.length - 3);
    for (let column = 0; column < 3; column++) {
      const standardError = Math.sqrt(saved.clusterCovariance[column]![column]!);
      close(saved.interval95[column]![0]!, saved.coefficients[column]! - 1.96 * standardError);
      close(saved.interval95[column]![1]!, saved.coefficients[column]! + 1.96 * standardError);
      for (let other = 0; other < 3; other++) {
        let reconstructed = 0;
        for (let first = 0; first < 3; first++) for (let second = 0; second < 3; second++)
          reconstructed += cross[column]![first]! * saved.clusterCovariance[first]![second]! * cross[second]![other]!;
        const expected = correction * [...scores.values()].reduce((sum, score) => sum + score[column]! * score[other]!, 0);
        assert.ok(Math.abs(reconstructed - expected) < 1e-7 * Math.max(1, Math.abs(expected)));
      }
    }
  };
  for (const [name, selected] of Object.entries(cohorts)) verifyAssociation(selected, report.associations[name]);
  assert.deepEqual(report.eraSensitivity.map((entry: { years: number[] }) => entry.years), [[1978, 1999], [2000, 2012], [2013, 2026]]);
  for (const entry of report.eraSensitivity) verifyAssociation(cohorts.stable.filter((row) => row.beforeSeason >= entry.years[0] && row.season <= entry.years[1]), entry);
  const direction = (value: number, threshold: number) => value <= -threshold ? 'decreased' : value >= threshold ? 'increased' : 'similar';
  assert.equal(report.stableDirectionalGroups.length, 9);
  assert.equal(new Set(report.stableDirectionalGroups.map((group: { shots: string; assists: string }) => `${group.shots}:${group.assists}`)).size, 9);
  for (const group of report.stableDirectionalGroups) {
    const selected = cohorts.stable.filter((row) => direction(row.features.shotChange!, 2) === group.shots && direction(row.features.assistChange!, 1) === group.assists);
    assert.equal(group.pairs, selected.length);
    assert.equal(group.players, new Set(selected.map((row) => row.playerId)).size);
    if (selected.length) close(group.meanTurnoverChange, selected.reduce((sum, row) => sum + row.target, 0) / selected.length);
    else assert.equal(group.meanTurnoverChange, null);
  }
  for (const name of ['unseenPlayers', 'futureSeasons', 'unseenFuturePlayers']) {
    const evaluation = report.evaluations[name];
    assert.deepEqual(evaluation.trainingIndices, prediction.evaluations[name].trainingIndices);
    assert.deepEqual(evaluation.testIndices, prediction.evaluations[name].testIndices);
    const training: Observation[] = evaluation.trainingIndices.map((index: number) => rows[index]!);
    const testing: Observation[] = evaluation.testIndices.map((index: number) => rows[index]!);
    assert.deepEqual(Object.keys(evaluation.models), modelNames);
    for (const model of modelNames) {
      const saved = evaluation.models[model];
      const fields: string[] = model === 'context' ? context : model === 'shots' ? [...context, 'shotChange']
        : model === 'shotsAndAssists' ? [...context, 'shotChange', 'assistChange'] : [];
      assert.deepEqual(saved.fields, fields);
      let predicted: number[];
      if (!fields.length) {
        assert.equal(saved.fit, null);
        predicted = testing.map((row) => row[model as 'fixedTurnovers' | 'shotLinkedTurnovers']);
      } else {
        const fit = saved.fit;
        for (const [index, field] of fields.entries()) {
          const mean = training.reduce((sum, row) => sum + row.features[field]!, 0) / training.length;
          const scale = Math.sqrt(training.reduce((sum, row) => sum + (row.features[field]! - mean) ** 2, 0) / training.length);
          close(fit.mean[index], mean);
          close(fit.scale[index], scale > 1e-12 ? scale : 1);
        }
        const design = (row: Observation) => [1, ...fields.map((field, index) => (row.features[field]! - fit.mean[index]) / fit.scale[index])];
        const predictionFor = (row: Observation) => design(row).reduce((sum, value, index) => sum + value * fit.coefficients[index], 0);
        const gradient: number[] = fit.coefficients.map((value: number, index: number) => index ? value : 0);
        for (const row of training) design(row).forEach((value, index) => { gradient[index]! += value * (predictionFor(row) - row.target); });
        assert.ok(gradient.every((value) => Math.abs(value) < 1e-7));
        predicted = testing.map(predictionFor);
      }
      assert.equal(predicted.length, saved.predictions.length);
      predicted.forEach((value, index) => close(saved.predictions[index], value));
      close(saved.metrics.rmse, Math.sqrt(predicted.reduce((sum, value, index) => sum + (value - testing[index]!.target) ** 2, 0) / testing.length));
      close(saved.metrics.mae, predicted.reduce((sum, value, index) => sum + Math.abs(value - testing[index]!.target), 0) / testing.length);
    }
    for (const [candidate, reference] of [['shots', 'context'], ['shotsAndAssists', 'shots']]) {
      const saved = evaluation.comparisons[`${candidate}Minus${reference}`];
      const differences = testing.map((row, index) => (evaluation.models[candidate!].predictions[index] - row.target) ** 2
        - (evaluation.models[reference!].predictions[index] - row.target) ** 2);
      const mean = differences.reduce((sum, value) => sum + value, 0) / testing.length;
      const scores = new Map<string, number>();
      testing.forEach((row, index) => scores.set(row.playerId, (scores.get(row.playerId) ?? 0) + differences[index]! - mean));
      const standardError = Math.sqrt(scores.size / (scores.size - 1) * [...scores.values()].reduce((sum, value) => sum + value ** 2, 0) / testing.length ** 2);
      close(saved.meanSquaredErrorDifference, mean);
      close(saved.playerClusterStandardError, standardError);
      close(saved.interval95[0], mean - 1.96 * standardError);
      close(saved.interval95[1], mean + 1.96 * standardError);
    }
  }
});

test('team role study uses lagged rates and reconciles matched team budgets and season-cluster comparisons', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const report = load('docs/research/mid-iq/MID_IQ_TEAM_ROLE_STUDY_1.json');
  assert.equal(report.scope, 'lagged-team-season-budget-diagnostics');
  for (const [path, hash] of Object.entries(report.sourceSha256))
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex'), hash);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../scripts/data_pipeline/audit_team_roles.py', import.meta.url)))
    .digest('hex'), report.implementationSha256);
  interface Rates { shots: number; assists: number; turnovers: number }
  interface Member { playerId: string; afterCsvLine: number; priorCsvLines: number[]; priorMinutes: number; priorGames: number;
    fallback: string | null; priorRates: Rates; after: Rates & { minutes: number } }
  type Scenario = { status: 'unsupported'; reason: string } | { status: 'evaluated'; turnoverEnds: number; shotEnds: number;
    passingBudget: number; fixedTurnovers: number; shotLinkedTurnovers: number; passingLinkedTurnovers: number };
  interface Team { season: number; team: string; reference: Rates; players: Member[]; totals: Rates & { minutes: number };
    priorMinuteCoverage: number; targetTurnoverEnds: number; leaguePrediction: number; teamSummary: { turnoverPercent: number | null };
    scenarios: Record<string, Scenario> }
  const rows: Team[] = report.rows;
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const splits = { 'shot-only': { shot: 1, passing: 0 }, 'half-fixed': { shot: 0.5, passing: 0 },
    'split-roles': { shot: 0.5, passing: 0.5 }, 'mixed-fixed': { shot: 0.25, passing: 0.5 } };
  const allocations = ['prior-roles', 'observed-shares', 'observed-passing-volume'];
  assert.deepEqual(report.protocol.splits, splits);
  assert.deepEqual(report.protocol.allocations, allocations);
  assert.deepEqual(report.protocol.partitions, { earlier: [1979, 2012], later: [2013, 2026] });
  assert.equal(report.teamSeasons, 1336);
  assert.equal(rows.length, 1336);
  assert.equal(new Set(rows.map((row) => `${row.season}:${row.team}`)).size, rows.length);
  assert.equal(report.zeroMinuteStints.length, 5);
  for (const row of report.zeroMinuteStints) for (const field of ['minutes', 'shots', 'assists', 'turnovers']) assert.equal(row[field], 0);
  const era = load('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json');
  const unsupported: Record<string, number> = {};
  let scenarios = 0;
  for (const row of rows) {
    assert.ok(row.season >= 1979 && row.season <= 2026);
    assert.equal('expectedWins' in row, false);
    assert.equal(new Set(row.players.map((player) => player.playerId)).size, row.players.length);
    const reference = era.seasons.find((season: { season: number }) => season.season === row.season - 1).totals;
    close(row.reference.shots, (reference.fieldGoalAttempts + 0.44 * reference.freeThrowAttempts) / reference.minutes);
    close(row.reference.assists, reference.assists / reference.minutes);
    close(row.reference.turnovers, reference.turnovers / reference.minutes);
    for (const field of ['minutes', 'shots', 'assists', 'turnovers'] as const) close(row.totals[field], sum(row.players.map((player) => player.after[field])));
    for (const player of row.players) {
      const eligible = player.priorMinutes >= 500 && player.priorGames >= 20;
      assert.equal(player.fallback, eligible ? null : player.priorCsvLines.length ? 'insufficient-prior-exposure' : 'no-prior-season');
      if (!eligible) assert.deepEqual(player.priorRates, row.reference);
      assert.ok(player.after.minutes > 0);
    }
    close(row.priorMinuteCoverage, sum(row.players.filter((player) => player.fallback === null).map((player) => player.after.minutes)) / row.totals.minutes);
    close(row.targetTurnoverEnds, 100 * row.totals.turnovers / (row.totals.shots + row.totals.turnovers));
    const leagueShare = row.reference.turnovers / (row.reference.shots + row.reference.turnovers);
    close(row.leaguePrediction, 100 * leagueShare);
    assert.deepEqual(Object.keys(row.scenarios), Object.keys(splits).flatMap((split) => allocations.map((allocation) => `${split}:${allocation}`)));
    const nominal = row.players.map((player) => {
      const exposure = 100 * player.after.minutes / row.totals.minutes;
      return { shots: exposure * (1 - leagueShare) * player.priorRates.shots / row.reference.shots,
        passing: exposure * player.priorRates.assists / row.reference.assists,
        turnovers: exposure * leagueShare * player.priorRates.turnovers / row.reference.turnovers };
    });
    for (const [splitName, split] of Object.entries(splits)) for (const allocation of allocations) {
      scenarios++;
      const saved = row.scenarios[`${splitName}:${allocation}`]!;
      const shotWeights = allocation === 'prior-roles' ? nominal.map((player) => player.shots) : row.players.map((player) => player.after.shots);
      const passWeights = allocation === 'prior-roles' ? nominal.map((player) => player.passing) : row.players.map((player) => player.after.assists);
      const shotTotal = sum(shotWeights), passTotal = sum(passWeights);
      let reason = nominal.some((player) => player.shots <= 0) ? 'zero-prior-shot-exposure'
        : shotTotal <= 0 || passTotal <= 0 ? 'empty-role-demand'
          : nominal.some((player, index) => player.passing === 0 && (passWeights[index]! > 0 || split.passing * player.turnovers > 0))
            ? 'zero-prior-passing-exposure' : null;
      const budget = allocation === 'observed-passing-volume' ? 100 * row.totals.assists / row.totals.minutes / row.reference.assists : 100;
      const fixed = sum(nominal.map((player) => (1 - split.shot - split.passing) * player.turnovers));
      const passing = sum(nominal.map((player, index) => player.passing > 0
        ? split.passing * player.turnovers / player.passing * budget * passWeights[index]! / passTotal : 0));
      if (!reason && fixed + passing > 100) reason = 'passing-cost-exceeds-event-budget';
      if (reason) {
        assert.deepEqual(saved, { status: 'unsupported', reason });
        unsupported[reason] = (unsupported[reason] ?? 0) + 1;
        continue;
      }
      assert.equal(saved.status, 'evaluated');
      if (saved.status !== 'evaluated') throw new Error('Expected a supported team case');
      const marginal = sum(nominal.map((player, index) => split.shot * player.turnovers / player.shots * shotWeights[index]! / shotTotal));
      const turnovers = (fixed + passing + 100 * marginal) / (1 + marginal);
      close(saved.turnoverEnds, turnovers);
      close(saved.shotEnds, 100 - turnovers);
      close(saved.fixedTurnovers, fixed);
      close(saved.passingLinkedTurnovers, passing);
      close(saved.shotLinkedTurnovers, marginal * (100 - turnovers));
      close(saved.passingBudget, budget);
      close(saved.shotEnds + saved.turnoverEnds, 100);
      close(saved.turnoverEnds, saved.fixedTurnovers + saved.shotLinkedTurnovers + saved.passingLinkedTurnovers);
    }
  }
  assert.equal(scenarios, 16032);
  assert.deepEqual(unsupported, report.unsupportedScenarios);
  assert.deepEqual(unsupported, { 'zero-prior-passing-exposure': 10 });
  const verifyMetrics = (actual: number[], predicted: number[], saved: { teams: number; bias: number; mae: number; rmse: number }) => {
    const errors = predicted.map((value, index) => value - actual[index]!);
    assert.equal(saved.teams, actual.length);
    close(saved.bias, sum(errors) / errors.length);
    close(saved.mae, sum(errors.map(Math.abs)) / errors.length);
    close(saved.rmse, Math.sqrt(sum(errors.map((value) => value ** 2)) / errors.length));
  };
  const measured = rows.filter((row) => row.teamSummary.turnoverPercent !== null);
  verifyMetrics(measured.map((row) => row.teamSummary.turnoverPercent!), measured.map((row) => row.targetTurnoverEnds), report.teamSummaryCrossCheck);
  for (const [period, first, last] of [['earlier', 1979, 2012], ['later', 2013, 2026]] as const) for (const coverage of ['all', 'at-least-90-percent']) {
    const selected = rows.filter((row) => row.season >= first && row.season <= last && (coverage === 'all' || row.priorMinuteCoverage >= 0.9));
    const common = selected.filter((row) => Object.values(row.scenarios).every((scenario) => scenario.status === 'evaluated'));
    const saved = report.evaluations[`${period}:${coverage}`];
    assert.equal(saved.eligibleTeams, selected.length);
    assert.equal(saved.commonTeams, common.length);
    assert.equal(saved.unsupportedTeams, selected.length - common.length);
    const prediction = (row: Team, name: string) => {
      if (name === 'league') return row.leaguePrediction;
      const value = row.scenarios[name]!;
      assert.equal(value.status, 'evaluated');
      return value.status === 'evaluated' ? value.turnoverEnds : NaN;
    };
    assert.deepEqual(Object.keys(saved.models), ['league', ...Object.keys(common[0]!.scenarios)]);
    for (const name of Object.keys(saved.models)) verifyMetrics(common.map((row) => row.targetTurnoverEnds), common.map((row) => prediction(row, name)), saved.models[name]);
    const comparisons: Array<[string, string, string]> = Object.keys(common[0]!.scenarios).map((name) => [`${name}-minus-league`, name, 'league']);
    for (const split of Object.keys(splits)) for (const [candidate, baseline] of [['observed-shares', 'prior-roles'], ['observed-passing-volume', 'observed-shares']])
      comparisons.push([`${split}:${candidate}-minus-${baseline}`, `${split}:${candidate}`, `${split}:${baseline}`]);
    for (const allocation of allocations) comparisons.push([`split-roles-minus-shot-only:${allocation}`, `split-roles:${allocation}`, `shot-only:${allocation}`]);
    assert.deepEqual(Object.keys(saved.comparisons), comparisons.map(([key]) => key));
    for (const [key, candidate, baseline] of comparisons) {
      const differences = common.map((row) => (prediction(row, candidate) - row.targetTurnoverEnds) ** 2 - (prediction(row, baseline) - row.targetTurnoverEnds) ** 2);
      const mean = sum(differences) / common.length;
      const grouped = new Map<number, number>();
      common.forEach((row, index) => grouped.set(row.season, (grouped.get(row.season) ?? 0) + differences[index]! - mean));
      const radius = 1.96 * Math.sqrt(grouped.size / (grouped.size - 1) * sum([...grouped.values()].map((value) => value ** 2))) / common.length;
      const comparison = saved.comparisons[key];
      assert.equal(comparison.seasonClusters, grouped.size);
      close(comparison.meanSquaredErrorDifference, mean);
      close(comparison.interval95[0], mean - radius);
      close(comparison.interval95[1], mean + radius);
    }
  }
});

test('candidate1 shrinkage preserves registration, earlier-only selection and the component rejection gate', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const hash = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
  const protocol = load('docs/research/mid-iq/MID_IQ_CANDIDATE_1_PROTOCOL.json');
  const selection = load('docs/research/mid-iq/MID_IQ_CANDIDATE_1_SELECTION.json');
  const report = load('docs/research/mid-iq/MID_IQ_CANDIDATE_1_RESULT.json');
  const source = load('docs/research/mid-iq/MID_IQ_TEAM_ROLE_STUDY_1.json');
  assert.equal(hash('docs/research/mid-iq/MID_IQ_CANDIDATE_1_PROTOCOL.json'), 'f660073f9a4ef7519eab939676a822cb0e098d84d18b58fd70ea2132bcbe2e01');
  assert.equal(selection.scope, 'earlier-only-candidate-selection');
  assert.equal(report.scope, 'selected-turnover-shrinkage-evaluation');
  assert.equal(report.selectionSha256, hash('docs/research/mid-iq/MID_IQ_CANDIDATE_1_SELECTION.json'));
  assert.equal(selection.implementationSha256, hash('scripts/data_pipeline/evaluate_turnover_shrinkage.py'));
  assert.equal(report.implementationSha256, selection.implementationSha256);
  assert.equal(selection.protocolVersion, protocol.version);
  assert.equal(report.protocolVersion, protocol.version);
  assert.deepEqual(report.runtime, selection.runtime);
  assert.deepEqual(report.sourceSha256, selection.sourceSha256);
  for (const [path, expected] of Object.entries(report.sourceSha256)) assert.equal(hash(path), expected);
  assert.deepEqual(protocol.kMinutes, [0, 250, 500, 1000, 2000, 4000, 8000, 16000]);
  assert.equal(protocol.configurationCount, 8);
  assert.equal(protocol.candidateMechanism, 1);
  assert.equal(protocol.minimumLaterRmseReduction, 0.02);
  assert.equal(protocol.highCoverageMinimum, 0.9);
  assert.deepEqual(protocol.fixedPolicy, { shotFraction: 0.5, passingFraction: 0.5, allocation: 'prior-roles', capacities: 'uncapped' });
  interface Rates { shots: number; assists: number; turnovers: number }
  interface Row { season: number; team: string; reference: Rates; targetTurnoverEnds: number; priorMinuteCoverage: number;
    leaguePrediction: number; players: Array<{ priorRates: Rates; priorMinutes: number; fallback: string | null; after: { minutes: number } }>;
    scenarios: Record<string, { status: string; turnoverEnds: number }> }
  interface Ledger { status: string; shotEnds: number; turnoverEnds: number; passingBudget: number;
    fixedTurnovers: number; shotLinkedTurnovers: number; passingLinkedTurnovers: number }
  interface SavedRow { sourceIndex: number; season: number; team: string; result: Ledger }
  const rows: Row[] = source.rows;
  const common = rows.flatMap((row, index) => Object.values(row.scenarios).every((scenario) => scenario.status === 'evaluated') ? [index] : []);
  const training = common.filter((index) => rows[index]!.season >= 1979 && rows[index]!.season <= 2012);
  assert.equal(common.length, 1335);
  assert.equal(training.length, 915);
  assert.deepEqual(selection.trainingIndices, training);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const predict = (row: Row, kMinutes: number) => {
    const totalMinutes = sum(row.players.map((player) => player.after.minutes));
    const share = row.reference.turnovers / (row.reference.shots + row.reference.turnovers);
    let nominalShots = 0, nominalPassing = 0, nominalTurnovers = 0;
    for (const player of row.players) {
      const weight = 100 * player.after.minutes / totalMinutes;
      const reliability = kMinutes === 0 || player.fallback !== null ? 1 : player.priorMinutes / (player.priorMinutes + kMinutes);
      const rate = reliability * player.priorRates.turnovers + (1 - reliability) * row.reference.turnovers;
      assert.ok(rate >= Math.min(player.priorRates.turnovers, row.reference.turnovers) - 1e-12);
      assert.ok(rate <= Math.max(player.priorRates.turnovers, row.reference.turnovers) + 1e-12);
      nominalShots += weight * (1 - share) * player.priorRates.shots / row.reference.shots;
      nominalPassing += weight * player.priorRates.assists / row.reference.assists;
      nominalTurnovers += weight * share * rate / row.reference.turnovers;
    }
    const passing = 50 * nominalTurnovers / nominalPassing;
    const marginal = 0.5 * nominalTurnovers / nominalShots;
    const shots = (100 - passing) / (1 + marginal);
    return { shots, passing, shotTurnovers: shots * marginal, turnovers: 100 - shots };
  };
  const verifyMetrics = (indices: number[], predictions: number[], saved: { teams: number; bias: number; mae: number; rmse: number }) => {
    const errors = indices.map((index, position) => predictions[position]! - rows[index]!.targetTurnoverEnds);
    assert.equal(saved.teams, indices.length);
    close(saved.bias, sum(errors) / errors.length);
    close(saved.mae, sum(errors.map(Math.abs)) / errors.length);
    close(saved.rmse, Math.sqrt(sum(errors.map((error) => error ** 2)) / errors.length));
  };
  assert.deepEqual(selection.grid.map((entry: { kMinutes: number }) => entry.kMinutes), protocol.kMinutes);
  for (const entry of selection.grid) {
    assert.deepEqual(entry.unsupportedIndices, []);
    assert.equal(entry.predictions.length, training.length);
    const predicted = training.map((index) => predict(rows[index]!, entry.kMinutes).turnovers);
    predicted.forEach((value, index) => close(value, entry.predictions[index]));
    if (entry.kMinutes === 0) training.forEach((index, position) => assert.equal(entry.predictions[position], rows[index]!.scenarios['split-roles:prior-roles']!.turnoverEnds));
    verifyMetrics(training, predicted, entry.metrics);
  }
  const chosen = [...selection.grid].sort((first, second) => first.metrics.rmse - second.metrics.rmse || first.kMinutes - second.kMinutes)[0];
  assert.equal(selection.selectedKMinutes, chosen.kMinutes);
  assert.equal(selection.selectedKMinutes, 500);
  assert.equal(report.selectedKMinutes, selection.selectedKMinutes);
  const results = new Map<number, Ledger>((report.rows as SavedRow[]).map((row) => [row.sourceIndex, row.result]));
  assert.deepEqual((report.rows as SavedRow[]).map((row) => row.sourceIndex), common);
  for (const saved of report.rows as SavedRow[]) {
    const row = rows[saved.sourceIndex]!;
    assert.equal(saved.season, row.season);
    assert.equal(saved.team, row.team);
    const expected = predict(row, report.selectedKMinutes);
    assert.equal(saved.result.status, 'evaluated');
    close(saved.result.shotEnds, expected.shots);
    close(saved.result.turnoverEnds, expected.turnovers);
    close(saved.result.passingLinkedTurnovers, expected.passing);
    close(saved.result.shotLinkedTurnovers, expected.shotTurnovers);
    close(saved.result.shotEnds + saved.result.turnoverEnds, 100);
    close(saved.result.turnoverEnds, saved.result.passingLinkedTurnovers + saved.result.shotLinkedTurnovers);
    assert.equal(saved.result.fixedTurnovers, 0);
    assert.equal(saved.result.passingBudget, 100);
  }
  for (const [period, first, last] of [['earlier', 1979, 2012], ['later', 2013, 2026]] as const) for (const coverage of ['all', 'at-least-90-percent']) {
    const indices = common.filter((index) => rows[index]!.season >= first && rows[index]!.season <= last
      && (coverage === 'all' || rows[index]!.priorMinuteCoverage >= 0.9));
    const saved = report.evaluations[`${period}:${coverage}`];
    assert.deepEqual(saved.indices, indices);
    assert.deepEqual(saved.unsupportedIndices, []);
    const candidate = indices.map((index) => predict(rows[index]!, selection.selectedKMinutes).turnovers);
    verifyMetrics(indices, candidate, saved.models.candidate);
    for (const [name, field] of [['shotOnly', 'shot-only:prior-roles'], ['unshrunk', 'split-roles:prior-roles'], ['league', 'league']] as const) {
      const baseline = indices.map((index) => field === 'league' ? rows[index]!.leaguePrediction : rows[index]!.scenarios[field]!.turnoverEnds);
      verifyMetrics(indices, baseline, saved.models[name]);
      const differences = indices.map((index, position) => (candidate[position]! - rows[index]!.targetTurnoverEnds) ** 2
        - (baseline[position]! - rows[index]!.targetTurnoverEnds) ** 2);
      const mean = sum(differences) / indices.length;
      const grouped = new Map<number, number>();
      indices.forEach((index, position) => grouped.set(rows[index]!.season, (grouped.get(rows[index]!.season) ?? 0) + differences[position]! - mean));
      const radius = 1.96 * Math.sqrt(grouped.size / (grouped.size - 1) * sum([...grouped.values()].map((value) => value ** 2))) / indices.length;
      close(saved.comparisons[name].meanSquaredErrorDifference, mean);
      close(saved.comparisons[name].interval95[0], mean - radius);
      close(saved.comparisons[name].interval95[1], mean + radius);
      assert.equal(saved.comparisons[name].seasonClusters, grouped.size);
    }
  }
  const earlier = report.evaluations['earlier:all'], later = report.evaluations['later:all'], high = report.evaluations['later:at-least-90-percent'];
  const rules = {
    positiveShrinkageAndFullSupport: report.selectedKMinutes > 0 && [...results.values()].every((result) => result.status === 'evaluated'),
    earlierNoWorseThanShotOnly: earlier.models.candidate.rmse <= earlier.models.shotOnly.rmse,
    laterMaterialAndPairedImprovement: ['shotOnly', 'unshrunk'].every((name) => later.models.candidate.rmse <= 0.98 * later.models[name].rmse && later.comparisons[name].interval95[1] < 0),
    laterHighCoverageNoRegression: ['shotOnly', 'unshrunk'].every((name) => high.models.candidate.rmse <= high.models[name].rmse),
  };
  assert.deepEqual(report.decision.rules, rules);
  assert.deepEqual(report.decision.failedRules, Object.entries(rules).filter(([, passed]) => !passed).map(([name]) => name));
  assert.equal(report.decision.verdict, Object.values(rules).every(Boolean) ? 'advance-to-integration-assessment' : 'reject-component');
  assert.equal(report.decision.verdict, 'reject-component');
});

test('candidate2 role costs preserve registration, independent ledgers and the component acceptance gate', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const hash = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
  const protocol = load('docs/research/mid-iq/MID_IQ_CANDIDATE_2_PROTOCOL.json');
  const selection = load('docs/research/mid-iq/MID_IQ_CANDIDATE_2_SELECTION.json');
  const report = load('docs/research/mid-iq/MID_IQ_CANDIDATE_2_RESULT.json');
  assert.equal(hash('docs/research/mid-iq/MID_IQ_CANDIDATE_2_PROTOCOL.json'), '78f403ecea458a8f98a75d1667e77c970380f06a32cc2d0d2f125afaefad0f12');
  assert.deepEqual(protocol.passingWeights, [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(protocol.configurationCount, 5);
  assert.equal(protocol.candidateMechanism, 2);
  assert.equal(protocol.minimumLaterRmseReduction, 0.02);
  assert.equal(protocol.highCoverageMinimum, 0.9);
  assert.deepEqual(protocol.trainingYears, [1979, 2012]);
  assert.deepEqual(protocol.evaluationYears, [2013, 2026]);
  assert.equal(selection.scope, 'earlier-only-role-cost-selection');
  assert.equal(report.scope, 'selected-role-cost-evaluation');
  assert.equal(report.selectionSha256, hash('docs/research/mid-iq/MID_IQ_CANDIDATE_2_SELECTION.json'));
  assert.equal(selection.implementationSha256, hash('scripts/data_pipeline/evaluate_role_costs.py'));
  for (const field of ['implementationSha256', 'protocolVersion', 'runtime', 'sourceSha256']) assert.deepEqual(report[field], selection[field]);
  assert.equal(report.protocolVersion, protocol.version);
  for (const [path, expected] of Object.entries(report.sourceSha256)) assert.equal(hash(path), expected);
  interface Rates { shots: number; assists: number; turnovers: number }
  interface Row { season: number; team: string; reference: Rates; targetTurnoverEnds: number; priorMinuteCoverage: number;
    leaguePrediction: number; players: Array<{ priorRates: Rates; after: { minutes: number } }>;
    scenarios: Record<string, { status: string; turnoverEnds: number }> }
  interface Ledger { status: string; shotEnds: number; turnoverEnds: number; passingBudget: number;
    fixedTurnovers: number; shotLinkedTurnovers: number; passingLinkedTurnovers: number }
  interface SavedRow { sourceIndex: number; season: number; team: string; result: Ledger }
  const rows: Row[] = load(protocol.source).rows;
  const common = rows.flatMap((row, index) => Object.values(row.scenarios).every((scenario) => scenario.status === 'evaluated') ? [index] : []);
  const training = common.filter((index) => rows[index]!.season >= 1979 && rows[index]!.season <= 2012);
  assert.equal(common.length, 1335);
  assert.equal(training.length, 915);
  assert.deepEqual(selection.trainingIndices, training);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const predict = (row: Row, passingWeight: number) => {
    const totalMinutes = sum(row.players.map((player) => player.after.minutes));
    const share = row.reference.turnovers / (row.reference.shots + row.reference.turnovers);
    const exposures = row.players.map((player) => {
      const minutes = 100 * player.after.minutes / totalMinutes;
      const shotRatio = player.priorRates.shots / row.reference.shots;
      const assistRatio = player.priorRates.assists / row.reference.assists;
      const passingFraction = passingWeight * assistRatio / ((1 - passingWeight) * shotRatio + passingWeight * assistRatio);
      const turnovers = minutes * share * player.priorRates.turnovers / row.reference.turnovers;
      return { shots: minutes * (1 - share) * shotRatio, passing: minutes * assistRatio,
        passingTurnovers: passingFraction * turnovers, shotTurnovers: (1 - passingFraction) * turnovers };
    });
    const passing = 100 * sum(exposures.map((player) => player.passingTurnovers)) / sum(exposures.map((player) => player.passing));
    const marginal = sum(exposures.map((player) => player.shotTurnovers)) / sum(exposures.map((player) => player.shots));
    const shots = (100 - passing) / (1 + marginal);
    return { status: 'evaluated', shotEnds: shots, turnoverEnds: 100 - shots, passingBudget: 100,
      fixedTurnovers: 0, shotLinkedTurnovers: shots * marginal, passingLinkedTurnovers: passing };
  };
  const verifyLedger = (actual: Ledger, expected: Ledger) => {
    assert.equal(actual.status, 'evaluated');
    for (const field of ['shotEnds', 'turnoverEnds', 'passingBudget', 'fixedTurnovers', 'shotLinkedTurnovers', 'passingLinkedTurnovers'] as const) close(actual[field], expected[field]);
    close(actual.shotEnds + actual.turnoverEnds, 100);
    close(actual.turnoverEnds, actual.passingLinkedTurnovers + actual.shotLinkedTurnovers);
  };
  const verifyMetrics = (indices: number[], predictions: number[], saved: { teams: number; bias: number; mae: number; rmse: number }) => {
    const errors = indices.map((index, position) => predictions[position]! - rows[index]!.targetTurnoverEnds);
    assert.equal(saved.teams, indices.length);
    close(saved.bias, sum(errors) / errors.length);
    close(saved.mae, sum(errors.map(Math.abs)) / errors.length);
    close(saved.rmse, Math.sqrt(sum(errors.map((error) => error ** 2)) / errors.length));
  };
  assert.deepEqual(selection.grid.map((entry: { passingWeight: number }) => entry.passingWeight), protocol.passingWeights);
  for (const entry of selection.grid) {
    assert.deepEqual(entry.unsupportedIndices, []);
    assert.equal(entry.results.length, training.length);
    const ledgers = training.map((index) => predict(rows[index]!, entry.passingWeight));
    ledgers.forEach((ledger, position) => verifyLedger(entry.results[position], ledger));
    if (entry.passingWeight === 0) training.forEach((index, position) => assert.deepEqual(entry.results[position], rows[index]!.scenarios['shot-only:prior-roles']));
    verifyMetrics(training, ledgers.map((ledger) => ledger.turnoverEnds), entry.metrics);
  }
  const chosen = [...selection.grid].sort((first, second) => first.metrics.rmse - second.metrics.rmse || first.passingWeight - second.passingWeight)[0];
  assert.equal(selection.selectedPassingWeight, chosen.passingWeight);
  assert.equal(selection.selectedPassingWeight, 0.25);
  assert.equal(report.selectedPassingWeight, selection.selectedPassingWeight);
  assert.deepEqual((report.rows as SavedRow[]).map((row) => row.sourceIndex), common);
  for (const saved of report.rows as SavedRow[]) {
    const row = rows[saved.sourceIndex]!;
    assert.equal(saved.season, row.season);
    assert.equal(saved.team, row.team);
    verifyLedger(saved.result, predict(row, selection.selectedPassingWeight));
  }
  for (const [period, first, last] of [['earlier', 1979, 2012], ['later', 2013, 2026]] as const) for (const coverage of ['all', 'at-least-90-percent']) {
    const indices = common.filter((index) => rows[index]!.season >= first && rows[index]!.season <= last
      && (coverage === 'all' || rows[index]!.priorMinuteCoverage >= 0.9));
    const saved = report.evaluations[`${period}:${coverage}`];
    assert.deepEqual(saved.indices, indices);
    assert.deepEqual(saved.unsupportedIndices, []);
    const candidate = indices.map((index) => predict(rows[index]!, selection.selectedPassingWeight).turnoverEnds);
    verifyMetrics(indices, candidate, saved.models.candidate);
    for (const [name, field] of [['shotOnly', 'shot-only:prior-roles'], ['unshrunk', 'split-roles:prior-roles'], ['league', 'league']] as const) {
      const baseline = indices.map((index) => field === 'league' ? rows[index]!.leaguePrediction : rows[index]!.scenarios[field]!.turnoverEnds);
      verifyMetrics(indices, baseline, saved.models[name]);
      const differences = indices.map((index, position) => (candidate[position]! - rows[index]!.targetTurnoverEnds) ** 2
        - (baseline[position]! - rows[index]!.targetTurnoverEnds) ** 2);
      const mean = sum(differences) / indices.length;
      const grouped = new Map<number, number>();
      indices.forEach((index, position) => grouped.set(rows[index]!.season, (grouped.get(rows[index]!.season) ?? 0) + differences[position]! - mean));
      const radius = 1.96 * Math.sqrt(grouped.size / (grouped.size - 1) * sum([...grouped.values()].map((value) => value ** 2))) / indices.length;
      close(saved.comparisons[name].meanSquaredErrorDifference, mean);
      close(saved.comparisons[name].interval95[0], mean - radius);
      close(saved.comparisons[name].interval95[1], mean + radius);
      assert.equal(saved.comparisons[name].seasonClusters, grouped.size);
    }
  }
  const earlier = report.evaluations['earlier:all'], later = report.evaluations['later:all'], high = report.evaluations['later:at-least-90-percent'];
  const rules = {
    positivePassingWeightAndFullSupport: report.selectedPassingWeight > 0 && (report.rows as SavedRow[]).every((row) => row.result.status === 'evaluated'),
    earlierNoWorseThanShotOnly: earlier.models.candidate.rmse <= earlier.models.shotOnly.rmse,
    laterMaterialAndPairedImprovement: ['shotOnly', 'unshrunk'].every((name) => later.models.candidate.rmse <= 0.98 * later.models[name].rmse && later.comparisons[name].interval95[1] < 0),
    laterHighCoverageNoRegression: ['shotOnly', 'unshrunk'].every((name) => high.models.candidate.rmse <= high.models[name].rmse),
  };
  assert.deepEqual(report.decision.rules, rules);
  assert.deepEqual(report.decision.failedRules, []);
  assert.ok(Object.values(rules).every(Boolean));
  assert.equal(report.decision.verdict, 'advance-to-integration-assessment');
});

test('integration1 masked turnovers preserve player separation, frozen neighbors and the failed uncertainty gate', () => {
  const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const hash = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
  const protocol = load('docs/research/mid-iq/MID_IQ_INTEGRATION_1_PROTOCOL.json');
  const fit = load('docs/research/mid-iq/MID_IQ_MISSING_TURNOVERS_FIT_1.json');
  const report = load('docs/research/mid-iq/MID_IQ_MISSING_TURNOVERS_RESULT_1.json');
  const audit = load(protocol.missingDataPolicy.source);
  assert.equal(hash('docs/research/mid-iq/MID_IQ_INTEGRATION_1_PROTOCOL.json'), 'a9a933d9b923dc21e44346aa805a8daa80af68566e1f4d8fe221af08d9432232');
  assert.equal(protocol.candidate2PassingWeight, 0.25);
  assert.deepEqual(protocol.budget, { missingDataPolicies: 1, strengthMappings: 1, retunes: 0, freshPanels: 1, finalistPolicyEvaluations: 1, humanPilots: 1 });
  assert.deepEqual(protocol.missingDataPolicy.minimumCohorts, { donors: 100, calibration: 40, evaluation: 40 });
  assert.deepEqual(protocol.missingDataPolicy.maskingGate, { allPredictionsFiniteNonnegative: true, rmseNoWorseThanDonorMean: true,
    maximumAbsoluteBiasPer36: 0.25, minimumEmpiricalIntervalCoverage: 0.85, maximumMeanIntervalWidthPer36: 3 });
  assert.equal(fit.version, 'mid-iq-missing-turnovers-fit-1');
  assert.equal(report.version, 'mid-iq-missing-turnovers-result-1');
  assert.equal(report.fitSha256, hash('docs/research/mid-iq/MID_IQ_MISSING_TURNOVERS_FIT_1.json'));
  assert.equal(fit.implementationSha256, hash('scripts/data_pipeline/evaluate_missing_turnovers.py'));
  for (const field of ['implementationSha256', 'sourceSha256', 'protocolVersion', 'runtime']) assert.deepEqual(report[field], fit[field]);
  assert.equal(fit.protocolVersion, protocol.version);
  for (const [path, expected] of Object.entries(fit.sourceSha256)) assert.equal(hash(path), expected);
  interface Peak { id: string; ready: boolean; peakYears: number[];
    aggregate: { totals: { minutes: number }; per36: { fieldGoalAttempts: number; freeThrowAttempts: number; assists: number; turnovers: number } } }
  interface Entry { id: string; identity: string; peakYears: number[]; minutes: number; features: number[]; observedTurnoversPer36: number }
  interface Neighbor { id: string; squaredDistance: number; turnoversPer36: number }
  interface Prediction extends Entry { prediction: number; neighbors: Neighbor[]; lower: number; upper: number }
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const bucket = (identity: string) => Number(BigInt(`0x${createHash('sha256').update(identity).digest('hex')}`) % 10n);
  const cohort = (first: number, last: number, buckets: number[]) => {
    const candidates = (audit.players as Peak[]).filter((entry) => entry.ready && buckets.includes(bucket(entry.id.split('_')[0]!))
      && entry.peakYears.every((year) => year >= first && year <= last));
    const identities = new Set<string>();
    const chosen = candidates.sort((first, second) => second.aggregate.totals.minutes - first.aggregate.totals.minutes
      || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)).filter((entry) => {
      const identity = entry.id.split('_')[0]!;
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
    return chosen.map((entry): Entry => ({ id: entry.id, identity: entry.id.split('_')[0]!, peakYears: entry.peakYears,
      minutes: entry.aggregate.totals.minutes,
      features: [entry.aggregate.per36.fieldGoalAttempts + 0.44 * entry.aggregate.per36.freeThrowAttempts, entry.aggregate.per36.assists],
      observedTurnoversPer36: entry.aggregate.per36.turnovers })).sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
  };
  const donors = cohort(1978, 2002, [0, 1, 2, 3, 4, 5]);
  const calibration = cohort(2003, 2012, [6, 7]);
  const evaluation = cohort(2013, 2026, [8, 9]);
  assert.deepEqual([donors.length, calibration.length, evaluation.length], [433, 68, 117]);
  const all = [...donors, ...calibration, ...evaluation];
  assert.equal(new Set(all.map((entry) => entry.identity)).size, all.length);
  assert.deepEqual(fit.donors, donors);
  assert.deepEqual(fit.calibrationIds, calibration.map((entry) => entry.id));
  assert.deepEqual(fit.cohortCounts, { donors: 433, calibration: 68 });
  assert.equal(fit.status, 'fitted');
  const means = [0, 1].map((feature) => sum(donors.map((entry) => entry.features[feature]!)) / donors.length);
  const deviations = [0, 1].map((feature) => Math.sqrt(sum(donors.map((entry) => (entry.features[feature]! - means[feature]!) ** 2)) / donors.length));
  means.forEach((value, index) => close(fit.standardization.means[index], value));
  deviations.forEach((value, index) => close(fit.standardization.populationStandardDeviations[index], value));
  const baseline = sum(donors.map((entry) => entry.observedTurnoversPer36)) / donors.length;
  close(fit.baseline, baseline);
  const predict = (features: number[]) => {
    const neighbors = donors.map((donor) => ({ id: donor.id, turnoversPer36: donor.observedTurnoversPer36,
      squaredDistance: sum([0, 1].map((feature) => ((features[feature]! - donor.features[feature]!) / deviations[feature]!) ** 2)) }))
      .sort((first, second) => first.squaredDistance - second.squaredDistance || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)).slice(0, 50);
    return { prediction: sum(neighbors.map((entry) => entry.turnoversPer36)) / 50, neighbors };
  };
  const verify = (entries: Entry[], results: Prediction[]) => {
    assert.equal(entries.length, results.length);
    return entries.map((entry, index) => {
      const saved = results[index]!;
      for (const field of ['id', 'identity', 'peakYears', 'minutes', 'features', 'observedTurnoversPer36'] as const) assert.deepEqual(saved[field], entry[field]);
      const expected = predict(entry.features);
      assert.equal(saved.neighbors.length, 50);
      assert.deepEqual(saved.neighbors.map((neighbor) => neighbor.id), expected.neighbors.map((neighbor) => neighbor.id));
      expected.neighbors.forEach((neighbor, position) => {
        close(saved.neighbors[position]!.squaredDistance, neighbor.squaredDistance);
        close(saved.neighbors[position]!.turnoversPer36, neighbor.turnoversPer36);
      });
      close(saved.prediction, expected.prediction);
      return expected.prediction;
    });
  };
  const calibrated = verify(calibration, fit.calibration);
  const residuals = calibrated.map((value, index) => Math.abs(value - calibration[index]!.observedTurnoversPer36)).sort((first, second) => first - second);
  const rank = Math.ceil((calibration.length + 1) * 0.9), radius = residuals[rank - 1]!;
  assert.equal(fit.uncertainty.rank, rank);
  close(fit.uncertainty.radius, radius);
  const predicted = verify(evaluation, report.rows);
  const errors = predicted.map((value, index) => value - evaluation[index]!.observedTurnoversPer36);
  const intervals = predicted.map((value) => [Math.max(0, value - radius), value + radius]);
  intervals.forEach((interval, index) => {
    close(report.rows[index].lower, interval[0]!);
    close(report.rows[index].upper, interval[1]!);
  });
  const metrics = {
    players: evaluation.length, bias: sum(errors) / errors.length,
    mae: sum(errors.map(Math.abs)) / errors.length, rmse: Math.sqrt(sum(errors.map((value) => value ** 2)) / errors.length),
    baselineRmse: Math.sqrt(sum(evaluation.map((entry) => (baseline - entry.observedTurnoversPer36) ** 2)) / evaluation.length),
    intervalCoverage: evaluation.filter((entry, index) => intervals[index]![0]! <= entry.observedTurnoversPer36 && entry.observedTurnoversPer36 <= intervals[index]![1]!).length / evaluation.length,
    meanIntervalWidth: sum(intervals.map((interval) => interval[1]! - interval[0]!)) / evaluation.length,
  };
  for (const [name, value] of Object.entries(metrics)) close(report.metrics[name], value);
  const rules = {
    evaluationSupport: evaluation.length >= 40,
    allPredictionsFiniteNonnegative: [...predicted, ...intervals.flat()].every((value) => Number.isFinite(value) && value >= 0),
    rmseNoWorseThanDonorMean: metrics.rmse <= metrics.baselineRmse,
    absoluteBiasWithinLimit: Math.abs(metrics.bias) <= 0.25,
    intervalCoverageWithinLimit: metrics.intervalCoverage >= 0.85,
    intervalWidthWithinLimit: metrics.meanIntervalWidth <= 3,
  };
  assert.deepEqual(report.decision.rules, rules);
  assert.deepEqual(report.decision.failedRules, Object.entries(rules).filter(([, passed]) => !passed).map(([name]) => name));
  assert.deepEqual(report.decision.failedRules, ['absoluteBiasWithinLimit', 'intervalCoverageWithinLimit']);
  assert.equal(report.decision.verdict, 'stop-integration-cycle');
});

function makeLineup(): TeamLineup {
  const lineup: TeamLineup = {
    PG: null, SG: null, SF: null, PF: null, C: null, SIXTH: null, coach: null,
  };
  for (const position of STARTER_POSITIONS) {
    lineup[position] = {
      id: position, name: position, franchise: 'TEST', decade: '2020s',
      primaryPosition: position, eligiblePositions: [position], stats: { ...baseStats },
      overallRating: 50, peakYears: [2023, 2024, 2025],
    };
  }
  return lineup;
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

test('offline roster candidate preserves positive talent value and separates reserve usage from starter demand', () => {
  const lineup = makeLineup();
  lineup.SIXTH = { ...lineup.PG!, id: 'reserve', stats: { ...baseStats, pts: 6, ast: 1, dbpm: 0 } };
  const snapshot = structuredClone(lineup);
  const context = { opponentNetRating: 3, isHome: true, isBackToBack: true };
  const original = evaluateRosterCandidate(lineup, context, INITIAL_ROSTER_BALANCE);
  for (const slot of STARTER_POSITIONS) {
    const improved = structuredClone(lineup);
    improved[slot]!.stats.pts += 1;
    assert.ok(evaluateRosterCandidate(improved, context, INITIAL_ROSTER_BALANCE).winProbability > original.winProbability);
  }
  const reserveUsage = structuredClone(lineup);
  reserveUsage.SIXTH!.stats.usgPct += 30;
  assert.deepEqual(evaluateRosterCandidate(reserveUsage, context, INITIAL_ROSTER_BALANCE), original);
  reserveUsage.SIXTH!.stats.pts += 10;
  assert.ok(evaluateRosterCandidate(reserveUsage, context, INITIAL_ROSTER_BALANCE).winProbability > original.winProbability);
  assert.deepEqual(lineup, snapshot);
  assert.deepEqual(evaluateGame(lineup, context, BALANCE_RULES_V2), evaluateGame(snapshot, context, BALANCE_RULES_V2));
});

test('offline roster spacing and congestion are continuous and PF/C labels do not change results', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  for (const rating of [2, 5, 10]) {
    const lower = structuredClone(lineup);
    for (const slot of STARTER_POSITIONS) lower[slot]!.stats.threePtAttempts = rating / 2;
    const upper = structuredClone(lower);
    upper.PG!.stats.threePtAttempts += 1e-7;
    const first = evaluateRosterCandidate(lower, context, INITIAL_ROSTER_BALANCE);
    const second = evaluateRosterCandidate(upper, context, INITIAL_ROSTER_BALANCE);
    assert.ok(second.deltaRating >= first.deltaRating);
    assert.ok(second.deltaRating - first.deltaRating < 1e-5);
  }
  let previous = Infinity;
  for (const usage of [114.999999, 115, 115.000001, 130, 160, 200]) {
    const changed = structuredClone(lineup);
    for (const slot of STARTER_POSITIONS) changed[slot]!.stats.usgPct = usage / 5;
    const result = evaluateRosterCandidate(changed, context, INITIAL_ROSTER_BALANCE);
    assert.ok(result.deltaRating <= previous);
    assert.ok(result.synergy.phiUsg > 0 && result.synergy.phiUsg <= 1);
    previous = result.deltaRating;
  }
  lineup.PF!.stats.pts = 30;
  lineup.C!.stats.dbpm = 5;
  const swapped = { ...lineup, PF: lineup.C, C: lineup.PF };
  close(evaluateRosterCandidate(lineup, context, INITIAL_ROSTER_BALANCE).deltaRating,
    evaluateRosterCandidate(swapped, context, INITIAL_ROSTER_BALANCE).deltaRating);
});

test('frozen offline candidates reproduce evaluations and unrounded development and reserved band failures', () => {
  const catalog = parseResearchJson(readFileSync(new URL('../../data/reference/mid-iq-roster-benchmarks.json', import.meta.url), 'utf8'));
  const playerList: Player[] = parseResearchJson(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8'));
  const coachList: Coach[] = parseResearchJson(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8'));
  const pool: OpponentPool = parseResearchJson(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool;
  for (const [reportName, passed, poolPassed, family] of [
    ['FIT_3', 10, undefined, 'development'], ['FIT_8', 15, undefined, 'development'],
    ['FIT_10', 15, undefined, 'development'], ['FIT_12', 15, 15, 'development'],
    ['FIT_13', 13, 12, 'development'], ['FIT_14', 13, 14, 'development'],
    ['FIT_16', 13, 14, 'development'], ['FIT_18', 13, 15, 'development'],
    ['VALIDATION_1', 4, 4, 'validation'],
  ] as const) {
    const report = parseResearchJson(readFileSync(new URL(`../../docs/research/mid-iq/MID_IQ_ROSTER_${reportName}.json`, import.meta.url), 'utf8'));
    for (const row of report.rosters) {
      const roster = catalog.rosters.find((entry: { id: string }) => entry.id === row.id);
      assert.equal(catalog.families[roster.family], family);
      const slots = [...STARTER_POSITIONS, 'SIXTH'] as const;
      const lineup = { ...Object.fromEntries(slots.map((slot, index) => [slot, playerList.find((player) => player.id === roster.players[index])])),
        coach: coachList.find((coach) => coach.id === roster.coach) } as TeamLineup;
      const neutral = evaluateRosterCandidate(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false }, report.fitted.parameters);
      assert.deepEqual(parseResearchJson(JSON.stringify(neutral)), row.neutral);
      if (poolPassed !== undefined) {
        let expected = 0;
        for (const tier of Object.keys(SCHEDULE_COUNTS) as (keyof OpponentPool)[]) {
          for (const opponent of pool[tier]) for (const home of [0, 3]) {
            const rating = neutral.deltaRating - opponent.netRating + home;
            expected += SCHEDULE_COUNTS[tier] / pool[tier].length / 2
              * (68 * calculateWinProbability(rating) + 14 * calculateWinProbability(rating - 8 + 7 * neutral.synergy.sixthManFRF)) / 82;
          }
        }
        close(expected, row.poolExpectedWins);
        assert.equal(row.poolInBand, expected >= row.target[0] && expected <= row.target[1]);
      }
    }
    assert.equal(report.rosters.length, family === 'development' ? 15 : 9);
    assert.equal(report.passed, passed);
    assert.equal(report.poolPassed, poolPassed);
    if (reportName === 'FIT_18') {
      for (const variant of report.variants) {
        const delta = variant.poolExpectedWinDifference;
        assert.ok(Number.isFinite(delta));
        if (['V01', 'V08'].includes(variant.id)) assert.ok(delta > 0);
        if (['V03', 'V07'].includes(variant.id)) assert.ok(delta < 0);
        if (variant.id === 'V04') assert.ok(delta >= 2 && delta <= 4);
        if (variant.id === 'V06') assert.ok(Math.abs(delta) <= 1e-10);
      }
    }
    if (family === 'development') assert.equal(report.variants.find((row: { id: string }) => row.id === 'V07').expectedWinDifference < 0, true);
    else {
      assert.equal(report.validationVerdict, 'FAIL');
      const selected = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ROSTER_FIT_18.json', import.meta.url), 'utf8'));
      assert.deepEqual(report.fitted.parameters, selected.fitted.parameters);
    }
  }
});

test('neutral-pace candidate does not treat tempo as talent and retains shooting-fit coaching', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 5, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, paceModel: 'neutral' as const };
  const original = evaluateRosterCandidate(lineup, context, parameters);
  for (const pace of [-3, 3]) {
    lineup.coach = { id: 'tempo', name: 'Tempo', systemName: 'Tempo', modifiers: [{ stat: 'pace', delta: pace }] };
    assert.deepEqual(evaluateRosterCandidate(lineup, context, parameters), original);
    assert.notEqual(evaluateRosterCandidate(lineup, context, INITIAL_ROSTER_BALANCE).deltaRating, original.deltaRating);
  }
  lineup.coach = { id: 'shooting', name: 'Shooting', systemName: 'Shooting', modifiers: [{ stat: 'threePtPct', delta: 0.04 }] };
  assert.ok(evaluateRosterCandidate(lineup, context, parameters).deltaRating > original.deltaRating);
  for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.threePtAttempts = 0;
  close(evaluateRosterCandidate(lineup, context, parameters).deltaRating,
    evaluateRosterCandidate({ ...lineup, coach: null }, context, parameters).deltaRating);
});

test('shared creation rewards passing without counting every creator as an independent lead', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, paceModel: 'neutral' as const, offenseModel: 'shared-creation' as const };
  lineup.PG!.stats.ast = 10;
  const original = evaluateRosterCandidate(lineup, context, parameters);
  const betterLead = structuredClone(lineup);
  betterLead.PG!.stats.ast += 1;
  const betterSupport = structuredClone(lineup);
  betterSupport.SG!.stats.ast += 1;
  const leadGain = evaluateRosterCandidate(betterLead, context, parameters).deltaRating - original.deltaRating;
  const supportGain = evaluateRosterCandidate(betterSupport, context, parameters).deltaRating - original.deltaRating;
  assert.ok(supportGain > 0);
  assert.ok(leadGain > supportGain);
  for (const slot of STARTER_POSITIONS) {
    const betterScorer = structuredClone(lineup);
    betterScorer[slot]!.stats.pts += 1;
    assert.ok(evaluateRosterCandidate(betterScorer, context, parameters).deltaRating > original.deltaRating);
  }
});

test('style coaching values transition and half-court strengths without making slow pace a penalty', () => {
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, paceModel: 'style' as const, offenseModel: 'shared-creation' as const };
  for (const pace of [-2, 2]) {
    const lineup = makeLineup();
    lineup.coach = { id: 'style', name: 'Style', systemName: 'Style', modifiers: [{ stat: 'pace', delta: pace }] };
    const original = evaluateRosterCandidate(lineup, context, parameters);
    assert.ok(original.coachPaceModifier > 0);
    assert.ok(original.coachPaceModifier <= Math.abs(pace) * parameters.coachScale);
    if (pace > 0) for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.stl += 0.1;
    else for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.pts += 1;
    const stronger = evaluateRosterCandidate(lineup, context, parameters);
    assert.ok(stronger.coachPaceModifier > original.coachPaceModifier);
    assert.ok(stronger.winProbability > original.winProbability);
  }
});

test('relative tempo fit is symmetric and coach preference follows roster strengths', () => {
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, paceModel: 'relative-style' as const, offenseModel: 'shared-creation' as const };
  for (const scorerPoints of [10, 30]) {
    const lineup = makeLineup();
    for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.pts = scorerPoints;
    const withPace = (pace: number) => evaluateRosterCandidate({ ...lineup,
      coach: { id: 'tempo', name: 'Tempo', systemName: 'Tempo', modifiers: [{ stat: 'pace', delta: pace }] },
    }, context, parameters);
    const fast = withPace(2);
    const slow = withPace(-2);
    close(fast.coachPaceModifier, -slow.coachPaceModifier);
    assert.equal(fast.deltaRating > slow.deltaRating, scorerPoints === 10);
    lineup.coach = { id: 'tempo', name: 'Tempo', systemName: 'Tempo', modifiers: [{ stat: 'pace', delta: -3 }] };
    const original = evaluateRosterCandidate(lineup, context, parameters);
    for (const slot of STARTER_POSITIONS) for (const stat of ['pts', 'ast', 'stl'] as const) {
      const improved = structuredClone(lineup);
      improved[slot]!.stats[stat] += 0.1;
      assert.ok(evaluateRosterCandidate(improved, context, parameters).deltaRating > original.deltaRating);
    }
  }
});

test('shooting coaches add made threes once, respect attempt volume and clamp percentages', () => {
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, coachShootingModel: 'made-shots' as const };
  for (const percentage of [0, 0.4, 0.99, 1]) for (const boost of [-0.05, 0.05]) {
    const lineup = makeLineup();
    for (const slot of STARTER_POSITIONS) {
      lineup[slot]!.stats.threePtPct = percentage;
      lineup[slot]!.stats.eraPaceFactor = 0.8;
    }
    const original = evaluateRosterCandidate(lineup, context, parameters);
    lineup.coach = { id: 'shooting', name: 'Shooting', systemName: 'Shooting', modifiers: [{ stat: 'threePtPct', delta: boost }] };
    const coached = evaluateRosterCandidate(lineup, context, parameters);
    const gain = 5 * 3 * 0.8 * 3 * (Math.max(0, Math.min(1, percentage + boost)) - percentage) * parameters.coachScale;
    close(coached.deltaRating - original.deltaRating, gain);
    close(coached.synergy.spacingRating, original.synergy.spacingRating);
    for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.threePtAttempts = 0;
    close(evaluateRosterCandidate(lineup, context, parameters).deltaRating,
      evaluateRosterCandidate({ ...lineup, coach: null }, context, parameters).deltaRating);
  }
});

test('direct defensive coaching is independent of roster-defense scaling and preserves the older model', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const coach: Coach = { id: 'defense', name: 'Defense', systemName: 'Defense', modifiers: [{ stat: 'dbpm', delta: 0.3 }] };
  for (const defenseScale of [0.4, 0.8, 1.1]) {
    const parameters = { ...INITIAL_ROSTER_BALANCE, defenseScale, coachDefenseModel: 'direct' as const };
    const original = evaluateRosterCandidate(lineup, context, parameters);
    const coached = evaluateRosterCandidate({ ...lineup, coach }, context, parameters);
    close(coached.deltaRating - original.deltaRating, 0.9 * parameters.coachScale);
    const legacy = { ...parameters, coachDefenseModel: 'scaled' as const };
    close(evaluateRosterCandidate({ ...lineup, coach }, context, legacy).deltaRating
      - evaluateRosterCandidate(lineup, context, legacy).deltaRating, 0.9 * parameters.coachScale * defenseScale);
    assert.deepEqual(evaluateRosterCandidate(lineup, context, parameters), evaluateRosterCandidate(lineup, context, legacy));
  }
});

test('system defensive coaching leaves player-liability penalties with the roster rather than amplifying coach effects', () => {
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  for (const dbpm of [-5, 0, 3]) for (const boost of [-0.6, 0.6]) {
    const lineup = makeLineup();
    for (const slot of STARTER_POSITIONS) lineup[slot]!.stats.dbpm = dbpm;
    const coach: Coach = { id: 'system', name: 'System', systemName: 'System', modifiers: [{ stat: 'dbpm', delta: boost }] };
    const parameters = { ...INITIAL_ROSTER_BALANCE, coachDefenseModel: 'system' as const };
    const original = evaluateRosterCandidate(lineup, context, parameters);
    const coached = evaluateRosterCandidate({ ...lineup, coach }, context, parameters);
    close(coached.deltaRating - original.deltaRating, 3 * boost * parameters.coachScale);
    const direct = { ...parameters, coachDefenseModel: 'direct' as const };
    assert.deepEqual(original, evaluateRosterCandidate(lineup, context, direct));
    if (dbpm === -5) assert.ok(Math.abs(evaluateRosterCandidate({ ...lineup, coach }, context, direct).deltaRating
      - original.deltaRating) > Math.abs(coached.deltaRating - original.deltaRating));
    const stronger = structuredClone(lineup);
    stronger.SG!.stats.dbpm += 0.1;
    assert.ok(evaluateRosterCandidate(stronger, context, parameters).deltaRating > original.deltaRating);
  }
});

test('role familiarity costs guard-wing-big crossings but not PF/C swaps or player talent improvements', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const parameters = { ...INITIAL_ROSTER_BALANCE, rolePenalty: 1.5 };
  const original = evaluateRosterCandidate(lineup, context, parameters);
  const moved = structuredClone(lineup);
  moved.SF!.primaryPosition = 'PG';
  close(evaluateRosterCandidate(moved, context, parameters).deltaRating, original.deltaRating - 1.5);
  moved.C!.primaryPosition = 'PG';
  close(evaluateRosterCandidate(moved, context, parameters).deltaRating, original.deltaRating - 4.5);
  const swapped = { ...lineup, PF: lineup.C, C: lineup.PF };
  close(evaluateRosterCandidate(swapped, context, parameters).deltaRating, original.deltaRating);
  const unspecified = structuredClone(lineup);
  unspecified.SF!.primaryPosition = '6TH';
  close(evaluateRosterCandidate(unspecified, context, parameters).deltaRating, original.deltaRating);
  moved.PG!.stats.pts += 1;
  assert.ok(evaluateRosterCandidate(moved, context, parameters).deltaRating > original.deltaRating - 4.5);
});

test('normalization scales volume only, is immutable and idempotent', () => {
  const stats = Object.freeze({ ...baseStats, eraPaceFactor: 0.794 });
  const result = normalizeStats(stats);
  for (const key of ['pts', 'reb', 'ast', 'stl', 'blk', 'threePtAttempts'] as const) {
    close(result[key], stats[key] * 0.794);
  }
  for (const key of ['fgPct', 'threePtPct', 'usgPct', 'dbpm'] as const) {
    assert.equal(result[key], stats[key]);
  }
  assert.equal(result.eraPaceFactor, 1);
  assert.deepEqual(normalizeStats(result), result);
  assert.equal(stats.pts, 20);
  close(calculateOffensiveContribution(stats), 15 * 0.794);
  close(calculateDefensiveComposite(stats), 2.5 + 3.75 * 0.794);
});

test('signed defense contributions reconcile exactly without changing the saved synergy shape', () => {
  const lineup = makeLineup();
  for (const dbpm of [-5, 0, 3]) {
    lineup.PG!.stats.dbpm = dbpm;
    lineup.SG!.stats.dbpm = dbpm;
    lineup.coach = { id: 'test', name: 'test', systemName: 'test', modifiers: [{ stat: 'dbpm', delta: 0.3 }] };
    const breakdown = calculateDefenseBreakdown(lineup);
    assert.equal(breakdown.total, calculateSynergy(lineup).drtgTeam);
    close(breakdown.baseline + breakdown.rimProtection + breakdown.perimeterDefense + breakdown.teamSupport + breakdown.liabilityPenalty, breakdown.total);
    assert.ok(breakdown.liabilityPenalty >= 0);
  }
  lineup.PG = null;
  lineup.PF = null;
  assert.equal(calculateDefenseBreakdown(lineup).total, calculateSynergy(lineup).drtgTeam);
});

test('usage follows thresholds, bench weighting, bonus cap and penalty floor', () => {
  for (const [usage, expected] of [[0, 1.03], [85, 1.03], [88, 1.021],
    [95, 1], [110, 1], [115, 1], [116, 0.992], [135, 0.84], [155, 0.68], [200, 0.5]]) {
    close(calculateUsageModifier(usage!), expected!);
  }
  assert.equal(calculateUsageModifier(120, 5), 1);
  close(calculateUsageModifier(121, 5), 0.992);
  const lineup = makeLineup();
  lineup.SIXTH = { ...lineup.PG!, stats: { ...baseStats, usgPct: 40 } };
  close(calculateSynergy(lineup).usgTeam, 116);
});

test('strict usage rules keep the bonus and optimal range but punish overload harder', () => {
  for (const [usage, expected] of [[0, 1.03], [88, 1.021], [95, 1], [115, 1],
    [116, 0.985], [135, 0.7], [151, 0.46], [152, 0.45], [200, 0.45]]) {
    close(calculateUsageModifier(usage!, 0, BALANCE_RULES_V3), expected!);
    assert.ok(calculateUsageModifier(usage!, 0, BALANCE_RULES_V3) <= calculateUsageModifier(usage!));
  }
  close(calculateUsageModifier(140, 20, BALANCE_RULES_V3), 0.925);
  assert.equal(calculateUsageModifier(135, 20, BALANCE_RULES_V3), 1);
});

test('spacing tier boundaries are inclusive at 2, 5 and 10', () => {
  for (const [rating, tier, modifier] of [
    [0, 'POOR', -0.15], [1.999, 'POOR', -0.15], [2, 'AVERAGE', 0],
    [4.999, 'AVERAGE', 0], [5, 'GOOD', 0.05], [9.999, 'GOOD', 0.05],
    [10, 'ELITE', 0.12],
  ] as const) {
    assert.deepEqual(calculateSpacing(rating), { spacingTier: tier, spacingModifier: modifier });
  }
});

test('full pipeline matches a hand-calculated five-player lineup', () => {
  const lineup = makeLineup();
  const before = structuredClone(lineup);
  const game = evaluateGame(lineup, { opponentNetRating: 2, isHome: true, isBackToBack: false });
  close(game.synergy.ortgTeam, 110);
  close(game.synergy.drtgTeam, 102.5);
  close(game.synergy.spacingRating, 6);
  close(game.synergy.effectiveOrtg, 115.5);
  close(game.synergy.netRating, 13);
  close(game.deltaRating, 14);
  close(game.winProbability, 1 / (1 + Math.exp(-14 / 10.5)));
  assert.deepEqual(lineup, before);
});

test('spacing uses raw attempts while offense and defense use pace-adjusted volume', () => {
  const lineup = makeLineup();
  for (const position of STARTER_POSITIONS) lineup[position]!.stats.eraPaceFactor = 0.5;
  const synergy = calculateSynergy(lineup);
  close(synergy.spacingRating, 6);
  close(synergy.ortgTeam, 102.5);
  close(synergy.drtgTeam, 104.75);
});

test('bench quality scales fatigue and permanent depth without changing starter ratings', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: true };
  assert.equal(evaluateGame(lineup, context).fatigueModifier, -8);
  lineup.SIXTH = { ...lineup.PG!, stats: { ...baseStats, pts: 40, usgPct: 0 } };
  const game = evaluateGame(lineup, context);
  assert.equal(game.synergy.sixthManFRF, 1);
  assert.equal(game.fatigueModifier, -1);
  assert.equal(game.synergy.depthBonus, 2);
  close(game.synergy.ortgTeam, 110);
  close(game.synergy.drtgTeam, 102.5);
  close(calculateSixthManFRF(baseStats), 0.675);
  assert.equal(calculateSixthManFRF(null), 0);
});

test('sigmoid has the specified width, symmetry, monotonicity and bounds', () => {
  assert.equal(calculateWinProbability(0), 0.5);
  close(calculateWinProbability(10), 0.7215937546003562);
  close(calculateWinProbability(10) + calculateWinProbability(-10), 1);
  assert.ok(calculateWinProbability(11) > calculateWinProbability(10));
  assert.equal(calculateWinProbability(1e6), 1);
  assert.equal(calculateWinProbability(-1e6), 0);
});

test('draft previews tolerate empty slots but game evaluation requires five starters', () => {
  const lineup = makeLineup();
  for (const position of STARTER_POSITIONS) lineup[position] = null;
  assert.ok(Object.values(calculateSynergy(lineup)).every(
    (value) => typeof value !== 'number' || Number.isFinite(value),
  ));
  assert.throws(() => evaluateGame(lineup, {
    opponentNetRating: 0, isHome: false, isBackToBack: false,
  }), /five starters/);
});

test('defense uses assigned slots and penalizes negative defenders after the worst', () => {
  const lineup = makeLineup();
  const scores = [-4, -3, 1, 2, 6];
  for (const [index, position] of STARTER_POSITIONS.entries()) {
    lineup[position]!.stats = {
      ...baseStats, dbpm: scores[index]! / 2.5, blk: 0, stl: 0, reb: 0,
    };
  }
  close(calculateSynergy(lineup).drtgTeam, 110 - 3 + 0.8 - 0.12 + 4.5);
  lineup.SG!.stats.dbpm = 0;
  close(calculateSynergy(lineup).drtgTeam, 110 - 3 + 0.4 - 0.3);
  const original = calculateSynergy(lineup).drtgTeam;
  [lineup.SG, lineup.C] = [lineup.C, lineup.SG];
  close(calculateSynergy(lineup).drtgTeam, original + 2 - 0.8);
});

test('all coach modifiers flow through the correct stages exactly once', () => {
  const lineup = makeLineup();
  for (const position of STARTER_POSITIONS) {
    lineup[position]!.stats.usgPct = 24;
    lineup[position]!.stats.threePtAttempts = 4;
  }
  lineup.coach = {
    id: 'test', name: 'Test', systemName: 'Test', modifiers: [
      { stat: 'fgPct', delta: 0.03 }, { stat: 'threePtPct', delta: 0.1 },
      { stat: 'dbpm', delta: 0.5 }, { stat: 'usgCap', delta: 5 },
      { stat: 'pace', delta: -1 },
    ],
  };
  const before = structuredClone(lineup);
  const game = evaluateGame(lineup, { opponentNetRating: 3, isHome: false, isBackToBack: false });
  close(game.synergy.ortgTeam, 110.6);
  close(game.synergy.drtgTeam, 101);
  close(game.synergy.spacingRating, 10);
  assert.equal(game.synergy.phiUsg, 1);
  close(game.synergy.effectiveOrtg, 110.6 * 1.12);
  close(game.deltaRating, 110.6 * 1.12 - 101 - 3 - 1);
  assert.deepEqual(lineup, before);
  lineup.SIXTH = { ...lineup.PG!, stats: { ...baseStats, usgPct: 0 } };
  close(calculateSynergy(lineup).sixthManFRF, (20 * 0.53 + 2.5 + 1.5) / 20);
});

test('coached percentages stay within zero and one and do not create attempts', () => {
  const lineup = makeLineup();
  lineup.coach = {
    id: 'test', name: 'Test', systemName: 'Test', modifiers: [
      { stat: 'fgPct', delta: 2 }, { stat: 'threePtPct', delta: -2 },
    ],
  };
  close(calculateSynergy(lineup).ortgTeam, 120);
  assert.equal(calculateSynergy(lineup).spacingRating, 0);
  lineup.coach.modifiers = [{ stat: 'threePtPct', delta: 2 }, { stat: 'fgPct', delta: -2 }];
  close(calculateSynergy(lineup).spacingRating, 15);
  close(calculateSynergy(lineup).ortgTeam, 100);
  for (const position of STARTER_POSITIONS) lineup[position]!.stats.threePtAttempts = 0;
  assert.equal(calculateSynergy(lineup).spacingRating, 0);
});

test('home, fatigue and bench depth are additive game modifiers', () => {
  const lineup = makeLineup();
  const context = { opponentNetRating: 3, isHome: false, isBackToBack: false };
  const away = evaluateGame(lineup, context);
  close(evaluateGame(lineup, { ...context, isHome: true }).deltaRating, away.deltaRating + 3);
  close(evaluateGame(lineup, { ...context, isBackToBack: true }).deltaRating, away.deltaRating - 8);
  lineup.SIXTH = { ...lineup.PG!, stats: { ...baseStats, pts: 15, dbpm: 0, usgPct: 0 } };
  const rested = evaluateGame(lineup, context);
  const tired = evaluateGame(lineup, { ...context, isBackToBack: true });
  assert.equal(rested.synergy.sixthManFRF, 0.5);
  assert.equal(tired.fatigueModifier, -4.5);
  close(rested.deltaRating, away.deltaRating + 1);
  close(tired.deltaRating, rested.deltaRating - 4.5);
  close(calculateSixthManFRF({ ...baseStats, eraPaceFactor: 0.5, dbpm: -1 }), 0.3125);
});

test('bench defense only rewards positive coach-adjusted DBPM and FRF remains bounded', () => {
  for (const dbpm of [-10, -1, 0, 1, 3]) {
    close(calculateSixthManFRF({ ...baseStats, dbpm }), (12.5 + Math.max(0, dbpm)) / 20);
  }
  const lineup = makeLineup();
  lineup.SIXTH = { ...lineup.PG!, stats: { ...baseStats, dbpm: -0.5 } };
  for (const delta of [-1, 0.5, 1]) {
    lineup.coach = {
      id: 'bench-test', name: 'Bench test', systemName: 'Test',
      modifiers: [{ stat: 'dbpm', delta }],
    };
    close(calculateSynergy(lineup).sixthManFRF, (12.5 + Math.max(0, -0.5 + delta)) / 20);
  }
  assert.equal(calculateSixthManFRF({ ...baseStats, pts: 0, ast: 0, dbpm: -10 }), 0);
  assert.equal(calculateSixthManFRF({ ...baseStats, pts: 1000, dbpm: 100 }), 1);
});

test('non-finite opponent ratings are rejected', () => {
  for (const opponentNetRating of [NaN, Infinity, -Infinity]) {
    assert.throws(() => evaluateGame(makeLineup(), {
      opponentNetRating, isHome: false, isBackToBack: false,
    }), /finite/);
  }
});

test('processed players, coaches and opponents work together without mutating source data', () => {
  const players = parseResearchJson(readFileSync(
    new URL('../../data/processed/players.json', import.meta.url), 'utf8',
  )) as Player[];
  const coaches = parseResearchJson(readFileSync(
    new URL('../../data/processed/coaches.json', import.meta.url), 'utf8',
  )) as Coach[];
  const opponents = parseResearchJson(readFileSync(
    new URL('../../data/processed/opponents.json', import.meta.url), 'utf8',
  )) as { regularSeasonPool: Record<string, { netRating: number }[]> };
  assert.ok(players.length > 0);
  assert.equal(coaches.length, 12);
  const original = JSON.stringify({ players, coaches, opponents });
  for (const player of players) {
    assert.ok(Number.isFinite(calculateOffensiveContribution(player.stats)), player.id);
    assert.ok(Number.isFinite(calculateDefensiveComposite(player.stats)), player.id);
    const quality = calculateSixthManFRF(player.stats);
    assert.ok(quality >= 0 && quality <= 1, player.id);
  }
  for (const decade of new Set(players.map((player) => player.decade))) {
    const lineup = makeLineup();
    const usedNames = new Set<string>();
    for (const position of STARTER_POSITIONS) {
      const player = players.find((candidate) => candidate.decade === decade
        && candidate.eligiblePositions.includes(position) && !usedNames.has(candidate.name));
      assert.ok(player, `${decade} ${position}`);
      usedNames.add(player.name);
      lineup[position] = player;
    }
    lineup.SIXTH = players.find((player) => player.decade === decade && !usedNames.has(player.name))!;
    assert.ok(lineup.SIXTH);
    for (const coach of coaches) {
      lineup.coach = coach;
      for (const opponent of Object.values(opponents.regularSeasonPool).flat()) {
        const game = evaluateGame(lineup, {
          opponentNetRating: opponent.netRating, isHome: true, isBackToBack: true,
        });
        assert.ok(game.winProbability >= 0 && game.winProbability <= 1);
        assert.ok(Object.values(game.synergy).every(
          (value) => typeof value !== 'number' || Number.isFinite(value),
        ));
      }
    }
  }
  assert.equal(JSON.stringify({ players, coaches, opponents }), original);
});