import {
  availableSlots, createDraft, draftPlayer, DRAFT_SLOTS, playerIdentity,
  rerollDraft, rollOptions, selectCoach, spinDraft,
} from './draft.ts';
import type { DraftSlot, DraftState, RerollKind } from './draft.ts';
import { BALANCE_RULES_V1, BALANCE_RULES_V2, evaluateGame } from './math.ts';
import type { BalanceRules } from './math.ts';
import { createRandom, DATA_VERSION, ENGINE_VERSION, randomStream, RANDOM_VERSION } from './random.ts';
import { aggregateSeason, generateSchedule, requireCompleteLineup, SCORE_RULES, SCORE_RULES_V1, SCORE_RULES_V3, simulateSeason } from './season.ts';
import type { ScoreRules } from './season.ts';
import type { Coach, OpponentPool, Player, SeasonResult, TeamLineup } from './types.ts';
import { lineupForUsagePolicy, STAR_USAGE_ENGINE_VERSION } from './usage-policy.ts';
import { HISTORICAL_ENTRY_ENGINE_VERSION, seasonForQualification } from './postseason-policy.ts';

export type DraftAction =
  | { type: 'COACH'; id: string }
  | { type: 'SPIN' }
  | { type: 'REROLL'; kind: RerollKind }
  | { type: 'PICK'; id: string; slot: DraftSlot };

export interface RunSave {
  schemaVersion: 1;
  id: string;
  seed: string;
  engineVersion: string;
  dataVersion: string;
  randomVersion: string;
  scoreVersion: string;
  phase: 'DRAFTING' | 'DRAFT_READY' | 'SEASON_RUNNING' | 'SEASON_COMPLETE';
  draft: DraftState;
  draftRandomState: number;
  legacyDraft: DraftState | null;
  actions: DraftAction[];
  frozenLineup: TeamLineup | null;
  season: SeasonResult | null;
}

export interface RunData {
  players: readonly Player[];
  coaches: readonly Coach[];
  opponents: OpponentPool;
}

function rulesForRun(run: RunSave): ScoreRules {
  if (run.engineVersion === 'season-1' && run.scoreVersion === SCORE_RULES_V1.version) return SCORE_RULES_V1;
  if (['season-2', 'season-3', STAR_USAGE_ENGINE_VERSION, HISTORICAL_ENTRY_ENGINE_VERSION].includes(run.engineVersion) && run.scoreVersion === SCORE_RULES_V3.version) return SCORE_RULES_V3;
  throw new Error('Unsupported engine/score version pair.');
}

export function balanceForRun(run: RunSave): BalanceRules {
  rulesForRun(run);
  return ['season-3', STAR_USAGE_ENGINE_VERSION, HISTORICAL_ENTRY_ENGINE_VERSION].includes(run.engineVersion) ? BALANCE_RULES_V2 : BALANCE_RULES_V1;
}

export function createRun(seed: string, coaches: readonly Coach[], legacyDraft: DraftState | null = null): RunSave {
  if (!seed || seed.length > 200) throw new Error('A run seed is required.');
  const random = randomStream(seed, 'draft');
  const draft = legacyDraft ? structuredClone(legacyDraft) : createDraft(coaches, random.next);
  return {
    schemaVersion: 1, id: seed, seed,
    engineVersion: legacyDraft ? ENGINE_VERSION : HISTORICAL_ENTRY_ENGINE_VERSION, dataVersion: DATA_VERSION, randomVersion: RANDOM_VERSION,
    scoreVersion: SCORE_RULES.version,
    phase: draft.phase === 'COMPLETE' ? 'DRAFT_READY' : 'DRAFTING',
    draft, draftRandomState: random.state(), legacyDraft: legacyDraft ? structuredClone(legacyDraft) : null,
    actions: [], frozenLineup: null, season: null,
  };
}

