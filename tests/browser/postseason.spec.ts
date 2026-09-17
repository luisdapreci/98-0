import { expect, expectFits, loadRun, readyFixture, savedState, saveKey, scenario, test } from './fixtures';
import { resultText, summarizeRun } from '../../src/engine/progress';

for (const kind of ['playInLoss', 'champion', 'perfect', 'seriesLoss'] as const) {
  test(`${kind}: qualification to saved postseason result`, async ({ page }, testInfo) => {
    const { run, finished } = scenario(kind);
    await loadRun(page, run);
    const record = page.locator('.season-record-row');
    await expect(record.getByRole('button', { name: 'START POSTSEASON', exact: true })).toBeVisible();
    const layout = await record.evaluate((element) => {
      const heading = element.querySelector('h2')!.getBoundingClientRect();
      const button = element.querySelector('button')!.getBoundingClientRect();
      const playback = document.querySelector('.playback-controls')!.getBoundingClientRect();
      return { beside: button.left >= heading.right, below: button.top >= heading.bottom,
        beforePlayback: button.bottom <= playback.top, fits: element.scrollWidth <= element.clientWidth };
    });
    expect(layout.fits && layout.beforePlayback).toBe(true);
    expect(testInfo.project.name === 'desktop' ? layout.beside : layout.beside || layout.below).toBe(true);
    await expectFits(page);
    await record.screenshot({ path: testInfo.outputPath('season-record-action.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'START POSTSEASON', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'THE PLAYOFF RUN.' })).toBeVisible();
    await expect(page.locator('.postseason-summary .ticker-score strong')).toHaveText(['--', '--']);
    await expect(page.locator('.series-preview')).toBeVisible();
    await expect(page.locator('.series-preview')).toContainText(finished.postseason!.gameLog[0]!.opponent.name);
    await expect(page.getByRole('button', { name: 'Mute game sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expectFits(page);
    await page.screenshot({ path: testInfo.outputPath(`${kind}-preview.png`), fullPage: true, animations: 'disabled' });
    expect((await savedState(page)).run).toEqual(finished);
    await page.getByRole('button', { name: finished.postseason!.entry === 'PLAY_IN' ? 'Start Play-In' : 'Start Series', exact: true }).click();
    await page.reload();
    expect((await savedState(page)).run).toEqual(finished);
    const skip = page.getByRole('button', { name: 'Skip to final result', exact: true });
    if ((await savedState(page)).postseasonPlayback.revealed < finished.postseason!.gameLog.length) await skip.click();
    else await expect(skip).toBeDisabled();
    await expect(page.getByRole('heading', { name: kind === 'perfect' ? '98-0. PERFECT.' : kind === 'champion' ? 'CHAMPIONS.' : 'RUN COMPLETE.' })).toBeVisible();
    await expect(page.locator('#postseason-title')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'SHARE RESULT', exact: true })).toBeInViewport({ ratio: 1 });
    if (kind === 'champion') await expect(page.getByText('CHAMPIONSHIP RING EARNED', { exact: true })).toBeVisible();
    if (kind === 'playInLoss') await expect(page.getByText('ELIMINATED / PLAY-IN', { exact: true })).toBeVisible();
    if (kind === 'seriesLoss') {
      await expect(page.locator('.elimination-review')).toContainText('Model disadvantages, not proven causes');
      await expect(page.locator('.postseason-retrospective')).toContainText('Closest game:');
      await expect(page.locator('.championship-ring')).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { name: 'THE RUN, REMEMBERED.' })).toBeVisible();
    await expect(page.locator('.ring-roster li')).toHaveCount(6);
    await expectFits(page);
    await page.screenshot({ path: testInfo.outputPath(`${kind}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'REGULAR SEASON', exact: true }).click();
    expect((await savedState(page)).run.season).toEqual(run.season);
    await page.getByRole('button', { name: 'PLAYOFFS', exact: true }).click();
    await page.reload();
    expect((await savedState(page)).run).toEqual(finished);
    await expect(page.getByRole('button', { name: 'Skip to final result', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
    await expect(page.getByLabel('RESULT TEXT', { exact: true })).toHaveValue(resultText(summarizeRun(finished, 1, true)!));
    await expect(page.getByRole('dialog').locator('.share-card')).toContainText(`${finished.postseason!.playoffs.wins}-${finished.postseason!.playoffs.losses}`);
    await page.keyboard.press('Escape');
  });
}

test('series entrances, clincher pauses and Finals ceremony preserve saved outcomes', async ({ page }, testInfo) => {
  const { finished } = scenario('perfect');
  await loadRun(page, finished);
  await page.clock.install();
  await expect(page.getByRole('button', { name: 'Mute game sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Start Series', exact: true }).click();
  await page.getByRole('button', { name: '5x speed', exact: true }).click();
  await page.getByRole('button', { name: 'Play playback', exact: true }).click();
  for (let step = 0; step < 12; step++) await page.clock.runFor(300);
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible();
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(3);
  await expect(page.locator('.series-stakes h3')).toHaveText('Win to advance.');
  await page.clock.runFor(3000);
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(3);
  await page.getByRole('button', { name: 'Play playback', exact: true }).click();
  for (let step = 0; step < 8; step++) await page.clock.runFor(500);
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(4);
  await expect(page.getByRole('button', { name: 'Start Series', exact: true })).toBeVisible();
  await expect(page.locator('.series-advancement')).toHaveText('ROUND 1 WON / ROUND 2 AWAITS');
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Series', exact: true })).toBeVisible();
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(4);
  await page.getByRole('button', { name: 'Finish Series', exact: true }).click();
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(8);
  await page.getByRole('button', { name: 'Finish Series', exact: true }).click();
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(12);
  await expect(page.locator('.postseason-summary')).toHaveClass(/finals-stage/);
  await expect(page.getByRole('progressbar', { name: 'Wins toward a championship' })).toHaveAttribute('value', '12');
  await expect(page.locator('.series-preview')).toContainText(finished.postseason!.path.at(-1)!.opponent.name);
  await expect(page.locator('.series-preview')).not.toContainText('CHAMPIONSHIP RING EARNED');
  expect(await page.locator('.series-identity').evaluate((element) => getComputedStyle(element, '::before').backgroundImage)).toContain('/court.svg');
  expect((await page.request.get('/court.svg')).ok()).toBe(true);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('finals-preview.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Finish Series', exact: true }).click();
  await expect(page.getByRole('heading', { name: '98-0. PERFECT.' })).toBeVisible();
  await page.clock.runFor(1500);
  await expect(page.locator('#postseason-title')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'SHARE RESULT', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.championship-ring')).toContainText('98-0');
  await expect(page.locator('.postseason-retrospective')).toContainText('A clean sweep.');
  expect((await savedState(page)).run).toEqual(finished);
  await expect(page.getByRole('button', { name: 'Finish Series', exact: true })).toBeDisabled();
});

test('Game 7 pauses before the result and retains elimination stakes after reload', async ({ page }, testInfo) => {
  const { finished } = scenario('gameSeven');
  const index = finished.postseason!.gameLog.findIndex((game) => game.seriesGame === 7);
  await loadRun(page, finished);
  await page.evaluate(({ saveKey, revealed }) => {
    const envelope = JSON.parse(localStorage.getItem(saveKey)!);
    envelope.state.postseasonPlayback.revealed = revealed;
    localStorage.setItem(saveKey, JSON.stringify(envelope));
  }, { saveKey, revealed: index - 1 });
  await page.reload();
  await page.clock.install();
  await page.getByRole('button', { name: '5x speed', exact: true }).click();
  await page.getByRole('button', { name: 'Play playback', exact: true }).click();
  for (let step = 0; step < 12; step++) await page.clock.runFor(500);
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(index);
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible();
  await expect(page.locator('.series-stakes')).toHaveClass(/high-stakes/);
  await expect(page.locator('.series-stakes h3')).toContainText('Game 7.');
  await expect(page.locator('.playoff-round').first()).toHaveAttribute('aria-current', 'step');
  await page.clock.runFor(3000);
  expect((await savedState(page)).postseasonPlayback.revealed).toBe(index);
  await page.reload();
  await expect(page.locator('.series-stakes h3')).toContainText('Game 7.');
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('game-seven.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Next Game', exact: true }).click();
  expect((await savedState(page)).run).toEqual(finished);
});

test('six-pick draft starts the regular season once and preserves playback controls', async ({ page }) => {
  const run = readyFixture('browser-complete-draft');
  await loadRun(page, run, 0);
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await expect(page.getByText('REGULAR SEASON / 0 OF 82', { exact: true })).toBeVisible();
  const resolved = (await savedState(page)).run;
  await page.getByRole('button', { name: '5x speed', exact: true }).click();
  await page.getByRole('button', { name: 'Play playback', exact: true }).click();
  await expect.poll(async () => (await savedState(page)).playback.revealed).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await page.reload();
  expect((await savedState(page)).run).toEqual(resolved);
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  expect((await savedState(page)).run).toEqual(resolved);
});