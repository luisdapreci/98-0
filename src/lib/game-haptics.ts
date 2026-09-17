'use client';

import { create } from 'zustand';
import type { SoundCue } from './sound-effects';

const preferenceKey = '98-0-haptics-v1';
const patterns: Record<SoundCue, number | number[]> = {
  reels: [12, 45, 12, 65, 20],
  lock: [20, 40, 30],
  coach: [15, 40, 25],
  switch: 10,
  start: [15, 50, 15],
  stop: 10,
  win: 12,
  loss: 25,
  overtime: [25, 60, 25],
  advance: [20, 50, 20, 50, 35],
  champion: [30, 60, 30, 60, 60],
  eliminated: [40, 70, 20],
  perfect: [25, 50, 25, 50, 35, 70, 60],
  tension: [12, 70, 12],
};

export const useHapticSettings = create<{ supported: boolean; enabled: boolean; error: string }>(() =>
  ({ supported: false, enabled: false, error: '' }));
let activated = false;

function stop() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(0); } catch {}
}

function play(cue: SoundCue) {
  const { supported, enabled } = useHapticSettings.getState();
  if (!supported || !enabled || !activated || document.hidden) return;
  try { navigator.vibrate(patterns[cue]); } catch {}
}

export const gameHaptics = {
  play,
  stop,
  toggle() {
    if (!useHapticSettings.getState().supported) return;
    const enabled = !useHapticSettings.getState().enabled;
    useHapticSettings.setState({ enabled, error: '' });
    try { localStorage.setItem(preferenceKey, JSON.stringify({ enabled })); }
    catch { useHapticSettings.setState({ error: 'This browser could not save your vibration preference.' }); }
    if (enabled) play('lock');
    else stop();
  },
  initialize() {
    const supported = typeof navigator.vibrate === 'function';
    let enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null');
      if (saved && typeof saved.enabled === 'boolean') enabled = saved.enabled;
    } catch {}
    useHapticSettings.setState({ supported, enabled, error: '' });
    activated = false;
    const gesture = (event: Event) => { if (event.isTrusted) activated = true; };
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('pointerdown', gesture, true);
    document.addEventListener('keydown', gesture, true);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      stop();
      activated = false;
      document.removeEventListener('pointerdown', gesture, true);
      document.removeEventListener('keydown', gesture, true);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
    };
  },
};