import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { calculateWinProbability } from './math.ts';
import { randomStream } from './random.ts';
import { sampleOutcome, SCORE_RULES, SCORE_RULES_V1 } from './season.ts';
import type { ScoreRules } from './season.ts';

interface HistoricalGame {
  id: string; season: number; date: string; home: string; away: string;
  homeScore: number; awayScore: number; overtime: number;
}
interface Matchup extends HistoricalGame { deltaRating: number; winProbability: number }
interface ScoreObservation { total: number; margin: number; overtime: number }

const mode = process.argv[2];
assert.ok(['fit', 'validate', 'fit-next', 'validate-next', 'replay-next', 'replay-release'].includes(mode ?? ''),
  'Use fit, validate, fit-next, validate-next, replay-next or replay-release.');
const releaseReplay = mode === 'replay-release';
const retry = mode!.endsWith('-next') || releaseReplay;
const fitting = mode === 'fit' || mode === 'fit-next';
const experimentVersion = retry ? 'historical-score-fit-2' : 'historical-score-fit-1';
const fitPath = new URL(`../../docs/PHASE3_SCORE_FIT${retry ? '_2' : ''}.json`, import.meta.url);
const validationPath = new URL(`../../docs/PHASE3_SCORE_VALIDATION${retry ? '_2' : ''}.json`, import.meta.url);
if (retry && mode !== 'replay-next' && !releaseReplay) {
  assert.ok(!existsSync(fitting ? fitPath : validationPath), 'Retain existing evidence; use replay-next to verify a held-out report.');
  if (fitting) assert.ok(!existsSync(validationPath), 'This holdout is already exposed; do not refit this experiment.');
}
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const implementationSha256 = retry ? Object.fromEntries(['calibrate-scores.ts', 'season.ts', 'math.ts', 'random.ts']
  .map((path) => [path, digest(readFileSync(new URL(path, import.meta.url)))])) : undefined;
const expectedSeason = retry ? (fitting ? 2024 : 2025) : 2022;
const referenceBytes = readFileSync(new URL(`../../data/reference/nba-scores${retry ? `-${expectedSeason}` : ''}.json`, import.meta.url));
const reference = JSON.parse(referenceBytes.toString()) as {
  schemaVersion: number; season: number; splitDate: string; games: HistoricalGame[]; sources: unknown[];
};
assert.equal(reference.schemaVersion, 1);
assert.equal(reference.season, expectedSeason);
assert.equal(reference.games.length, 1230);
assert.equal(new Set(reference.games.map((game) => game.id)).size, 1230);
const referenceSha256 = digest(referenceBytes);

const tolerances = {
  meanTotal: 4, totalSD: 3, totalP10: 5, totalP90: 5,
  meanMargin: 1.5, medianMargin: 2, marginP90: 3,
  thirtyPointRate: 0.025, fiftyPointRate: 0.008, onePointRate: 0.025,
  overtimeRate: 0.02, overtimeMeanMargin: 1.5, overtimeMarginP90: 4,
  overtimeMeanTotal: 12, multipleOvertimeShare: 0.12,
};
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const rounded = (value: number) => Number(value.toFixed(6));
function quantile(values: number[], fraction: number): number {
  const sorted = [...values].sort((first, second) => first - second);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return sorted[lower]! + (sorted[Math.ceil(index)]! - sorted[lower]!) * (index - lower);
}
function summarize(games: ScoreObservation[]) {
  const totals = games.map((game) => game.total);
  const margins = games.map((game) => game.margin);
  const overtime = games.filter((game) => game.overtime > 0);
  assert.ok(games.length && overtime.length);
  const meanTotal = mean(totals);
  return {
    meanTotal, totalSD: Math.sqrt(mean(totals.map((value) => (value - meanTotal) ** 2))),
    totalP10: quantile(totals, 0.1), totalP90: quantile(totals, 0.9),
    meanMargin: mean(margins), medianMargin: quantile(margins, 0.5), marginP90: quantile(margins, 0.9),
    thirtyPointRate: games.filter((game) => game.margin >= 30).length / games.length,
    fiftyPointRate: games.filter((game) => game.margin >= 50).length / games.length,
    onePointRate: games.filter((game) => game.margin === 1).length / games.length,
    overtimeRate: overtime.length / games.length,
    overtimeMeanMargin: mean(overtime.map((game) => game.margin)),
    overtimeMarginP90: quantile(overtime.map((game) => game.margin), 0.9),
    overtimeMeanTotal: mean(overtime.map((game) => game.total)),
    multipleOvertimeShare: overtime.filter((game) => game.overtime > 1).length / overtime.length,
  };
}
function observations(games: HistoricalGame[]): ScoreObservation[] {
  return games.map((game) => ({ total: game.homeScore + game.awayScore,
    margin: Math.abs(game.homeScore - game.awayScore), overtime: game.overtime }));
}

