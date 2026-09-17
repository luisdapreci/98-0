import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DRAFT_SLOTS, playerIdentity } from './draft.ts';
import { chooseLookaheadAction, expectedSeasonWins } from './draft-strategy.ts';
import { evaluateGame } from './math.ts';
import { applyDraftAction, createRun, recoverRun } from './run.ts';
import type { RunData } from './run.ts';
import { generateSchedule, requireCompleteLineup } from './season.ts';
import { parseResearchJson } from './research-files.ts';

test('research document migration translates references without changing frozen JSON', () => {
  const text = '{"source":"docs/MID_IQ_ROLE_ALLOCATION_1.json","sourceSha256":{"docs/MID_IQ_ROLE_ALLOCATION_1.json":"invalid"},"values":[null,3,false]}';
  const original = JSON.parse(text);
  const relocated = parseResearchJson(text);
  assert.equal(relocated.source, 'docs/research/mid-iq/MID_IQ_ROLE_ALLOCATION_1.json');
  assert.deepEqual(relocated.sourceSha256, { 'docs/research/mid-iq/MID_IQ_ROLE_ALLOCATION_1.json': 'invalid' });
  assert.deepEqual(relocated.values, [null, 3, false]);
  assert.equal(original.source, 'docs/MID_IQ_ROLE_ALLOCATION_1.json');
  assert.equal(JSON.stringify(original), text);
  assert.throws(() => parseResearchJson('{'), SyntaxError);
});

test('research migration preserves frozen bytes and verifies exact source revisions', () => {
  const migration: {
    paths: Record<string, string>; frozenArtifacts: Record<string, string>;
    sourceFiles: Record<string, string>; sourceRevisions: Record<string, string>;
  } = JSON.parse(readFileSync(new URL('../../docs/research/path-migration.json', import.meta.url), 'utf8'));
  const fingerprint = (path: string) => createHash('sha256')
    .update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest('hex');
  for (const [before, after] of Object.entries(migration.paths)) {
    assert.equal(existsSync(new URL(`../../${before}`, import.meta.url)), false, before);
    assert.ok(existsSync(new URL(`../../${after}`, import.meta.url)), after);
  }
  for (const [path, expected] of Object.entries(migration.frozenArtifacts)) assert.equal(fingerprint(path), expected, path);
  assert.equal(Object.keys(migration.sourceFiles).length, Object.keys(migration.sourceRevisions).length);
  for (const [path, original] of Object.entries(migration.sourceFiles)) {
    const current = migration.sourceRevisions[original];
    assert.equal(fingerprint(path), current, path);
    assert.deepEqual(parseResearchJson(JSON.stringify({ source: original, tampered: 'invalid' })),
      { source: current, tampered: 'invalid' });
  }
});

const data: RunData = {
  players: parseResearchJson(readFileSync(new URL('../../data/processed/players.json', import.meta.url), 'utf8')),
  coaches: parseResearchJson(readFileSync(new URL('../../data/processed/coaches.json', import.meta.url), 'utf8')),
  opponents: parseResearchJson(readFileSync(new URL('../../data/processed/opponents.json', import.meta.url), 'utf8')).regularSeasonPool,
};

