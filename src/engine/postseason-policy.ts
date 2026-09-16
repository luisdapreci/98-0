import { postseasonEntry } from './season.ts';
import type { SeasonResult } from './types.ts';

export const HISTORICAL_ENTRY_ENGINE_VERSION = 'season-5';

export function qualificationWinsForEngine(engineVersion: string): number {
  return engineVersion === HISTORICAL_ENTRY_ENGINE_VERSION ? 40 : 60;
}

export function seasonForQualification(season: SeasonResult, engineVersion: string): SeasonResult {
  if (engineVersion !== HISTORICAL_ENTRY_ENGINE_VERSION) return season;
  const qualified = season.gameLog.length === 82 && season.wins >= qualificationWinsForEngine(engineVersion);
  return {
    ...season,
    qualified,
    postseasonEntry: !qualified ? 'MISSED' : season.wins < 60 ? 'PLAY_IN' : postseasonEntry(season.wins),
  };
}