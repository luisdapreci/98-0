import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { BALANCE_RULES_V1, BALANCE_RULES_V2, calculateDefensiveComposite, calculateOffensiveContribution, calculateWinProbability, evaluateGame, STARTER_POSITIONS } from './math.ts';
import { availablePlayers, availableSlots } from './draft.ts';
import { chooseLookaheadAction, projectedChemistry } from './draft-strategy.ts';
import { applyDraftAction, createRun, recoverRun } from './run.ts';
import { randomStream } from './random.ts';
import { generateSchedule } from './season.ts';
import type { Coach, OpponentPool, Player, TeamLineup } from './types.ts';

const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const players = new Map<string, Player>(load('../../data/processed/players.json').map((player: Player) => [player.id, player]));
const coaches = new Map<string, Coach>(load('../../data/processed/coaches.json').map((coach: Coach) => [coach.id, coach]));
const pool: OpponentPool = load('../../data/processed/opponents.json').regularSeasonPool;
const slots = [...STARTER_POSITIONS, 'SIXTH'] as const;
interface Observation { seed: string; coach: string; lineup: string[]; scheduleExpectedWins?: number }
const reference: Observation = {
  seed: '50b9c2a6-c5c3-4bf3-8497-db022533d443', coach: 'gregg_popovich',
  lineup: ['brunsja01_NYK_2020s', 'tuckepj01_TOR_2010s', 'brookdi01_MEM_2010s',
    'duncati01_SAS_2000s', 'townska01_NYK_2020s', 'thompla01_IND_1990s'],
  scheduleExpectedWins: 53.93620965736469,
};
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const median = (values: number[]) => {
  const ordered = [...values].sort((first, second) => first - second);
  return (ordered[Math.floor((ordered.length - 1) / 2)]! + ordered[Math.ceil((ordered.length - 1) / 2)]!) / 2;
};

function prepare(observation: Observation) {
  const lineup = Object.fromEntries(slots.map((slot, index) => [slot, players.get(observation.lineup[index]!)!])) as unknown as TeamLineup;
  lineup.coach = coaches.get(observation.coach)!;
  assert.ok(slots.every((slot) => lineup[slot]));
  assert.ok(lineup.coach);
  const fgDelta = lineup.coach.modifiers.filter((modifier) => modifier.stat === 'fgPct')
    .reduce((total, modifier) => total + modifier.delta, 0);
  const offense = STARTER_POSITIONS.map((slot) => {
    const stats = lineup[slot]!.stats;
    return calculateOffensiveContribution({ ...stats, fgPct: Math.min(1, Math.max(0, stats.fgPct + fgDelta)) });
  }).sort((first, second) => second - first);
  const games = generateSchedule(observation.seed, pool).map((game) => evaluateGame(lineup, {
    opponentNetRating: game.opponent.netRating, isHome: game.isHome, isBackToBack: game.isBackToBack,
  }));
  const baseline = games.reduce((total, game) => total + game.winProbability, 0);
  if (observation.scheduleExpectedWins !== undefined)
    assert.ok(Math.abs(baseline - observation.scheduleExpectedWins) < 1e-8);
  const synergy = games[0]!.synergy;
  const candidate = evaluateGame(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false }, BALANCE_RULES_V2);
  const original = evaluateGame(lineup, { opponentNetRating: 0, isHome: false, isBackToBack: false });
  assert.ok(Math.abs(candidate.deltaRating - original.deltaRating
    - (mean(offense.slice(0, 3)) - mean(offense)) * synergy.phiUsg * (1 + synergy.spacingModifier) * 0.8) < 1e-10);
  return { games, delta: (mean(offense.slice(0, 3)) - mean(offense)) * synergy.phiUsg * (1 + synergy.spacingModifier) };
}

function evaluate(prepared: ReturnType<typeof prepare>, weight: number) {
  const probabilities = prepared.games.map((game) => calculateWinProbability(game.deltaRating + prepared.delta * weight));
  const distribution = Array<number>(83).fill(0);
  distribution[0] = 1;
  for (const probability of probabilities) {
    for (let wins = 82; wins >= 0; wins--)
      distribution[wins] = distribution[wins]! * (1 - probability) + (wins ? distribution[wins - 1]! * probability : 0);
  }
  return { expectedWins: probabilities.reduce((total, probability) => total + probability, 0),
    qualificationProbability: distribution.slice(60).reduce((total, probability) => total + probability, 0) };
}

