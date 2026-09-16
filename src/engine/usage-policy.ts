import type { TeamLineup } from './types.ts';
import {
  HISTORICAL_ENTRY_ENGINE_VERSION, QUALIFICATION_45_ENGINE_VERSION, STAR_USAGE_ENGINE_VERSION, STRICT_USAGE_ENGINE_VERSION,
} from './engine-versions.ts';

export function usageBaseCap(engineVersion: string): number {
  return [STAR_USAGE_ENGINE_VERSION, HISTORICAL_ENTRY_ENGINE_VERSION, STRICT_USAGE_ENGINE_VERSION, QUALIFICATION_45_ENGINE_VERSION]
    .includes(engineVersion) ? 135 : 115;
}

export function usageCapForLineup(lineup: TeamLineup, engineVersion: string): number {
  return usageBaseCap(engineVersion) + (lineup.coach?.modifiers.reduce(
    (total, modifier) => total + (modifier.stat === 'usgCap' ? modifier.delta : 0), 0,
  ) ?? 0);
}

export function lineupForUsagePolicy(lineup: TeamLineup, engineVersion: string): TeamLineup {
  const allowance = usageBaseCap(engineVersion) - 115;
  if (!allowance || !lineup.coach) return lineup;
  return { ...lineup, coach: { ...lineup.coach, modifiers: [
    ...lineup.coach.modifiers, { stat: 'usgCap', delta: allowance },
  ] } };
}