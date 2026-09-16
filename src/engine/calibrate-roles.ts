import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { evaluateRoleAllocation } from './role-allocation.ts';
import type { LineupOffenseInput } from './lineup-prototype.ts';

const load = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const fingerprint = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
const output = process.argv[2];
assert.ok(output, 'A new output path is required.');
assert.ok(!existsSync(output), 'Refusing to overwrite an existing role allocation study.');
const lineup = load('docs/MID_IQ_LINEUP_PROTOTYPE_1.json');
const roleStudy = load('docs/MID_IQ_ROLE_CHANGE_STUDY_1.json');
assert.equal(lineup.version, 'mid-iq-lineup-prototype-1');
assert.equal(roleStudy.version, 'mid-iq-role-change-study-1');
const sourceSha256: Record<string, string> = { ...lineup.sourceSha256,
  'docs/MID_IQ_LINEUP_PROTOTYPE_1.json': fingerprint('docs/MID_IQ_LINEUP_PROTOTYPE_1.json'),
  'src/engine/lineup-prototype.ts': lineup.implementationSha256,
  'src/engine/calibrate-lineups.ts': lineup.evaluatorSha256,
  'docs/MID_IQ_ROLE_CHANGE_STUDY_1.json': fingerprint('docs/MID_IQ_ROLE_CHANGE_STUDY_1.json'),
  'scripts/data_pipeline/audit_role_changes.py': roleStudy.implementationSha256 };