test('lookahead completes legal drafts using only public observations and independent hypothetical draws', () => {
  for (const seed of ['strategy-test-0', 'strategy-test-1']) {
    let run = createRun(seed, data.coaches);
    for (let step = 0; run.phase === 'DRAFTING'; step++) {
      assert.ok(step < 15);
      const before = structuredClone(run);
      const action = chooseLookaheadAction(run.draft, data.players, data.opponents);
      assert.deepEqual(run, before);
      if (step === 0 || step === 2) {
        const changed = { ...run, seed: 'hidden-other', draftRandomState: 123, id: 'different-id' };
        assert.deepEqual(action, chooseLookaheadAction(changed.draft, data.players, data.opponents));
      }
      run = applyDraftAction(run, action, data.players);
      assert.notDeepEqual(run, before);
    }
    requireCompleteLineup(run.draft.lineup);
    assert.equal(new Set(DRAFT_SLOTS.map((slot) => playerIdentity(run.draft.lineup[slot]!))).size, 6);
    assert.equal(recoverRun({ run }, data, 'unused').notice, null);
    const expected = expectedSeasonWins(run.draft.lineup, data.opponents);
    let scheduleMean = 0;
    for (let index = 0; index < 500; index++) {
      const schedule = generateSchedule(`expectation-${index}`, data.opponents);
      scheduleMean += schedule.reduce((total, game) => total + evaluateGame(run.draft.lineup, {
        opponentNetRating: game.opponent.netRating, isHome: game.isHome, isBackToBack: game.isBackToBack,
      }).winProbability, 0) / 500;
    }
    assert.ok(Math.abs(expected - scheduleMean) < 0.15);
    assert.ok(expected >= 0 && expected <= 82);
    assert.throws(() => chooseLookaheadAction(run.draft, data.players, data.opponents), /complete/);
  }
});

test('lookahead does not suggest unavailable rerolls or spend simulation randomness for an unopened roll', () => {
  const run = createRun('no-roll', data.coaches);
  const chosen = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  assert.deepEqual(chooseLookaheadAction(chosen.draft, data.players, data.opponents), { type: 'SPIN' });
  assert.throws(() => expectedSeasonWins(run.draft.lineup, data.opponents), /lineup/);
});

