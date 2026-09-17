import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { annotateRivalries, rivalryEvidence } from './rivalry.ts';
import { simulateSeason } from './season.ts';
import type { Coach, OpponentPool, Player, TeamLineup } from './types.ts';

const players: Player[] = JSON.parse(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8'));
const coaches: Coach[] = JSON.parse(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8'));
const pool: OpponentPool = JSON.parse(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool;
const empty: TeamLineup = { PG: null, SG: null, SF: null, PF: null, C: null, SIXTH: null, coach: null };
const playerFor = (franchise: string) => players.find((player) => player.franchise === franchise)!;

test('approved rivalries match symmetrically, include bench and retain stable deduplicated evidence', () => {
  for (const [drafted, opponent] of [['LAL', 'BOS'], ['BOS', 'LAL'], ['CHI', 'DET'], ['IND', 'NYK'], ['MIA', 'NYK'], ['PHI', 'BOS'], ['SAS', 'LAL']]) {
    const player = playerFor(drafted!);
    const evidence = rivalryEvidence({ ...empty, SIXTH: player }, opponent!);
    assert.equal(evidence.matches.length, 1);
    assert.deepEqual(evidence.matches[0]!.playerIds, [player.id]);
  }
  const first = playerFor('BOS');
  const second = players.find((player) => player.franchise === 'BOS' && player.id !== first.id)!;
  const lineup = { ...empty, PG: first, SG: second, SF: first, SIXTH: playerFor('SAS') };
  const evidence = rivalryEvidence(lineup, 'LAL');
  assert.equal(evidence.matches.length, 2);
  assert.deepEqual(evidence.matches[0]!.playerIds, [first.id, second.id].sort());
  assert.deepEqual(evidence, JSON.parse(JSON.stringify(evidence)));
  assert.equal(rivalryEvidence(lineup, 'ATL').matches.length, 0);
  assert.equal(rivalryEvidence({ ...empty, SIXTH: { ...first, franchise: 'ATL' } }, 'LAL').matches.length, 0);
});

test('annotations preserve all seeded game facts and do not mutate inputs', () => {
  const lineup = { ...empty, coach: coaches[0]! };
  const selected = new Set<string>();
  for (const slot of ['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH'] as const) {
    const player = players.find((candidate) => !selected.has(candidate.id.split('_')[0]!)
      && (slot === 'SIXTH' || candidate.eligiblePositions.includes(slot)))!;
    lineup[slot] = player;
    selected.add(player.id.split('_')[0]!);
  }
  const season = simulateSeason(lineup, pool, 'rivalry-invariance');
  const before = JSON.stringify(season);
  const annotated = annotateRivalries(season.gameLog, lineup);
  assert.deepEqual(annotated.map(({ rivalry, ...game }) => game), season.gameLog);
  assert.equal(JSON.stringify(season), before);
  assert.deepEqual(simulateSeason(lineup, pool, 'rivalry-invariance'), season);
  assert.deepEqual(annotateRivalries(annotated, lineup), annotated);
});