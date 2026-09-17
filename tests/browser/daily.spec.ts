import { availablePlayers, availableSlots, playerIdentity } from '../../src/engine/draft.ts';
import { applyDraftAction, createDailyRun, playersForRun } from '../../src/engine/run.ts';
import { dailySeed } from '../../src/engine/daily.ts';
import { DAILY_CALENDAR, DAILY_ROTATION_VERSION, calendarVersionForDate, challengeFixedPlayers, rotationDate, rotationSchedule, rotatingChallengeForDate } from '../../src/engine/daily-calendar.ts';
import { data, expect, expectFits, loadRun, savedState, test } from './fixtures';

const ledgerKey = '98-0-daily-v1';
const now = new Date('2026-09-17T23:59:00Z');
const firstCycle = rotationSchedule(rotationDate(0));

test('Daily commits before offers, completes six picks, persists results and retries as practice', async ({ page }, testInfo) => {
  const date = firstCycle.find((entry) => entry.challenge.id === 'triangle-test')!.date;
  await page.clock.setFixedTime(new Date(`${date}T12:00:00Z`));
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Local only. No public ranking');
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const initial = (await savedState(page)).run;
  expect(initial.seed).toBe(dailySeed(date));
  expect(initial.daily.version).toBe('daily-3');
  expect(initial.daily.calendarVersion).toBe(DAILY_ROTATION_VERSION);
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
  await page.clock.setFixedTime(new Date('2026-09-18T00:01:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-date')).toContainText('2026-09-17');
  await page.getByRole('button', { name: 'RESUME DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run).toEqual(original);
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run.daily.date).toBe('2026-09-18');
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
  let run = createDailyRun({ version: 'daily-1', date: '2026-09-16', startedAt: Date.parse('2026-09-16T23:59:00Z'), kind: 'local', attemptId: 'late-fixture' }, data.coaches);
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

for (const index of [15, 26, 6, 27, 38, 42, 48, 49, 50, 51, 52, 55]) {
  const challenge = DAILY_CALENDAR[index]!;
  test(`Daily ${challenge.name} enforces its pool and retains locked players through all remaining picks`, async ({ page }, testInfo) => {
    const date = firstCycle.find((entry) => entry.challenge.id === challenge.id)!.date;
    await page.clock.setFixedTime(new Date(`${date}T12:00:00Z`));
    await page.goto('/');
    await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
    await expect(page.locator('.daily-preview')).toContainText(challenge.name);
    await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const initial = (await savedState(page)).run;
    expect(initial.daily.challengeId).toBe(challenge.id);
    expect(initial.daily.calendarVersion).toBe(DAILY_ROTATION_VERSION);
    expect(initial.draft.offers).toHaveLength(3);
    const fixedPlayers = challengeFixedPlayers(challenge);
    for (const fixed of fixedPlayers) expect(initial.draft.lineup[fixed.slot].id).toBe(fixed.id);
    expect(initial.draft.rerolls).toEqual(challenge.rerolls ?? { team: 1, era: 1 });
    await page.getByRole('button', { name: /^Select / }).first().click();
    for (let round = 0; round < 6 - fixedPlayers.length; round++) {
      await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
      await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
      if (round === 0) {
        if (challenge.decades?.length === 1) await expect(page.getByRole('button', { name: 'Reroll era', exact: true })).toBeDisabled();
        if (challenge.rerolls) {
          await expect(page.getByRole('button', { name: 'Reroll team', exact: true })).toBeDisabled();
          await expect(page.getByRole('button', { name: 'Reroll era', exact: true })).toBeDisabled();
        }
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
      await expect(page.locator('.player-row')).toHaveCount(candidates.length);
      for (const fixed of fixedPlayers) expect(candidates.some((player) => playerIdentity(player) === playerIdentity(run.draft.lineup[fixed.slot]))).toBe(false);
      for (const candidate of candidates) {
        if (challenge.eligiblePosition) expect(candidate.eligiblePositions).toContain(challenge.eligiblePosition);
        const filter = challenge.statFilter;
        if (filter?.operator === 'lt') expect(candidate.stats[filter.stat]).toBeLessThan(filter.value);
        if (filter?.operator === 'lte') expect(candidate.stats[filter.stat]).toBeLessThanOrEqual(filter.value);
        if (filter?.operator === 'gte') expect(candidate.stats[filter.stat]).toBeGreaterThanOrEqual(filter.value);
      }
      const player = candidates.find((candidate) => availableSlots(run.draft.lineup, candidate).length)!;
      const slot = availableSlots(run.draft.lineup, player)[0]!;
      await page.getByRole('button', { name: `Draft ${player.name}`, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
      for (const fixed of fixedPlayers) expect((await savedState(page)).run.draft.lineup[fixed.slot]).toEqual(initial.draft.lineup[fixed.slot]);
      if (round === 0) {
        const before = (await savedState(page)).run;
        await page.reload();
        await expect(page.locator('.daily-banner')).toContainText(challenge.name);
        expect((await savedState(page)).run).toEqual(before);
      }
    }
    await expect(page.getByRole('button', { name: 'START SEASON', exact: true })).toBeEnabled();
    expect((await savedState(page)).run.actions.filter((action: { type: string }) => action.type === 'PICK')).toHaveLength(6 - fixedPlayers.length);
    if (index === 42) {
      await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
      await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
      const complete = (await savedState(page)).run;
      await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].result?.wins, ledgerKey)).toBe(complete.season.wins);
      await page.reload();
      await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Local Daily records' })).toContainText('Shaq Meets Steph');
      await page.getByRole('button', { name: 'START PRACTICE', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const practice = (await savedState(page)).run;
      expect(practice.daily.kind).toBe('practice');
      expect(practice.seed).toBe(initial.seed);
      expect(practice.draft).toEqual(initial.draft);
    }
  });
}

test('Daily calendar rolls into another complete shuffled cycle at UTC midnight', async ({ page }, testInfo) => {
  const lastDate = rotationDate(55);
  await page.clock.install({ time: new Date(`${lastDate}T23:59:59Z`) });
  await page.clock.pauseAt(new Date(`${lastDate}T23:59:59Z`));
  await page.goto('/');
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-preview')).toContainText(rotatingChallengeForDate(lastDate)!.name);
  await page.locator('.daily-calendar summary').click();
  await expect(page.locator('.daily-calendar li')).toHaveCount(56);
  expect(await page.locator('.daily-calendar li strong').allTextContents()).toEqual(firstCycle.map((entry) => entry.challenge.name));
  await page.clock.runFor(2000);
  const date = rotationDate(56);
  const nextCycle = rotationSchedule(date);
  await expect(page.locator('.daily-date')).toContainText(date);
  await expect(page.locator('.daily-preview')).toContainText(nextCycle[0]!.challenge.name);
  expect(nextCycle[0]!.challenge.id).not.toBe(rotatingChallengeForDate(lastDate)!.id);
  expect(await page.locator('.daily-calendar li strong').allTextContents()).toEqual(nextCycle.map((entry) => entry.challenge.name));
  expect(new Set(nextCycle.map((entry) => entry.challenge.id)).size).toBe(56);
  await expect(page.locator('.daily-calendar li[aria-current="date"] time')).toHaveText(date);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('daily-rotation-calendar.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run.seed).toBe(dailySeed(date));
});

test('Legacy drafts resume unchanged and do not consume the fresh rotation commitment', async ({ page }) => {
  const date = rotationDate(0);
  await page.clock.setFixedTime(now);
  await page.goto('/');
  const run = createDailyRun({ version: 'daily-2', calendarVersion: calendarVersionForDate(date), challengeId: DAILY_CALENDAR[1]!.id,
    date, startedAt: now.getTime(), kind: 'local', attemptId: 'legacy-resume' }, data.coaches, data.players);
  await page.evaluate(({ key, attempt }) => localStorage.setItem(key, JSON.stringify([{ attempt }])), { key: ledgerKey, attempt: run.daily });
  await loadRun(page, run, 0);
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-preview')).toContainText(DAILY_CALENDAR[1]!.name);
  await page.getByRole('button', { name: 'RESUME DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run).toEqual(run);
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await expect(page.locator('.daily-preview')).toContainText(rotatingChallengeForDate(date)!.name);
  await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const fresh = (await savedState(page)).run;
  expect(fresh.daily.kind).toBe('local');
  expect(fresh.seed).not.toBe(run.seed);
  await page.reload();
  expect((await savedState(page)).run).toEqual(fresh);
  const entries = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ledgerKey);
  expect(entries.map((entry: { attempt: { kind: string } }) => entry.attempt.kind)).toEqual(['local', 'local']);
  expect(entries[0].attempt).toEqual(run.daily);
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
  await page.getByRole('button', { name: 'START PRACTICE', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await savedState(page)).run.daily.kind).toBe('practice');
});

test('Independent offline players agree on future UTC themes, seeds, coaches and reels', async ({ browser, baseURL }) => {
  const contexts = [];
  const runs = [];
  try {
    for (const timezoneId of ['America/Los_Angeles', 'Asia/Tokyo']) {
      const context = await browser.newContext({ baseURL, timezoneId });
      contexts.push(context);
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2032-02-29T01:00:00Z'));
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Daily challenge', exact: true }).click();
      await page.getByRole('button', { name: 'START DAILY', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: /^Select / }).first().click();
      await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
      await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
      runs.push((await savedState(page)).run);
    }
    expect(runs[0].seed).toBe(dailySeed('2032-02-29'));
    expect(runs[1].seed).toBe(runs[0].seed);
    expect(runs[1].daily.challengeId).toBe(runs[0].daily.challengeId);
    expect(runs[1].draft).toEqual(runs[0].draft);
  } finally {
    for (const context of contexts) await context.close();
  }
});