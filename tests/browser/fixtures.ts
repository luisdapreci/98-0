import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { availablePlayers, availableSlots } from '../../src/engine/draft.ts';
import { calculateSynergy } from '../../src/engine/iq-math.ts';
import { randomStream } from '../../src/engine/random.ts';
import { RIVALRY_VERSION } from '../../src/engine/rivalry.ts';
import { applyDraftAction, balanceForRun, createRun, finishSeason, recoverRun, startPostseason, startSeason } from '../../src/engine/run.ts';
import type { RunData, RunSave } from '../../src/engine/run.ts';
import { aggregateSeason, sampleOutcome, SCORE_RULES_V3 } from '../../src/engine/season.ts';
import { seasonForQualification } from '../../src/engine/postseason-policy.ts';
import { lineupForUsagePolicy } from '../../src/engine/usage-policy.ts';
import type { IQMode } from '../../src/engine/types.ts';

export const saveKey = '98-0-draft-v1';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../data/processed/${name}.json`, import.meta.url), 'utf8'));
const pool = read('opponents');
export const data: RunData = { players: read('players'), coaches: read('coaches'), opponents: pool.regularSeasonPool, playoffs: pool.playoffPool };

export const test = base.extend<{ pageErrors: string[]; guideDismissed: boolean }>({
  guideDismissed: [true, { option: true }],
  pageErrors: [async ({ page, context, guideDismissed }, use) => {
    if (guideDismissed) await context.addInitScript(() => localStorage.setItem('98-0-guide-v1', 'dismissed'));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };

export function readyFixture(seed: string, mode?: IQMode): RunSave {
  let run = createRun(seed, data.coaches, null, RIVALRY_VERSION, mode);
  run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  for (let round = 0; round < 6; round++) {
    run = applyDraftAction(run, { type: 'SPIN' }, data.players);
    const options = availablePlayers(run.draft, data.players).flatMap((player) => availableSlots(run.draft.lineup, player).map((slot) => {
      const lineup = { ...run.draft.lineup, [slot]: player };
      const synergy = calculateSynergy(lineupForUsagePolicy(lineup, run.engineVersion), balanceForRun(run));
      return { player, slot, rating: synergy.netRating + synergy.depthBonus };
    })).sort((first, second) => second.rating - first.rating);
    run = applyDraftAction(run, { type: 'PICK', id: options[0]!.player.id, slot: options[0]!.slot }, data.players);
  }
  return run;
}

export function controlledSeason(wins: number, seed: string, mode?: IQMode): RunSave {
  const run = finishSeason(startSeason(readyFixture(seed, mode)), data.opponents);
  const games = run.season!.gameLog.map((game, index) => ({
    ...game,
    ...sampleOutcome(game.evaluation, () => index < wins ? 0 : 1 - Number.EPSILON,
      randomStream(seed, `browser-controlled-season/${index}`).next, SCORE_RULES_V3),
  }));
  const controlled = { ...run, season: seasonForQualification(aggregateSeason(games), run.engineVersion) };
  const saved = JSON.parse(JSON.stringify({ run: controlled }));
  expect(recoverRun(saved, data, 'fixture-recovery').run).toEqual(saved.run);
  return controlled;
}

export function scenario(kind: 'playInLoss' | 'champion' | 'perfect' | 'overtime' | 'gameSeven' | 'seriesLoss') {
  for (let index = 0; index < 500; index++) {
    const wins = kind === 'perfect' ? 82 : kind === 'overtime' ? 75 : kind === 'gameSeven' || kind === 'seriesLoss' ? 65 : 45;
    const run = controlledSeason(wins, `browser-phase5-${index}`);
    const finished = startPostseason(run, data.playoffs!);
    const result = finished.postseason!;
    if (kind === 'playInLoss' ? result.eliminatedRound === 'playIn'
      : kind === 'champion' ? result.champion : kind === 'perfect' ? result.isPerfectRun
        : kind === 'gameSeven' ? result.gameLog.some((game) => game.seriesGame === 7)
          : kind === 'seriesLoss' ? !result.champion && result.eliminatedRound !== 'playIn'
        : result.gameLog.some((game) => game.overtime.length)) return { run, finished };
  }
  throw new Error(`No seeded postseason fixture for ${kind}.`);
}

export async function loadRun(page: Page, run: RunSave, revealed = 82) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    if (navigator.locks) await navigator.locks.request('98-0-daily-start', () => undefined);
  });
  await page.evaluate(({ run, revealed, saveKey }) => localStorage.setItem(saveKey, JSON.stringify({ version: 1, state: {
    run, playback: { runId: run.id, revealed, overtimePeriod: null },
    postseasonPlayback: run.postseason ? { runId: `${run.id}:postseason`, revealed: 0, overtimePeriod: null } : null,
  } })), { run, revealed, saveKey });
  await page.reload();
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
}

export async function savedState(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, saveKey);
}

export async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const overflow = await page.locator('.postseason-summary, .playoff-round, .series-games, .rivalry-alert, .result-tabs, .series-preview, .series-stakes, .matchup-scouting, .ring-roster').evaluateAll((elements) =>
    elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className));
  expect(overflow).toEqual([]);
}