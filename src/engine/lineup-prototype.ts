export interface LineupOffenseInput {
  id: string;
  shotWorkloadRatio: number | null;
  trueShootingDelta: number | null;
  turnoverRateRatio: number | null;
  assistRateRatio: number | null;
}

export interface LineupOffensePolicy {
  referenceShotPointsPerEnd: number;
  referenceTurnoverShare: number;
  turnoverShotResponse: number;
  capacityMultiplier: number | null;
}

export function evaluateLineupOffense(inputs: readonly LineupOffenseInput[], policy: Readonly<LineupOffensePolicy>, shotShares?: readonly number[]) {
  if (inputs.length !== 5 || new Set(inputs.map((input) => input.id.split('_')[0])).size !== 5)
    throw new Error('Five distinct starter identities are required.');
  if (!Number.isFinite(policy.referenceShotPointsPerEnd) || policy.referenceShotPointsPerEnd <= 0
    || !Number.isFinite(policy.referenceTurnoverShare) || policy.referenceTurnoverShare < 0 || policy.referenceTurnoverShare >= 1
    || !Number.isFinite(policy.turnoverShotResponse) || policy.turnoverShotResponse < 0 || policy.turnoverShotResponse > 1
    || (policy.capacityMultiplier !== null && (!Number.isFinite(policy.capacityMultiplier) || policy.capacityMultiplier <= 0)))
    throw new Error('Finite reference rates, response in [0, 1] and a positive capacity multiplier or null are required.');
  const rates = inputs.map((input) => {
    for (const field of ['shotWorkloadRatio', 'trueShootingDelta', 'turnoverRateRatio', 'assistRateRatio'] as const) {
      const value = input[field];
      if (value === null || !Number.isFinite(value) || (field !== 'trueShootingDelta' && value < 0))
        throw new Error(`Observed finite ${field} required for ${input.id}.`);
    }
    const observedShots = 20 * (1 - policy.referenceTurnoverShare) * input.shotWorkloadRatio!;
    const observedTurnovers = 20 * policy.referenceTurnoverShare * input.turnoverRateRatio!;
    const shotPointsPerEnd = policy.referenceShotPointsPerEnd + 2 * input.trueShootingDelta!;
    const fixedTurnovers = (1 - policy.turnoverShotResponse) * observedTurnovers;
    const turnoverCostPerShot = policy.turnoverShotResponse * observedTurnovers / observedShots;
    const capacity = policy.capacityMultiplier === null ? Infinity : observedShots * policy.capacityMultiplier;
    if (observedShots <= 0 || ![observedShots, observedTurnovers, shotPointsPerEnd, fixedTurnovers, turnoverCostPerShot].every(Number.isFinite)
      || shotPointsPerEnd < 0 || (policy.capacityMultiplier !== null && !Number.isFinite(capacity)))
      throw new Error(`Positive shot exposure and finite projected rates required for ${input.id}.`);
    return { id: input.id, observedShots, observedTurnovers, shotPointsPerEnd, fixedTurnovers,
      turnoverCostPerShot, capacity, assistRateRatio: input.assistRateRatio! };
  });
  const demand = rates.reduce((sum, rate) => sum + rate.observedShots, 0);
  if (!Number.isFinite(demand)) throw new Error('Finite total shot demand required.');
  const weights = shotShares ?? rates.map((rate) => rate.observedShots / demand);
  if (weights.length !== 5 || weights.some((weight) => !Number.isFinite(weight) || weight < 0)
    || Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-10)
    throw new Error('Five finite nonnegative shot shares must sum to one.');
  const allocatedShots = rates.map(() => 0);
  let remaining = 100 - rates.reduce((sum, rate) => sum + rate.fixedTurnovers, 0);
  if (!Number.isFinite(remaining) || remaining < 0) throw new Error('Fixed turnover exposure exceeds the event budget.');
  let active = rates.map((_, index) => index).filter((index) => weights[index]! > 0);
  while (active.length && remaining > 0) {
    const weightedCost = active.reduce((sum, index) => sum + weights[index]! * (1 + rates[index]!.turnoverCostPerShot), 0);
    if (!Number.isFinite(weightedCost) || weightedCost <= 0) throw new Error('Finite positive allocation cost required.');
    const saturated = active.filter((index) => remaining * weights[index]! / weightedCost > rates[index]!.capacity);
    if (!saturated.length) {
      for (const index of active) allocatedShots[index] = remaining * weights[index]! / weightedCost;
      remaining = 0;
    } else {
      for (const index of saturated) {
        allocatedShots[index] = rates[index]!.capacity;
        remaining -= rates[index]!.capacity * (1 + rates[index]!.turnoverCostPerShot);
      }
      active = active.filter((index) => !saturated.includes(index));
    }
  }
  const players = rates.map((rate, index) => {
    const shots = allocatedShots[index]!;
    const shotLinkedTurnovers = shots * rate.turnoverCostPerShot;
    return { id: rate.id, requestedShotShare: weights[index]!, observedShots: rate.observedShots,
      observedTurnovers: rate.observedTurnovers, shotCapacity: Number.isFinite(rate.capacity) ? rate.capacity : null,
      allocatedShots: shots, workloadMultiplier: shots / rate.observedShots,
      fixedTurnovers: rate.fixedTurnovers, shotLinkedTurnovers, turnoverEnds: rate.fixedTurnovers + shotLinkedTurnovers,
      points: shots * rate.shotPointsPerEnd, shotPointsPerEnd: rate.shotPointsPerEnd, assistRateRatio: rate.assistRateRatio };
  });
  const shotEnds = players.reduce((sum, player) => sum + player.allocatedShots, 0);
  const turnoverEnds = players.reduce((sum, player) => sum + player.turnoverEnds, 0);
  const pointsOnAllocatedEvents = players.reduce((sum, player) => sum + player.points, 0);
  const unallocatedEnds = Math.max(0, 100 - shotEnds - turnoverEnds);
  const maxWorkloadMultiplier = Math.max(...players.map((player) => player.workloadMultiplier));
  if (![shotEnds, turnoverEnds, pointsOnAllocatedEvents, unallocatedEnds, maxWorkloadMultiplier].every(Number.isFinite)
    || Math.abs(shotEnds + turnoverEnds + unallocatedEnds - 100) > 1e-8)
    throw new Error('Finite conserved event accounting required.');
  return { version: 'lineup-offense-prototype-1', scope: 'offline-allocation-sensitivity',
    policy: { ...policy }, allocation: shotShares ? 'explicit-shot-shares' : 'observed-shot-demand',
    status: unallocatedEnds > 1e-8 ? 'capacity-shortfall' : 'fully-allocated',
    pointsOnAllocatedEvents, shotEnds, turnoverEnds, unallocatedEnds,
    maxWorkloadMultiplier, players };
}