const records = new Map<string, { margin: number; played: number }>();
const matchups: Matchup[] = [...reference.games].sort((first, second) =>
  first.date.localeCompare(second.date) || first.id.localeCompare(second.id)).map((game) => {
  for (const score of [game.homeScore, game.awayScore, game.overtime]) assert.ok(Number.isInteger(score) && score >= 0);
  assert.notEqual(game.homeScore, game.awayScore);
  assert.equal(game.season, expectedSeason);
  assert.ok(Number.isFinite(Date.parse(game.date)));
  assert.ok(game.home && game.away && game.home !== game.away);
  const home = records.get(game.home) ?? { margin: 0, played: 0 };
  const away = records.get(game.away) ?? { margin: 0, played: 0 };
  const deltaRating = home.margin / (home.played + 10) - away.margin / (away.played + 10) + 2.5;
  const margin = game.homeScore - game.awayScore;
  records.set(game.home, { margin: home.margin + margin, played: home.played + 1 });
  records.set(game.away, { margin: away.margin - margin, played: away.played + 1 });
  return { ...game, deltaRating, winProbability: calculateWinProbability(deltaRating) };
});
assert.equal(records.size, 30);
assert.ok([...records.values()].every((record) => record.played === 82));
const training = retry ? (fitting ? matchups : []) : matchups.filter((game) => game.date < reference.splitDate);
const validation = retry ? (fitting ? [] : matchups) : matchups.filter((game) => game.date >= reference.splitDate);
if (!retry) assert.ok(training.length > 500 && validation.length > 300);

function simulate(games: Matchup[], rules: ScoreRules, repeats: number) {
  const results: ScoreObservation[] = [];
  let regulationCap = 0;
  let overtimeCap = 0;
  let periodCap = 0;
  for (const game of games) {
    const scoreRandom = randomStream(experimentVersion, game.id).next;
    const won = game.homeScore > game.awayScore;
    for (let sample = 0; sample < repeats; sample++) {
      const result = sampleOutcome(game, () => won ? 0 : 1 - Number.EPSILON, scoreRandom, rules);
      assert.equal(result.won, won);
      const margin = Math.abs(result.margin);
      regulationCap += Number(!result.overtime.length && margin === rules.maxMargin);
      overtimeCap += Number(result.overtime.length > 0 && margin === rules.overtimeMaxMargin);
      periodCap += Number(result.overtime.length === rules.maxOvertimePeriods);
      results.push({ total: result.userScore + result.oppScore, margin, overtime: result.overtime.length });
    }
  }
  return { count: results.length, summary: summarize(results), capCounts: { regulationCap, overtimeCap, periodCap } };
}

