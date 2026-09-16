import { BALANCE_RULES_V2, calculateDefenseBreakdown, calculateOffensiveContribution, calculateTeamOffense, calculateWinProbability, evaluateGame, normalizeStats, STARTER_POSITIONS } from './math.ts';
import type { GameContext, GameEvaluation, TeamLineup } from './types.ts';

export interface RosterBalanceParameters {
  paceModel?: 'legacy-quality' | 'neutral' | 'style' | 'relative-style';
  offenseModel?: 'independent' | 'shared-creation';
  coachShootingModel?: 'spacing' | 'made-shots';
  coachDefenseModel?: 'scaled' | 'direct' | 'system';
  rolePenalty?: number;
  offenseBaseline: number;
  offenseScale: number;
  leadScorerWeight: number;
  usageSlope: number;
  spacingLow: number;
  spacingHigh: number;
  defenseScale: number;
  depthScale: number;
  coachScale: number;
}

export const INITIAL_ROSTER_BALANCE: RosterBalanceParameters = {
  offenseBaseline: 91, offenseScale: 1.3, leadScorerWeight: 0.15, usageSlope: 0.006,
  spacingLow: -6, spacingHigh: 6, defenseScale: 0.9, depthScale: 5, coachScale: 0.6,
};

export function rosterBalanceFeatures(lineup: TeamLineup) {
  const original = evaluateGame(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false }, BALANCE_RULES_V2);
  const uncoachedLineup = { ...lineup, coach: null };
  const uncoached = evaluateGame(uncoachedLineup, { opponentNetRating: 0, isHome: false, isBackToBack: false }, BALANCE_RULES_V2);
  const defenseLiabilityDelta = calculateDefenseBreakdown(lineup).liabilityPenalty
    - calculateDefenseBreakdown(uncoachedLineup).liabilityPenalty;
  const fgDelta = lineup.coach?.modifiers.filter((modifier) => modifier.stat === 'fgPct').reduce((sum, modifier) => sum + modifier.delta, 0) ?? 0;
  const capDelta = lineup.coach?.modifiers.filter((modifier) => modifier.stat === 'usgCap').reduce((sum, modifier) => sum + modifier.delta, 0) ?? 0;
  const threePointDelta = lineup.coach?.modifiers.filter((modifier) => modifier.stat === 'threePtPct').reduce((sum, modifier) => sum + modifier.delta, 0) ?? 0;
  const scoringPair = (contributions: number[]) => contributions.sort((first, second) => second - first).slice(0, 2)
    .reduce((sum, value) => sum + value, 0) / 2;
  const topOffense = scoringPair(STARTER_POSITIONS.map((slot) => {
    const stats = lineup[slot]!.stats;
    return calculateOffensiveContribution({ ...stats, fgPct: Math.max(0, Math.min(1, stats.fgPct + fgDelta)) });
  }));
  const uncoachedTop = scoringPair(STARTER_POSITIONS.map((slot) => calculateOffensiveContribution(lineup[slot]!.stats)));
  const normalized = STARTER_POSITIONS.map((slot) => normalizeStats(lineup[slot]!.stats));
  const coachThreePointGain = normalized.reduce((sum, stats) => sum + 3 * stats.threePtAttempts
    * (Math.max(0, Math.min(1, stats.threePtPct + threePointDelta)) - stats.threePtPct), 0);
  const uncoachedScoring = normalized.map((stats) => stats.pts * stats.fgPct);
  const coachedScoring = normalized.map((stats) => stats.pts * Math.max(0, Math.min(1, stats.fgPct + fgDelta)));
  const sharedCreation = 0.6 * Math.max(...normalized.map((stats) => stats.ast))
    + 0.4 * normalized.reduce((sum, stats) => sum + stats.ast, 0) / 5;
  const transitionFit = Math.min(1, normalized.reduce((sum, stats) => sum + stats.ast / 5 + stats.stl / 1.5, 0) / 10);
  const halfCourtFit = Math.min(1, scoringPair([...uncoachedScoring]) / 16);
  const role = { PG: 0, SG: 0, SF: 1, PF: 2, C: 2 };
  const roleDistance = STARTER_POSITIONS.reduce((sum, slot) => {
    const primary = lineup[slot]!.primaryPosition;
    return sum + (primary === '6TH' ? 0 : Math.abs(role[slot] - role[primary]));
  }, 0);
  return { original, uncoached, topOffense, uncoachedTop, capDelta,
    sharedCreation, transitionFit, halfCourtFit, roleDistance, coachThreePointGain, defenseLiabilityDelta,
    scoringCore: calculateTeamOffense(coachedScoring, BALANCE_RULES_V2) - 95,
    uncoachedScoringCore: calculateTeamOffense(uncoachedScoring, BALANCE_RULES_V2) - 95,
    scoringPair: scoringPair(coachedScoring), uncoachedScoringPair: scoringPair(uncoachedScoring),
    starterUsage: STARTER_POSITIONS.reduce((sum, slot) => sum + lineup[slot]!.stats.usgPct, 0) };
}

