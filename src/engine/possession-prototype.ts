export interface PossessionInput {
  id: string;
  points: number | null;
  fieldGoalAttempts: number | null;
  freeThrowAttempts: number | null;
  turnovers: number | null;
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