import { postseasonEntry } from './season.ts';
import type { SeasonResult } from './types.ts';
import { HISTORICAL_ENTRY_ENGINE_VERSION, STRICT_USAGE_ENGINE_VERSION } from './engine-versions.ts';

const HISTORICAL_ENTRY_VERSIONS = [HISTORICAL_ENTRY_ENGINE_VERSION, STRICT_USAGE_ENGINE_VERSION];

export function qualificationWinsForEngine(engineVersion: string): number {
  return HISTORICAL_ENTRY_VERSIONS.includes(engineVersion) ? 40 : 60;
}

export function seasonForQualification(season: SeasonResult, engineVersion: string): SeasonResult {
  if (!HISTORICAL_ENTRY_VERSIONS.includes(engineVersion)) return season;
  const qualified = season.gameLog.length === 82 && season.wins >= qualificationWinsForEngine(engineVersion);
  return {
    ...season,
    qualified,
    postseasonEntry: !qualified ? 'MISSED' : season.wins < 60 ? 'PLAY_IN' : postseasonEntry(season.wins),
  };
}