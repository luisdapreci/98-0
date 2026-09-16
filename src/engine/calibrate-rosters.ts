import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BALANCE_RULES_V2, calculateUsageModifier, calculateWinProbability, evaluateGame, normalizeStats } from './math.ts';
import { availablePlayers, availableSlots, DRAFT_SLOTS } from './draft.ts';
import { applyDraftAction, createRun, recoverRun } from './run.ts';
import { randomStream } from './random.ts';
import { generateSchedule, requireCompleteLineup, SCHEDULE_COUNTS } from './season.ts';
import { evaluateRosterCandidate, evaluateRosterFeatures, INITIAL_ROSTER_BALANCE, rosterBalanceFeatures } from './roster-balance.ts';
import type { RosterBalanceParameters } from './roster-balance.ts';
import { evaluatePossessionBudget } from './possession-prototype.ts';
import type { PossessionInput } from './possession-prototype.ts';
import type { Coach, GameContext, GameEvaluation, OpponentPool, Player, TeamLineup } from './types.ts';

const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fingerprint = (path: string) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
// math.ts gained the season-6 (mid-iq-3) usage rules; mid-iq-1/mid-iq-2 evaluation is unchanged, so fits
// recorded against the previous file remain replayable.
const MATH_REVISIONS: Record<string, string> = {
  '0c8598ec267cfae50a5228e65e8143e3ab6b979d1f5a605e77433ece68a8c800':
    'a32b9121f2201c6426ad078a316e7922b546c2fe488c468e16f68fb0b3912c82',
};
const mathMatchesFit = (recorded: string) => [recorded, MATH_REVISIONS[recorded]].includes(fingerprint('./math.ts'));
interface Roster { id: string; tier: string; family: string; coach: string; players: string[] }
interface Variant { id: string; parent: string; replace: Record<string, string>; coach?: string }
const catalog: {
  version: string; sourceSha256: Record<string, string>; families: Record<string, string>;
  targets: Record<string, { expectedWins: number[] }>; rosters: Roster[]; variants: Variant[];
} = load('../../data/reference/mid-iq-roster-benchmarks.json');
const players: Player[] = load('../../data/processed/players.json');
const coaches: Coach[] = load('../../data/processed/coaches.json');
const pool: OpponentPool = load('../../data/processed/opponents.json').regularSeasonPool;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const quantile = (values: number[], probability: number) => [...values].sort((first, second) => first - second)[Math.floor((values.length - 1) * probability)]!;
type Evaluator = (lineup: TeamLineup, context: GameContext) => GameEvaluation;
const baseline: Evaluator = (lineup, context) => evaluateGame(lineup, context, BALANCE_RULES_V2);
const usageCandidate: Evaluator = (lineup, context) => {
  const result = baseline(lineup, context);
  const synergy = { ...result.synergy };
  synergy.usgTeam -= (lineup.SIXTH?.stats.usgPct ?? 0) * 0.4;
  const cap = lineup.coach?.modifiers.filter((modifier) => modifier.stat === 'usgCap')
    .reduce((sum, modifier) => sum + modifier.delta, 0) ?? 0;
  synergy.phiUsg = calculateUsageModifier(synergy.usgTeam, cap);
  synergy.effectiveOrtg = (95 + (synergy.ortgTeam - 95) * synergy.phiUsg) * (1 + synergy.spacingModifier);
  synergy.netRating = synergy.effectiveOrtg - synergy.drtgTeam;
  const deltaRating = result.deltaRating + synergy.netRating - result.synergy.netRating;
  return { ...result, synergy, deltaRating, winProbability: calculateWinProbability(deltaRating) };
};
const spacingCandidate: Evaluator = (lineup, context) => {
  const result = usageCandidate(lineup, context);
  const synergy = { ...result.synergy };
  const rating = synergy.spacingRating;
  const spacingPoints = rating < 3 ? -6 + rating
    : rating < 5 ? -3 + (rating - 3) * 3.5
      : Math.min(6, 4 + (rating - 5) * 0.4);
  const unspaced = 95 + (synergy.ortgTeam - 95) * synergy.phiUsg;
  synergy.spacingModifier = spacingPoints / unspaced;
  synergy.effectiveOrtg = unspaced + spacingPoints;
  synergy.netRating = synergy.effectiveOrtg - synergy.drtgTeam;
  const deltaRating = result.deltaRating + synergy.netRating - result.synergy.netRating;
  return { ...result, synergy, deltaRating, winProbability: calculateWinProbability(deltaRating) };
};

function lineupFor(roster: Roster): TeamLineup {
  const lineup = {
    ...Object.fromEntries(DRAFT_SLOTS.map((slot, index) => [slot, players.find((player) => player.id === roster.players[index])])),
    coach: coaches.find((coach) => coach.id === roster.coach),
  } as TeamLineup;
  requireCompleteLineup(lineup);
  return lineup;
}

