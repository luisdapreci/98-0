import type {
  Coach, GameContext, GameEvaluation, PlayerStats, SynergySnapshot, TeamLineup,
} from './types.ts';

export const STARTER_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export const SIGMOID_WIDTH = 10.5;

export const BALANCE_RULES_V1 = { version: 'mid-iq-1', coreOffenseWeight: 0, usagePenaltySlope: 0.008, usagePenaltyFloor: 0.5 } as const;
export const BALANCE_RULES_V2 = { version: 'mid-iq-2', coreOffenseWeight: 0.8, usagePenaltySlope: 0.008, usagePenaltyFloor: 0.5 } as const;
export const BALANCE_RULES_V3 = { version: 'mid-iq-3', coreOffenseWeight: 0.8, usagePenaltySlope: 0.015, usagePenaltyFloor: 0.45 } as const;
export interface BalanceRules {
  version: string;
  coreOffenseWeight: number;
  usagePenaltySlope: number;
  usagePenaltyFloor: number;
}

export function calculateTeamOffense(contributions: readonly number[], rules: BalanceRules = BALANCE_RULES_V1): number {
  if (contributions.length !== 5 || contributions.some((value) => !Number.isFinite(value)))
    throw new Error('Five finite offensive contributions are required.');
  if (!Number.isFinite(rules.coreOffenseWeight) || rules.coreOffenseWeight < 0 || rules.coreOffenseWeight > 1)
    throw new Error('Invalid core offense weight.');
  const average = contributions.reduce((total, value) => total + value, 0) / 5;
  if (rules.coreOffenseWeight === 0) return 95 + average;
  const core = [...contributions].sort((first, second) => second - first).slice(0, 3)
    .reduce((total, value) => total + value, 0) / 3;
  return 95 + (1 - rules.coreOffenseWeight) * average + rules.coreOffenseWeight * core;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeStats(stats: PlayerStats): PlayerStats {
  const factor = stats.eraPaceFactor;
  return {
    ...stats,
    pts: stats.pts * factor,
    reb: stats.reb * factor,
    ast: stats.ast * factor,
    stl: stats.stl * factor,
    blk: stats.blk * factor,
    threePtAttempts: stats.threePtAttempts * factor,
    eraPaceFactor: 1,
  };
}

function coachDelta(coach: Coach | null, stat: Coach['modifiers'][number]['stat']): number {
  return coach?.modifiers.reduce(
    (total, modifier) => total + (modifier.stat === stat ? modifier.delta : 0), 0,
  ) ?? 0;
}

function coachedStats(stats: PlayerStats, coach: Coach | null): PlayerStats {
  return {
    ...stats,
    fgPct: clamp(stats.fgPct + coachDelta(coach, 'fgPct'), 0, 1),
    threePtPct: clamp(stats.threePtPct + coachDelta(coach, 'threePtPct'), 0, 1),
    dbpm: stats.dbpm + coachDelta(coach, 'dbpm'),
  };
}

export function calculateUsageModifier(usage: number, usgCapDelta = 0, rules: BalanceRules = BALANCE_RULES_V1): number {
  if (usage <= 95) return Math.min(1.03, 1 + 0.003 * (95 - usage));
  const threshold = 115 + usgCapDelta;
  if (usage <= threshold) return 1;
  return Math.max(rules.usagePenaltyFloor, 1 - rules.usagePenaltySlope * (usage - threshold));
}

export function calculateSpacing(spacingRating: number): Pick<
  SynergySnapshot, 'spacingTier' | 'spacingModifier'
> {
  if (spacingRating >= 10) return { spacingTier: 'ELITE', spacingModifier: 0.12 };
  if (spacingRating >= 5) return { spacingTier: 'GOOD', spacingModifier: 0.05 };
  if (spacingRating >= 2) return { spacingTier: 'AVERAGE', spacingModifier: 0 };
  return { spacingTier: 'POOR', spacingModifier: -0.15 };
}

export function calculateOffensiveContribution(stats: PlayerStats): number {
  const normalized = normalizeStats(stats);
  return normalized.pts * normalized.fgPct + normalized.ast;
}

export function calculateDefensiveComposite(stats: PlayerStats): number {
  const normalized = normalizeStats(stats);
  return normalized.dbpm * 2.5 + normalized.blk * 1.2
    + normalized.stl * 1.8 + normalized.reb * 0.15;
}

export function calculateSixthManFRF(stats: PlayerStats | null): number {
  if (!stats) return 0;
  const normalized = normalizeStats(stats);
  const quality = normalized.pts * normalized.fgPct
    + normalized.ast * 0.5 + Math.max(0, normalized.dbpm);
  return clamp(quality / 20, 0, 1);
}

function defenseBreakdown(starters: (PlayerStats | null)[]) {
  const defense = starters.map((stats) => stats ? calculateDefensiveComposite(stats) : 0);
  const rimProtect = Math.max(defense[3]!, defense[4]!) * 0.5;
  const perimeterDefend = (defense[0]! + defense[1]! + defense[2]!) / 3 * 0.4;
  const teamDepth = defense.reduce((total, score) => total + score, 0) / 5 * 0.3;
  const turnstilePenalty = [...defense].sort((first, second) => first - second)
    .slice(1).reduce((total, score) => total + Math.max(0, -score) * 1.5, 0);
  return {
    baseline: 110,
    rimProtection: -rimProtect,
    perimeterDefense: -perimeterDefend,
    teamSupport: -teamDepth,
    liabilityPenalty: turnstilePenalty,
    total: 110 - rimProtect - perimeterDefend - teamDepth + turnstilePenalty,
  };
}

export function calculateDefenseBreakdown(lineup: TeamLineup) {
  return defenseBreakdown(STARTER_POSITIONS.map((position) => {
    const player = lineup[position];
    return player ? coachedStats(player.stats, lineup.coach) : null;
  }));
}

export function calculateSynergy(lineup: TeamLineup, rules: BalanceRules = BALANCE_RULES_V1): SynergySnapshot {
  const starters = STARTER_POSITIONS.map((position) => {
    const player = lineup[position];
    return player ? coachedStats(player.stats, lineup.coach) : null;
  });
  const bench = lineup.SIXTH ? coachedStats(lineup.SIXTH.stats, lineup.coach) : null;
  const usgTeam = starters.reduce((total, stats) => total + (stats?.usgPct ?? 0), 0)
    + (bench?.usgPct ?? 0) * 0.4;
  const phiUsg = calculateUsageModifier(usgTeam, coachDelta(lineup.coach, 'usgCap'), rules);
  const spacingRating = starters.reduce(
    (total, stats) => total + (stats ? stats.threePtAttempts * stats.threePtPct : 0), 0,
  );
  const spacing = calculateSpacing(spacingRating);
  const drtgTeam = defenseBreakdown(starters).total;
  const ortgTeam = calculateTeamOffense(starters.map((stats) => stats ? calculateOffensiveContribution(stats) : 0), rules);
  const effectiveOrtg = ortgTeam * phiUsg * (1 + spacing.spacingModifier);
  const sixthManFRF = calculateSixthManFRF(bench);
  return {
    usgTeam,
    phiUsg,
    spacingRating,
    ...spacing,
    drtgTeam,
    ortgTeam,
    effectiveOrtg,
    netRating: effectiveOrtg - drtgTeam,
    sixthManFRF,
    depthBonus: sixthManFRF * 2,
  };
}

export function calculateWinProbability(deltaRating: number): number {
  return 1 / (1 + Math.exp(-deltaRating / SIGMOID_WIDTH));
}

export function evaluateGame(lineup: TeamLineup, context: GameContext, rules: BalanceRules = BALANCE_RULES_V1): GameEvaluation {
  if (STARTER_POSITIONS.some((position) => !lineup[position])) {
    throw new Error('Game evaluation requires all five starters.');
  }
  if (!Number.isFinite(context.opponentNetRating)) {
    throw new Error('Opponent net rating must be finite.');
  }
  const synergy = calculateSynergy(lineup, rules);
  const fatigueModifier = context.isBackToBack ? -8 + 7 * synergy.sixthManFRF : 0;
  const homeCourtBonus = context.isHome ? 3 : 0;
  const coachPaceModifier = coachDelta(lineup.coach, 'pace');
  const deltaRating = synergy.netRating - context.opponentNetRating
    + fatigueModifier + homeCourtBonus + synergy.depthBonus + coachPaceModifier;
  return {
    synergy,
    fatigueModifier,
    homeCourtBonus,
    coachPaceModifier,
    deltaRating,
    winProbability: calculateWinProbability(deltaRating),
  };
}