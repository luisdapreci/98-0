import {
  availablePlayers, availableSlots, DRAFT_SLOTS, draftPlayer, rerollDraft,
  rollOptions, selectCoach, spinDraft,
} from './draft.ts';
import type { DraftSlot, DraftState } from './draft.ts';
import { BALANCE_RULES_V1, calculateSynergy, calculateUsageModifier, calculateWinProbability, evaluateGame } from './math.ts';
import type { BalanceRules } from './math.ts';
import { randomStream } from './random.ts';
import type { DraftAction } from './run.ts';
import { requireCompleteLineup, SCHEDULE_COUNTS } from './season.ts';
import type { OpponentPool, OpponentTier, Player, TeamLineup } from './types.ts';

export const LOOKAHEAD_RULES = {
  version: 'legal-rollout-1',
  samples: 12,
  shortlist: 6,
} as const;

export function projectedChemistry(lineup: TeamLineup, rules: BalanceRules = BALANCE_RULES_V1): number {
  const synergy = calculateSynergy(lineup, rules);
  const missing = DRAFT_SLOTS.slice(0, 5).filter((slot) => !lineup[slot]).length;
  const usage = synergy.usgTeam + missing * 20 + (lineup.SIXTH ? 0 : 8);
  const cap = lineup.coach?.modifiers.filter((modifier) => modifier.stat === 'usgCap')
    .reduce((sum, modifier) => sum + modifier.delta, 0) ?? 0;
  return synergy.ortgTeam * calculateUsageModifier(usage, cap) * (1 + synergy.spacingModifier)
    - synergy.drtgTeam + synergy.depthBonus;
}

export function expectedSeasonWins(lineup: TeamLineup, pool: OpponentPool, rules: BalanceRules = BALANCE_RULES_V1): number {
  requireCompleteLineup(lineup);
  const contexts = [false, true].flatMap((isHome) => [false, true].map((isBackToBack) => ({
    delta: evaluateGame(lineup, { opponentNetRating: 0, isHome, isBackToBack }, rules).deltaRating,
    weight: 0.5 * (isBackToBack ? 14 / 82 : 68 / 82),
  })));
  let expected = 0;
  for (const [tier, count] of Object.entries(SCHEDULE_COUNTS) as [OpponentTier, number][]) {
    if (!pool[tier].length) throw new Error(`Empty ${tier} pool.`);
    for (const opponent of pool[tier]) {
      for (const { delta, weight } of contexts) {
        expected += count / pool[tier].length * weight * calculateWinProbability(delta - opponent.netRating);
      }
    }
  }
  return expected;
}

interface PickChoice {
  action: Extract<DraftAction, { type: 'PICK' }>;
  value: number;
}

function picks(draft: DraftState, players: readonly Player[], rules: BalanceRules): PickChoice[] {
  return availablePlayers(draft, players).flatMap((player) =>
    availableSlots(draft.lineup, player).map((slot) => ({
      action: { type: 'PICK' as const, id: player.id, slot },
      value: projectedChemistry({ ...draft.lineup, [slot]: player }, rules),
    }))).sort((first, second) => second.value - first.value
      || first.action.id.localeCompare(second.action.id)
      || DRAFT_SLOTS.indexOf(first.action.slot) - DRAFT_SLOTS.indexOf(second.action.slot));
}

function apply(draft: DraftState, action: DraftAction, players: readonly Player[], random: () => number): DraftState {
  switch (action.type) {
    case 'COACH': return selectCoach(draft, action.id);
    case 'SPIN': return spinDraft(draft, players, random);
    case 'REROLL': return rerollDraft(draft, players, action.kind, random);
    case 'PICK': return draftPlayer(draft, players, action.id, action.slot);
  }
}

function completeHypothetical(draft: DraftState, players: readonly Player[], random: () => number, rules: BalanceRules): TeamLineup {
  while (draft.phase !== 'COMPLETE') {
    if (!draft.roll) draft = spinDraft(draft, players, random);
    let choices = picks(draft, players, rules);
    for (const kind of ['team', 'era'] as const) {
      if (choices[0]!.value - projectedChemistry(draft.lineup, rules) < 3
        && rollOptions(draft, players, kind).length) {
        draft = rerollDraft(draft, players, kind, random);
        choices = picks(draft, players, rules);
      }
    }
    draft = apply(draft, choices[0]!.action, players, random);
  }
  return draft.lineup;
}

export function chooseLookaheadAction(draft: DraftState, players: readonly Player[], pool: OpponentPool, rules: BalanceRules = BALANCE_RULES_V1): DraftAction {
  if (draft.phase === 'COMPLETE') throw new Error('Draft is already complete.');
  if (draft.phase === 'DRAFT' && !draft.roll) return { type: 'SPIN' };
  const actions: DraftAction[] = [];
  if (draft.phase === 'COACH') {
    actions.push(...draft.offers.map((coach) => ({ type: 'COACH' as const, id: coach.id })));
  } else {
    const choices = picks(draft, players, rules);
    const shortlisted = choices.slice(0, LOOKAHEAD_RULES.shortlist);
    for (const slot of DRAFT_SLOTS) {
      const candidate = choices.find((choice) => choice.action.slot === slot);
      if (candidate && !shortlisted.includes(candidate)) shortlisted.push(candidate);
    }
    actions.push(...shortlisted.map((choice) => choice.action));
    for (const kind of ['team', 'era'] as const)
      if (rollOptions(draft, players, kind).length) actions.push({ type: 'REROLL', kind });
  }
  const visible = JSON.stringify({
    offers: draft.offers.map((coach) => coach.id), coach: draft.lineup.coach?.id,
    picks: DRAFT_SLOTS.map((slot) => draft.lineup[slot]?.id ?? null),
    roll: draft.roll, rerolls: draft.rerolls,
  });
  let bestAction = actions[0];
  let bestValue = -Infinity;
  const cache = new Map<string, number>();
  for (const action of actions) {
    let total = 0;
    for (let sample = 0; sample < LOOKAHEAD_RULES.samples; sample++) {
      const random = randomStream(LOOKAHEAD_RULES.version, `${visible}/${sample}`).next;
      const next = apply(draft, action, players, random);
      const lineup = completeHypothetical(next, players, random, rules);
      const key = JSON.stringify([lineup.coach!.id, ...DRAFT_SLOTS.map((slot: DraftSlot) => lineup[slot]!.id)]);
      let value = cache.get(key);
      if (value === undefined) {
        value = expectedSeasonWins(lineup, pool, rules);
        cache.set(key, value);
      }
      total += value;
      if (next.phase === 'COMPLETE') {
        total = value * LOOKAHEAD_RULES.samples;
        break;
      }
    }
    if (total > bestValue) {
      bestValue = total;
      bestAction = action;
    }
  }
  if (!bestAction) throw new Error('No legal strategy action.');
  return bestAction;
}