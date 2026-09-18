import { availablePlayers, availableSlots } from '../../src/engine/draft.ts';
import { createRun } from '../../src/engine/run.ts';
import { RIVALRY_VERSION } from '../../src/engine/rivalry.ts';
import { controlledSeason, data, expect, expectFits, loadRun, readyFixture, savedState, test } from './fixtures';

test('player stats stay on one compact row on mobile', async ({ page }, testInfo) => {
  await loadRun(page, createRun('browser-compact-stats', data.coaches, null, RIVALRY_VERSION, 'mid'), 0);
  await page.getByRole('button', { name: /^Select / }).first().click();
  await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
  await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.player-row').first()).toBeVisible();

  for (const width of testInfo.project.name === 'mobile' ? [320, 390, 760] : [1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const sort of ['Overall rating', 'Assists per game']) {
      await page.getByRole('button', { name: new RegExp(`^${sort}: sort`) }).click();
      const rows = await page.locator('.player-row').evaluateAll((elements) => elements.map((element) => {
        const stats = [...element.querySelectorAll<HTMLElement>('.stat-cell')];
        const bounds = element.getBoundingClientRect();
        return {
          count: stats.length,
          tops: stats.map((stat) => stat.getBoundingClientRect().top),
          fits: stats.every((stat) => {
            const rect = stat.getBoundingClientRect();
            return stat.scrollWidth <= stat.clientWidth + 1 && rect.left >= bounds.left && rect.right <= bounds.right;
          }),
        };
      }));
      for (const row of rows) {
        expect(row.count).toBe(10);
        expect(new Set(row.tops).size).toBe(1);
        expect(row.fits).toBe(true);
      }
      await expectFits(page);
    }
    await page.locator('.player-pool').screenshot({ path: testInfo.outputPath(`compact-stats-${width}.png`), animations: 'disabled' });
  }
});

test('earned collections cannot expose scouting during a HI IQ draft', async ({ page }) => {
  await loadRun(page, controlledSeason(0, 'hi-collection-unlock'));
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeEnabled();
  await loadRun(page, readyFixture('hi-collection-ready', 'hi'), 0);
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /RUN HISTORY/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeDisabled();
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /RUN HISTORY/ })).toBeEnabled();
  await page.getByRole('button', { name: /COACH ALMANAC/ }).click();
  await expect(page.locator('.almanac-entry')).toHaveCount(12);
});

test('screen transitions reset scrolling to the top', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 400 });
  const expectTransitionAtTop = async (name: string | RegExp) => {
    const button = page.getByRole('button', { name, exact: true }).first();
    await expect(button).toBeEnabled();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await button.evaluate((element: HTMLButtonElement) => element.click());
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  };

  await loadRun(page, createRun('browser-scroll-coach', data.coaches, null, RIVALRY_VERSION, 'mid'), 0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE DRAFT ROOM.');
  await expectTransitionAtTop(/^Select /);
  await expect(page.getByRole('heading', { name: 'ON THE CLOCK' })).toBeVisible();

  await loadRun(page, readyFixture('browser-scroll-ready'), 0);
  await expectTransitionAtTop('START SEASON');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE REGULAR SEASON.');
  await expect(page.getByRole('button', { name: 'Skip to final result', exact: true })).toBeVisible();

  await loadRun(page, controlledSeason(65, 'browser-scroll-postseason'));
  await expectTransitionAtTop('START POSTSEASON');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE PLAYOFFS.');
  await expect(page.getByRole('group', { name: 'Run results' })).toBeVisible();
  await expectTransitionAtTop('REGULAR SEASON');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE REGULAR SEASON.');
  await expectTransitionAtTop('PLAYOFFS');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE PLAYOFFS.');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE PLAYOFFS.');
  await expectFits(page);
});

