import { STARTER_POSITIONS } from './math.ts';
import type { Coach, EraDecade, Player, TeamLineup } from './types.ts';

export const DRAFT_SLOTS = [...STARTER_POSITIONS, 'SIXTH'] as const;
export type DraftSlot = (typeof DRAFT_SLOTS)[number];
export type RerollKind = 'team' | 'era';
export interface DraftRoll {
  franchise: string;
  decade: EraDecade;
}
export interface DraftState {
  phase: 'COACH' | 'DRAFT' | 'COMPLETE';
  offers: Coach[];
  lineup: TeamLineup;
  roll: DraftRoll | null;
  rerolls: Record<RerollKind, number>;
}

function pickRandom<Value>(values: readonly Value[], random: () => number): Value {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Random value must be in [0, 1).');
  const selected = values[Math.floor(value * values.length)];
  if (selected === undefined) throw new Error('No playable options remain.');
  return selected;
}

export function playerIdentity(player: Player): string {
  return player.id.split('_')[0]!;
}

export function createDraft(coaches: readonly Coach[], random = Math.random): DraftState {
  const remaining = [...new Map(coaches.map((coach) => [coach.id, coach])).values()];
  if (remaining.length < 3) throw new Error('At least three unique coaches are required.');
  const offers: Coach[] = [];
  while (offers.length < 3) {
    const coach = pickRandom(remaining, random);
    offers.push(coach);
    remaining.splice(remaining.indexOf(coach), 1);
  }
  return {
    phase: 'COACH',
    offers,
    roll: null,
    rerolls: { team: 1, era: 1 },
    lineup: { PG: null, SG: null, SF: null, PF: null, C: null, SIXTH: null, coach: null },
  };
}

export function selectCoach(state: DraftState, coachId: string): DraftState {
  const coach = state.offers.find((offer) => offer.id === coachId);
  if (state.phase !== 'COACH' || !coach) throw new Error('Select one of the offered coaches.');
  return { ...state, phase: 'DRAFT', lineup: { ...state.lineup, coach } };
}

export function availableSlots(lineup: TeamLineup, player: Player): DraftSlot[] {
  return DRAFT_SLOTS.filter(
    (slot) => !lineup[slot] && (slot === 'SIXTH' || player.eligiblePositions.includes(slot)),
  );
}

function undraftedPlayers(state: DraftState, players: readonly Player[]): Player[] {
  const drafted = new Set(
    DRAFT_SLOTS.flatMap((slot) => {
      const player = state.lineup[slot];
      return player ? [playerIdentity(player)] : [];
    }),
  );
  return players.filter((player) => !drafted.has(playerIdentity(player)));
}

export function availablePlayers(state: DraftState, players: readonly Player[]): Player[] {
  if (!state.roll || state.phase !== 'DRAFT') return [];
  return undraftedPlayers(state, players)
    .filter(
      (player) =>
        player.franchise === state.roll!.franchise && player.decade === state.roll!.decade,
    )
    .sort(
      (first, second) =>
        second.overallRating - first.overallRating || first.name.localeCompare(second.name),
    );
}

export function rollOptions(
  state: DraftState,
  players: readonly Player[],
  kind?: RerollKind,
): DraftRoll[] {
  if (state.phase !== 'DRAFT') return [];
  if (kind && (!state.roll || state.rerolls[kind] === 0)) return [];
  const rolls = new Map<string, DraftRoll>();
  for (const player of undraftedPlayers(state, players)) {
    if (availableSlots(state.lineup, player).length === 0) continue;
    if (
      kind === 'team' &&
      (player.decade !== state.roll!.decade || player.franchise === state.roll!.franchise)
    )
      continue;
    if (
      kind === 'era' &&
      (player.franchise !== state.roll!.franchise || player.decade === state.roll!.decade)
    )
      continue;
    rolls.set(`${player.franchise}_${player.decade}`, {
      franchise: player.franchise,
      decade: player.decade,
    });
  }
  return [...rolls.values()];
}

export function spinDraft(
  state: DraftState,
  players: readonly Player[],
  random = Math.random,
): DraftState {
  if (state.phase !== 'DRAFT' || state.roll)
    throw new Error('Draft the current roll before spinning again.');
  return { ...state, roll: pickRandom(rollOptions(state, players), random) };
}

export function rerollDraft(
  state: DraftState,
  players: readonly Player[],
  kind: RerollKind,
  random = Math.random,
): DraftState {
  const roll = pickRandom(rollOptions(state, players, kind), random);
  return { ...state, roll, rerolls: { ...state.rerolls, [kind]: state.rerolls[kind] - 1 } };
}

export function draftPlayer(
  state: DraftState,
  players: readonly Player[],
  playerId: string,
  slot: DraftSlot,
): DraftState {
  const player = availablePlayers(state, players).find((candidate) => candidate.id === playerId);
  if (!player || !availableSlots(state.lineup, player).includes(slot))
    throw new Error('This player cannot fill that slot.');
  const lineup = { ...state.lineup, [slot]: player };
  return {
    ...state,
    lineup,
    roll: null,
    phase: DRAFT_SLOTS.every((position) => lineup[position]) ? 'COMPLETE' : 'DRAFT',
  };
}
