import { readFileSync } from 'node:fs';
import { emptyProgress, recordProgress, resultText } from '../../src/engine/progress';
import { controlledSeason, expect, expectFits, loadRun, readyFixture, savedState, scenario, test } from './fixtures';

const progressKey = '98-0-progress-v1';

test('Almanac unlocks for a losing season before playback and survives new drafts', async ({ page }, testInfo) => {
  await loadRun(page, readyFixture('collection-unlock'), 0);
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeDisabled();
  await loadRun(page, controlledSeason(0, 'collection-zero-wins'), 0);
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeEnabled();
  await page.getByRole('button', { name: /COACH ALMANAC/ }).click();
  await expect(page.locator('.almanac-entry')).toHaveCount(12);
  await expect(page.locator('.almanac-entry').first()).toContainText('Triangle Offense');
  await expectFits(page);
  await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('almanac.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /RUN HISTORY/ }).click();
  await expect(page.locator('.collection-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'NEW RUN', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /COACH ALMANAC/ })).toBeEnabled();
  await page.getByRole('button', { name: /RUN HISTORY/ }).click();
  await expect(page.locator('.history-list li')).toHaveCount(1);
  await expect(page.locator('.history-list')).toContainText('MISSED POSTSEASON');
  await expect(page.locator('.history-record')).toHaveText('0-82');
});

test('history updates pending postseason in place and exported records match the saved perfect run', async ({ page }, testInfo) => {
  const { run, finished } = scenario('perfect');
  await loadRun(page, run);
  await expect(page.getByRole('button', { name: 'SHARE RESULT', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SHARE RESULT', exact: true })).toHaveClass(/primary-button/);
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.share-card')).toContainText('POSTSEASON PENDING');
  await expect(page.getByRole('dialog').locator('.share-card')).not.toContainText('98-0. PERFECT.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'START POSTSEASON', exact: true }).click();
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.share-card')).toContainText('POSTSEASON PENDING');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).runs[0].postseasonStatus, progressKey)).toBe('complete');
  await page.reload();
  expect((await savedState(page)).run).toEqual(finished);
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  const expected = recordProgress(emptyProgress(), finished, true, true).runs[0]!;
  await expect(page.getByLabel('RESULT TEXT', { exact: true })).toHaveValue(resultText(expected));
  await expect(page.getByLabel('RESULT TEXT', { exact: true })).toContainText('https://98-0.vercel.app');
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toHaveClass(/primary-button/);
  await expect(page.getByRole('dialog').locator('.share-card')).toContainText('98-0. PERFECT.');
  await expect(page.getByRole('dialog').locator('.share-card')).toContainText('16-0');
  await expect(page.getByRole('button', { name: 'IMAGE', exact: true })).toBeEnabled();
  await expectFits(page);
  expect(await page.locator('.share-card, .share-card *, .share-actions').evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 1).map((element) => element.className))).toEqual([]);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'IMAGE', exact: true }).click();
  const download = await downloading;
  await download.saveAs(testInfo.outputPath('perfect-share.png'));
  const png = readFileSync((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    let bright = 0;
    let rightHalfBright = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! > 100 && data[index + 1]! > 100) {
        bright++;
        if ((index / 4) % image.width > image.width / 2 && index / 4 > image.width * 40) rightHalfBright++;
      }
    }
    return { width: image.width, height: image.height, bright, rightHalfBright };
  }, png.toString('base64'));
  expect(pixels.width).toBe(1440);
  expect(pixels.height).toBeGreaterThan(800);
  expect(pixels.bright).toBeGreaterThan(10000);
  expect(pixels.rightHalfBright).toBeGreaterThan(1000);
  await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('share-dialog.png') });
});

test('history caps at 50 while per-mode personal bests remain accessible with long names and Daily metadata', async ({ page }, testInfo) => {
  const run = controlledSeason(82, 'collection-history', 'hi');
  let progress = recordProgress(emptyProgress(), run, true, false, 1);
  const best = progress.bests.hi!.record;
  best.lineup[0]!.name = 'Dikembe Mutombo Mpolondo Mukamba Jean-Jacques Wamutombo';
  best.daily = { date: '2026-09-17', kind: 'practice' };
  for (let index = 2; index <= 55; index++) progress = recordProgress(progress,
    { ...run, id: `history-${index}`, iqMode: index % 2 ? 'no' : 'mid', season: { ...run.season!, wins: 45, losses: 37 } }, true, false, index);
  await page.goto('/');
  await page.evaluate(({ key, progress }) => localStorage.setItem(key, JSON.stringify(progress)), { key: progressKey, progress });
  await page.reload();
  await page.getByRole('button', { name: /RUN HISTORY/ }).click();
  await expect(page.locator('.history-list li')).toHaveCount(50);
  await page.getByRole('group', { name: 'History IQ mode' }).getByRole('button', { name: 'HI IQ', exact: true }).click();
  await expect(page.locator('.collection-empty')).toBeVisible();
  await page.getByRole('button', { name: 'PERSONAL BESTS', exact: true }).click();
  await expect(page.locator('.history-list li')).toHaveCount(3);
  await page.getByRole('button', { name: /View result:/ }).first().click();
  await expect(page.getByRole('dialog').locator('.share-card')).toContainText('DAILY / 2026-09-17 UTC / PRACTICE');
  await expect(page.getByRole('dialog').locator('.share-lineup')).toContainText(best.lineup[0]!.name);
  await expect(page.getByRole('button', { name: 'IMAGE', exact: true })).toBeEnabled();
  expect(await page.locator('.share-card, .share-card *').evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 1).map((element) => element.className))).toEqual([]);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'IMAGE', exact: true }).click();
  await (await downloading).saveAs(testInfo.outputPath('long-name-share.png'));
  await expectFits(page);
});

test('clipboard and native-share capability failures preserve selectable text and downloads', async ({ page }) => {
  const run = controlledSeason(44, 'collection-fallback');
  await loadRun(page, run);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  await page.getByRole('button', { name: 'COPY TEXT', exact: true }).click();
  await expect(page.locator('.share-feedback')).toContainText('Clipboard unavailable');
  expect(await page.getByLabel('RESULT TEXT', { exact: true }).evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  await expect(page.locator('.share-feedback')).toContainText('Sharing unavailable');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'TEXT FILE', exact: true }).click();
  const download = await downloading;
  const text = readFileSync((await download.path())!, 'utf8');
  expect(text).toContain('https://98-0.vercel.app');
  expect(text).toBe(resultText(recordProgress(emptyProgress(), run, true, false).runs[0]!));
  await expect(page.locator('.share-feedback')).toContainText('Text download started');
});

test('copy and native share report success, cancellation and failure without losing the result', async ({ page }) => {
  await loadRun(page, controlledSeason(65, 'collection-share-api'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { document.body.dataset.copied = text; } } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { document.body.dataset.shared = `${data.files?.[0]?.type}:${data.text}`; } });
  });
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'IMAGE', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'COPY TEXT', exact: true }).click();
  await expect(page.locator('.share-feedback')).toHaveText('Result text copied.');
  expect(await page.locator('body').getAttribute('data-copied')).toBe(await page.getByLabel('RESULT TEXT', { exact: true }).inputValue());
  expect(await page.locator('body').getAttribute('data-copied')).toContain('https://98-0.vercel.app');
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  await expect(page.locator('.share-feedback')).toHaveText('Result shared.');
  expect(await page.locator('body').getAttribute('data-shared')).toContain('image/png:98-0');
  expect(await page.locator('body').getAttribute('data-shared')).toContain('https://98-0.vercel.app');
  for (const name of ['AbortError', 'NotAllowedError']) {
    await page.evaluate((name) => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Rejected', name); } }), name);
    await page.getByRole('button', { name: 'SHARE', exact: true }).click();
    await expect(page.locator('.share-feedback')).toContainText(name === 'AbortError' ? 'Share cancelled.' : 'Sharing failed.');
  }
  await expect(page.getByLabel('RESULT TEXT', { exact: true })).not.toHaveValue('');
});

test('image generation failure leaves the text fallback usable', async ({ page }) => {
  await loadRun(page, controlledSeason(44, 'collection-image-error'));
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function () { throw new Error('Export blocked'); }; });
  await page.getByRole('button', { name: 'SHARE RESULT', exact: true }).click();
  await expect(page.locator('.share-feedback')).toContainText('Image export failed');
  await expect(page.getByRole('button', { name: 'IMAGE', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'TEXT FILE', exact: true })).toBeEnabled();
  await expect(page.getByLabel('RESULT TEXT', { exact: true })).toContainText('44-38');
});