test('three IQ modes default to Mid IQ, persist selection, and lock at coach signing', async ({ page }, testInfo) => {
  await loadRun(page, createRun('browser-mode-choice', data.coaches, null, RIVALRY_VERSION, 'mid'), 0);
  const modes = page.getByRole('group', { name: 'IQ mode', exact: true });
  await expect(modes.getByRole('button')).toHaveText(['NO IQ', 'MID IQ', 'HI IQ']);
  await expect(modes.getByRole('button', { name: 'MID IQ', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const original = (await savedState(page)).run;
  await modes.getByRole('button', { name: 'MID IQ', exact: true }).click();
  expect((await savedState(page)).run).toEqual(original);
  let previous = original;
  for (const label of ['HI IQ', 'MID IQ', 'HI IQ']) {
    await modes.getByRole('button', { name: label, exact: true }).click();
    const changed = (await savedState(page)).run;
    expect(changed.seed).not.toBe(previous.seed);
    const priorIds = previous.draft.offers.map((coach: { id: string }) => coach.id);
    expect(changed.draft.offers.every((coach: { id: string }) => !priorIds.includes(coach.id))).toBe(true);
    await page.reload();
    expect((await savedState(page)).run).toEqual(changed);
    previous = changed;
  }
  await modes.getByRole('button', { name: 'NO IQ', exact: true }).click();
  await expect(page.locator('.modifier-list')).toHaveCount(0);
  await page.reload();
  expect((await savedState(page)).run.iqMode).toBe('no');
  await expect(page.locator('.mode-label')).toHaveText('NO IQ');
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('mode-selection.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(modes).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.mode-label')).toHaveText('NO IQ');
  await expect(page.getByRole('heading', { name: 'TEAM QUALITY' })).toBeVisible();
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this run', exact: true }).click();
  expect((await savedState(page)).run.iqMode).toBe('no');
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await expect(modes.getByRole('button', { name: 'MID IQ', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('HI IQ hides all scouting stats through six interactive picks and reveals only at Start Season', async ({ page }, testInfo) => {
  await loadRun(page, createRun('browser-hi-six-picks', data.coaches, null, RIVALRY_VERSION, 'mid'), 0);
  await page.getByRole('group', { name: 'IQ mode' }).getByRole('button', { name: 'HI IQ', exact: true }).click();
  await expect(page.locator('.coach-description, .modifier-list, .coach-identity p')).toHaveCount(0);
  await page.getByRole('button', { name: /^Select / }).first().click();
  for (let round = 0; round < 6; round++) {
    await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
    await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
    const run = (await savedState(page)).run;
    const eligible = availablePlayers(run.draft, data.players).find((player) => availableSlots(run.draft.lineup, player).length)!;
    const slot = availableSlots(run.draft.lineup, eligible)[0]!;
    await expect(page.locator('.status-modifiers, .coach-system, .synergy-section, .overall')).toHaveCount(0);
    await expect(page.locator('.table-header button')).toHaveText(['PLAYER / PEAK SEASONS', 'POS']);
    const names = await page.locator('.player-row .player-name strong').allTextContents();
    expect(names).toEqual([...names].sort((first, second) => first.localeCompare(second)));
    await expect(page.getByRole('button', { name: /rating: sort|per game: sort|percentage: sort/i })).toHaveCount(0);
    await page.getByRole('button', { name: `Draft ${eligible.name}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'LOCK YOUR PICK' });
    await expect(dialog.locator('.pick-stat-line')).toHaveCount(0);
    await expect(dialog).not.toContainText('OVR');
    await dialog.getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
    if (round === 0) await page.reload();
  }
  await expect(page.getByRole('button', { name: 'START SEASON', exact: true })).toBeVisible();
  await expect(page.locator('.completion-ratings, .synergy-section, .status-modifiers')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.completion-ratings, .synergy-section, .status-modifiers')).toHaveCount(0);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('hi-ready.png'), fullPage: true, animations: 'disabled' });
  const ready = (await savedState(page)).run;
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEAM CHEMISTRY' })).toBeVisible();
  await expect(page.locator('.status-modifiers')).toBeVisible();
  const finished = (await savedState(page)).run;
  await page.locator('.roster-profiles summary').click();
  await page.locator('.roster-profiles button').first().click();
  await expect(page.getByRole('dialog', { name: 'PLAYER PROFILE' }).locator('.pick-stat-line')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('DBPM');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'TEAM CHEMISTRY' })).toBeVisible();
  expect((await savedState(page)).run.iqMode).toBe('hi');
  await loadRun(page, { ...ready, iqMode: 'mid' }, 0);
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  expect((await savedState(page)).run.season).toEqual(finished.season);
  await loadRun(page, finished, 0);
  await expect(page.getByRole('heading', { name: 'TEAM CHEMISTRY' })).toBeVisible();
  expect((await savedState(page)).run).toEqual(finished);
});

test('No IQ quality previews and playoffs use disabled chemistry without misleading autopsies', async ({ page }, testInfo) => {
  await loadRun(page, readyFixture('browser-no-preview', 'no'), 0);
  await expect(page.getByRole('heading', { name: 'TEAM QUALITY' })).toBeVisible();
  await expect(page.locator('.meter-block, .chemistry-grid, .status-modifiers')).toHaveCount(0);
  await expect(page.getByText('USAGE EFFICIENCY', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  const season = (await savedState(page)).run.season;
  for (const game of season.gameLog) {
    expect(game.evaluation.synergy.phiUsg).toBe(1);
    expect(game.evaluation.synergy.spacingModifier).toBe(0);
    expect(game.evaluation.coachPaceModifier).toBe(0);
  }
  const qualified = controlledSeason(65, 'browser-no-playoffs', 'no');
  await loadRun(page, qualified);
  await page.getByRole('button', { name: 'START POSTSEASON', exact: true }).click();
  await expect(page.locator('.mode-label')).toHaveText('NO IQ');
  const finished = (await savedState(page)).run;
  for (const game of finished.postseason.gameLog) {
    expect(game.evaluation.synergy.phiUsg).toBe(1);
    expect(game.evaluation.synergy.spacingModifier).toBe(0);
    expect(game.evaluation.coachPaceModifier).toBe(0);
  }
  await expect(page.locator('.series-preview')).not.toContainText(/Usage overload|Spacing reduces/);
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  await expect(page.locator('.elimination-review')).not.toContainText(/Usage overload|Poor spacing/);
  await page.locator('.draft-sidebar .defense-breakdown summary').click();
  await expect(page.locator('.draft-sidebar .defense-breakdown')).toContainText('Individual defensive ability');
  await expect(page.locator('.draft-sidebar .defense-breakdown')).not.toContainText('Rim protection');
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('no-results.png'), fullPage: true, animations: 'disabled' });
  await page.reload();
  expect((await savedState(page)).run).toEqual(finished);
});