import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { Page } from '@playwright/test';
import { availablePlayers, availableSlots } from '../../src/engine/draft.ts';
import { createRun } from '../../src/engine/run.ts';
import type { SoundCue } from '../../src/lib/sound-effects.ts';
import { data, expect, expectFits, loadRun, readyFixture, savedState, saveKey, scenario, test } from './fixtures';

declare global {
  interface Window {
    audioProbe: { starts: number; stops: number; contexts: AudioContext[]; gains: GainNode[] };
    hapticProbe: (number | number[])[];
    soundTest: typeof import('../../src/lib/sound-effects.ts');
  }
}

async function instrumentHaptics(page: Page, behavior: 'supported' | 'missing' | 'blocked' | 'throws' = 'supported') {
  await page.addInitScript((behavior) => {
    window.hapticProbe = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: behavior === 'missing' ? undefined
      : (pattern: number | number[]) => {
        if (behavior === 'throws') throw new Error('Vibration unavailable');
        window.hapticProbe.push(pattern);
        return behavior !== 'blocked';
      } });
  }, behavior);
}
const pulses = (page: Page) => page.evaluate(() => window.hapticProbe.filter((pattern) => pattern !== 0));

async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    window.audioProbe = { starts: 0, stops: 0, contexts: [], gains: [] };
    const OriginalContext = window.AudioContext;
    window.AudioContext = class extends OriginalContext {
      constructor() { super(); window.audioProbe.contexts.push(this); }
      createGain() {
        const gain = super.createGain();
        window.audioProbe.gains.push(gain);
        return gain;
      }
      createOscillator() {
        const source = super.createOscillator();
        const start = source.start.bind(source);
        const stop = source.stop.bind(source);
        source.start = (when) => { window.audioProbe.starts++; start(when); };
        source.stop = (when) => { window.audioProbe.stops++; stop(when); };
        return source;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (when, offset, duration) => { window.audioProbe.starts++; start(when, offset, duration); };
        return source;
      }
    };
  });
}
const starts = (page: Page) => page.evaluate(() => window.audioProbe.starts);

test('sound palette renders non-silent unclipped waveforms and cancels scheduled voices', async ({ page }) => {
  await page.goto('/');
  const source = readFileSync(new URL('../../src/lib/sound-effects.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  await page.addScriptTag({ content: `{ const exports = {}; ${compiled}\nwindow.soundTest = exports; }` });
  const measurements = await page.evaluate(async () => {
    const records = [];
    for (const cue of Object.keys(window.soundTest.SOUND_CUES) as SoundCue[]) {
      const context = new OfflineAudioContext(1, 3 * 44100, 44100);
      window.soundTest.renderSound(context, context.destination, cue);
      const samples = (await context.startRendering()).getChannelData(0);
      let peak = 0;
      let energy = 0;
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      const cancelled = new OfflineAudioContext(1, 3 * 44100, 44100);
      const stop = window.soundTest.renderSound(cancelled, cancelled.destination, cue);
      stop();
      stop();
      const stopped = (await cancelled.startRendering()).getChannelData(0);
      records.push({ cue, peak, energy, tail: samples.slice(-4410).some((sample) => Math.abs(sample) > 0.0001),
        leaked: stopped.slice(4410).some((sample) => Math.abs(sample) > 0.0001) });
    }
    return records;
  });
  expect(measurements).toHaveLength(14);
  for (const clip of measurements) {
    expect(clip.peak, clip.cue).toBeGreaterThan(0.001);
    expect(clip.peak, clip.cue).toBeLessThan(1);
    expect(clip.energy, clip.cue).toBeGreaterThan(0.01);
    expect(clip.tail, clip.cue).toBe(false);
    expect(clip.leaked, clip.cue).toBe(false);
  }
});

test('draft sounds share one context, persist settings, mute immediately and fit mobile', async ({ page }, testInfo) => {
  await instrumentAudio(page);
  await loadRun(page, createRun('browser-audio-draft', data.coaches), 0);
  const original = (await savedState(page)).run;
  expect(await starts(page)).toBe(0);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Mute game sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  expect((await savedState(page)).run).toEqual(original);
  expect(await page.evaluate(() => window.audioProbe.gains[0].gain.value)).toBe(1);
  await expect(page.getByRole('group', { name: 'Game audio' }).getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('slider', { name: 'Sound volume' })).toHaveCount(0);
  await expect(page.getByLabel('Sound settings', { exact: true })).toHaveCount(0);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('sound-controls.png'), fullPage: true, animations: 'disabled' });
  let before = await starts(page);
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  before = await starts(page);
  await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
  await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  const run = (await savedState(page)).run;
  const eligible = availablePlayers(run.draft, data.players).find((player) => availableSlots(run.draft.lineup, player).length)!;
  const slot = availableSlots(run.draft.lineup, eligible)[0]!;
  await page.getByRole('button', { name: `Draft ${eligible.name}`, exact: true }).click();
  before = await starts(page);
  await page.getByRole('dialog').getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  const stops = await page.evaluate(() => window.audioProbe.stops);
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  expect(await page.evaluate(() => window.audioProbe.stops)).toBeGreaterThan(stops);
  before = await starts(page);
  await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
  await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
  expect(await starts(page)).toBe(before);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable game sound', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.audioProbe.gains[0].gain.value)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('98-0-audio-v1')!))).toEqual({ enabled: true });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute game sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await starts(page)).toBe(0);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await page.getByRole('button', { name: 'Reroll team', exact: true }).click();
  await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.audioProbe.gains[0].gain.value)).toBe(1);
});

test('legacy volume is ignored at full gain while mute and malformed preference recovery work', async ({ page }) => {
  await instrumentAudio(page);
  await loadRun(page, createRun('browser-audio-legacy', data.coaches), 0);
  const original = (await savedState(page)).run;
  for (const saved of ['{"enabled":true,"volume":0}', '{"enabled":true,"volume":0.25}',
    '{"enabled":false,"volume":0.25}', '{"enabled":true}', '{invalid']) {
    await page.evaluate((value) => localStorage.setItem('98-0-audio-v1', value), saved);
    await page.reload();
    const muted = saved.includes('false');
    await expect(page.getByRole('button', { name: muted ? 'Enable game sound' : 'Mute game sound', exact: true }))
      .toHaveAttribute('aria-pressed', String(!muted));
    expect(await starts(page)).toBe(0);
    if (!muted) await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
    await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
    await expect.poll(() => starts(page)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.audioProbe.gains[0].gain.value)).toBe(1);
    expect((await savedState(page)).run).toEqual(original);
  }
});

test('season play, pause, reveal and skip sound without changing saved outcomes', async ({ page }) => {
  await instrumentAudio(page);
  await loadRun(page, readyFixture('browser-audio-season'), 0);
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  let before = await starts(page);
  await page.getByRole('button', { name: 'START SEASON', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  const resolved = (await savedState(page)).run;
  await page.getByRole('button', { name: '5x speed', exact: true }).click();
  before = await starts(page);
  await page.getByRole('button', { name: 'Play playback', exact: true }).click();
  await expect.poll(async () => (await savedState(page)).playback.revealed).toBeGreaterThan(1);
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  before = await starts(page);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  before = await starts(page);
  await page.getByRole('button', { name: 'Next reveal', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  expect((await savedState(page)).run).toEqual(resolved);
  expect(await starts(page) - before).toBeLessThan(30);
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
});

test('postseason sounds reveal overtime and the ending only on progression, with background cancellation', async ({ page }) => {
  await instrumentAudio(page);
  const { finished } = scenario('overtime');
  await loadRun(page, finished);
  const index = finished.postseason!.gameLog.findIndex((game) => game.overtime.length);
  await page.evaluate(({ saveKey, index }) => {
    const saved = JSON.parse(localStorage.getItem(saveKey)!);
    saved.state.postseasonPlayback.revealed = index;
    localStorage.setItem(saveKey, JSON.stringify(saved));
  }, { saveKey, index });
  await page.reload();
  expect(await starts(page)).toBe(0);
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  let before = await starts(page);
  await page.getByRole('button', { name: 'Next Game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next overtime period', exact: true })).toBeVisible();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  const stopped = await page.evaluate(() => window.audioProbe.stops);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('suspended');
  expect(await page.evaluate(() => window.audioProbe.stops)).toBeGreaterThan(stopped);
  before = await starts(page);
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  expect(await starts(page)).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await starts(page)).toBe(before);
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(before);
  expect(await starts(page) - before).toBeLessThan(15);
  expect((await savedState(page)).run).toEqual(finished);
  await page.reload();
  expect(await starts(page)).toBe(0);
});

test('unsupported audio fails visibly without blocking draft actions', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'AudioContext', { value: undefined }));
  await loadRun(page, createRun('browser-audio-unsupported', data.coaches), 0);
  const original = (await savedState(page)).run;
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game sound', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Audio is unavailable' })).toBeVisible();
  expect((await savedState(page)).run).toEqual(original);
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  await expect(page.locator('.sound-error')).toHaveCount(0);
});

