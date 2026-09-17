import { parseResearchJson } from './research-files.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { evaluatePossessionOffense } from './possession-prototype.ts';
import type { PossessionOffenseInput } from './possession-prototype.ts';

const load = (path: string) => parseResearchJson(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const hash = (path: string) => createHash('sha256').update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
const output = process.argv[2];
assert.ok(output && !existsSync(output), 'A new unused output path is required.');
const historyPath = 'docs/research/mid-iq/MID_IQ_HISTORICAL_TEAM_OFFENSE_1.json';
const auditPath = 'docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json';
const history = load(historyPath);
const audit = load(auditPath);
assert.equal(history.version, 'mid-iq-historical-team-offense-1');
assert.equal(audit.version, 'mid-iq-possession-input-audit-1');
const sourceSha256: Record<string, string> = {};
for (const sources of [history.sourceSha256, audit.sourceSha256, {
  [historyPath]: hash(historyPath), [auditPath]: hash(auditPath),
  'scripts/data_pipeline/audit_team_offense.py': history.implementationSha256,
  'scripts/data_pipeline/audit_possessions.py': audit.auditImplementationSha256,
  'src/engine/possession-prototype.ts': hash('src/engine/possession-prototype.ts'),
  'src/engine/calibrate-possession-offense.ts': hash('src/engine/calibrate-possession-offense.ts'),
}]) for (const [path, expected] of Object.entries(sources) as [string, string][]) {
  if (sourceSha256[path]) assert.equal(sourceSha256[path], expected);
  assert.equal(hash(path), expected, `Stale source: ${path}`);
  sourceSha256[path] = expected;
}
const fields = ['points', 'fieldGoalAttempts', 'freeThrowAttempts', 'turnovers', 'offensiveRebounds', 'threePointAttempts'] as const;
type Rates = Record<typeof fields[number], number>;
interface HistoricalRow {
  season: number; team: string; target: number; priorMinuteCoverage: number;
  players: { id: string; minutes: number; rates: Rates }[];
  predictions: Record<string, number>;
}
interface Peak { id: string; peakYears: number[]; aggregate: { per36: Record<typeof fields[number], number | null> } }
interface Roster { id: string; players: string[]; parent?: string }
const policy = { referencePossessionsPer36: 75, maxWorkloadMultiplier: null };
const protocol = {
  version: 'possession-offense-2', scope: 'offline-development-not-release',
  equation: '100 * sum(PTS) / sum(FGA + 0.44*FTA + TOV - ORB), using five equal-time per36 profiles.',
  coefficients: 'No learned coefficients, intercept, scoring stretch, usage reward, assist bonus or additional three-point bonus. 0.44 is the existing box-score free-throw proxy.',
  reboundAssumption: 'ORB are continued possessions with the same aggregate shot and turnover distribution; no second-chance efficiency advantage. Individual ORB are pooled, not subtracted from a player possession share.',
  shotMix: 'Observed PTS includes two-point, three-point and free-throw outcomes. 3PA/FGA is reported, not rewarded again; future shot mix and spacing effects are not inferred.',
  workload: 'Observed demand sets shares; all event rates scale together with constant efficiency. A 100-pace reference implies 75 possessions per36. Ceilings null, 1 and 1.25 are unselected sensitivities, not fitted capacity estimates.',
  shortfall: 'Ceiling violations return no complete score. Unconstrained accounting remains diagnostic only, not a zero-score penalty.',
  historical: 'Reuse frozen prior-season eligible-player/fallback inputs, target minutes and temporal cohorts. Top-five by target minutes versus all-roster minute-weighted profiles. No new fit; 2013+ remains previously exposed evaluation data.',
  centering: 'Subtract equal-team mean of model predictions within each target season; no target offense enters prediction or centering. Not a standalone preseason forecast.',
  benchmark: 'Original pooled peak per36, five starters only. No era transport, coaches, reserve, defense, fatigue, spacing, win conversion or band fitting. Missing required fields remain unsupported.',
};
const evaluate = (inputs: PossessionOffenseInput[]) => {
  const result = evaluatePossessionOffense(inputs, policy);
  assert.ok(Math.abs(result.shotEnds + result.turnoverEnds - result.reboundContinuations - 100) < 1e-8);
  assert.ok(result.pointsPer100Possessions !== null);
  return result;
};
const historicalRows = (history.rows as HistoricalRow[]).map((row) => {
  const topFive = [...row.players].sort((first, second) => second.minutes - first.minutes || first.id.localeCompare(second.id)).slice(0, 5);
  const toInput = (player: typeof row.players[number]): PossessionOffenseInput => ({ id: player.id,
    ...Object.fromEntries(fields.map((field) => [field, player.rates[field] * 36])) as Rates });
  const totalMinutes = row.players.reduce((total, player) => total + player.minutes, 0);
  const weighted = Object.fromEntries(fields.map((field) => [field,
    row.players.reduce((total, player) => total + player.minutes * player.rates[field], 0) / totalMinutes * 36])) as Rates;
  const topFiveResult = evaluate(topFive.map(toInput));
  const wholeRosterResult = evaluate(Array.from({ length: 5 }, (_, index) => ({ id: `profile${index}`, ...weighted })));
  return { season: row.season, team: row.team, target: row.target, priorMinuteCoverage: row.priorMinuteCoverage,
    raw: { topFive: topFiveResult.pointsPer100Possessions!, wholeRoster: wholeRosterResult.pointsPer100Possessions! },
    workload: { topFive: topFiveResult.workloadMultiplier, wholeRoster: wholeRosterResult.workloadMultiplier },
    predictions: { ...row.predictions } };
});
for (const row of historicalRows) for (const model of ['topFive', 'wholeRoster'] as const) {
  const season = historicalRows.filter((candidate) => candidate.season === row.season);
  row.predictions[model] = row.raw[model] - season.reduce((total, candidate) => total + candidate.raw[model], 0) / season.length;
}
const metrics = (rows: typeof historicalRows, model: string) => {
  const errors = rows.map((row) => row.predictions[model]! - row.target);
  return { teams: rows.length, bias: errors.reduce((total, error) => total + error, 0) / rows.length,
    mae: errors.reduce((total, error) => total + Math.abs(error), 0) / rows.length,
    rmse: Math.sqrt(errors.reduce((total, error) => total + error ** 2, 0) / rows.length) };
};
const paired = (rows: typeof historicalRows, first: string, second: string) => {
  const differences = rows.map((row) => (row.predictions[first]! - row.target) ** 2 - (row.predictions[second]! - row.target) ** 2);
  const mean = differences.reduce((total, difference) => total + difference, 0) / rows.length;
  const clusters = new Map<number, number>();
  rows.forEach((row, index) => clusters.set(row.season, (clusters.get(row.season) ?? 0) + differences[index]! - mean));
  assert.ok(clusters.size > 1);
  const error = Math.sqrt(clusters.size / (clusters.size - 1) * [...clusters.values()].reduce((total, value) => total + value ** 2, 0) / rows.length ** 2);
  return { meanSquaredErrorDifference: mean, interval95: [mean - 1.96 * error, mean + 1.96 * error], seasonClusters: clusters.size };
};
const evaluations = Object.fromEntries(Object.entries({ training: [1981, 2012], later: [2013, 2026],
  laterEarly: [2013, 2019], laterRecent: [2020, 2026] }).flatMap(([period, bounds]) => ['all', 'coverage90'].map((cohort) => {
  const selected = historicalRows.filter((row) => row.season >= bounds[0]! && row.season <= bounds[1]!
    && (cohort === 'all' || row.priorMinuteCoverage >= 0.9));
  assert.ok(selected.length);
  const models = ['mean', 'persistence', 'combinedIndex', 'separateCreation', 'profile', 'profileAndCreation', 'topFive', 'wholeRoster'];
  return [`${period}:${cohort}`, { teams: selected.length,
    models: Object.fromEntries(models.map((model) => [model, metrics(selected, model)])),
    comparisons: Object.fromEntries(['topFive', 'wholeRoster'].flatMap((model) => ['mean', 'combinedIndex', 'profile'].map((baseline) =>
      [`${model}-minus-${baseline}`, paired(selected, model, baseline)]))) }];
})));
const peaks = new Map<string, Peak>((audit.players as Peak[]).map((peak) => [peak.id, peak]));
const catalog: { rosters: Roster[]; variants: { id: string; parent: string; replace: Record<string, string> }[] } =
  load('data/reference/mid-iq-roster-benchmarks.json');
const slots = ['PG', 'SG', 'SF', 'PF', 'C', 'SIXTH'];
const variants = catalog.variants.map((variant) => {
  const parent = catalog.rosters.find((roster) => roster.id === variant.parent)!;
  assert.ok(parent);
  assert.ok(Object.keys(variant.replace).every((slot) => slots.includes(slot)));
  return { id: variant.id, parent: variant.parent, players: parent.players.map((id, index) => variant.replace[slots[index]!] ?? id) };
});
const rosters = [...catalog.rosters, ...variants].map((roster) => {
  assert.equal(roster.players.length, 6);
  assert.equal(new Set(roster.players.map((id) => id.split('_')[0])).size, 6);
  const inputs = roster.players.slice(0, 5).map((id) => {
    const peak = peaks.get(id);
    assert.ok(peak, `Missing peak: ${id}`);
    return { id, ...Object.fromEntries(fields.map((field) => [field, peak.aggregate.per36[field]])) } as PossessionOffenseInput;
  });
  const missing = inputs.flatMap((input) => fields.filter((field) => input[field] === null || !Number.isFinite(input[field]))
    .map((field) => ({ id: input.id, field })));
  const scenarios = missing.length ? [] : [null, 1, 1.25].map((maxWorkloadMultiplier) =>
    evaluatePossessionOffense(inputs, { ...policy, maxWorkloadMultiplier }));
  return { id: roster.id, parent: roster.parent ?? null, status: missing.length ? 'unsupported-data' : 'accounting-only',
    inputs, missing, ignoredReserve: roster.players[5], scenarios };
});
for (const [path, expected] of Object.entries(sourceSha256)) assert.equal(hash(path), expected, `Source changed: ${path}`);
const report = { version: 'mid-iq-possession-offense-2', protocol, sourceSha256, evaluations, historicalRows, rosters,
  limitations: ['A box-score possession proxy, not observed possessions or validated five-player offense. Team-only turnovers/rebounds, FT sequence details and opponent rebound resistance are unavailable.',
    'Rebounding is transported as observed activity, not opportunity-adjusted rebound skill; constant repeat-shot efficiency and unlimited primary workload are assumptions.',
    'Per36 peak comparisons across eras lack era normalization. Top-five historical units are selected by minutes, not actual shared court time; whole-roster profiles are synthetic averages.',
    'Historical predictions use actual target minutes and previously exposed source data. Prior missing-player fallback follows the frozen historical study; benchmark missing values are not imputed.',
    'Season-centered predictions use the full target roster cohort, not scoring labels. Existing fitted comparators use different calibration, so this is an input/accounting screen, not a matched model-selection trial.',
    'Normal season-cluster intervals are descriptive, unadjusted for multiple comparisons. No fitted coefficients, ceiling selection, release gate, benchmark acceptance or win predictions.'] };
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ later: evaluations['later:all'], highCoverage: evaluations['later:coverage90'],
  rosters: rosters.map((row) => ({ id: row.id, status: row.status, missing: row.missing,
    points: row.scenarios[0]?.pointsPer100Possessions, workload: row.scenarios[0]?.workloadMultiplier })) }, null, 2));