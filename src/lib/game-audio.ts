'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { renderSound } from './sound-effects';
import type { SoundCue } from './sound-effects';
import { gameHaptics } from './game-haptics';

const preferenceKey = '98-0-audio-v1';
export const useAudioSettings = create<{ enabled: boolean; error: string }>(() =>
  ({ enabled: true, error: '' }));
let context: AudioContext | null = null;
let master: GainNode | null = null;
let generation = 0;
const active = new Map<string, { cancel: () => void }>();

function savePreferences() {
  const { enabled } = useAudioSettings.getState();
  try { localStorage.setItem(preferenceKey, JSON.stringify({ enabled })); }
  catch { useAudioSettings.setState({ error: 'Sound works, but this browser could not save your audio preferences.' }); }
}

function stopAll() {
  generation++;
  for (const sound of active.values()) sound.cancel();
  active.clear();
}

async function unlock(): Promise<boolean> {
  if (!useAudioSettings.getState().enabled || document.hidden) return false;
  try {
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      master = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 6;
      master.connect(limiter).connect(context.destination);
    }
    master!.gain.value = 1;
    if (context.state !== 'running') await context.resume();
    return context.state === 'running';
  } catch {
    useAudioSettings.setState({ error: 'Audio is unavailable. The game can continue without sound.' });
    return false;
  }
}

function channelFor(cue: SoundCue): string {
  if (['win', 'loss', 'overtime', 'advance', 'champion', 'perfect', 'eliminated', 'tension'].includes(cue)) return 'result';
  return cue === 'start' || cue === 'stop' ? 'playback' : 'action';
}

function play(cue: SoundCue, withHaptics = true) {
  if (withHaptics) gameHaptics.play(cue);
  const settings = useAudioSettings.getState();
  if (!settings.enabled || document.hidden) return;
  const requestGeneration = generation;
  const requested = performance.now();
  const emit = () => {
    if (!context || !master || context.state !== 'running' || document.hidden || requestGeneration !== generation
      || !useAudioSettings.getState().enabled || performance.now() - requested > 500) return;
    const channel = channelFor(cue);
    const previous = active.get(channel);
    previous?.cancel();
    try {
      active.set(channel, { cancel: renderSound(context, master, cue) });
    } catch {
      stopAll();
      useAudioSettings.setState({ error: 'A sound could not play. The game can continue without sound.' });
    }
  };
  if (context?.state === 'running') emit();
  else void unlock().then((ready) => { if (ready) emit(); });
}

export const gameAudio = {
  play,
  stopAll() { stopAll(); gameHaptics.stop(); },
  toggle() {
    const enabled = !useAudioSettings.getState().enabled;
    useAudioSettings.setState({ enabled, error: '' });
    stopAll();
    savePreferences();
    if (enabled) play('win', false);
    else if (context?.state === 'running') void context.suspend().catch(() => {});
  },
  initialize() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null');
      if (saved && typeof saved.enabled === 'boolean') useAudioSettings.setState({ enabled: saved.enabled });
    } catch { useAudioSettings.setState({ enabled: true }); }
    const gesture = () => { void unlock(); };
    const hide = () => {
      if (document.hidden) {
        stopAll();
        if (context?.state === 'running') void context.suspend().catch(() => {});
      }
    };
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stopAll);
    return () => {
      stopAll();
      document.removeEventListener('pointerdown', gesture);
      document.removeEventListener('keydown', gesture);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stopAll);
    };
  },
};

export function usePlaybackAudio({ revealed, overtimePeriod, playing, won, ending, advanced, tension }: {
  revealed: number; overtimePeriod: number | null; playing: boolean; won?: boolean;
  ending?: SoundCue; advanced?: boolean; tension?: boolean;
}) {
  const previous = useRef({ revealed, overtimePeriod, playing });
  useEffect(() => {
    const before = previous.current;
    const changed = revealed !== before.revealed || overtimePeriod !== before.overtimePeriod;
    if (playing !== before.playing) gameAudio.play(playing ? 'start' : 'stop');
    if (changed) gameAudio.play(ending ?? (overtimePeriod !== null ? 'overtime' : advanced ? 'advance'
      : tension && revealed % 8 === 0 ? 'tension' : won ? 'win' : 'loss'));
    previous.current = { revealed, overtimePeriod, playing };
  }, [revealed, overtimePeriod, playing, won, ending, advanced, tension]);
}