function distributionFor(probabilities: number[]) {
  const distribution = Array<number>(probabilities.length + 1).fill(0);
  distribution[0] = 1;
  for (const probability of probabilities) {
    assert.ok(Number.isFinite(probability) && probability >= 0 && probability <= 1);
    for (let wins = probabilities.length; wins >= 0; wins--)
      distribution[wins] = distribution[wins]! * (1 - probability) + (wins ? distribution[wins - 1]! * probability : 0);
  }
  assert.ok(Math.abs(distribution.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
  assert.ok(Math.abs(distribution.reduce((sum, value, wins) => sum + value * wins, 0)
    - probabilities.reduce((sum, value) => sum + value, 0)) < 1e-9);
  return distribution;
}

const validating = process.argv[3] === 'validate';
const seedPrefix = validating ? 'mid-iq-rosters-validation-1-' : 'mid-iq-rosters-development-1-';
const schedules = Array.from({ length: validating ? 256 : 64 }, (_, index) => generateSchedule(`${seedPrefix}${index}`, pool));
function measure(lineup: TeamLineup, evaluator: Evaluator) {
  const neutral = evaluator(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false });
  let poolExpectedWins = 0;
  for (const [tier, count] of Object.entries(SCHEDULE_COUNTS)) {
    const opponents = pool[tier as keyof OpponentPool];
    for (const opponent of opponents) for (const isHome of [false, true]) for (const isBackToBack of [false, true]) {
      const weight = count / opponents.length * 0.5 * (isBackToBack ? 14 / 82 : 68 / 82);
      poolExpectedWins += weight * evaluator(lineup, { opponentNetRating: opponent.netRating, isHome, isBackToBack }).winProbability;
    }
  }
  const contextCache = new Map<string, number>();
  const expectations: number[] = [];
  const mixedDistribution = Array<number>(83).fill(0);
  for (const schedule of schedules) {
    const probabilities = schedule.map((game) => {
      const context = { opponentNetRating: game.opponent.netRating, isHome: game.isHome, isBackToBack: game.isBackToBack };
      const key = JSON.stringify(context);
      if (!contextCache.has(key)) contextCache.set(key, evaluator(lineup, context).winProbability);
      return contextCache.get(key)!;
    });
    expectations.push(probabilities.reduce((sum, value) => sum + value, 0));
    distributionFor(probabilities).forEach((probability, wins) => { mixedDistribution[wins]! += probability / schedules.length; });
  }
  const winQuantile = (target: number) => {
    let cumulative = 0;
    return mixedDistribution.findIndex((probability) => { cumulative += probability; return cumulative >= target; });
  };
  return {
    expectedWins: mean(expectations), poolExpectedWins,
    scheduleMeanStandardError: Math.sqrt(mean(expectations.map((value) => (value - mean(expectations)) ** 2)) / (expectations.length - 1)),
    scheduleExpectedWinsP05P95: [quantile(expectations, 0.05), quantile(expectations, 0.95)],
    qualificationProbability: mixedDistribution.slice(60).reduce((sum, value) => sum + value, 0),
    seasonWinsP05P50P95: [winQuantile(0.05), winQuantile(0.5), winQuantile(0.95)],
    undefeatedProbability: mixedDistribution[82], neutral,
  };
}

const output = process.argv[2];
const mode = process.argv[3] ?? 'baseline';
assert.ok(['baseline', 'usage', 'spacing', 'fit', 'audit', 'validate', 'diagnose', 'possession', 'coach-audit', 'stress', 'position-stress', 'policy-stress', 'access-stress'].includes(mode), 'Choose baseline, usage, spacing, fit, audit, validate, diagnose, possession, coach-audit, stress, position-stress, policy-stress or access-stress.');
assert.ok(output, 'A new output path is required.');
assert.ok(!existsSync(output), 'Refusing to overwrite an existing report.');
for (const [file, sha] of Object.entries(catalog.sourceSha256)) assert.equal(fingerprint(`../../data/processed/${file}`), sha);
const development = catalog.rosters.filter((roster) => catalog.families[roster.family] === 'development');
assert.equal(development.length, 15);
function variantLineup(variant: Variant) {
  const lineup = lineupFor(development.find((roster) => roster.id === variant.parent)!);
  for (const [slot, id] of Object.entries(variant.replace)) {
    assert.ok(DRAFT_SLOTS.includes(slot as typeof DRAFT_SLOTS[number]));
    lineup[slot as typeof DRAFT_SLOTS[number]] = players.find((player) => player.id === id)!;
  }
  if (variant.coach) lineup.coach = coaches.find((coach) => coach.id === variant.coach)!;
  requireCompleteLineup(lineup);
  return lineup;
}
function stress() {
  const fitPath = process.argv[4];
  assert.ok(fitPath, 'Provide the frozen fit report path.');
  const frozen = JSON.parse(readFileSync(fitPath, 'utf8'));
  assert.equal(frozen.scope, 'development-only');
  assert.equal(frozen.candidateImplementationSha256, fingerprint('./roster-balance.ts'), 'Candidate implementation changed after fitting.');
  assert.equal(frozen.catalogSha256, fingerprint('../../data/reference/mid-iq-roster-benchmarks.json'));
  assert.ok(mathMatchesFit(frozen.mathSha256), 'Math implementation changed after fitting.');
  assert.equal(frozen.opponentSha256, fingerprint('../../data/processed/opponents.json'));
  const parameters: RosterBalanceParameters = frozen.fitted.parameters;
  const candidate: Evaluator = (lineup, context) => evaluateRosterCandidate(lineup, context, parameters);
  const replacements = Object.fromEntries(DRAFT_SLOTS.map((slot) => {
    const eligible = players.filter((player) => slot === 'SIXTH' || player.eligiblePositions.includes(slot));
    const normalized = eligible.map((player) => normalizeStats(player.stats));
    const stats = Object.fromEntries(Object.keys(normalized[0]!).map((key) => [key,
      mean(normalized.map((row) => row[key as keyof Player['stats']]))])) as unknown as Player['stats'];
    return [slot, { ...eligible[0]!, id: `replacement-${slot}`, stats }];
  })) as Record<typeof DRAFT_SLOTS[number], Player>;
  const project = (lineup: TeamLineup, evaluator: Evaluator) => {
    const complete = { ...lineup };
    for (const slot of DRAFT_SLOTS) complete[slot] ??= replacements[slot];
    return evaluator(complete, { opponentNetRating: 0, isHome: false, isBackToBack: false }).deltaRating;
  };
  const evaluateDraft = (lineup: TeamLineup, seed: string, evaluator: Evaluator) => {
    const features = evaluator(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false });
    const probabilities = generateSchedule(seed, pool).map((game) => calculateWinProbability(features.deltaRating
      - game.opponent.netRating + (game.isHome ? 3 : 0) + (game.isBackToBack ? -8 + 7 * features.synergy.sixthManFRF : 0)));
    const distribution = distributionFor(probabilities);
    return { expectedWins: probabilities.reduce((sum, value) => sum + value, 0),
      qualificationProbability: distribution.slice(60).reduce((sum, value) => sum + value, 0),
      directEntryProbability: distribution.slice(65).reduce((sum, value) => sum + value, 0),
      firstSeedProbability: distribution.slice(75).reduce((sum, value) => sum + value, 0),
      undefeatedProbability: distribution[82]!,
      wins: probabilities.filter((probability, index) => randomStream(seed, `outcome/${index + 1}`).next() < probability).length };
  };
  const seedPrefix = process.argv[5] ?? 'mid-iq-rosters-draft-stress-1-';
  const seedCount = Number(process.argv[6] ?? 100);
  assert.ok(Number.isSafeInteger(seedCount) && seedCount >= 2 && seedCount <= 10000, 'Seed count must be an integer from 2 to 10000.');
  interface StressObservation {
    seed: string; players: string[]; coach: string; actions: ReturnType<typeof createRun>['actions'];
    secondaryStarters: number; forcedSecondaryPicks: number;
    decisions: { legalPlayers: number; consideredPlayers: number; selectedRank: number; offeredIds: string[] }[];
    baseline: ReturnType<typeof evaluateDraft>; candidate: ReturnType<typeof evaluateDraft>;
  }
  const results: {
    policy: string; objective: string; count: number;
    summary: Record<string, Record<string, number | number[]>>;
    positions: Record<string, number>; observations: StressObservation[];
  }[] = [];
  const policies = mode === 'position-stress' ? ['rating', 'greedy-candidate', 'primary-rating', 'primary-greedy']
    : mode === 'policy-stress' ? ['random', 'rating', 'primary-rating', 'rating-top3', 'candidate-top3', 'greedy-candidate']
    : mode === 'access-stress' ? ['rating', 'rating-menu3', 'rating-menu8', 'greedy-candidate', 'candidate-menu3', 'candidate-menu8']
    : ['random', 'rating', 'greedy-baseline', 'greedy-candidate'];
  for (const policy of policies) {
    const objective = policy === 'greedy-baseline' ? 'baseline'
      : ['greedy-candidate', 'primary-greedy', 'candidate-top3', 'candidate-menu3', 'candidate-menu8'].includes(policy) ? 'candidate' : 'rating';
    if (policy === 'primary-greedy') assert.equal(objective, 'candidate');
    const observations: StressObservation[] = [];
    for (let index = 0; index < seedCount; index++) {
      const seed = `${seedPrefix}${index}`;
      let run = createRun(seed, coaches);
      let forcedSecondaryPicks = 0;
      const decisions = randomStream(seed, 'roster-stress-decisions-1').next;
      const policyRandom = randomStream(seed, 'roster-stress-shortlist-1').next;
      const decisionLog: typeof observations[number]['decisions'] = [];
      while (run.phase === 'DRAFTING') {
        if (run.draft.phase === 'COACH') {
          const coach = run.draft.offers[Math.floor(decisions() * run.draft.offers.length)]!;
          run = applyDraftAction(run, { type: 'COACH', id: coach.id }, players);
        } else if (!run.draft.roll) run = applyDraftAction(run, { type: 'SPIN' }, players);
        else {
          const choices = availablePlayers(run.draft, players).flatMap((player) => availableSlots(run.draft.lineup, player).map((slot) => ({
            player, slot, value: objective === 'rating' ? player.overallRating
              : project({ ...run.draft.lineup, [slot]: player }, objective === 'candidate' ? candidate : baseline),
          }))).sort((first, second) => second.value - first.value || first.player.id.localeCompare(second.player.id)
            || DRAFT_SLOTS.indexOf(first.slot) - DRAFT_SLOTS.indexOf(second.slot));
          const primary = choices.filter(({ player, slot }) => slot === 'SIXTH' || player.primaryPosition === slot);
          const shortlist = policy.startsWith('primary') && primary.length ? primary : choices;
          const uniquePlayers = shortlist.filter((choice, index) => shortlist.findIndex((other) => other.player.id === choice.player.id) === index);
          const menuSize = policy.endsWith('menu3') ? 3 : policy.endsWith('menu8') ? 8 : undefined;
          const menuIds = new Set(uniquePlayers.map(({ player }) => ({ id: player.id,
            draw: randomStream(seed, `roster-menu/${decisionLog.length}/${player.id}`).next() }))
            .sort((first, second) => first.draw - second.draw || first.id.localeCompare(second.id))
            .slice(0, menuSize ?? uniquePlayers.length).map(({ id }) => id));
          const considered = menuSize ? uniquePlayers.filter(({ player }) => menuIds.has(player.id))
            : policy.endsWith('top3') ? uniquePlayers.slice(0, 3) : uniquePlayers;
          const choice = policy === 'random' ? choices[Math.floor(decisions() * choices.length)]!
            : policy.endsWith('top3') ? considered[Math.floor(policyRandom() * considered.length)]! : considered[0]!;
          decisionLog.push({ legalPlayers: new Set(choices.map((entry) => entry.player.id)).size,
            consideredPlayers: considered.length, selectedRank: uniquePlayers.findIndex((entry) => entry.player.id === choice.player.id) + 1,
            offeredIds: considered.map(({ player }) => player.id) });
          if (policy.endsWith('top3')) assert.ok(decisionLog.at(-1)!.selectedRank >= 1 && decisionLog.at(-1)!.selectedRank <= 3);
          if (menuSize) {
            assert.equal(considered.length, Math.min(menuSize, uniquePlayers.length));
            assert.ok(menuIds.has(choice.player.id));
          }
          if (policy.startsWith('primary') && !primary.length) forcedSecondaryPicks++;
          run = applyDraftAction(run, { type: 'PICK', id: choice.player.id, slot: choice.slot }, players);
        }
      }
      assert.deepEqual(recoverRun({ run }, { players, coaches, opponents: pool }, 'unused').run, run);
      observations.push({ seed, players: DRAFT_SLOTS.map((slot) => run.draft.lineup[slot]!.id), coach: run.draft.lineup.coach!.id,
        secondaryStarters: DRAFT_SLOTS.slice(0, 5).filter((slot) => run.draft.lineup[slot]!.primaryPosition !== slot).length,
        forcedSecondaryPicks, decisions: decisionLog,
        actions: run.actions, baseline: evaluateDraft(run.draft.lineup, seed, baseline), candidate: evaluateDraft(run.draft.lineup, seed, candidate) });
    }
    const summary = Object.fromEntries(['baseline', 'candidate'].map((version) => {
      const rows = observations.map((row) => row[version as 'baseline' | 'candidate']);
      return [version, { medianExpectedWins: quantile(rows.map((row) => row.expectedWins), 0.5),
        expectedWinsP10P90: [quantile(rows.map((row) => row.expectedWins), 0.1), quantile(rows.map((row) => row.expectedWins), 0.9)],
        meanQualificationProbability: mean(rows.map((row) => row.qualificationProbability)),
        meanDirectEntryProbability: mean(rows.map((row) => row.directEntryProbability)),
        meanFirstSeedProbability: mean(rows.map((row) => row.firstSeedProbability)),
        meanUndefeatedProbability: mean(rows.map((row) => row.undefeatedProbability)),
        realizedQualificationRate: rows.filter((row) => row.wins >= 60).length / rows.length }];
    }));
    const positions = { meanSecondaryStarters: mean(observations.map((row) => row.secondaryStarters)),
      forcedSecondaryPicks: observations.reduce((sum, row) => sum + row.forcedSecondaryPicks, 0) };
    results.push({ policy, objective, count: observations.length, summary, positions, observations });
    console.log(JSON.stringify({ policy, objective, summary, positions }));
  }
  const coachChecks = (mode === 'stress' ? development : []).map((roster) => {
    const lineup = lineupFor(roster);
    const choices = coaches.map((coach) => ({ coach: coach.id, expectedWins: measure({ ...lineup, coach }, candidate).expectedWins }))
      .sort((first, second) => second.expectedWins - first.expectedWins);
    return { id: roster.id, spread: choices[0]!.expectedWins - choices.at(-1)!.expectedWins, choices };
  });
  console.table(coachChecks.map((row) => ({ id: row.id, spread: row.spread.toFixed(2), best: row.choices[0]!.coach, worst: row.choices.at(-1)!.coach })));
  const pairs = mode === 'policy-stress' ? [['rating', 'rating-top3'], ['greedy-candidate', 'candidate-top3'], ['rating', 'greedy-candidate']]
    : mode === 'access-stress' ? [['rating', 'rating-menu3'], ['rating', 'rating-menu8'], ['greedy-candidate', 'candidate-menu3'], ['greedy-candidate', 'candidate-menu8']] : [];
  const pairedComparisons = pairs.map(([control, treatment]) => {
    const first = results.find((row) => row.policy === control)!.observations;
    const second = results.find((row) => row.policy === treatment)!.observations;
    const metrics = Object.fromEntries((['expectedWins', 'qualificationProbability'] as const).map((metric) => {
      const differences = second.map((row, index) => {
        assert.equal(row.seed, first[index]!.seed);
        assert.equal(row.coach, first[index]!.coach);
        return row.candidate[metric] - first[index]!.candidate[metric];
      });
      const difference = mean(differences);
      const standardError = Math.sqrt(mean(differences.map((value) => (value - difference) ** 2)) / (differences.length - 1));
      return [metric, { meanDifference: difference, standardError,
        approximate95Interval: [difference - 1.96 * standardError, difference + 1.96 * standardError] }];
    }));
    return { control, treatment, count: first.length, metrics };
  });
  for (const comparison of pairedComparisons) console.log(JSON.stringify(comparison));
  return { version: `mid-iq-roster-${mode}-3`, parameters, seedPrefix, seedCount, sourceFit: fitPath,
    sourceFitSha256: createHash('sha256').update(readFileSync(fitPath)).digest('hex'),
    candidateImplementationSha256: fingerprint('./roster-balance.ts'), evaluatorSha256: fingerprint('./calibrate-rosters.ts'), results, coachChecks, pairedComparisons,
    limitations: ['Development stress only, not a passed release gate.', `${seedCount} seeds per policy; random offered coach, no rerolls, greedy rather than lookahead.`,
      'Greedy policies fill missing positions with pool-mean stat placeholders; these are forecasts, not additional legal picks.',
      'Primary-preferring policies restrict choices to primary positions or bench when available, falling back to legal secondary slots to finish. This is a policy ablation, not a new draft rule.',
      'Top-three policies sample uniformly among distinct players, each in its best-ranked legal slot; their independent decision stream does not change coach or draft randomness. They are synthetic consistency controls, not measured human policies.',
      'Menu controls restrict this experiment to uniformly ranked legal players within the current roll; this is not a live draft rule. Choices can alter later legal roll options, so seed pairing does not imply identical later menus.',
      'Paired intervals use per-seed differences and a normal approximation; they describe these synthetic policies, not human behavior or model uncertainty.',
      'Each completed draft is legal and replay-validated. Candidate evaluation does not change saved run versions.',
      'Not human behavior, engagement, playoff or title validation. This report does not evaluate reserved families; prior exposure is recorded separately.'] };
}
if (mode === 'stress' || mode === 'position-stress' || mode === 'policy-stress' || mode === 'access-stress') {
  writeFileSync(output, `${JSON.stringify(stress(), null, 2)}\n`, { flag: 'wx' });
  process.exit(0);
}
function fit() {
  const neutralContext = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const baseFeatures = development.map((roster) => ({ roster, features: rosterBalanceFeatures(lineupFor(roster)) }));
  const variantFeatures = catalog.variants.filter((variant) => development.some((roster) => roster.id === variant.parent))
    .map((variant) => ({ variant, features: rosterBalanceFeatures(variantLineup(variant)) }));
  const histograms = [new Map<number, number>(), new Map<number, number>()];
  for (const [tier, count] of Object.entries(SCHEDULE_COUNTS)) {
    const opponents = pool[tier as keyof OpponentPool];
    for (const opponent of opponents) for (const isHome of [false, true]) for (const isBackToBack of [false, true]) {
      const histogram = histograms[Number(isBackToBack)]!;
      const shift = (isHome ? 3 : 0) - opponent.netRating;
      const weight = count / opponents.length * 0.5 * (isBackToBack ? 14 / 82 : 68 / 82);
      histogram.set(shift, (histogram.get(shift) ?? 0) + weight);
    }
  }
  assert.ok(Math.abs([...histograms[0]!.values()].reduce((sum, weight) => sum + weight, 0) - 68) < 1e-9);
  assert.ok(Math.abs([...histograms[1]!.values()].reduce((sum, weight) => sum + weight, 0) - 14) < 1e-9);
  const step = 0.05;
  const tables = histograms.map((histogram) => Array.from({ length: 4001 }, (_, index) =>
    [...histogram].reduce((sum, [shift, count]) => sum + count * calculateWinProbability(-100 + index * step + shift), 0)));
  const lookup = (rating: number, table: number[]) => {
    assert.ok(rating > -100 && rating < 100);
    const position = (rating + 100) / step;
    const lower = Math.floor(position);
    return table[lower]! + (table[lower + 1]! - table[lower]!) * (position - lower);
  };
  const expected = (features: ReturnType<typeof rosterBalanceFeatures>, parameters: RosterBalanceParameters) => {
    const result = evaluateRosterFeatures(features, neutralContext, parameters);
    return lookup(result.deltaRating, tables[0]!) + lookup(result.deltaRating - 8 + 7 * result.synergy.sixthManFRF, tables[1]!);
  };
  type NumericParameter = Exclude<keyof RosterBalanceParameters, 'paceModel' | 'offenseModel' | 'coachShootingModel' | 'coachDefenseModel'>;
  const bounds: Record<NumericParameter, [number, number, number]> = {
    offenseBaseline: [86, 100, 1], offenseScale: [0.8, 1.8, 0.1], leadScorerWeight: [0, 0.8, 0.05],
    usageSlope: [0.002, 0.01, 0.001], spacingLow: [-8, 0, 1], spacingHigh: [3, 8, 1],
    defenseScale: [0.4, 1.1, 0.05], depthScale: [2, 7, 0.5], coachScale: [0.8, 1, 0.1],
    rolePenalty: [0, 0, 0],
  };
  const loss = (parameters: RosterBalanceParameters) => {
    const results = new Map(baseFeatures.map(({ roster, features }) => [roster.id, expected(features, parameters)]));
    let total = 0;
    let violation = 0;
    const numericalGuard = 0.0001;
    for (const { roster } of baseFeatures) {
      const wins = results.get(roster.id)!;
      const [low, high] = catalog.targets[roster.tier]!.expectedWins as [number, number];
      const miss = Math.max(0, low + 0.05 - wins, wins - high + 0.05);
      total += 100 * miss * miss + 0.001 * (wins - (low + high) / 2) ** 2;
      violation += Math.max(0, low + numericalGuard - wins, wins - high + numericalGuard) ** 2;
    }
    for (const { variant, features } of variantFeatures) {
      const delta = expected(features, parameters) - results.get(variant.parent)!;
      if (variant.id === 'V04') total += 400 * Math.max(0, 2.05 - delta, delta - 3.95) ** 2;
      if (['V01', 'V08'].includes(variant.id)) total += 400 * Math.max(0, -delta) ** 2;
      if (['V03', 'V07'].includes(variant.id)) total += 400 * Math.max(0, delta) ** 2;
      if (variant.id === 'V04') violation += Math.max(0, 2 + numericalGuard - delta, delta - 4 + numericalGuard) ** 2;
      if (['V01', 'V08'].includes(variant.id)) violation += Math.max(0, numericalGuard - delta) ** 2;
      if (['V03', 'V07'].includes(variant.id)) violation += Math.max(0, numericalGuard + delta) ** 2;
      if (variant.id === 'V06') violation += Math.max(0, Math.abs(delta) - 1e-10) ** 2;
    }
    if (violation === 0) {
      assert.ok(total < 100, 'Feasible preference score must rank ahead of infeasible scores.');
      return total;
    }
    return 100 + 1e6 * violation + 0.001 * total;
  };
  const initialRules: RosterBalanceParameters = { ...INITIAL_ROSTER_BALANCE, coachScale: 1, paceModel: 'relative-style', offenseModel: 'shared-creation', coachShootingModel: 'made-shots', coachDefenseModel: 'system', rolePenalty: 0 };
  let best = { ...initialRules };
  let bestLoss = loss(best);
  const starts = [initialRules,
    { ...initialRules, offenseScale: 1.6, offenseBaseline: 88, leadScorerWeight: 0.3 },
    { ...initialRules, usageSlope: 0.003, defenseScale: 0.7, spacingLow: -3 }];
  const warmStart = process.argv[4];
  if (warmStart) {
    const previous = JSON.parse(readFileSync(warmStart, 'utf8'));
    assert.equal(previous.scope, 'development-only');
    assert.equal(previous.catalogSha256, fingerprint('../../data/reference/mid-iq-roster-benchmarks.json'));
    assert.equal(previous.candidateImplementationSha256, fingerprint('./roster-balance.ts'));
    const parameters: RosterBalanceParameters = previous.fitted.parameters;
    assert.equal(parameters.paceModel, initialRules.paceModel);
    assert.equal(parameters.offenseModel, initialRules.offenseModel);
    assert.equal(parameters.coachShootingModel, initialRules.coachShootingModel);
    assert.equal(parameters.coachDefenseModel, initialRules.coachDefenseModel);
    for (const key of Object.keys(bounds) as NumericParameter[]) {
      const [minimum, maximum] = bounds[key];
      assert.ok(Number.isFinite(parameters[key]) && parameters[key]! >= minimum - 1e-10 && parameters[key]! <= maximum + 1e-10);
    }
    starts.push(parameters);
  }
  const traces = [];
  for (const initial of starts) {
    let parameters = { ...initial };
    let currentLoss = loss(parameters);
    for (const resolution of [1, 0.5, 0.2, 0.1, 0.05]) {
      for (let pass = 0; pass < 100; pass++) {
        let changed = false;
        for (const key of Object.keys(bounds) as NumericParameter[]) {
          const [minimum, maximum, increment] = bounds[key];
          for (const direction of [-1, 1]) {
            const candidate = { ...parameters, [key]: Math.max(minimum, Math.min(maximum, parameters[key]! + direction * increment * resolution)) };
            const candidateLoss = loss(candidate);
            if (candidateLoss < currentLoss - 1e-10) { parameters = candidate; currentLoss = candidateLoss; changed = true; }
          }
        }
        if (!changed) break;
      }
    }
    traces.push({ initial, parameters, loss: currentLoss });
    if (currentLoss < bestLoss) { best = parameters; bestLoss = currentLoss; }
  }
  const keys = Object.keys(bounds) as NumericParameter[];
  for (const resolution of [0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002]) {
    for (let pass = 0; pass < 500; pass++) {
      let next = best;
      let nextLoss = bestLoss;
      for (let first = 0; first < keys.length; first++) for (let second = first; second < keys.length; second++) {
        for (const firstDirection of [-1, 1]) for (const secondDirection of [-1, 1]) {
          const candidate = { ...best };
          for (const [key, direction] of [[keys[first]!, firstDirection], [keys[second]!, secondDirection]] as const) {
            const [minimum, maximum, increment] = bounds[key];
            candidate[key] = Math.max(minimum, Math.min(maximum, candidate[key]! + direction * increment * resolution));
          }
          const candidateLoss = loss(candidate);
          if (candidateLoss < nextLoss - 1e-10) { next = candidate; nextLoss = candidateLoss; }
        }
      }
      if (next === best) break;
      best = next;
      bestLoss = nextLoss;
    }
  }
  const directionSeed = 'mid-iq-roster-coupled-directions-1';
  const directionRandom = randomStream(directionSeed, 'fit-directions').next;
  const beforeCoupledLoss = bestLoss;
  let coupledEvaluations = 0;
  for (const resolution of [0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001]) {
    for (let pass = 0; pass < 80; pass++) {
      let next = best;
      let nextLoss = bestLoss;
      for (let probe = 0; probe < 256; probe++) {
        const candidate = { ...best };
        for (const key of keys) {
          const [minimum, maximum, increment] = bounds[key];
          candidate[key] = Math.max(minimum, Math.min(maximum,
            best[key]! + (2 * directionRandom() - 1) * increment * resolution));
        }
        const candidateLoss = loss(candidate);
        coupledEvaluations++;
        if (candidateLoss < nextLoss - 1e-10) { next = candidate; nextLoss = candidateLoss; }
      }
      if (next === best) break;
      best = next;
      bestLoss = nextLoss;
    }
  }
  assert.ok(bestLoss <= beforeCoupledLoss);
  const coupledSearch = { seed: directionSeed, evaluations: coupledEvaluations, beforeLoss: beforeCoupledLoss, afterLoss: bestLoss };
  console.log(JSON.stringify({ parameters: best, loss: bestLoss, coupledSearch }));
  return { parameters: best, loss: bestLoss, bounds, traces, warmStart, coupledSearch,
    warmStartSha256: warmStart ? createHash('sha256').update(readFileSync(warmStart)).digest('hex') : undefined,
    method: 'Full opponent-pool weighted expectation; feasibility first with 0.0001-win lookup guard, then the existing 0.05-win interior preference. Bounded single/pair search and seeded coupled probes; no validation cases or global-optimum claim.' };
}
function frozenFit() {
  const path = process.argv[4];
  assert.ok(path, 'Provide a frozen fit report.');
  const report = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(report.scope, 'development-only');
  assert.equal(report.catalogSha256, fingerprint('../../data/reference/mid-iq-roster-benchmarks.json'));
  assert.equal(report.candidateImplementationSha256, fingerprint('./roster-balance.ts'));
  assert.ok(mathMatchesFit(report.mathSha256), 'Math implementation changed after fitting.');
  assert.equal(report.opponentSha256, fingerprint('../../data/processed/opponents.json'));
  if (validating) {
    assert.equal(report.poolPassed, development.length, 'Development pool bands must all pass before validation.');
    assert.deepEqual(report.rosters.map((row: { id: string }) => row.id), development.map((roster) => roster.id));
    assert.ok(report.rosters.every((row: { poolInBand: boolean }) => row.poolInBand));
    assert.deepEqual(report.variants.map((row: { id: string }) => row.id), catalog.variants.map((variant) => variant.id));
    for (const variant of report.variants) {
      const delta = variant.poolExpectedWinDifference;
      assert.ok(Number.isFinite(delta));
      if (['V01', 'V08'].includes(variant.id)) assert.ok(delta > 0);
      if (['V03', 'V07'].includes(variant.id)) assert.ok(delta < 0);
      if (variant.id === 'V04') assert.ok(delta >= 2 && delta <= 4);
      if (variant.id === 'V06') assert.ok(Math.abs(delta) <= 1e-10);
    }
    const previousValidationPath = new URL('../../docs/MID_IQ_ROSTER_VALIDATION_1.json', import.meta.url);
    if (existsSync(previousValidationPath)) {
      const previous = JSON.parse(readFileSync(previousValidationPath, 'utf8'));
      assert.equal(previous.sourceFitSha256, createHash('sha256').update(readFileSync(path)).digest('hex'),
        'Reserved families already exposed. Only replay the original frozen fit; a new validation requires independent families.');
      assert.equal(previous.catalogSha256, report.catalogSha256);
    }
  }
  return report.fitted as ReturnType<typeof fit>;
}
const fitted = mode === 'fit' ? fit() : mode === 'audit' || mode === 'coach-audit' || mode === 'diagnose' || validating ? frozenFit() : undefined;
const evaluator: Evaluator = fitted ? (lineup, context) => evaluateRosterCandidate(lineup, context, fitted.parameters)
  : mode === 'spacing' ? spacingCandidate : mode === 'usage' ? usageCandidate : baseline;
