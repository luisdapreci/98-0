export interface PossessionInput {
  id: string;
  points: number | null;
  fieldGoalAttempts: number | null;
  freeThrowAttempts: number | null;
  turnovers: number | null;
}

export interface PossessionOffenseInput extends PossessionInput {
  offensiveRebounds: number | null;
  threePointAttempts: number | null;
}

export interface PossessionOffensePolicy {
  referencePossessionsPer36: number;
  maxWorkloadMultiplier: number | null;
}

export function evaluatePossessionOffense(inputs: readonly PossessionOffenseInput[], policy: Readonly<PossessionOffensePolicy>) {
  if (!Number.isFinite(policy.referencePossessionsPer36) || policy.referencePossessionsPer36 <= 0
    || (policy.maxWorkloadMultiplier !== null && (!Number.isFinite(policy.maxWorkloadMultiplier) || policy.maxWorkloadMultiplier <= 0)))
    throw new Error('Positive finite reference exposure and workload ceiling or null required.');
  const budget = evaluatePossessionBudget(inputs);
  for (const input of inputs) {
    for (const field of ['offensiveRebounds', 'threePointAttempts'] as const)
      if (input[field] === null || !Number.isFinite(input[field]) || input[field]! < 0)
        throw new Error(`Observed finite nonnegative ${field} required for ${input.id}.`);
    if (input.threePointAttempts! > input.fieldGoalAttempts!)
      throw new Error(`Three-point attempts cannot exceed field-goal attempts for ${input.id}.`);
  }
  const sum = (field: keyof Omit<PossessionOffenseInput, 'id'>) => inputs.reduce((total, input) => total + input[field]!, 0);
  const observedShotEnds = sum('fieldGoalAttempts') + 0.44 * sum('freeThrowAttempts');
  const observedUsedEnds = observedShotEnds + sum('turnovers');
  const observedRebounds = sum('offensiveRebounds');
  const observedPossessions = observedUsedEnds - observedRebounds;
  if (![observedUsedEnds, observedRebounds, observedPossessions].every(Number.isFinite)
    || observedPossessions <= 0 || observedRebounds >= observedShotEnds)
    throw new Error('Finite positive net possession exposure and rebounds below shot events required.');
  const eventMultiplier = observedUsedEnds / observedPossessions;
  const exposureScale = 100 / observedPossessions;
  const workloadMultiplier = policy.referencePossessionsPer36 / observedPossessions;
  const projectedPoints = budget.pointsPer100UsedEnds * eventMultiplier;
  const players = budget.players.map((player, index) => ({ id: player.id, share: player.share,
    points: player.points * eventMultiplier, shotEnds: player.shotEnds * eventMultiplier,
    turnoverEnds: player.turnoverEnds * eventMultiplier,
    reboundContinuations: inputs[index]!.offensiveRebounds! * exposureScale,
    threePointAttempts: inputs[index]!.threePointAttempts! * exposureScale }));
  const shotEnds = budget.shotEnds * eventMultiplier;
  const turnoverEnds = budget.turnoverEnds * eventMultiplier;
  const reboundContinuations = observedRebounds * exposureScale;
  if (![projectedPoints, shotEnds, turnoverEnds, reboundContinuations, workloadMultiplier].every(Number.isFinite)
    || players.some((player) => Object.values(player).some((value) => typeof value === 'number' && !Number.isFinite(value)))
    || Math.abs(shotEnds + turnoverEnds - reboundContinuations - 100) > 1e-8)
    throw new Error('Finite conserved possession accounting required.');
  const supported = policy.maxWorkloadMultiplier === null || workloadMultiplier <= policy.maxWorkloadMultiplier;
  return { version: 'possession-offense-prototype-2', scope: 'offline-box-possession-proxy',
    status: supported ? 'accounted' : 'workload-shortfall', policy: { ...policy },
    pointsPer100Possessions: supported ? projectedPoints : null,
    unconstrainedPointsPer100Possessions: projectedPoints,
    pointsPerShotEnd: sum('points') / observedShotEnds,
    threePointAttemptShare: sum('fieldGoalAttempts') > 0 ? sum('threePointAttempts') / sum('fieldGoalAttempts') : 0,
    observedPossessionsPer36: observedPossessions, workloadMultiplier,
    shotEnds, turnoverEnds, reboundContinuations, players };
}

export function evaluatePossessionBudget(inputs: readonly PossessionInput[], shares?: readonly number[]) {
  if (inputs.length !== 5 || new Set(inputs.map((input) => input.id.split('_')[0])).size !== 5)
    throw new Error('Five distinct starter identities are required.');
  const rates = inputs.map((input) => {
    for (const field of ['points', 'fieldGoalAttempts', 'freeThrowAttempts', 'turnovers'] as const) {
      const value = input[field];
      if (value === null || !Number.isFinite(value) || value < 0)
        throw new Error(`Observed finite nonnegative ${field} required for ${input.id}.`);
    }
    const shotEnds = input.fieldGoalAttempts! + 0.44 * input.freeThrowAttempts!;
    const usedEnds = shotEnds + input.turnovers!;
    if (!Number.isFinite(usedEnds) || usedEnds <= 0 || (shotEnds === 0 && input.points! > 0))
      throw new Error(`Positive offensive exposure required for ${input.id}.`);
    return { id: input.id, shotEnds, usedEnds, points: input.points!, turnovers: input.turnovers! };
  });
  const totalDemand = rates.reduce((sum, rate) => sum + rate.usedEnds, 0);
  if (!Number.isFinite(totalDemand)) throw new Error('Finite total demand required.');
  const allocation = shares ?? rates.map((rate) => rate.usedEnds / totalDemand);
  if (allocation.length !== 5 || allocation.some((share) => !Number.isFinite(share) || share < 0)
    || Math.abs(allocation.reduce((sum, share) => sum + share, 0) - 1) > 1e-10)
    throw new Error('Five finite nonnegative opportunity shares must sum to one.');
  const players = rates.map((rate, index) => {
    const allocatedEnds = 100 * allocation[index]!;
    return { id: rate.id, share: allocation[index]!, allocatedEnds,
      shotEnds: allocatedEnds * rate.shotEnds / rate.usedEnds,
      turnoverEnds: allocatedEnds * rate.turnovers / rate.usedEnds,
      points: allocatedEnds * rate.points / rate.usedEnds };
  });
  const pointsPer100UsedEnds = players.reduce((sum, player) => sum + player.points, 0);
  if (!Number.isFinite(pointsPer100UsedEnds)) throw new Error('Finite point output required.');
  return { version: 'possession-accounting-prototype-1',
    allocation: shares ? 'explicit-shares' : 'observed-per36-demand',
    pointsPer100UsedEnds, shotEnds: players.reduce((sum, player) => sum + player.shotEnds, 0),
    turnoverEnds: players.reduce((sum, player) => sum + player.turnoverEnds, 0), players };
}