export function applyDraftAction(run: RunSave, action: DraftAction, players: readonly Player[]): RunSave {
  if (run.phase !== 'DRAFTING') return run;
  const random = createRandom(run.draftRandomState);
  let draft: DraftState;
  switch (action.type) {
    case 'COACH': draft = selectCoach(run.draft, action.id); break;
    case 'SPIN': draft = spinDraft(run.draft, players, random.next); break;
    case 'REROLL':
      if (!['team', 'era'].includes(action.kind)) throw new Error('Invalid reroll.');
      if (!rollOptions(run.draft, players, action.kind).length) return run;
      draft = rerollDraft(run.draft, players, action.kind, random.next); break;
    case 'PICK': draft = draftPlayer(run.draft, players, action.id, action.slot); break;
    default: throw new Error('Invalid draft action.');
  }
  return {
    ...run, draft, draftRandomState: random.state(), actions: [...run.actions, action],
    phase: draft.phase === 'COMPLETE' ? 'DRAFT_READY' : 'DRAFTING',
  };
}

export function startSeason(run: RunSave): RunSave {
  if (run.phase !== 'DRAFT_READY') return run;
  requireCompleteLineup(run.draft.lineup);
  return { ...run, phase: 'SEASON_RUNNING', frozenLineup: structuredClone(run.draft.lineup) };
}

export function finishSeason(run: RunSave, pool: OpponentPool): RunSave {
  if (run.phase !== 'SEASON_RUNNING' || !run.frozenLineup) return run;
  const season = simulateSeason(lineupForUsagePolicy(run.frozenLineup, run.engineVersion), pool, run.seed, rulesForRun(run), balanceForRun(run));
  return { ...run, phase: 'SEASON_COMPLETE', season: seasonForQualification(season, run.engineVersion) };
}

function equal(first: unknown, second: unknown): boolean {
  if (first === second) return true;
  if (typeof first !== 'object' || first === null || typeof second !== 'object' || second === null) return false;
  if (Array.isArray(first) !== Array.isArray(second)) return false;
  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const keys = Object.keys(firstRecord);
  return keys.length === Object.keys(secondRecord).length && keys.every((key) =>
    Object.hasOwn(secondRecord, key) && equal(firstRecord[key], secondRecord[key]));
}

function validateLegacyDraft(value: DraftState, data: RunData): DraftState {
  const draft = structuredClone(value);
  if (!['COACH', 'DRAFT', 'COMPLETE'].includes(draft.phase) || draft.offers.length !== 3
    || new Set(draft.offers.map((coach) => coach.id)).size !== 3) throw new Error('Invalid draft.');
  for (const coach of draft.offers)
    if (!equal(coach, data.coaches.find((candidate) => candidate.id === coach.id))) throw new Error('Unknown coach.');
  if (draft.lineup.coach !== null && !draft.offers.some((coach) => equal(coach, draft.lineup.coach)))
    throw new Error('Coach was not offered.');
  const identities = new Set<string>();
  for (const slot of DRAFT_SLOTS) {
    const player = draft.lineup[slot];
    if (player === null) continue;
    if (!equal(player, data.players.find((candidate) => candidate.id === player.id))
      || !availableSlots({ ...draft.lineup, [slot]: null }, player).includes(slot)
      || identities.has(playerIdentity(player))) throw new Error('Invalid saved pick.');
    identities.add(playerIdentity(player));
  }
  for (const kind of ['team', 'era'] as const)
    if (draft.rerolls[kind] !== 0 && draft.rerolls[kind] !== 1) throw new Error('Invalid reroll count.');
  if (draft.phase === 'COACH' && (identities.size || draft.lineup.coach || draft.roll
    || draft.rerolls.team !== 1 || draft.rerolls.era !== 1)) throw new Error('Invalid coach phase.');
  if (draft.phase !== 'COACH' && !draft.lineup.coach) throw new Error('Missing coach.');
  if ((draft.phase === 'COMPLETE') !== (identities.size === 6)) throw new Error('Invalid draft completion.');
  if (draft.roll !== null && (draft.phase !== 'DRAFT' || !rollOptions(draft, data.players).some((roll) => equal(roll, draft.roll))))
    throw new Error('Invalid saved roll.');
  return draft;
}