if (mode === 'possession') {
  const auditPath = process.argv[4];
  assert.ok(auditPath, 'Provide a frozen possession input audit.');
  const auditBytes = readFileSync(auditPath);
  const audit = JSON.parse(auditBytes.toString('utf8'));
  assert.equal(audit.version, 'mid-iq-possession-input-audit-1');
  assert.equal(audit.scope, 'offline-data-audit');
  for (const path of ['data/raw/Player Per Game.csv', 'data/raw/Advanced.csv', 'data/processed/players.json',
    'data/reference/mid-iq-roster-benchmarks.json', 'scripts/data_pipeline/process_players.py',
    'scripts/data_pipeline/franchise_map.py', 'scripts/data_pipeline/curated_defense.py']) {
    assert.equal(audit.sourceSha256[path], fingerprint(`../../${path}`), `Stale possession audit source: ${path}`);
  }
  assert.equal(audit.auditImplementationSha256, fingerprint('../../scripts/data_pipeline/audit_possessions.py'));
  const entries: { id: string; peakYears: number[]; ready: boolean;
    aggregate: { per36: Record<string, number | null> } | null }[] = audit.players;
  assert.deepEqual(entries.map((entry) => entry.id).sort(), players.map((player) => player.id).sort());
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const player of players) assert.deepEqual(byId.get(player.id)!.peakYears, player.peakYears);
  const rows = catalog.rosters.map((roster) => {
    const unsupportedIds = roster.players.filter((id) => !byId.get(id)!.ready);
    if (unsupportedIds.length) return { id: roster.id, status: 'unsupported-data', unsupportedIds };
    const inputs: PossessionInput[] = roster.players.slice(0, 5).map((id) => {
      const per36 = byId.get(id)!.aggregate!.per36;
      return { id, points: per36.points!, fieldGoalAttempts: per36.fieldGoalAttempts!,
        freeThrowAttempts: per36.freeThrowAttempts!, turnovers: per36.turnovers! };
    });
    const observedDemand = evaluatePossessionBudget(inputs);
    const equalShares = evaluatePossessionBudget(inputs, [0.2, 0.2, 0.2, 0.2, 0.2]);
    for (const result of [observedDemand, equalShares]) assert.ok(Math.abs(result.shotEnds + result.turnoverEnds - 100) < 1e-10);
    return { id: roster.id, status: 'accounting-only', inputs, observedDemand, equalShares };
  });
  writeFileSync(output, `${JSON.stringify({ version: 'mid-iq-possession-prototype-1', scope: 'exposed-offensive-accounting',
    sourceAudit: auditPath, sourceAuditSha256: createHash('sha256').update(auditBytes).digest('hex'),
    implementationSha256: fingerprint('./possession-prototype.ts'), evaluatorSha256: fingerprint('./calibrate-rosters.ts'),
    sourceSha256: audit.sourceSha256, supportedPlayers: audit.readyPlayers, totalPlayers: entries.length,
    supportedRosters: rows.filter((row) => row.status === 'accounting-only').length, rows,
    method: 'A fixed 100 used-event budget (FGA + 0.44 FTA + TOV). Default shares follow observed pooled per36 demand; equal shares are an unfitted sensitivity comparison.',
    limitations: ['Not ORTG or true possessions: offensive rebounds, opponent effects and exact free-throw sequences are not represented.',
      'Five-starter equal-time accounting only. Reserve, fatigue, defense, coach, spacing and assist redistribution are not implemented.',
      'No era-efficiency normalization, load-efficiency tradeoff, win estimates, fitting, band acceptance or independent validation.',
      'Higher shot volume alone can lower output when it reallocates demand to a less efficient scorer. This is not a complete talent-value model.',
      'Any missing required peak field blocks the entire roster; no partial-season fallback or zero-filled historical turnovers.'],
  }, null, 2)}\n`, { flag: 'wx' });
  console.table(rows.map((row) => ({ id: row.id, status: row.status,
    pointsPer100UsedEnds: row.observedDemand?.pointsPer100UsedEnds.toFixed(3),
    equalSharePoints: row.equalShares?.pointsPer100UsedEnds.toFixed(3),
    turnoverEnds: row.observedDemand?.turnoverEnds.toFixed(3), unsupported: row.unsupportedIds?.join(', ') })));
  process.exit(0);
}
if (mode === 'diagnose') {
  const validationPath = '../../docs/MID_IQ_ROSTER_VALIDATION_1.json';
  const validation = load(validationPath);
  const sourceFitSha256 = createHash('sha256').update(readFileSync(process.argv[4]!)).digest('hex');
  assert.equal(validation.scope, 'reserved-family-validation');
  assert.equal(validation.sourceFitSha256, sourceFitSha256, 'Diagnosis requires the original exposed fit.');
  const sourceFit = JSON.parse(readFileSync(process.argv[4]!, 'utf8'));
  for (const key of ['catalogSha256', 'candidateImplementationSha256', 'mathSha256', 'opponentSha256']) {
    assert.equal(validation[key], sourceFit[key]);
  }
  const parameters = fitted!.parameters;
  assert.equal(parameters.offenseModel, 'shared-creation');
  assert.equal(parameters.coachShootingModel, 'made-shots');
  assert.equal(parameters.coachDefenseModel, 'system');
  assert.equal(parameters.rolePenalty, 0);
  const recorded: { id: string; poolExpectedWins: number; neutral: GameEvaluation }[] = [...sourceFit.rosters, ...validation.rosters];
  assert.deepEqual(recorded.map((row) => row.id).sort(), catalog.rosters.map((row) => row.id).sort());
  const rows = catalog.rosters.map((roster) => {
    const lineup = lineupFor(roster);
    const features = rosterBalanceFeatures(lineup);
    const neutral = evaluator(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false });
    const previous = recorded.find((row) => row.id === roster.id)!;
    assert.deepEqual(JSON.parse(JSON.stringify(neutral)), previous.neutral);
    const expectedAtShift = (shift: number) => {
      let wins = 0;
      for (const [tier, count] of Object.entries(SCHEDULE_COUNTS)) {
        const opponents = pool[tier as keyof OpponentPool];
        for (const opponent of opponents) for (const home of [0, 3]) {
          const rating = neutral.deltaRating + shift - opponent.netRating + home;
          wins += count / opponents.length / 2 * (68 * calculateWinProbability(rating)
            + 14 * calculateWinProbability(rating - 8 + 7 * neutral.synergy.sixthManFRF)) / 82;
        }
      }
      return wins;
    };
    const expectedWins = expectedAtShift(0);
    assert.ok(Math.abs(expectedWins - previous.poolExpectedWins) < 1e-10);
    const target = catalog.targets[roster.tier]!.expectedWins;
    const shiftForWins = (wins: number) => {
      let low = -200;
      let high = 200;
      assert.ok(expectedAtShift(low) < wins && expectedAtShift(high) > wins);
      for (let iteration = 0; iteration < 60; iteration++) {
        const middle = (low + high) / 2;
        if (expectedAtShift(middle) < wins) low = middle;
        else high = middle;
      }
      const shift = (low + high) / 2;
      assert.ok(Math.abs(expectedAtShift(shift) - wins) < 1e-10);
      return shift;
    };
    const requiredRatingShift = target.map(shiftForWins);
    const shooting = features.coachThreePointGain * parameters.coachScale;
    const offense = neutral.synergy.ortgTeam - parameters.offenseBaseline - shooting;
    const creation = features.sharedCreation * parameters.offenseScale;
    const rosterDefense = (110 - features.uncoached.synergy.drtgTeam) * parameters.defenseScale;
    const components = {
      baseline: parameters.offenseBaseline - 110,
      scoring: offense - creation,
      creation,
      usageLoss: offense * (neutral.synergy.phiUsg - 1),
      shootingCoach: shooting,
      spacing: neutral.synergy.effectiveOrtg - parameters.offenseBaseline - offense * neutral.synergy.phiUsg - shooting,
      rosterDefense,
      defensiveCoach: 110 - neutral.synergy.drtgTeam - rosterDefense,
      reserve: neutral.synergy.depthBonus,
      paceCoach: neutral.coachPaceModifier,
    };
    assert.ok(Math.abs(Object.values(components).reduce((sum, value) => sum + value, 0) - neutral.deltaRating) < 1e-10);
    const removeTerm = Object.entries(components).filter(([name]) => name !== 'baseline').map(([name, value]) => ({
      name, ratingShift: -value, expectedWins: expectedAtShift(-value), winDifference: expectedAtShift(-value) - expectedWins,
    }));
    const uncompressedDefenseShift = (110 - features.uncoached.synergy.drtgTeam) - rosterDefense;
    const noLead = evaluateRosterFeatures(features, { opponentNetRating: 0, isHome: false, isBackToBack: false },
      { ...parameters, leadScorerWeight: 0 });
    const counterfactual = (ratingShift: number) => ({ ratingShift, expectedWins: expectedAtShift(ratingShift) });
    return { id: roster.id, family: catalog.families[roster.family], target, expectedWins, requiredRatingShift,
      nearestBandRatingShift: expectedWins < target[0]! ? requiredRatingShift[0] : expectedWins > target[1]! ? requiredRatingShift[1] : 0,
      neutral, components, removeTerm,
      uncompressedRosterDefense: counterfactual(uncompressedDefenseShift),
      coreOnlyScoring: counterfactual(noLead.deltaRating - neutral.deltaRating),
      starterInputs: DRAFT_SLOTS.slice(0, 5).map((slot) => {
        const player = lineup[slot]!;
        const stats = normalizeStats(player.stats);
        return { slot, id: player.id, points: stats.pts, fgPct: stats.fgPct, scoringProduct: stats.pts * stats.fgPct,
          assists: stats.ast, dbpm: stats.dbpm, blocks: stats.blk, steals: stats.stl, rebounds: stats.reb,
          rawThreePointAttempts: player.stats.threePtAttempts, threePtPct: stats.threePtPct };
      }),
    };
  });
  writeFileSync(output, `${JSON.stringify({ version: 'mid-iq-roster-diagnosis-1', scope: 'exposed-family-diagnosis',
    sourceFit: process.argv[4], sourceFitSha256, validationSha256: fingerprint(validationPath),
    candidateImplementationSha256: fingerprint('./roster-balance.ts'), evaluatorSha256: fingerprint('./calibrate-rosters.ts'),
    catalogSha256: sourceFit.catalogSha256, mathSha256: sourceFit.mathSha256, opponentSha256: sourceFit.opponentSha256,
    parameters, rows, limitations: ['All 24 families were previously measured. This is not fresh validation or parameter selection.',
      'Additive rating terms reconcile exactly; isolated win changes are nonlinear and must not be summed.',
      'Term removal holds other terms and reserve fatigue fixed; it is not a legal player substitution or historical causal estimate.',
      'Defense scale one and lead weight zero are diagnostic ablations, not calibrated alternatives or release candidates.'],
  }, null, 2)}\n`, { flag: 'wx' });
  console.table(rows.map((row) => ({ id: row.id, expected: row.expectedWins.toFixed(2),
    gap: row.nearestBandRatingShift!.toFixed(3), scoring: row.components.scoring.toFixed(2),
    creation: row.components.creation.toFixed(2), spacing: row.components.spacing.toFixed(2),
    defense: row.components.rosterDefense.toFixed(2), rawDefenseWins: row.uncompressedRosterDefense.expectedWins.toFixed(2) })));
  process.exit(0);
}
if (mode === 'coach-audit') {
  const context = { opponentNetRating: 0, isHome: false, isBackToBack: false };
  const rows = development.map((roster) => {
    const lineup = { ...lineupFor(roster), coach: null };
    const uncoached = evaluator(lineup, context);
    const probes: Coach['modifiers'] = [{ stat: 'fgPct', delta: 0.03 }, { stat: 'threePtPct', delta: 0.03 },
      { stat: 'dbpm', delta: 0.3 }, { stat: 'usgCap', delta: 3 }, { stat: 'pace', delta: 1 }, { stat: 'pace', delta: -1 }];
    const effects = probes.map((modifier) => {
      const coached = evaluator({ ...lineup, coach: { id: 'probe', name: 'Probe', systemName: 'Probe', modifiers: [modifier] } }, context);
      return { ...modifier, ratingGain: coached.deltaRating - uncoached.deltaRating,
        offenseGain: coached.synergy.effectiveOrtg - uncoached.synergy.effectiveOrtg,
        defenseGain: uncoached.synergy.drtgTeam - coached.synergy.drtgTeam,
        reserveGain: coached.synergy.depthBonus - uncoached.synergy.depthBonus };
    });
    return { id: roster.id, uncoached, effects };
  });
  writeFileSync(output, `${JSON.stringify({ version: 'mid-iq-coach-unit-audit-1', scope: 'development-only',
    sourceFit: process.argv[4], sourceFitSha256: createHash('sha256').update(readFileSync(process.argv[4]!)).digest('hex'),
    candidateImplementationSha256: fingerprint('./roster-balance.ts'), evaluatorSha256: fingerprint('./calibrate-rosters.ts'),
    parameters: fitted!.parameters, rows,
    limitations: ['Isolated modifier probes at neutral context, not fitted parameters or additive attribution of full coaches.',
      'Different stat doses are explicitly recorded; equal percentages are not claims of equal coaching value.',
      'No validation-family performance or human behavior measured.'] }, null, 2)}\n`, { flag: 'wx' });
  console.table(rows.map((row) => ({ id: row.id, ...Object.fromEntries(row.effects.map((effect) =>
    [`${effect.stat} ${effect.delta}`, effect.ratingGain.toFixed(3)])) })));
  process.exit(0);
}
const evaluationRosters = validating ? catalog.rosters.filter((roster) => catalog.families[roster.family] === 'validation') : development;
if (validating) assert.equal(evaluationRosters.length, 9);
const rosters = evaluationRosters.map((roster) => {
  const result = measure(lineupFor(roster), evaluator);
  const target = catalog.targets[roster.tier]!.expectedWins;
  return { id: roster.id, target, ...result, inBand: result.expectedWins >= target[0]! && result.expectedWins <= target[1]!,
    poolInBand: result.poolExpectedWins >= target[0]! && result.poolExpectedWins <= target[1]! };
});
const variants = catalog.variants.filter((variant) => !validating && development.some((roster) => roster.id === variant.parent)).map((variant) => {
  const lineup = variantLineup(variant);
  const result = measure(lineup, evaluator);
  return { id: variant.id, parent: variant.parent, ...result,
    expectedWinDifference: result.expectedWins - rosters.find((roster) => roster.id === variant.parent)!.expectedWins,
    poolExpectedWinDifference: result.poolExpectedWins - rosters.find((roster) => roster.id === variant.parent)!.poolExpectedWins };
});
const report = {
  version: `mid-iq-rosters-${mode}-1`, scope: validating ? 'reserved-family-validation' : 'development-only', balance: BALANCE_RULES_V2, experiment: mode,
  sourceFit: validating ? process.argv[4] : undefined,
  sourceFitSha256: validating ? createHash('sha256').update(readFileSync(process.argv[4]!)).digest('hex') : undefined,
  validationVerdict: validating ? rosters.every((row) => row.poolInBand) ? 'PASS' : 'FAIL' : undefined,
  fitted, candidateImplementationSha256: fingerprint('./roster-balance.ts'),
  catalogVersion: catalog.version, catalogSha256: fingerprint('../../data/reference/mid-iq-roster-benchmarks.json'),
  evaluatorSha256: fingerprint('./calibrate-rosters.ts'), mathSha256: fingerprint('./math.ts'),
  opponentSha256: fingerprint('../../data/processed/opponents.json'), seedPrefix, schedules: schedules.length,
  method: `Full-pool expected wins determine band acceptance; exact conditional Bernoulli distributions mixed over ${schedules.length} seeded schedules describe season variation. Standard error measures schedule sampling only, not model uncertainty.`,
  rosters, variants, passed: rosters.filter((roster) => roster.inBand).length, poolPassed: rosters.filter((roster) => roster.poolInBand).length,
  limitations: [validating ? 'These nine families are now exposed; retuning on them is not independent validation.' : 'Development cases only; prior reserved-family exposure is documented separately.', 'Not observed human draft or playoff/title outcomes.'],
};
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.table(rosters.map((row) => ({ id: row.id, target: row.target.join('-'), expected: row.expectedWins.toFixed(2), poolExpected: row.poolExpectedWins.toFixed(2), qualified: row.qualificationProbability.toFixed(3), samplePass: row.inBand, poolPass: row.poolInBand })));
console.table(variants.map((row) => ({ id: row.id, delta: row.expectedWinDifference.toFixed(3), poolDelta: row.poolExpectedWinDifference.toFixed(3) })));
if (report.validationVerdict === 'FAIL') process.exitCode = 1;