export function evaluateRosterFeatures(
  features: ReturnType<typeof rosterBalanceFeatures>, context: GameContext, parameters: RosterBalanceParameters,
): GameEvaluation {
  const { original, uncoached } = features;
  const blend = (base: number, coached: number) => base + (coached - base) * parameters.coachScale;
  const synergy = { ...original.synergy };
  const shared = parameters.offenseModel === 'shared-creation';
  const core = shared ? blend(features.uncoachedScoringCore, features.scoringCore)
    : blend(uncoached.synergy.ortgTeam - 95, original.synergy.ortgTeam - 95);
  const lead = shared ? blend(features.uncoachedScoringPair, features.scoringPair)
    : blend(features.uncoachedTop, features.topOffense);
  const offense = core * (1 - parameters.leadScorerWeight) + lead * parameters.leadScorerWeight
    + (shared ? features.sharedCreation : 0);
  const excess = Math.max(0, features.starterUsage - 115 - features.capDelta * parameters.coachScale);
  synergy.usgTeam = features.starterUsage;
  synergy.phiUsg = 1 / (1 + parameters.usageSlope * excess * excess / 30);
  const madeShots = parameters.coachShootingModel === 'made-shots';
  const shotGain = madeShots ? features.coachThreePointGain * parameters.coachScale : 0;
  synergy.ortgTeam = parameters.offenseBaseline + parameters.offenseScale * offense + shotGain;
  synergy.spacingRating = madeShots ? uncoached.synergy.spacingRating
    : blend(uncoached.synergy.spacingRating, original.synergy.spacingRating);
  const spacingRatio = Math.max(0, Math.min(1, synergy.spacingRating / 10));
  const spacingPoints = parameters.spacingLow + (parameters.spacingHigh - parameters.spacingLow) * spacingRatio;
  const unspaced = parameters.offenseBaseline + parameters.offenseScale * offense * synergy.phiUsg + shotGain;
  synergy.spacingModifier = spacingPoints / unspaced;
  synergy.effectiveOrtg = unspaced + spacingPoints;
  const defense = blend(uncoached.synergy.drtgTeam, original.synergy.drtgTeam);
  const defensiveRating = parameters.coachDefenseModel === 'system'
    ? 110 + (uncoached.synergy.drtgTeam - 110) * parameters.defenseScale
      + (original.synergy.drtgTeam - uncoached.synergy.drtgTeam - features.defenseLiabilityDelta) * parameters.coachScale
    : parameters.coachDefenseModel === 'direct'
    ? 110 + (uncoached.synergy.drtgTeam - 110) * parameters.defenseScale
      + (original.synergy.drtgTeam - uncoached.synergy.drtgTeam) * parameters.coachScale
    : 110 + (defense - 110) * parameters.defenseScale;
  synergy.drtgTeam = defensiveRating
    + (parameters.rolePenalty ?? 0) * features.roleDistance;
  synergy.sixthManFRF = blend(uncoached.synergy.sixthManFRF, original.synergy.sixthManFRF);
  synergy.depthBonus = synergy.sixthManFRF * parameters.depthScale;
  synergy.netRating = synergy.effectiveOrtg - synergy.drtgTeam;
  const fatigueModifier = context.isBackToBack ? -8 + 7 * synergy.sixthManFRF : 0;
  const homeCourtBonus = context.isHome ? 3 : 0;
  const coachPaceModifier = parameters.paceModel === 'neutral' ? 0
    : parameters.paceModel === 'relative-style' ? original.coachPaceModifier * parameters.coachScale
      * (features.transitionFit - features.halfCourtFit)
    : parameters.paceModel === 'style' ? Math.abs(original.coachPaceModifier) * parameters.coachScale
      * (original.coachPaceModifier > 0 ? features.transitionFit : features.halfCourtFit)
      : original.coachPaceModifier * parameters.coachScale;
  const deltaRating = synergy.netRating - context.opponentNetRating + fatigueModifier + homeCourtBonus
    + synergy.depthBonus + coachPaceModifier;
  return { synergy, fatigueModifier, homeCourtBonus, coachPaceModifier, deltaRating,
    winProbability: calculateWinProbability(deltaRating) };
}

export function evaluateRosterCandidate(lineup: TeamLineup, context: GameContext, parameters: RosterBalanceParameters): GameEvaluation {
  return evaluateRosterFeatures(rosterBalanceFeatures(lineup), context, parameters);
}