function validateSeason(season: SeasonResult, lineup: TeamLineup, pool: OpponentPool, seed: string, rules: ScoreRules, balance: BalanceRules, engineVersion: string): void {
  const schedule = generateSchedule(seed, pool);
  if (season.gameLog.length !== 82) throw new Error('Incomplete season.');
  for (const [index, game] of season.gameLog.entries()) {
    const entry = schedule[index]!;
    for (const key of Object.keys(entry) as (keyof typeof entry)[])
      if (!equal(game[key], entry[key])) throw new Error('Invalid schedule.');
    const context = { opponentNetRating: entry.opponent.netRating, isHome: entry.isHome, isBackToBack: entry.isBackToBack };
    if (!equal(game.context, context) || !equal(game.evaluation, evaluateGame(lineup, context, balance)))
      throw new Error('Invalid rating context.');
    for (const score of [game, game.regulation, ...game.overtime])
      for (const value of [score.userScore, score.oppScore])
        if (!Number.isSafeInteger(value) || value < 0 || value > 300) throw new Error('Invalid score.');
    if (game.userScore === game.oppScore || game.won !== (game.userScore > game.oppScore)
      || game.margin !== game.userScore - game.oppScore) throw new Error('Invalid winner.');
    if (game.overtime.length > rules.maxOvertimePeriods) throw new Error('Invalid overtime count.');
    if (game.overtime.length && (game.regulation.userScore !== game.regulation.oppScore
      || game.overtime.slice(0, -1).some((period) => period.userScore !== period.oppScore)))
      throw new Error('Invalid overtime ties.');
    for (const key of ['userScore', 'oppScore'] as const)
      if (game[key] !== game.regulation[key] + game.overtime.reduce((total, period) => total + period[key], 0))
        throw new Error('Invalid score sum.');
    const limit = game.overtime.length ? rules.overtimeMaxMargin : rules.maxMargin;
    if (Math.abs(game.margin) > limit) throw new Error('Invalid margin.');
    const events = [...(game.overtime.length ? ['OVERTIME'] : []), ...(Math.abs(game.margin) === 1 ? ['ONE_POINT_FINISH'] : [])];
    if (!equal(game.events, events)) throw new Error('Invalid events.');
  }
  if (!equal(season, seasonForQualification(aggregateSeason(season.gameLog), engineVersion))) throw new Error('Invalid season totals.');
}

export function recoverRun(value: unknown, data: RunData, legacySeed: string): { run: RunSave | null; notice: string | null } {
  if (value === undefined || value === null) return { run: null, notice: null };
  try {
    const saved = value as { draft?: DraftState; run?: RunSave };
    if (saved.draft && !saved.run) {
      const draft = validateLegacyDraft(saved.draft, data);
      return {
        run: createRun(legacySeed, data.coaches, draft),
        notice: 'Previous draft restored. Seeded replay begins from this saved draft.',
      };
    }
    const run = saved.run;
    if (!run || run.schemaVersion !== 1
      || run.dataVersion !== DATA_VERSION || run.randomVersion !== RANDOM_VERSION) throw new Error('Unsupported save version.');
    const rules = rulesForRun(run);
    const legacy = run.legacyDraft === null ? null : validateLegacyDraft(run.legacyDraft, data);
    let replay = { ...createRun(run.seed, data.coaches, legacy), engineVersion: run.engineVersion, scoreVersion: run.scoreVersion };
    if (!Array.isArray(run.actions) || run.actions.length > 15) throw new Error('Invalid action history.');
    for (const action of run.actions) {
      const next = applyDraftAction(replay, action, data.players);
      if (next === replay) throw new Error('Invalid action history.');
      replay = next;
    }
    if (run.phase === 'SEASON_RUNNING' || run.phase === 'SEASON_COMPLETE') replay = startSeason(replay);
    if (run.phase === 'SEASON_COMPLETE') {
      if (!run.season || !replay.frozenLineup) throw new Error('Missing season result.');
      validateSeason(run.season, lineupForUsagePolicy(replay.frozenLineup, run.engineVersion), data.opponents, run.seed, rules, balanceForRun(run), run.engineVersion);
      replay = { ...replay, phase: 'SEASON_COMPLETE', season: run.season };
    }
    if (!equal(run, replay)) throw new Error('Invalid run state.');
    return { run: structuredClone(run), notice: null };
  } catch {
    return { run: null, notice: 'Saved run is invalid or uses unsupported versions. A new draft has been opened.' };
  }
}