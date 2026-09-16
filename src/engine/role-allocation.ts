import { evaluateLineupOffense } from './lineup-prototype.ts';
import type { LineupOffenseInput } from './lineup-prototype.ts';

export interface RoleAllocationPolicy {
  referenceShotPointsPerEnd: number;
  referenceTurnoverShare: number;
  shotTurnoverFraction: number;
  passingTurnoverFraction: number;
  shotCapacityMultiplier: number | null;
  passingCapacityMultiplier: number | null;
}

function allocate(budget: number, weights: readonly number[], capacities: readonly number[], costs: readonly number[]) {
  if (!Number.isFinite(budget) || budget < 0) throw new Error('Finite nonnegative allocation budget required.');
  const allocation = weights.map(() => 0);
  let remaining = budget;
  let active = weights.map((_, index) => index).filter((index) => weights[index]! > 0 && capacities[index]! > 0);
  while (active.length && remaining > 0) {
    const cost = active.reduce((sum, index) => sum + weights[index]! * costs[index]!, 0);
    if (!Number.isFinite(cost) || cost <= 0) throw new Error('Finite positive role allocation cost required.');
    const capped = active.filter((index) => remaining * weights[index]! / cost > capacities[index]!);
    if (!capped.length) {
      for (const index of active) allocation[index] = remaining * weights[index]! / cost;
      remaining = 0;
    } else {
      for (const index of capped) {
        allocation[index] = capacities[index]!;
        remaining -= capacities[index]! * costs[index]!;
      }
      active = active.filter((index) => !capped.includes(index));
    }
  }
  return allocation;
}

function roleWeights(explicit: readonly number[] | undefined, observed: readonly number[]) {
  const total = observed.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) throw new Error('Finite observed role demand required.');
  const weights = explicit ?? observed.map((value) => total > 0 ? value / total : 0);
  if (weights.length !== 5 || weights.some((value) => !Number.isFinite(value) || value < 0)
    || (explicit || total > 0) && Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) > 1e-10)
    throw new Error('Five finite nonnegative role shares must sum to one.');
  return weights;
}

