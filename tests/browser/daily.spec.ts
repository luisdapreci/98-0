import { availablePlayers, availableSlots, playerIdentity } from '../../src/engine/draft.ts';
import { applyDraftAction, createDailyRun, playersForRun } from '../../src/engine/run.ts';
import { dailySeed } from '../../src/engine/daily.ts';
import { DAILY_CALENDAR, DAILY_CALENDAR_VERSION, dailyChallengeDate } from '../../src/engine/daily-calendar.ts';
import { data, expect, expectFits, loadRun, savedState, test } from './fixtures';

const ledgerKey = '98-0-daily-v1';
const now = new Date('2026-09-16T23:59:00Z');

test('Daily commits before offers, completes six picks, persists results and retries as practice', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(now);
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Local only. No public ranking');
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const initial = (await savedState(page)).run;
  expect(initial.seed).toBe(dailySeed('2026-09-16'));
  expect(initial.iqMode).toBe('mid');
  expect(initial.daily.kind).toBe('local');
  expect(initial.daily.challengeId).toBe('triangle-test');
  expect(initial.draft.offers.map((coach: { id: string }) => coach.id)).toEqual(['phil_jackson']);
  await expect(page.locator('.daily-banner')).toContainText('Triangle Test');
  await expect(page.getByRole('heading', { name: 'YOUR DAILY COACH', exact: true })).toBeVisible();
  await expect(page.locator('.coach-card')).toHaveCount(1);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('daily-fixed-coach.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].attempt, ledgerKey)).toEqual(initial.daily);
  await expect(page.getByRole('group', { name: 'IQ mode', exact: true })).toHaveCount(0);
  await page.reload();
  expect((await savedState(page)).run).toEqual(initial);
  await page.getByRole('button', { name: /^Select / }).first().click();
  for (let round = 0; round < 6; round++) {
    await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
    await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
    const run = (await savedState(page)).run;
    const player = availablePlayers(run.draft, data.players).find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
    const slot = round === 0 ? 'SIXTH' : availableSlots(run.draft.lineup, player)[0]!;
    await page.getByRole('button', { name: `Draft ${player.name}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
    if (round === 0) await page.reload();
  }
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  const complete = (await savedState(page)).run;
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].result?.wins, ledgerKey)).toBe(complete.season.wins);
  await page.reload();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local Daily records' })).toContainText(`${complete.season.wins}-${complete.season.losses}`);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('daily-records.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'START PRACTICE', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const practice = (await savedState(page)).run;
  expect(practice.daily.kind).toBe('practice');
  expect(practice.seed).toBe(initial.seed);
  expect(practice.draft.offers).toEqual(initial.draft.offers);
  expect(practice.id).not.toBe(initial.id);
  await expect(page.locator('.daily-banner')).toContainText('PRACTICE / UNRANKED');
});

test('Daily survives UTC rollover; abandonment retains commitment and the next day is separate', async ({ page }) => {
  await page.clock.setFixedTime(now);
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const original = (await savedState(page)).run;
  await page.clock.setFixedTime(new Date('2026-09-17T00:01:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-date')).toContainText('2026-09-16');
  await page.getByRole('button', { name: 'RESUME DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run).toEqual(original);
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run.daily.date).toBe('2026-09-17');
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START PRACTICE', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const entries = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ledgerKey);
  expect(entries.map((entry: { attempt: { kind: string } }) => entry.attempt.kind)).toEqual(['local', 'local', 'practice']);
});

test('Daily late completion stays playable and cannot enter local first-attempt results', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-18T00:00:00Z'));
  let run = createDailyRun({ version: 'daily-1', date: '2026-09-16', startedAt: now.getTime(), kind: 'local', attemptId: 'late-fixture' }, data.coaches);
  run = applyDraftAction(run, { type: 'COACH', id: run.draft.offers[0]!.id }, data.players);
  for (let round = 0; round < 6; round++) {
    run = applyDraftAction(run, { type: 'SPIN' }, data.players);
    const player = availablePlayers(run.draft, data.players).find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
    run = applyDraftAction(run, { type: 'PICK', id: player.id, slot: availableSlots(run.draft.lineup, player)[0]! }, data.players);
  }
  await page.goto('/');
  await page.evaluate(({ key, attempt }) => localStorage.setItem(key, JSON.stringify([{ attempt }])), { key: ledgerKey, attempt: run.daily });
  await loadRun(page, run, 0);
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await expect(page.locator('.daily-banner')).toContainText('LATE / UNRANKED');
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  const completed = (await savedState(page)).run;
  await page.reload();
  expect((await savedState(page)).run).toEqual(completed);
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local Daily records' })).toContainText('LATE / UNRANKED');
});

test('Daily fails closed on corrupt or unavailable storage without revealing offers', async ({ page }) => {
  await page.clock.setFixedTime(now);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  const original = (await savedState(page)).run;
  await page.evaluate((key) => localStorage.setItem(key, 'invalid'), ledgerKey);
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  expect((await savedState(page)).run).toEqual(original);
  expect(await page.evaluate((key) => localStorage.getItem(key), ledgerKey)).toBe('invalid');
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
      originalSet.call(this, name, value);
    };
  }, ledgerKey);
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  expect((await savedState(page)).run).toEqual(original);
  await expect(page.locator('.error-banner')).toContainText('Storage full');
});

for (const index of [15, 26, 6, 27]) {
  const challenge = DAILY_CALENDAR[index]!;
  test(`Daily ${challenge.name} enforces its pool and retains locked players through five or six picks`, async ({ page }, testInfo) => {
    const date = dailyChallengeDate(index);
    await page.clock.setFixedTime(new Date(`${date}T12:00:00Z`));
    await page.goto('/');
    await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
    await expect(page.locator('.daily-preview')).toContainText(challenge.name);
    await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const initial = (await savedState(page)).run;
    expect(initial.daily.challengeId).toBe(challenge.id);
    expect(initial.draft.offers).toHaveLength(3);
    const fixed = challenge.fixedPlayer;
    if (fixed) expect(initial.draft.lineup[fixed.slot].id).toBe(fixed.id);
    await page.getByRole('button', { name: /^Select / }).first().click();
    for (let round = 0; round < (fixed ? 5 : 6); round++) {
      await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
      await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
      if (round === 0) {
        if (challenge.decades?.length === 1) await expect(page.getByRole('button', { name: 'Reroll era', exact: true })).toBeDisabled();
        for (const kind of ['team', 'era']) {
          const button = page.getByRole('button', { name: `Reroll ${kind}`, exact: true });
          if (await button.isEnabled()) {
            await button.click();
            await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
          }
        }
        await expectFits(page);
        expect(await page.locator('.daily-banner, .reel-section').evaluateAll((elements) =>
          elements.every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('daily-restricted-draft.png'), fullPage: true, animations: 'disabled' });
      }
      const run = (await savedState(page)).run;
      if (challenge.decades) expect(challenge.decades).toContain(run.draft.roll.decade);
      if (challenge.franchises) expect(challenge.franchises).toContain(run.draft.roll.franchise);
      const pool = playersForRun(run, data.players);
      const candidates = availablePlayers(run.draft, pool);
      if (fixed) expect(candidates.some((player) => playerIdentity(player) === playerIdentity(run.draft.lineup[fixed.slot]))).toBe(false);
      const player = candidates.find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
      const slot = availableSlots(run.draft.lineup, player)[0]!;
      await page.getByRole('button', { name: `Draft ${player.name}`, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
      if (fixed) expect((await savedState(page)).run.draft.lineup[fixed.slot]).toEqual(initial.draft.lineup[fixed.slot]);
      if (round === 0) {
        const before = (await savedState(page)).run;
        await page.reload();
        await expect(page.locator('.daily-banner')).toContainText(challenge.name);
        expect((await savedState(page)).run).toEqual(before);
      }
    }
    await expect(page.getByRole('button', { name: 'START SEASON', exact: true })).toBeEnabled();
    expect((await savedState(page)).run.actions.filter((action: { type: string }) => action.type === 'PICK')).toHaveLength(fixed ? 5 : 6);
  });
}

test('Daily calendar has 28 unique entries, ends without looping and still resumes its last challenge', async ({ page }, testInfo) => {
  const date = dailyChallengeDate(28);
  await page.clock.setFixedTime(new Date(`${date}T00:00:00Z`));
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  const original = (await savedState(page)).run;
  await expect(page.locator('.daily-availability')).toHaveText('No challenge published for this date.');
  await expect(page.getByRole('button', { name: 'START DAILY', exact: true })).toBeDisabled();
  await page.locator('.daily-calendar summary').click();
  await expect(page.locator('.daily-calendar li')).toHaveCount(28);
  const names = await page.locator('.daily-calendar li strong').allTextContents();
  expect(new Set(names).size).toBe(28);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('daily-calendar-ended.png'), fullPage: true, animations: 'disabled' });
  expect((await savedState(page)).run).toEqual(original);
  expect(await page.evaluate((key) => localStorage.getItem(key), ledgerKey)).toBeNull();
  const lastDate = dailyChallengeDate(27);
  const run = createDailyRun({ version: 'daily-2', calendarVersion: DAILY_CALENDAR_VERSION, challengeId: DAILY_CALENDAR[27]!.id,
    date: lastDate, startedAt: Date.parse(`${lastDate}T12:00:00Z`), kind: 'local', attemptId: 'last-day-resume' }, data.coaches, data.players);
  await page.evaluate(({ key, attempt }) => localStorage.setItem(key, JSON.stringify([{ attempt }])), { key: ledgerKey, attempt: run.daily });
  await loadRun(page, run, 0);
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-preview')).toContainText('Manu off the Bench');
  await page.getByRole('button', { name: 'RESUME DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run).toEqual(run);
});