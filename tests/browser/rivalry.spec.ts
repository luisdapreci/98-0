import { controlledSeason, expect, expectFits, loadRun, savedState, test } from './fixtures';

test('approved rivalry evidence is visible and survives reload without changing the season', async ({ page }) => {
  let run = controlledSeason(65, 'browser-rivalry-0');
  for (let index = 1; !run.season!.gameLog.some((game) => game.rivalry!.matches.length) && index < 50; index++)
    run = controlledSeason(65, `browser-rivalry-${index}`);
  const game = run.season!.gameLog.find((entry) => entry.rivalry!.matches.length)!;
  expect(game).toBeTruthy();
  await loadRun(page, run);
  await page.locator('.season-timeline').getByRole('button', { name: new RegExp(`^Game ${game.gameNumber}:`) }).click();
  const details = page.locator('.season-log').filter({ has: page.locator('summary', { hasText: `GAME DETAILS / ${game.gameNumber}` }) });
  await expect(details.getByText('HISTORIC FRANCHISE RIVALRY', { exact: true })).toBeVisible();
  await expect(details.getByText(/Roster representatives:/).first()).toBeVisible();
  await expectFits(page);
  expect((await savedState(page)).run).toEqual(run);
  await page.reload();
  expect((await savedState(page)).run).toEqual(run);
});