if (fitting) {
  const observed = summarize(observations(training));
  const regulation = training.filter((game) => !game.overtime);
  const overtime = training.filter((game) => game.overtime);
  const midpoints = regulation.map((game) => (game.homeScore + game.awayScore) / 2);
  const center = mean(midpoints);
  let rules: ScoreRules = {
    ...SCORE_RULES_V1, version: retry ? 'conditional-score-3-candidate' : 'conditional-score-2',
    regulationOffset: 1,
    baseline: rounded(center - 0.25),
    baselineSpread: rounded(Math.sqrt(6 * mean(midpoints.map((value) => (value - center) ** 2)))),
    maxMargin: 100, overtimeMaxMargin: 30, maxOvertimePeriods: 6,
    overtimeProbability: rounded(overtime.length / training.reduce((total, game) =>
      total + 4 * game.winProbability * (1 - game.winProbability), 0)),
    overtimeContinuation: rounded(overtime.reduce((total, game) => total + game.overtime - 1, 0)
      / overtime.reduce((total, game) => total + game.overtime, 0)),
    overtimeBaseline: rounded(Math.max(6, Math.min(14, (observed.overtimeMeanTotal - 2 * center)
      / (2 * mean(overtime.map((game) => game.overtime)))))),
  };
  const trials: { parameter: string; value: number; loss: number }[] = [];
  const jointTrials: { scale: number; offset: number; worstError: number; squaredError: number }[] = [];
  if (retry) {
    const metrics = ['meanMargin', 'medianMargin', 'marginP90', 'thirtyPointRate', 'fiftyPointRate', 'onePointRate'] as const;
    let bestWorst = Infinity;
    let bestSquared = Infinity;
    for (const offset of [0, 1]) {
      for (let scale = 5; scale <= 10.5; scale += 0.25) {
        const candidate = { ...rules, regulationScale: scale, regulationOffset: offset };
        const summary = simulate(training, candidate, 40).summary;
        const errors = metrics.map((metric) => Math.abs(summary[metric] - observed[metric]) / tolerances[metric]);
        const worstError = Math.max(...errors);
        const squaredError = errors.reduce((total, error) => total + error ** 2, 0);
        jointTrials.push({ scale, offset, worstError: rounded(worstError), squaredError: rounded(squaredError) });
        if (worstError < bestWorst || (worstError === bestWorst && squaredError < bestSquared)) {
          bestWorst = worstError;
          bestSquared = squaredError;
          rules = candidate;
        }
      }
    }
  }
  for (const [parameter, candidates, metrics] of [
    ['regulationScale', [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5], ['meanMargin', 'medianMargin', 'marginP90', 'thirtyPointRate', 'fiftyPointRate']],
    ['overtimeScale', [2, 2.5, 3, 3.5, 4, 4.5, 5], ['overtimeMeanMargin', 'overtimeMarginP90']],
  ] as const) {
    if (retry && parameter === 'regulationScale') continue;
    let bestLoss = Infinity;
    let bestValue = rules[parameter];
    for (const value of candidates) {
      const summary = simulate(training, { ...rules, [parameter]: value }, 40).summary;
      const loss = metrics.reduce((total, metric) => total + ((summary[metric] - observed[metric]) / tolerances[metric]) ** 2, 0);
      trials.push({ parameter, value, loss: rounded(loss) });
      if (loss < bestLoss) { bestLoss = loss; bestValue = value; }
    }
    rules = { ...rules, [parameter]: bestValue };
  }
  const report = {
    version: experimentVersion, referenceSha256, sources: reference.sources, splitDate: retry ? null : reference.splitDate,
    trainingCount: training.length, validationCount: retry ? 1230 : validation.length,
    matchupProxy: 'Pregame mean point differential, ten-game zero prior, +2.5 home; fixed sigma 10.5.',
    outcomeConditioning: 'Observed historical winner; not a win-prediction calibration.',
    tolerances, rules, trials, observed, original: simulate(training, SCORE_RULES_V1, 100), candidate: simulate(training, rules, 100),
    ...(retry ? { trainingSeason: 2024, validationSeason: 2025, implementationSha256, jointTrials,
      method: 'Full-season baseline; minimax joint regulation scale/offset, then least-squares OT scale.' } : {}),
  };
  writeFileSync(fitPath, JSON.stringify(report, null, 2) + '\n', { flag: retry ? 'wx' : 'w' });
  console.log(JSON.stringify({ trainingCount: training.length, rules, observed, candidate: report.candidate }, null, 2));
} else {
  const fitBytes = readFileSync(fitPath);
  const fit = JSON.parse(fitBytes.toString()) as {
    version: string; referenceSha256: string; rules: ScoreRules; tolerances: typeof tolerances;
    trainingSeason?: number; validationSeason?: number; implementationSha256?: typeof implementationSha256;
  };
  if (retry) {
    assert.equal(fit.version, experimentVersion);
    assert.equal(fit.trainingSeason, 2024);
    assert.equal(fit.validationSeason, expectedSeason);
    const trainingBytes = readFileSync(new URL('../../data/reference/nba-scores-2024.json', import.meta.url));
    assert.equal(fit.referenceSha256, digest(trainingBytes), 'Development reference changed after fitting.');
    if (releaseReplay) {
      assert.equal(SCORE_RULES.version, 'conditional-score-3');
      assert.deepEqual({ ...SCORE_RULES, version: fit.rules.version }, fit.rules, 'Released parameters differ from the accepted candidate.');
    } else assert.deepEqual(fit.implementationSha256, implementationSha256, 'Calibration implementation changed after fitting.');
    const trainingIds = new Set((JSON.parse(trainingBytes.toString()).games as HistoricalGame[]).map((game) => game.id));
    assert.ok(validation.every((game) => !trainingIds.has(game.id)), 'Training and validation games overlap.');
  } else assert.equal(fit.referenceSha256, referenceSha256, 'Reference changed after fitting.');
  assert.deepEqual(fit.tolerances, tolerances, 'Validation tolerances changed after fitting.');
  const observed = summarize(observations(validation));
  const original = simulate(validation, SCORE_RULES_V1, 200);
  const candidate = simulate(validation, releaseReplay ? SCORE_RULES : fit.rules, 200);
  const gates = Object.entries(tolerances).map(([metric, tolerance]) => {
    const name = metric as keyof typeof tolerances;
    const difference = candidate.summary[name] - observed[name];
    return { metric, observed: observed[name], candidate: candidate.summary[name], tolerance,
      difference, passed: Math.abs(difference) <= tolerance };
  });
  const report = { version: retry ? 'historical-score-validation-2' : 'historical-score-validation-1', referenceSha256,
    fitSha256: digest(fitBytes), rules: fit.rules,
    count: validation.length, observed, original, candidate, gates, passed: gates.every((gate) => gate.passed),
    ...(retry ? { sources: reference.sources, trainingReferenceSha256: fit.referenceSha256, implementationSha256 } : {}),
  };
  if (releaseReplay) {
    const retained = JSON.parse(readFileSync(validationPath, 'utf8')) as typeof report;
    assert.deepEqual({ ...report, implementationSha256: undefined }, { ...retained, implementationSha256: undefined },
      'Released implementation did not reproduce retained historical evidence.');
    console.log(JSON.stringify({ version: 'historical-score-release-verification-1', scoreVersion: SCORE_RULES.version,
      validationSha256: digest(readFileSync(validationPath)), implementationSha256, passed: report.passed }, null, 2));
  } else if (mode === 'replay-next') assert.deepEqual(report, JSON.parse(readFileSync(validationPath, 'utf8')), 'Retained evidence did not reproduce.');
  else writeFileSync(validationPath, JSON.stringify(report, null, 2) + '\n', { flag: retry ? 'wx' : 'w' });
  if (!releaseReplay) console.log(JSON.stringify(report, null, 2));
  assert.ok(report.passed, 'Historical score acceptance failed; do not retune on this holdout.');
}
