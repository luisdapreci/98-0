import {
  BALANCE_RULES_V1, calculateDefenseBreakdown as baselineDefense, calculateDefensiveComposite,
  calculateSynergy as baselineSynergy, calculateWinProbability, evaluateGame as baselineEvaluation, STARTER_POSITIONS,
} from './math.ts';
import type { BalanceRules as BaselineRules } from './math.ts';
import type { GameContext, GameEvaluation, SynergySnapshot, TeamLineup } from './types.ts';

export interface BalanceRules extends BaselineRules {
  chemistry?: 'none';
}

export function calculateDefenseBreakdown(lineup: TeamLineup, rules: BalanceRules = BALANCE_RULES_V1) {
  if (rules.chemistry !== 'none') return baselineDefense(lineup);
  const individualDefense = -1.2 * STARTER_POSITIONS.reduce((total, position) =>
    total + (lineup[position] ? calculateDefensiveComposite(lineup[position]!.stats) : 0), 0) / 5;
  return { baseline: 110, rimProtection: 0, perimeterDefense: 0, teamSupport: individualDefense,
    liabilityPenalty: 0, total: 110 + individualDefense };
}

export function calculateSynergy(lineup: TeamLineup, rules: BalanceRules = BALANCE_RULES_V1): SynergySnapshot {
  if (rules.chemistry !== 'none') return baselineSynergy(lineup, rules);
  const base = baselineSynergy({ ...lineup, coach: null }, rules);
  const drtgTeam = calculateDefenseBreakdown(lineup, rules).total;
  return { ...base, phiUsg: 1, spacingTier: 'AVERAGE', spacingModifier: 0,
    drtgTeam, effectiveOrtg: base.ortgTeam, netRating: base.ortgTeam - drtgTeam };
}

export function evaluateGame(lineup: TeamLineup, context: GameContext, rules: BalanceRules = BALANCE_RULES_V1): GameEvaluation {
  if (rules.chemistry !== 'none') return baselineEvaluation(lineup, context, rules);
  const base = baselineEvaluation({ ...lineup, coach: null }, context, rules);
  const synergy = calculateSynergy(lineup, rules);
  const deltaRating = synergy.netRating - context.opponentNetRating
    + base.fatigueModifier + base.homeCourtBonus + synergy.depthBonus;
  return { ...base, synergy, deltaRating, coachPaceModifier: 0, winProbability: calculateWinProbability(deltaRating) };
}