function redraft() {
  const playerList = [...players.values()];
  const coachList = [...coaches.values()];
  const seedPrefix = 'mid-iq-core-validation-1-';
  const results = [];
  for (const rules of [BALANCE_RULES_V1, BALANCE_RULES_V2]) {
    for (const policy of ['random', 'chemistry', 'ovr-first', 'overloaded', 'non-shooting', 'defensive', 'lookahead']) {
      const count = policy === 'lookahead' ? 20 : 100;
      const observations = [];
      for (let index = 0; index < count; index++) {
        const seed = `${seedPrefix}${index}`;
        let run = createRun(seed, coachList);
        const decisions = randomStream(seed, `core-policy-1/${policy}`).next;
        while (run.phase === 'DRAFTING') {
          if (policy === 'lookahead') {
            run = applyDraftAction(run, chooseLookaheadAction(run.draft, playerList, pool, rules), playerList);
          } else if (run.draft.phase === 'COACH') {
            const coach = run.draft.offers[Math.floor(decisions() * run.draft.offers.length)]!;
            run = applyDraftAction(run, { type: 'COACH', id: coach.id }, playerList);
          } else if (!run.draft.roll) {
            run = applyDraftAction(run, { type: 'SPIN' }, playerList);
          } else {
            const options = availablePlayers(run.draft, playerList).flatMap((player) =>
              availableSlots(run.draft.lineup, player).map((slot) => {
                const fit = projectedChemistry({ ...run.draft.lineup, [slot]: player }, rules);
                let value = fit;
                if (policy === 'ovr-first') value = player.overallRating;
                if (policy === 'overloaded') value = player.stats.usgPct + player.overallRating * 0.1;
                if (policy === 'non-shooting') value = player.overallRating * 0.1 - player.stats.threePtAttempts * player.stats.threePtPct * 10;
                if (policy === 'defensive') value = calculateDefensiveComposite(player.stats) + fit * 0.05;
                return { player, slot, value };
              })).sort((first, second) => second.value - first.value
                || first.player.id.localeCompare(second.player.id) || slots.indexOf(first.slot) - slots.indexOf(second.slot));
            const pick = policy === 'random' ? options[Math.floor(decisions() * options.length)]! : options[0]!;
            run = applyDraftAction(run, { type: 'PICK', id: pick.player.id, slot: pick.slot }, playerList);
          }
        }
        assert.deepEqual(recoverRun({ run }, { players: playerList, coaches: coachList, opponents: pool }, 'unused').run, run);
        const observation = { seed, coach: run.draft.lineup.coach!.id, lineup: slots.map((slot) => run.draft.lineup[slot]!.id) };
        const prepared = prepare(observation);
        const wins = prepared.games.filter((game, gameIndex) => randomStream(seed, `outcome/${gameIndex + 1}`).next()
          < calculateWinProbability(game.deltaRating + prepared.delta * rules.coreOffenseWeight)).length;
        observations.push({ ...observation, ...evaluate(prepared, rules.coreOffenseWeight), wins, actions: run.actions });
        if (policy === 'lookahead' && (index + 1) % 5 === 0) console.log(`${rules.version} lookahead ${index + 1}/${count}`);
      }
      const result = { balanceVersion: rules.version, policy, count,
        medianWins: median(observations.map((row) => row.wins)),
        qualified: observations.filter((row) => row.wins >= 60).length / count,
        medianExpectedWins: median(observations.map((row) => row.expectedWins)),
        meanQualificationProbability: mean(observations.map((row) => row.qualificationProbability)), observations };
      console.log(JSON.stringify({ ...result, observations: undefined }));
      results.push(result);
    }
  }
  return { version: 'mid-iq-core-redraft-1', seedPrefix, rules: BALANCE_RULES_V2,
    reference: evaluate(prepare(reference), BALANCE_RULES_V2.coreOffenseWeight), results,
    limitations: ['Lookahead has only 20 seeds per version; no population-rate guarantee.',
      'OVR-first selects random offered coaches, no rerolls; it is not measured human behavior.',
      'No playoff or title frequency validation.'] };
}

if (process.argv[3] === 'redraft') {
  assert.ok(process.argv[2], 'A new output path is required.');
  const report = redraft();
  writeFileSync(process.argv[2], `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  process.exit(0);
}

const retained: { strategyResults: Record<string, { observations: Observation[] }> } = load('../../docs/PHASE3_REVIEW.json');
const prepared = Object.fromEntries(Object.entries(retained.strategyResults)
  .map(([policy, result]) => [policy, result.observations.map(prepare)]));
const referencePrepared = prepare(reference);
const candidates = [0, 0.8].map((weight) => {
  const result = { weight, reference: evaluate(referencePrepared, weight),
    policies: Object.fromEntries(Object.entries(prepared).map(([policy, rosters]) => {
      const results = rosters.map((roster) => evaluate(roster, weight));
      return [policy, { medianExpectedWins: median(results.map((row) => row.expectedWins)),
        meanQualificationProbability: mean(results.map((row) => row.qualificationProbability)) }];
    })) };
  console.log(JSON.stringify(result));
  return result;
});
const report = {
  version: 'mid-iq-offense-experiment-1', status: 'offline-development-only',
  formula: 'ORTG = 95 + (1 - weight) * mean(all five OC) + weight * mean(top three OC)',
  reference, candidates,
  limitations: ['Exposed retained rosters and schedules; not fresh validation.',
    'Fixed-roster evaluation; policies have not redrafted for the candidate.',
    'Qualification probabilities are exact conditional Bernoulli sums, not observed rates.'],
};
if (process.argv[2]) writeFileSync(process.argv[2], `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });