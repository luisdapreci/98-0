import { expect, expectFits, savedState, test } from './fixtures';

test.use({ guideDismissed: false });

test('first visit guide closes, remembers dismissal, and reopens without changing a draft', async ({ page }, testInfo) => {
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'HOW TO PLAY 98-0' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Close guide' })).toBeFocused();
  await expect(guide).toContainText('45 wins');
  await expect(guide).toContainText('One attempt per day, even if cancelled.');
  await expect(guide).not.toContainText(/practice/i);
  await expectFits(page);
  expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('guide-first-visit.png'), animations: 'disabled' });
  expect(await guide.evaluate((element) => element.matches(':modal'))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(guide.getByRole('button', { name: "LET'S PLAY" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('guide-bottom.png'), animations: 'disabled' });
  await page.keyboard.press('Shift+Tab');
  await expect(guide.getByRole('button', { name: 'Close guide' })).toBeFocused();
  await guide.getByRole('button', { name: "LET'S PLAY" }).click();
  await expect(guide).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('98-0-guide-v1'))).toBe('dismissed');
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
  const saved = await savedState(page);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();
  expect(await savedState(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  await expect(guide).not.toBeVisible();
  expect(await savedState(page)).toEqual(saved);
});

test('Escape dismisses the first visit guide and restores focus after reopening', async ({ page }) => {
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'HOW TO PLAY 98-0' });
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).not.toBeVisible();
  await page.reload();
  const trigger = page.getByRole('button', { name: 'How to play', exact: true });
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  await expect(guide).not.toBeVisible();
  await trigger.click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('guide remains dismissible and gameplay works when guide storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === '98-0-guide-v1') throw new DOMException('Storage blocked', 'SecurityError');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === '98-0-guide-v1') throw new DOMException('Storage blocked', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'HOW TO PLAY 98-0' });
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();
  await expect(guide).not.toBeVisible();
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).not.toBeVisible();
});

test('returning player header fits with guide, sound, vibration and install controls', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('98-0-guide-v1', 'dismissed');
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog', { name: 'HOW TO PLAY 98-0' })).not.toBeVisible();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await expect(page.getByRole('button', { name: 'Install 98-0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /game vibration/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /game sound/ })).toBeVisible();
  await expectFits(page);
  const controls = await page.locator('.topbar-right button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  for (let index = 1; index < controls.length; index++) {
    const previous = controls[index - 1];
    const current = controls[index];
    expect(current.left >= previous.right || current.top >= previous.bottom).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('guide-header.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'HOW TO PLAY 98-0' })).toBeVisible();
});