for (const [path, hash] of Object.entries(roleStudy.sourceSha256)) {
  if (sourceSha256[path]) assert.equal(sourceSha256[path], hash);
  sourceSha256[path] = hash as string;
}
for (const [path, hash] of Object.entries(sourceSha256)) assert.equal(fingerprint(path), hash, `Stale role allocation source: ${path}`);
const era = load('docs/MID_IQ_ERA_BASELINE_AUDIT_1.json');
const baseline: { shotPointsPerEnd: number; turnoverShare: number } = era.seasons.find((row: { season: number }) => row.season === 2020);
assert.ok(baseline);
const byId = new Map<string, LineupOffenseInput & { ready: boolean }>(lineup.players.map((player: LineupOffenseInput & { ready: boolean }) => [player.id, player]));
const protocol = {
  referenceSeason: 2020,
  turnoverSplits: [{ id: 'shot-only', shot: 1, passing: 0 }, { id: 'half-fixed', shot: 0.5, passing: 0 },
    { id: 'split-roles', shot: 0.5, passing: 0.5 }, { id: 'mixed-fixed', shot: 0.25, passing: 0.5 }],
  capacityPairs: [{ id: 'uncapped', shots: null, passing: null }, { id: 'shot-1.25', shots: 1.25, passing: null },
    { id: 'passing-1.25', shots: null, passing: 1.25 }, { id: 'both-1.25', shots: 1.25, passing: 1.25 },
    { id: 'both-1.5', shots: 1.5, passing: 1.5 }],
  allocations: ['observed', 'lead-passer-half', 'equal-shots'],
  passingBudget: '100 responsibility units separate from the 100 shot-plus-turnover event budget. Observed nominal passing =20*assistRateRatio; no unit is a made assist, pass count, shot or bonus point.',
  leadRole: 'Largest assistRateRatio receives 0.5 passing share, remaining 0.5 proportional to other assist ratios. Lexical ID breaks ties; this can reduce a naturally dominant share. Not an optimizer.',
  turnoverSplit: 'TOV_i = observedTOV_i*(fixedFraction + shotFraction*shotMultiplier + passingFraction*passingMultiplier). fixedFraction=1-shotFraction-passingFraction. No measured slope is imported.',
  sequence: 'Allocate passing responsibility first; subtract passing-linked and fixed turnovers, then allocate shots including their marginal turnover costs.',
  shortfall: 'Report both unallocated event and passing budgets. Either shortfall makes output incomplete, even if points increase when unfilled passing reduces estimated turnover costs.',
  unsupported: 'Retain all earlier missing-data rosters. Zero assist exposure with positive passing-linked turnover cost is unsupported, not imputed. No forecasted or alternate peaks.',
  scope: 'Fixed reference and design grid, not new empirical validation, policy selection, assist creation or win-band fitting.',
};
interface SourceRoster { id: string; parent: string | null; status: string; playerIds?: string[]; coachId?: string; unsupportedIds?: string[] }
const rows = (lineup.rows as SourceRoster[]).map((row) => {
  if (row.status === 'unsupported-data') return { id: row.id, parent: row.parent, status: row.status, unsupportedIds: row.unsupportedIds };
  assert.equal(row.status, 'allocation-only');
  assert.ok(row.playerIds && row.playerIds.length === 6);
  for (const id of row.playerIds) assert.ok(byId.get(id)?.ready);
  const inputs = row.playerIds.slice(0, 5).map((id) => byId.get(id)!);
  const ordered = [...inputs].sort((first, second) => second.assistRateRatio! - first.assistRateRatio!
    || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
  const lead = ordered[0]!;
  const otherDemand = ordered.slice(1).reduce((sum, player) => sum + player.assistRateRatio!, 0);
  const leadShares = inputs.map((player) => player.id === lead.id ? 0.5 : otherDemand > 0 ? 0.5 * player.assistRateRatio! / otherDemand : 0);
  const scenarios = protocol.turnoverSplits.flatMap((split) => protocol.capacityPairs.flatMap((caps) => protocol.allocations.map((allocation) => {
    const key = { turnoverSplit: split.id, capacityPair: caps.id, allocation };
    const unsupportedIds = inputs.filter((player) => player.assistRateRatio === 0 && split.passing * player.turnoverRateRatio! > 0).map((player) => player.id);
    if (unsupportedIds.length) return { ...key, status: 'unsupported-passing-exposure', unsupportedIds };
    if (allocation === 'lead-passer-half' && (lead.assistRateRatio! <= 0 || otherDemand <= 0))
      return { ...key, status: 'unsupported-lead-distribution', unsupportedIds: inputs.filter((player) => player.assistRateRatio === 0).map((player) => player.id) };
    const shares = allocation === 'lead-passer-half' ? { passing: leadShares }
      : allocation === 'equal-shots' ? { shots: [0.2, 0.2, 0.2, 0.2, 0.2] } : {};
    const result = evaluateRoleAllocation(inputs, { referenceShotPointsPerEnd: baseline.shotPointsPerEnd,
      referenceTurnoverShare: baseline.turnoverShare, shotTurnoverFraction: split.shot, passingTurnoverFraction: split.passing,
      shotCapacityMultiplier: caps.shots, passingCapacityMultiplier: caps.passing }, shares);
    return { ...key, status: 'evaluated', result };
  })));
  return { id: row.id, parent: row.parent, status: 'role-allocation-only', playerIds: row.playerIds, coachId: row.coachId,
    leadPasserId: lead.id, scenarios };
});
for (const [path, hash] of Object.entries(sourceSha256)) assert.equal(fingerprint(path), hash, `Source changed during role allocation: ${path}`);
const report = { version: 'mid-iq-role-allocation-1', scope: 'exposed-dual-role-allocation-sensitivity', protocol, sourceSha256,
  implementationSha256: fingerprint('src/engine/role-allocation.ts'), evaluatorSha256: fingerprint('src/engine/calibrate-roles.ts'),
  supportedRosters: rows.filter((row) => row.status === 'role-allocation-only').length,
  evaluatedScenarios: rows.reduce((sum, row) => sum + (row.scenarios?.filter((scenario) => scenario.status === 'evaluated').length ?? 0), 0), rows,
  limitations: ['Design bookkeeping, not ORTG, wins, forecasted assists or validated full-lineup strength. Fractions, reference year and capacities are not chosen from outcomes.',
    'Passing responsibility is an assist-based proxy, not actual passing attempts or completed assists. Its fixed target is not linked to shot outcomes or teammate conversion.',
    'Passing is allocated first and budgets are not jointly optimized. Shortfalls remain unresolved; reduced estimated turnovers from missing passing are not a team-strength reward.',
    'A higher assist ratio changes inferred role and cost per role unit, not an independently identified passing or ball-security skill. Shot and pass components partition turnovers only; no extra points are created.',
    'No causal load-efficiency response, creation benefit, spacing, rebounds, defense, coach, reserve, fatigue or historical missing-data imputation. Zero-exposure linked rates are not extrapolated.',
    'All original roster families are exposed development evidence. The limited 2020-reference grid is not a robustness guarantee across eras or an independent validation.'],
};
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(`Retained ${report.supportedRosters}/${rows.length} rosters; ${report.evaluatedScenarios} evaluated scenarios.`);
for (const row of rows) {
  if (!row.scenarios) continue;
  const resultFor = (allocation: string) => {
    const scenario = row.scenarios!.find((entry) => entry.turnoverSplit === 'split-roles'
      && entry.capacityPair === 'uncapped' && entry.allocation === allocation);
    return scenario && 'result' in scenario ? scenario.result : undefined;
  };
  const observed = resultFor('observed');
  const lead = resultFor('lead-passer-half');
  console.log(JSON.stringify({ id: row.id, lead: row.leadPasserId, observedPoints: observed?.pointsOnAllocatedEvents,
    leadPoints: lead?.pointsOnAllocatedEvents, observedTurnovers: observed?.turnoverEnds, leadTurnovers: lead?.turnoverEnds,
    passingExpansion: observed ? Math.max(...observed.players.map((player) => player.passingWorkloadMultiplier ?? 0)) : null }));
}