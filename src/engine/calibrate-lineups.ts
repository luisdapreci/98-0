import { parseResearchJson } from './research-files.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { evaluateLineupOffense } from './lineup-prototype.ts';
import type { LineupOffenseInput } from './lineup-prototype.ts';

const fingerprint = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const output = process.argv[2];
assert.ok(output, 'A new output path is required.');
assert.ok(!existsSync(output), 'Refusing to overwrite an existing lineup study.');
const audit = load('docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json');
const era = load('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json');
assert.equal(audit.version, 'mid-iq-possession-input-audit-1');
assert.equal(era.version, 'mid-iq-era-baseline-audit-1');
const sourceSha256: Record<string, string> = { ...era.sourceSha256,
  'docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json': fingerprint('docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json'),
  'scripts/data_pipeline/audit_era_baselines.py': era.implementationSha256,
  'scripts/data_pipeline/audit_possessions.py': audit.auditImplementationSha256,
};
for (const [path, hash] of Object.entries(audit.sourceSha256)) assert.equal(sourceSha256[path], hash);
for (const [path, hash] of Object.entries(sourceSha256)) assert.equal(fingerprint(path), hash, `Stale lineup source: ${path}`);
interface Season {
  season: number; shotPointsPerEnd: number; turnoverShare: number | null;
  totals: { minutes: number; turnovers: number | null };
}
interface Peak {
  id: string; peakYears: number[]; ready: boolean;
  selected: { season: number; games: number; stats: { minutes: number; turnovers: number | null } }[];
}
interface RelativePeak extends LineupOffenseInput { peakYears: number[] }
interface Roster { id: string; coach: string; players: string[]; parent?: string }
const baselines = new Map<number, Season>(era.seasons.map((row: Season) => [row.season, row]));
const contexts = new Map<string, RelativePeak>(era.players.map((row: RelativePeak) => [row.id, row]));
const stored: { id: string; peakYears: number[] }[] = load('data/processed/players.json');
const storedById = new Map(stored.map((player) => [player.id, player]));
const peaks: Peak[] = audit.players;
assert.deepEqual(peaks.map((row) => row.id).sort(), stored.map((row) => row.id).sort());
assert.deepEqual([...contexts.keys()].sort(), stored.map((row) => row.id).sort());
const players = peaks.map((peak) => {
  const context = contexts.get(peak.id)!;
  assert.deepEqual(peak.peakYears, storedById.get(peak.id)!.peakYears);
  assert.deepEqual(context.peakYears, peak.peakYears);
  let observed = 0, expected = 0;
  let ready = peak.ready;
  for (const row of peak.selected) {
    const baseline = baselines.get(row.season)!;
    if (row.stats.turnovers === null || baseline.totals.turnovers === null) ready = false;
    else {
      observed += row.games * row.stats.turnovers;
      expected += row.games * row.stats.minutes * baseline.totals.turnovers / baseline.totals.minutes;
    }
  }
  const turnoverRateRatio = ready && expected > 0 ? observed / expected : null;
  const input: LineupOffenseInput = { id: peak.id, shotWorkloadRatio: context.shotWorkloadRatio,
    trueShootingDelta: context.trueShootingDelta, turnoverRateRatio, assistRateRatio: context.assistRateRatio };
  return { ...input, peakYears: peak.peakYears, ready: ready && turnoverRateRatio !== null };
});
const byId = new Map(players.map((row) => [row.id, row]));
const catalog: { rosters: Roster[]; variants: { id: string; parent: string; replace: Record<string, string>; coach?: string }[] } =
  load('data/reference/mid-iq-roster-benchmarks.json');