test('offline policy and access controls preserve pairing, legal menus, probability ordering and report immutability', () => {
  const directory = mkdtempSync(join(tmpdir(), '98-0-policy-test-'));
  const script = fileURLToPath(new URL('./calibrate-rosters.ts', import.meta.url));
  const fixture = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json', import.meta.url), 'utf8'));
  for (const [key, path] of Object.entries({ candidateImplementationSha256: './roster-balance.ts',
    mathSha256: './math.ts', opponentSha256: '../../data/processed/opponents.json' })) {
    fixture[key] = createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
  }
  const fitPath = join(directory, 'fixture.json');
  writeFileSync(fitPath, JSON.stringify(fixture));
  const run = (mode: string, output: string) => spawnSync(process.execPath,
    ['--experimental-strip-types', script, output, mode, fitPath, 'policy-regression-', '2'], { encoding: 'utf8' });
  try {
    const blockedPath = join(directory, 'blocked-validation.json');
    const blocked = run('validate', blockedPath);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /Development pool bands must all pass/);
    assert.equal(existsSync(blockedPath), false);
    const alteredFit = parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ROSTER_FIT_18.json', import.meta.url), 'utf8'));
    alteredFit.candidateImplementationSha256 = fixture.candidateImplementationSha256;
    alteredFit.provenanceProbe = true;
    writeFileSync(fitPath, JSON.stringify(alteredFit));
    const exposed = run('validate', blockedPath);
    assert.notEqual(exposed.status, 0);
    assert.match(exposed.stderr, /Reserved families already exposed/);
    assert.equal(existsSync(blockedPath), false);
    const blockedDiagnosis = run('diagnose', blockedPath);
    assert.notEqual(blockedDiagnosis.status, 0);
    assert.match(blockedDiagnosis.stderr, /Diagnosis requires the original exposed fit/);
    assert.equal(existsSync(blockedPath), false);
    writeFileSync(fitPath, readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ROSTER_FIT_18.json', import.meta.url)));
    const diagnosisPath = join(directory, 'diagnosis.json');
    const diagnosis = run('diagnose', diagnosisPath);
    assert.equal(diagnosis.status, 0, diagnosis.stderr);
    const diagnosisText = readFileSync(diagnosisPath, 'utf8');
    const diagnosticReport = parseResearchJson(diagnosisText);
    assert.equal(diagnosticReport.scope, 'exposed-family-diagnosis');
    assert.equal(diagnosticReport.rows.length, 24);
    for (const row of diagnosticReport.rows) {
      const total = (Object.values(row.components) as number[]).reduce((sum, value) => sum + value, 0);
      assert.ok(Math.abs(total - row.neutral.deltaRating) < 1e-10);
      assert.ok(row.requiredRatingShift[0] < row.requiredRatingShift[1]);
      for (const removal of row.removeTerm) {
        assert.ok(removal.expectedWins >= 0 && removal.expectedWins <= 82);
        assert.ok(Math.abs(removal.expectedWins - row.expectedWins - removal.winDifference) < 1e-10);
      }
    }
    assert.match(run('diagnose', diagnosisPath).stderr, /Refusing to overwrite/);
    assert.equal(readFileSync(diagnosisPath, 'utf8'), diagnosisText);
    const possessionPath = join(directory, 'possession.json');
    const auditPath = fileURLToPath(new URL('../../docs/research/mid-iq/MID_IQ_POSSESSION_INPUT_AUDIT_1.json', import.meta.url));
    const runPossession = (input: string) => spawnSync(process.execPath,
      ['--experimental-strip-types', script, possessionPath, 'possession', input], { encoding: 'utf8' });
    const badAudit = parseResearchJson(readFileSync(auditPath, 'utf8'));
    badAudit.sourceSha256['data/processed/players.json'] = 'invalid';
    const badAuditPath = join(directory, 'bad-audit.json');
    writeFileSync(badAuditPath, JSON.stringify(badAudit));
    const stale = runPossession(badAuditPath);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale possession audit source/);
    assert.equal(existsSync(possessionPath), false);
    const possession = runPossession(auditPath);
    assert.equal(possession.status, 0, possession.stderr);
    const possessionText = readFileSync(possessionPath, 'utf8');
    const possessionReport = parseResearchJson(possessionText);
    assert.equal(possessionReport.scope, 'exposed-offensive-accounting');
    assert.equal(possessionReport.supportedRosters, 22);
    assert.deepEqual(possessionReport.rows.filter((row: { status: string }) => row.status === 'unsupported-data')
      .map((row: { id: string }) => row.id), ['E05', 'F06']);
    for (const row of possessionReport.rows.filter((row: { status: string }) => row.status === 'accounting-only')) {
      for (const result of [row.observedDemand, row.equalShares]) {
        assert.ok(Math.abs(result.shotEnds + result.turnoverEnds - 100) < 1e-10);
        assert.ok(Number.isFinite(result.pointsPer100UsedEnds));
      }
      assert.equal('expectedWins' in row, false);
    }
    assert.match(runPossession(auditPath).stderr, /Refusing to overwrite/);
    assert.equal(readFileSync(possessionPath, 'utf8'), possessionText);
    const lineupPath = join(directory, 'lineup.json');
    const lineupScript = fileURLToPath(new URL('./calibrate-lineups.ts', import.meta.url));
    const runLineup = () => spawnSync(process.execPath, ['--experimental-strip-types', lineupScript, lineupPath], { encoding: 'utf8' });
    const lineupExecution = runLineup();
    assert.equal(lineupExecution.status, 0, lineupExecution.stderr);
    const lineupText = readFileSync(lineupPath, 'utf8');
    assert.deepEqual(parseResearchJson(lineupText), parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_LINEUP_PROTOTYPE_1.json', import.meta.url), 'utf8')));
    assert.match(runLineup().stderr, /Refusing to overwrite/);
    assert.equal(readFileSync(lineupPath, 'utf8'), lineupText);
    const rolePath = join(directory, 'role-allocation.json');
    const roleScript = fileURLToPath(new URL('./calibrate-roles.ts', import.meta.url));
    const runRoles = () => spawnSync(process.execPath, ['--experimental-strip-types', roleScript, rolePath], { encoding: 'utf8' });
    const roleExecution = runRoles();
    assert.equal(roleExecution.status, 0, roleExecution.stderr);
    const roleText = readFileSync(rolePath, 'utf8');
    assert.deepEqual(parseResearchJson(roleText), parseResearchJson(readFileSync(new URL('../../docs/research/mid-iq/MID_IQ_ROLE_ALLOCATION_1.json', import.meta.url), 'utf8')));
    assert.match(runRoles().stderr, /Refusing to overwrite/);
    assert.equal(readFileSync(rolePath, 'utf8'), roleText);
    writeFileSync(fitPath, JSON.stringify(fixture));
    const reports = ['policy-stress', 'access-stress'].map((mode) => {
      const output = join(directory, `${mode}.json`);
      const execution = run(mode, output);
      assert.equal(execution.status, 0, execution.stderr);
      const text = readFileSync(output, 'utf8');
      const report = parseResearchJson(text);
      assert.equal(report.seedCount, 2);
      assert.equal(report.results.length, 6);
      for (const result of report.results) for (const observation of result.observations) {
        assert.equal(observation.decisions.length, 6);
        const picks = observation.actions.filter((action: { type: string }) => action.type === 'PICK');
        observation.decisions.forEach((decision: { offeredIds: string[]; consideredPlayers: number; selectedRank: number }, index: number) => {
          assert.equal(new Set(decision.offeredIds).size, decision.consideredPlayers);
          assert.ok(decision.offeredIds.includes(picks[index].id));
          if (result.policy.endsWith('top3')) assert.ok(decision.selectedRank >= 1 && decision.selectedRank <= 3);
        });
        for (const evaluation of [observation.baseline, observation.candidate]) {
          assert.ok(evaluation.undefeatedProbability >= 0);
          assert.ok(evaluation.undefeatedProbability <= evaluation.firstSeedProbability);
          assert.ok(evaluation.firstSeedProbability <= evaluation.directEntryProbability);
          assert.ok(evaluation.directEntryProbability <= evaluation.qualificationProbability);
          assert.ok(evaluation.qualificationProbability <= 1 + 1e-12);
        }
      }
      const repeated = run(mode, output);
      assert.notEqual(repeated.status, 0);
      assert.match(repeated.stderr, /Refusing to overwrite/);
      assert.equal(readFileSync(output, 'utf8'), text);
      return report;
    });
    for (const policy of ['rating', 'greedy-candidate']) {
      const results = reports.map((report) => report.results.find((row: { policy: string }) => row.policy === policy));
      assert.deepEqual(results[0].observations, results[1].observations);
      assert.deepEqual(results[0].summary, results[1].summary);
    }
    const access = reports[1];
    for (const objective of ['rating', 'candidate']) {
      const menus = [3, 8].map((size) => access.results.find((row: { policy: string }) => row.policy === `${objective}-menu${size}`));
      for (let index = 0; index < 2; index++) {
        const smaller: string[] = menus[0].observations[index].decisions[0].offeredIds;
        const larger: string[] = menus[1].observations[index].decisions[0].offeredIds;
        assert.equal(smaller.length, 3);
        assert.equal(larger.length, 8);
        assert.ok(smaller.every((id) => larger.includes(id)));
      }
    }
    for (const comparison of access.pairedComparisons) {
      const control = access.results.find((row: { policy: string }) => row.policy === comparison.control);
      const treatment = access.results.find((row: { policy: string }) => row.policy === comparison.treatment);
      const differences = treatment.observations.map((row: { candidate: { expectedWins: number } }, index: number) =>
        row.candidate.expectedWins - control.observations[index].candidate.expectedWins);
      assert.equal(comparison.metrics.expectedWins.meanDifference, (differences[0] + differences[1]) / 2);
      assert.ok(Math.abs(comparison.metrics.expectedWins.standardError - Math.abs(differences[0] - differences[1]) / 2) < 1e-12);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});