test('haptics follow muted draft actions, persist independently and fit mobile', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await instrumentHaptics(page);
  await loadRun(page, createRun('browser-haptics-draft', data.coaches), 0);
  const original = (await savedState(page)).run;
  await expect(page.getByRole('button', { name: 'Disable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await pulses(page)).toEqual([]);
  await page.getByRole('button', { name: 'Mute game sound', exact: true }).click();
  expect(await pulses(page)).toEqual([]);
  await page.getByRole('button', { name: 'Disable game vibration', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
  expect(await pulses(page)).toEqual([[180, 100, 180]]);
  expect((await savedState(page)).run).toEqual(original);
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath('haptic-controls.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: /^Select / }).first().click();
  expect((await pulses(page)).at(-1)).toEqual([15, 40, 25]);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const name of ['SPIN THE REELS', 'Reroll team', 'Reroll era']) {
    const before = (await pulses(page)).length;
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'true');
    expect((await pulses(page)).slice(before)).toEqual([750]);
    await page.clock.runFor(749);
    await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'true');
    await page.clock.runFor(1);
    await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
    expect((await pulses(page)).slice(before)).toEqual([750]);
  }
  await page.clock.resume();
  const run = (await savedState(page)).run;
  const eligible = availablePlayers(run.draft, data.players).find((player) => availableSlots(run.draft.lineup, player).length)!;
  const slot = availableSlots(run.draft.lineup, eligible)[0]!;
  await page.getByRole('button', { name: `Draft ${eligible.name}`, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: `LOCK ${slot === 'SIXTH' ? '6TH' : slot}`, exact: true }).click();
  expect((await pulses(page)).at(-1)).toEqual([20, 40, 30]);
  await page.getByRole('button', { name: 'Disable game vibration', exact: true }).click();
  expect(await page.evaluate(() => window.hapticProbe.at(-1))).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Enable game sound', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'SPIN THE REELS', exact: true }).click();
  await expect(page.locator('.player-list')).toHaveAttribute('aria-busy', 'false');
  expect(await pulses(page)).toEqual([]);
  await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Disable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await pulses(page)).toEqual([]);
});

test('haptics respect reduced motion and handle malformed or unwritable preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await instrumentHaptics(page);
  await loadRun(page, createRun('browser-haptics-preferences', data.coaches), 0);
  await expect(page.getByRole('button', { name: 'Enable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
  expect(await pulses(page)).toEqual([[180, 100, 180]]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Disable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await pulses(page)).toEqual([]);
  for (const saved of ['{invalid', '{"enabled":"true"}', 'null']) {
    await page.evaluate((value) => localStorage.setItem('98-0-haptics-v1', value), saved);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enable game vibration', exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === '98-0-haptics-v1') throw new Error('Storage unavailable');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'could not save your vibration preference' })).toBeVisible();
  expect(await pulses(page)).toEqual([[180, 100, 180]]);
  await page.getByRole('button', { name: /^Select / }).first().click();
  await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
});

test('haptics follow postseason reveals, cancel in the background and never replay saved results', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await instrumentHaptics(page);
  const { finished } = scenario('overtime');
  await loadRun(page, finished);
  const index = finished.postseason!.gameLog.findIndex((game) => game.overtime.length);
  await page.evaluate(({ saveKey, index }) => {
    const saved = JSON.parse(localStorage.getItem(saveKey)!);
    saved.state.postseasonPlayback.revealed = index;
    localStorage.setItem(saveKey, JSON.stringify(saved));
    localStorage.setItem('98-0-audio-v1', '{"enabled":false}');
  }, { saveKey, index });
  await page.reload();
  expect(await pulses(page)).toEqual([]);
  await page.getByRole('button', { name: 'Next Game', exact: true }).click();
  await expect.poll(async () => (await pulses(page)).at(-1)).toEqual([25, 60, 25]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.hapticProbe.at(-1))).toBe(0);
  const before = await pulses(page);
  await page.getByRole('button', { name: 'Disable game vibration', exact: true }).click();
  await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
  expect(await pulses(page)).toEqual(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await pulses(page)).toEqual(before);
  await page.getByRole('button', { name: 'Skip to final result', exact: true }).click();
  await expect.poll(async () => (await pulses(page)).length).toBeGreaterThan(before.length);
  expect((await savedState(page)).run).toEqual(finished);
  await page.reload();
  expect(await pulses(page)).toEqual([]);
});

test('missing, blocked or throwing vibration APIs never block the draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const behavior of ['missing', 'blocked', 'throws'] as const) {
    await instrumentHaptics(page, behavior);
    await loadRun(page, createRun(`browser-haptics-${behavior}`, data.coaches), 0);
    await expect(page.getByRole('group', { name: 'Game haptics', exact: true })).toHaveCount(behavior === 'missing' ? 0 : 1);
    await page.getByRole('button', { name: /^Select / }).first().click();
    await expect(page.getByRole('button', { name: 'SPIN THE REELS', exact: true })).toBeEnabled();
    if (behavior !== 'missing') {
      const message = behavior === 'blocked' ? 'The browser blocked vibration.' : 'Vibration is unavailable in this browser.';
      await expect(page.getByRole('group', { name: 'Game haptics' }).getByRole('status')).toContainText(message);
      await expectFits(page);
      await page.getByRole('button', { name: 'Disable game vibration', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Game haptics' }).getByRole('status')).toHaveCount(0);
      await page.getByRole('button', { name: 'Enable game vibration', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Game haptics' }).getByRole('status')).toContainText(message);
    }
  }
  expect(errors).toEqual([]);
});