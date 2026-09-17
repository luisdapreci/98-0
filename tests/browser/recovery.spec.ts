import { controlledSeason, expect, expectFits, loadRun, savedState, saveKey, scenario, test } from './fixtures';

test('malformed progression and storage write failures are reported without clearing history', async ({ page }) => {
  await loadRun(page, controlledSeason(44, 'progress-storage-failure'));
  const key = '98-0-progress-v1';
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).not.toBeNull();
  const saved = await page.evaluate((key) => localStorage.getItem(key)!, key);
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Almanac and history could not be saved or opened' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{broken');
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, saved), { key, saved });
  await page.reload();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === '98-0-progress-v1') throw new DOMException('Full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  const run = controlledSeason(43, 'progress-storage-second');
  await page.evaluate(({ run, saveKey }) => localStorage.setItem(saveKey, JSON.stringify({ version: 1, state: { run, playback: { runId: run.id, revealed: 82, overtimePeriod: null } } })), { run, saveKey });
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === '98-0-progress-v1') throw new DOMException('Full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Almanac and history could not be saved or opened' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(saved);
  expect((await savedState(page)).run.id).toBe(run.id);
});

test('tied postseason overtime resumes without spoilers and a missing cursor restarts presentation', async ({ page }) => {
  const { finished } = scenario('overtime');
  await loadRun(page, finished);
  const index = finished.postseason!.gameLog.findIndex((game) => game.overtime.length);
  await page.evaluate(({ saveKey, index }) => {
    const envelope = JSON.parse(localStorage.getItem(saveKey)!);
    envelope.state.postseasonPlayback = { runId: `${envelope.state.run.id}:postseason`, revealed: index, overtimePeriod: 0 };
    localStorage.setItem(saveKey, JSON.stringify(envelope));
  }, { saveKey, index });
  await page.reload();
  const game = finished.postseason!.gameLog[index]!;
  await expect(page.locator('.postseason-summary .ticker-score strong')).toHaveText([String(game.regulation.userScore), String(game.regulation.oppScore)]);
  await expect(page.getByText(/END OF REGULATION \/ OVERTIME/)).toBeVisible();
  expect((await savedState(page)).run).toEqual(finished);
  await page.getByRole('button', { name: 'Next overtime period', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectFits(page);
  await page.evaluate((saveKey) => {
    const envelope = JSON.parse(localStorage.getItem(saveKey)!);
    delete envelope.state.postseasonPlayback;
    localStorage.setItem(saveKey, JSON.stringify(envelope));
  }, saveKey);
  await page.reload();
  await expect(page.getByText('POSTSEASON / 0 GAMES FINISHED', { exact: true })).toBeVisible();
  expect((await savedState(page)).run).toEqual(finished);
});

test('legacy saves advance, tampered postseason is backed up, and reset can be cancelled', async ({ page }) => {
  const run = controlledSeason(65, 'browser-legacy');
  delete run.rivalryVersion;
  for (const game of run.season!.gameLog) delete game.rivalry;
  await loadRun(page, run);
  await page.getByRole('button', { name: 'START POSTSEASON', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'THE PLAYOFF RUN.' })).toBeVisible();
  const finished = (await savedState(page)).run;
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this run', exact: true }).click();
  expect((await savedState(page)).run).toEqual(finished);
  await page.evaluate((saveKey) => {
    const envelope = JSON.parse(localStorage.getItem(saveKey)!);
    envelope.state.run.postseason.gameLog[0].userScore++;
    localStorage.setItem(saveKey, JSON.stringify(envelope));
  }, saveKey);
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Saved run is invalid' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(`${key}-recovery`), saveKey)).toBeTruthy();
});