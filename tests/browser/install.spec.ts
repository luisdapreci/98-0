import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expect, expectFits, savedState, test } from './fixtures';

async function openGame(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
}

async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed' | 'error') {
  return page.evaluate((outcome) => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installCalls = String(Number(document.documentElement.dataset.installCalls ?? 0) + 1);
        if (outcome === 'error') throw new Error('Install unavailable');
      },
      userChoice: Promise.resolve({ outcome }),
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, outcome);
}

test('install manifest and PNG icons are usable and the game remains playable', async ({ page, request }, testInfo) => {
  await openGame(page);
  await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
  const favicon = await request.get('/favicon.ico');
  expect(favicon.ok()).toBe(true);
  const faviconBytes = await favicon.body();
  expect(faviconBytes.readUInt16LE(0)).toBe(0);
  expect(faviconBytes.readUInt16LE(2)).toBe(1);
  expect(faviconBytes.readUInt16LE(4)).toBe(3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    expect(faviconBytes[entry]).toBe(size);
    expect(faviconBytes[entry + 1]).toBe(size);
    const offset = faviconBytes.readUInt32LE(entry + 12);
    expect(faviconBytes.subarray(offset, offset + 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(faviconBytes.readUInt32BE(offset + 16)).toBe(size);
    expect(faviconBytes.readUInt32BE(offset + 20)).toBe(size);
  }
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
  const response = await request.get((await manifestLink.getAttribute('href'))!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', short_name: '98-0', display: 'standalone' });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512']);
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  for (const icon of [...manifest.icons, { src: appleIcon, sizes: '180x180' }]) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
    const bytes = await image.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const size = Number(icon.sizes.split('x')[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  const regularProfile = await chromium.launchPersistentContext(testInfo.outputPath('install-profile'), {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
  });
  try {
    const regularPage = await regularProfile.newPage();
    await regularPage.goto(page.url());
    const session = await regularProfile.newCDPSession(regularPage);
    const eligibility = await session.send('Page.getInstallabilityErrors');
    expect(eligibility.installabilityErrors).toEqual([]);
    await session.detach();
  } finally {
    await regularProfile.close();
  }
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
});

test('install accepts one native prompt without changing saved gameplay', async ({ page }, testInfo) => {
  await openGame(page);
  const saved = await savedState(page);
  expect(await offerInstall(page, 'accepted')).toBe(true);
  const install = page.getByRole('button', { name: 'Install 98-0', exact: true });
  await expect(install).toBeVisible();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('install-header.png'), fullPage: true, animations: 'disabled' });
  await install.click();
  await expect(install).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
  expect(await savedState(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('button', { name: 'New run', exact: true })).toBeEnabled();
  expect(await savedState(page)).toEqual(saved);
});

test('dismissed install is not reused and a new browser offer works', async ({ page }) => {
  await openGame(page);
  await offerInstall(page, 'dismissed');
  const install = page.getByRole('button', { name: 'Install 98-0', exact: true });
  await install.click();
  await expect(install).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
  await offerInstall(page, 'accepted');
  await install.click();
  await expect(install).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '2');
});

test('failed install shows a dismissible fallback and preserves the run', async ({ page }) => {
  await openGame(page);
  const saved = await savedState(page);
  await offerInstall(page, 'error');
  await page.getByRole('button', { name: 'Install 98-0', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Install 98-0', exact: true });
  await expect(dialog).toContainText('Installation could not open.');
  await dialog.getByRole('button', { name: 'Close install dialog' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await savedState(page)).toEqual(saved);
});

test('appinstalled removes the install control', async ({ page }) => {
  await openGame(page);
  await offerInstall(page, 'dismissed');
  await expect(page.getByRole('button', { name: 'Install 98-0', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('button', { name: 'Install 98-0', exact: true })).toHaveCount(0);
});

test('Safari installation guidance opens, closes, and leaves gameplay unchanged', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  });
  await openGame(page);
  const saved = await savedState(page);
  await page.getByRole('button', { name: 'Install 98-0', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Install 98-0', exact: true });
  await expect(dialog).toContainText('Add to Home Screen');
  await expectFits(page);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('install-safari.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Install 98-0', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close install dialog' }).click();
  expect(await savedState(page)).toEqual(saved);
});

test('standalone launches hide installation controls', async ({ page }) => {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = originalMatchMedia(query);
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await openGame(page);
  await offerInstall(page, 'accepted');
  await expect(page.getByRole('button', { name: 'Install 98-0', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Select / }).first()).toBeEnabled();
});