const slots = ['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH'];
const variants = catalog.variants.map((variant) => {
  const parent = catalog.rosters.find((roster) => roster.id === variant.parent)!;
  assert.ok(parent);
  for (const slot of Object.keys(variant.replace)) assert.ok(slots.includes(slot));
  return { id: variant.id, parent: variant.parent, coach: variant.coach ?? parent.coach,
    players: parent.players.map((id, index) => variant.replace[slots[index]!] ?? id) };
});
const protocol = {
  referenceSeasons: [1990, 2010, 2020], turnoverShotResponses: [0, 0.5, 1],
  capacityMultipliers: [null, 1, 1.25, 1.5], allocations: ['observed', 'equal'],
  primaryDisplay: { referenceSeason: 2020, allocation: 'observed', turnoverShotResponse: 0, capacityMultiplier: null },
  normalization: 'Add twice the exposure-weighted TS delta to reference points per shot end; multiply reference per-player shot and turnover exposure by their separate season-relative workload ratios.',
  turnoverRate: 'Pooled selected-peak turnovers divided by sum(selected minutes * own-season league turnovers per minute); any missing peak row blocks the player.',
  eventBudget: '100 shot-plus-turnover events; five equal-time players each have 20 reference events before workload ratios.',
  allocation: 'Proportional requested shot weights, redistributing only when a player reaches the assumed cap. Zero requested weights stay zero. No efficiency optimization.',
  turnoverResponse: 'TOV_i = observedTOV_i * ((1-response) + response * allocatedShots_i / observedShots_i). These are design sensitivities, not fitted causal responses.',
  capacity: 'Allocated shots cannot exceed multiplier * observed shots; null is unlimited expansion. Unused capacity is reported as unresolved events, never a fabricated turnover or fitted scoring penalty.',
  assists: 'Recorded for inspection only. No causal creation bonus or next-season regression coefficient is transferred to peak lineups.',
};
const rows = [...catalog.rosters, ...variants].map((roster) => {
  assert.equal(roster.players.length, 6);
  assert.equal(new Set(roster.players.map((id) => id.split('_')[0])).size, 6);
  for (const id of roster.players) assert.ok(byId.has(id));
  const unsupportedIds = roster.players.filter((id) => !byId.get(id)!.ready);
  if (unsupportedIds.length) return { id: roster.id, parent: roster.parent ?? null, status: 'unsupported-data', unsupportedIds };
  const inputs = roster.players.slice(0, 5).map((id) => byId.get(id)!);
  const scenarios = protocol.referenceSeasons.flatMap((referenceSeason) => {
    const baseline = baselines.get(referenceSeason)!;
    assert.ok(baseline && baseline.turnoverShare !== null);
    return protocol.turnoverShotResponses.flatMap((turnoverShotResponse) => protocol.capacityMultipliers.flatMap((capacityMultiplier) =>
      protocol.allocations.map((allocation) => ({ referenceSeason, allocation, turnoverShotResponse, capacityMultiplier,
        result: evaluateLineupOffense(inputs, { referenceShotPointsPerEnd: baseline.shotPointsPerEnd,
          referenceTurnoverShare: baseline.turnoverShare!, turnoverShotResponse, capacityMultiplier },
        allocation === 'equal' ? [0.2, 0.2, 0.2, 0.2, 0.2] : undefined) }))));
  });
  return { id: roster.id, parent: roster.parent ?? null, status: 'allocation-only', playerIds: roster.players,
    coachId: roster.coach, scenarios };
});
for (const [path, hash] of Object.entries(sourceSha256)) assert.equal(fingerprint(path), hash, `Source changed during lineup study: ${path}`);
const report = { version: 'mid-iq-lineup-prototype-1', scope: 'exposed-lineup-allocation-sensitivity', protocol,
  sourceSha256, implementationSha256: fingerprint('src/engine/lineup-prototype.ts'),
  evaluatorSha256: fingerprint('src/engine/calibrate-lineups.ts'),
  supportedPlayers: players.filter((player) => player.ready).length, players,
  supportedRosters: rows.filter((row) => row.status === 'allocation-only').length, rows,
  limitations: ['Accounting under design assumptions, not ORTG, wins, true possessions or validated lineup strength. No roster-band fitting or acceptance gates.',
    'Unallocated events are unresolved; points on allocated events for a shortfall are not a complete-team score and must not be ranked against fully allocated cases.',
    'Era transport, equal playing time and capacity multipliers are assumptions. The stress grid is not a confidence interval or a selected policy.',
    'No efficiency response to expanded workload, optimal shot selection, spacing, assists-to-shot creation, offensive rebounds, defense, opponent effects, coaches, reserve contribution or fatigue.',
    'Six-player data completeness is checked for consistency with earlier audits, but only the five starters are evaluated.',
    'Rate compression and expansion can change turnover totals and lineup order; no claim of positive talent value for changing observed volume alone.',
    'Missing historical turnovers remain unsupported; original peaks, live rules and all exposed roster expectations remain unchanged.'],
};
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(`Retained ${report.supportedRosters}/${rows.length} rosters, ${report.supportedPlayers}/${players.length} players, 72 scenarios per supported roster.`);
console.log(JSON.stringify(rows.map((row) => {
  const primary = row.scenarios?.find((scenario) => scenario.referenceSeason === 2020 && scenario.allocation === 'observed'
    && scenario.turnoverShotResponse === 0 && scenario.capacityMultiplier === null)?.result;
  return { id: row.id, status: row.status, points: primary?.pointsOnAllocatedEvents,
    turnovers: primary?.turnoverEnds, expansion: primary?.maxWorkloadMultiplier, unsupportedIds: row.unsupportedIds };
}), null, 2));