export function evaluateRoleAllocation(inputs: readonly LineupOffenseInput[], policy: Readonly<RoleAllocationPolicy>,
  shares: { shots?: readonly number[]; passing?: readonly number[] } = {}) {
  const shotFraction = policy.shotTurnoverFraction;
  const passingFraction = policy.passingTurnoverFraction;
  if (![shotFraction, passingFraction].every((value) => Number.isFinite(value) && value >= 0)
    || shotFraction + passingFraction > 1)
    throw new Error('Finite nonnegative turnover fractions with a sum at most one required.');
  for (const cap of [policy.shotCapacityMultiplier, policy.passingCapacityMultiplier])
    if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) throw new Error('Positive finite role capacity or null required.');
  const validated = evaluateLineupOffense(inputs, { referenceShotPointsPerEnd: policy.referenceShotPointsPerEnd,
    referenceTurnoverShare: policy.referenceTurnoverShare, turnoverShotResponse: 1, capacityMultiplier: null });
  const rates = validated.players.map((player) => {
    const observedPassing = 20 * player.assistRateRatio;
    if (!Number.isFinite(observedPassing)) throw new Error('Finite passing exposure required.');
    if (observedPassing === 0 && passingFraction * player.observedTurnovers > 0)
      throw new Error(`Unsupported passing-linked turnover exposure without observed assists: ${player.id}.`);
    const shotCapacity = policy.shotCapacityMultiplier === null ? Infinity : player.observedShots * policy.shotCapacityMultiplier;
    const passingCapacity = observedPassing === 0 ? 0
      : policy.passingCapacityMultiplier === null ? Infinity : observedPassing * policy.passingCapacityMultiplier;
    const fixedTurnovers = (1 - shotFraction - passingFraction) * player.observedTurnovers;
    const costPerShot = shotFraction * player.observedTurnovers / player.observedShots;
    const costPerPassingUnit = observedPassing > 0 ? passingFraction * player.observedTurnovers / observedPassing : 0;
    if (![fixedTurnovers, costPerShot, costPerPassingUnit].every(Number.isFinite)
      || (policy.shotCapacityMultiplier !== null && !Number.isFinite(shotCapacity))
      || (policy.passingCapacityMultiplier !== null && !Number.isFinite(passingCapacity)))
      throw new Error('Finite role costs and capped exposures required.');
    return { id: player.id, observedShots: player.observedShots, observedTurnovers: player.observedTurnovers,
      observedPassing, shotPointsPerEnd: player.shotPointsPerEnd, shotCapacity, passingCapacity,
      fixedTurnovers, costPerShot, costPerPassingUnit };
  });
  const shotWeights = roleWeights(shares.shots, rates.map((rate) => rate.observedShots));
  const passingWeights = roleWeights(shares.passing, rates.map((rate) => rate.observedPassing));
  const allocatedPassing = allocate(100, passingWeights, rates.map((rate) => rate.passingCapacity), rates.map(() => 1));
  const passingTurnovers = rates.map((rate, index) => rate.costPerPassingUnit * allocatedPassing[index]!);
  const shotBudget = 100 - rates.reduce((sum, rate, index) => sum + rate.fixedTurnovers + passingTurnovers[index]!, 0);
  const allocatedShots = allocate(shotBudget, shotWeights, rates.map((rate) => rate.shotCapacity), rates.map((rate) => 1 + rate.costPerShot));
  const players = rates.map((rate, index) => ({ id: rate.id,
    requestedShotShare: shotWeights[index]!, requestedPassingShare: passingWeights[index]!,
    observedShots: rate.observedShots, observedPassing: rate.observedPassing, observedTurnovers: rate.observedTurnovers,
    shotCapacity: Number.isFinite(rate.shotCapacity) ? rate.shotCapacity : null,
    passingCapacity: Number.isFinite(rate.passingCapacity) ? rate.passingCapacity : null,
    allocatedShots: allocatedShots[index]!, allocatedPassing: allocatedPassing[index]!,
    shotWorkloadMultiplier: allocatedShots[index]! / rate.observedShots,
    passingWorkloadMultiplier: rate.observedPassing > 0 ? allocatedPassing[index]! / rate.observedPassing : null,
    fixedTurnovers: rate.fixedTurnovers, shotLinkedTurnovers: allocatedShots[index]! * rate.costPerShot,
    passingLinkedTurnovers: passingTurnovers[index]!,
    turnoverEnds: rate.fixedTurnovers + allocatedShots[index]! * rate.costPerShot + passingTurnovers[index]!,
    points: allocatedShots[index]! * rate.shotPointsPerEnd, shotPointsPerEnd: rate.shotPointsPerEnd }));
  const shotEnds = players.reduce((sum, player) => sum + player.allocatedShots, 0);
  const turnoverEnds = players.reduce((sum, player) => sum + player.turnoverEnds, 0);
  const passingUnits = players.reduce((sum, player) => sum + player.allocatedPassing, 0);
  const pointsOnAllocatedEvents = players.reduce((sum, player) => sum + player.points, 0);
  const unallocatedEnds = Math.max(0, 100 - shotEnds - turnoverEnds);
  const unallocatedPassing = Math.max(0, 100 - passingUnits);
  if (![shotEnds, turnoverEnds, passingUnits, pointsOnAllocatedEvents, unallocatedEnds, unallocatedPassing].every(Number.isFinite)
    || players.some((player) => !Number.isFinite(player.shotWorkloadMultiplier)
      || player.passingWorkloadMultiplier !== null && !Number.isFinite(player.passingWorkloadMultiplier))
    || Math.abs(shotEnds + turnoverEnds + unallocatedEnds - 100) > 1e-8
    || Math.abs(passingUnits + unallocatedPassing - 100) > 1e-8)
    throw new Error('Finite conserved shot and passing budgets required.');
  return { version: 'role-allocation-prototype-1', scope: 'offline-dual-role-sensitivity', policy: { ...policy },
    status: unallocatedEnds > 1e-8 || unallocatedPassing > 1e-8 ? 'role-shortfall' : 'fully-allocated',
    shotAllocation: shares.shots ? 'explicit' : 'observed-demand', passingAllocation: shares.passing ? 'explicit' : 'observed-demand',
    pointsOnAllocatedEvents, shotEnds, turnoverEnds, unallocatedEnds, passingUnits, unallocatedPassing, players };
}