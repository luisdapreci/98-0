import { DRAFT_SLOTS } from './draft.ts';
import type { RivalryEvidence, TeamLineup } from './types.ts';

export const RIVALRY_VERSION = 'rivalry-1';
export const RIVALRY_PAIRS: readonly (readonly [string, string])[] = [
  ['BOS', 'LAL'], ['CHI', 'DET'], ['IND', 'NYK'],
  ['MIA', 'NYK'], ['BOS', 'PHI'], ['LAL', 'SAS'],
];

export function rivalryEvidence(lineup: TeamLineup, opponentFranchise: string): RivalryEvidence {
  const matches = RIVALRY_PAIRS.flatMap(([first, second]) => {
    const draftedFranchise = opponentFranchise === first ? second : opponentFranchise === second ? first : null;
    if (!draftedFranchise) return [];
    const playerIds = [...new Set(DRAFT_SLOTS.flatMap((slot) => {
      const player = lineup[slot];
      return player?.franchise === draftedFranchise ? [player.id] : [];
    }))].sort();
    return playerIds.length ? [{ franchises: [first, second] as [string, string], playerIds }] : [];
  }).sort((first, second) => first.franchises.join(':').localeCompare(second.franchises.join(':')));
  return { version: RIVALRY_VERSION, matches };
}

export function annotateRivalries<Game extends { opponent: { franchise: string } }>(games: readonly Game[], lineup: TeamLineup): Game[] {
  return games.map((game) => ({ ...game, rivalry: rivalryEvidence(lineup, game.opponent.franchise) }));
}