import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  availablePlayers,
  availableSlots,
  createDraft,
  draftPlayer,
  DRAFT_SLOTS,
  playerIdentity,
  rerollDraft,
  rollOptions,
  selectCoach,
  spinDraft,
} from './draft.ts';
import type { Coach, Player, TeamLineup } from './types.ts';
import { requireCompleteLineup } from './season.ts';

const players = JSON.parse(
  readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8'),
) as Player[];
const coaches = JSON.parse(
  readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8'),
) as Coach[];
const first = () => 0;
function begin() {
  const draft = createDraft(coaches, first);
  return selectCoach(draft, draft.offers[0]!.id);
}

test('review roster catalog pins legal player versions and family reservations without evaluating performance', () => {
  interface Roster { id: string; group: string; tier: string; family: string; coach: string; players: string[] }
  interface Variant { id: string; parent: string; replace: Record<string, string>; coach?: string }
  const catalog: {
    sourceSha256: Record<string, string>; slotOrder: string[];
    targets: Record<string, { expectedWins: number[] }>; families: Record<string, string>;
    rosters: Roster[]; variants: Variant[];
  } = JSON.parse(readFileSync(new URL('../../data/reference/mid-iq-roster-benchmarks.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(catalog.sourceSha256)) {
    const bytes = readFileSync(new URL(`../../data/processed/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `Review benchmark versions before updating ${file}`);
  }
  assert.deepEqual(catalog.slotOrder, DRAFT_SLOTS);
  assert.equal(catalog.rosters.length, 24);
  assert.equal(new Set(catalog.rosters.map((roster) => roster.id)).size, 24);
  assert.equal(new Set([...catalog.rosters, ...catalog.variants].map((row) => row.id)).size, 32);
  for (const [group, count] of [['contender', 15], ['exceptional', 7], ['flawed', 2]] as const)
    assert.equal(catalog.rosters.filter((roster) => roster.group === group).length, count);
  const approvedBands = [
    { ids: ['C01', 'F02', 'F03'], wins: [59, 63] },
    { ids: ['C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'F01'], wins: [64, 68] },
    { ids: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'F06'], wins: [69, 74] },
    { ids: ['F04'], wins: [30, 40] },
    { ids: ['F05'], wins: [35, 44] },
  ];
  for (const { ids, wins } of approvedBands) {
    for (const id of ids) {
      const roster = catalog.rosters.find((row) => row.id === id);
      assert.ok(roster, id);
      assert.deepEqual(catalog.targets[roster.tier]!.expectedWins, wins, id);
    }
  }
  const lineupFor = (roster: Roster): TeamLineup => ({
    ...Object.fromEntries(DRAFT_SLOTS.map((slot, index) => [slot, players.find((player) => player.id === roster.players[index])])),
    coach: coaches.find((coach) => coach.id === roster.coach),
  }) as TeamLineup;
  for (const roster of catalog.rosters) {
    const target = catalog.targets[roster.tier];
    assert.ok(target, roster.id);
    assert.equal(target.expectedWins.length, 2);
    assert.ok(target.expectedWins[0]! <= target.expectedWins[1]!);
    assert.ok(['development', 'validation'].includes(catalog.families[roster.family]!), roster.id);
    assert.equal(roster.players.length, 6);
    assert.doesNotThrow(() => requireCompleteLineup(lineupFor(roster)), roster.id);
  }
  assert.equal(catalog.rosters.filter((roster) => catalog.families[roster.family] === 'validation').length, 9);
  assert.equal(catalog.variants.length, 8);
  for (const variant of catalog.variants) {
    const parent = catalog.rosters.find((roster) => roster.id === variant.parent);
    assert.ok(parent, variant.id);
    const lineup = lineupFor(parent);
    for (const [slot, id] of Object.entries(variant.replace)) {
      assert.ok(DRAFT_SLOTS.includes(slot as typeof DRAFT_SLOTS[number]), variant.id);
      lineup[slot as typeof DRAFT_SLOTS[number]] = players.find((player) => player.id === id)!;
    }
    if (variant.coach) lineup.coach = coaches.find((coach) => coach.id === variant.coach)!;
    assert.doesNotThrow(() => requireCompleteLineup(lineup), variant.id);
  }
});

test('coach offers contain three unique choices and only one may be selected', () => {
  const draft = createDraft(coaches, first);
  assert.equal(new Set(draft.offers.map((coach) => coach.id)).size, 3);
  assert.throws(() => selectCoach(draft, 'not-offered'));
  assert.throws(() => spinDraft(draft, players, first));
  const chosen = selectCoach(draft, draft.offers[0]!.id);
  assert.throws(() => selectCoach(chosen, draft.offers[1]!.id));
  assert.equal(draft.lineup.coach, null);
});

test('current roll cannot be passed, and rerolls preserve the other reel', () => {
  const draft = spinDraft(begin(), players, first);
  const original = structuredClone(draft);
  assert.throws(() => spinDraft(draft, players, first));
  const team = rerollDraft(draft, players, 'team', first);
  assert.equal(team.roll!.decade, draft.roll!.decade);
  assert.notEqual(team.roll!.franchise, draft.roll!.franchise);
  assert.equal(team.rerolls.team, 0);
  assert.throws(() => rerollDraft(team, players, 'team', first));
  const era = rerollDraft(team, players, 'era', first);
  assert.equal(era.roll!.franchise, team.roll!.franchise);
  assert.notEqual(era.roll!.decade, team.roll!.decade);
  assert.equal(era.rerolls.era, 0);
  assert.throws(() => rerollDraft(era, players, 'era', first));
  assert.deepEqual(draft, original);
});

test('eligibility, occupied slots, off-roll picks and cross-era duplicates are enforced', () => {
  const draft = spinDraft(begin(), players, first);
  const player = availablePlayers(draft, players)[0]!;
  assert.throws(() => draftPlayer(draft, players, 'not-in-pool', 'SIXTH'));
  const ineligible = DRAFT_SLOTS.find(
    (slot) => !availableSlots(draft.lineup, player).includes(slot),
  );
  if (ineligible) assert.throws(() => draftPlayer(draft, players, player.id, ineligible));
  const picked = draftPlayer(draft, players, player.id, 'SIXTH');
  const spun = spinDraft(picked, players, first);
  assert.ok(
    availablePlayers(spun, players).every(
      (candidate) => playerIdentity(candidate) !== playerIdentity(player),
    ),
  );
  assert.throws(() => draftPlayer(spun, players, availablePlayers(spun, players)[0]!.id, 'SIXTH'));
  for (const duplicate of players.filter(
    (candidate) => playerIdentity(candidate) === playerIdentity(player),
  )) {
    const forced = {
      ...picked,
      roll: { franchise: duplicate.franchise, decade: duplicate.decade },
    };
    assert.ok(
      !availablePlayers(forced, players).some((candidate) => candidate.id === duplicate.id),
    );
  }
});

test('same team and era can recur after a pick and candidates are rating-sorted', () => {
  const draft = spinDraft(begin(), players, first);
  const candidates = availablePlayers(draft, players);
  assert.ok(
    candidates.every(
      (player, index) =>
        index === 0 || candidates[index - 1]!.overallRating >= player.overallRating,
    ),
  );
  const picked = draftPlayer(draft, players, candidates[0]!.id, 'SIXTH');
  assert.ok(
    rollOptions(picked, players).some(
      (roll) => roll.franchise === draft.roll!.franchise && roll.decade === draft.roll!.decade,
    ),
  );
});

test('unavailable rerolls do not consume a token', () => {
  const draft = spinDraft(begin(), players, first);
  const local = players.filter(
    (player) => player.franchise === draft.roll!.franchise && player.decade === draft.roll!.decade,
  );
  assert.deepEqual(rollOptions(draft, local, 'team'), []);
  assert.throws(() => rerollDraft(draft, local, 'team', first));
  assert.equal(draft.rerolls.team, 1);
});

test('100 deterministic runs finish with six distinct players, including bench-first drafts', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let value = seed;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    let draft = begin();
    for (let round = 0; round < 6; round++) {
      draft = spinDraft(draft, players, random);
      const candidates = availablePlayers(draft, players).filter(
        (player) => availableSlots(draft.lineup, player).length,
      );
      assert.ok(candidates.length > 0);
      const player = candidates[Math.floor(random() * candidates.length)]!;
      const slots = availableSlots(draft.lineup, player);
      draft = draftPlayer(draft, players, player.id, round === 0 ? 'SIXTH' : slots[0]!);
    }
    assert.equal(draft.phase, 'COMPLETE');
    assert.equal(new Set(DRAFT_SLOTS.map((slot) => playerIdentity(draft.lineup[slot]!))).size, 6);
    assert.throws(() => spinDraft(draft, players, random));
    assert.throws(() => rerollDraft(draft, players, 'era', random));
  }
});
