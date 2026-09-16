'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import playerData from '../../data/processed/players.json';
import coachData from '../../data/processed/coaches.json';
import franchiseData from '../../data/processed/franchises.json';
import opponentData from '../../data/processed/opponents.json';
import type { DraftSlot, RerollKind } from '../engine/draft';
import { applyDraftAction, createRun, finishSeason, recoverRun, startSeason } from '../engine/run';
import type { RunSave } from '../engine/run';
import { advancePlayback, restorePlayback } from '../engine/playback';
import type { SeasonPlayback } from '../engine/playback';
import type { Coach, OpponentPool, Player } from '../engine/types';

export const players = playerData as Player[];
export const coaches = coachData as Coach[];
export const franchises = franchiseData;
const opponents = opponentData.regularSeasonPool as OpponentPool;
const data = { players, coaches, opponents };
const saveKey = '98-0-draft-v1';

function storageWarning() {
  window.dispatchEvent(new Event('98-0-storage-error'));
}

function backupSave(raw: string) {
  try { localStorage.setItem(`${saveKey}-recovery`, raw); }
  catch { storageWarning(); }
}

const storage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (raw === null) return null;
      try {
        const envelope: unknown = JSON.parse(raw);
        if (!envelope || typeof envelope !== 'object' || !Object.hasOwn(envelope, 'state'))
          throw new Error('Invalid save envelope.');
      }
      catch {
        backupSave(raw);
        return JSON.stringify({ state: { invalid: true }, version: 1 });
      }
      return raw;
    } catch { storageWarning(); return null; }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); }
    catch { storageWarning(); }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); }
    catch { storageWarning(); }
  },
};

interface DraftStore {
  run: RunSave | null;
  playback: SeasonPlayback | null;
  notice: string | null;
  clearNotice: () => void;
  newRun: () => void;
  chooseCoach: (id: string) => void;
  spin: () => void;
  reroll: (kind: RerollKind) => void;
  pick: (id: string, slot: DraftSlot) => void;
  start: () => void;
  revealNext: () => void;
  skipSeason: () => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      run: null,
      playback: null,
      notice: null,
      clearNotice: () => set({ notice: null }),
      newRun: () => set({ run: createRun(crypto.randomUUID(), coaches), playback: null }),
      chooseCoach: (id) => set((state) => ({ run: applyDraftAction(state.run!, { type: 'COACH', id }, players) })),
      spin: () => set((state) => ({ run: applyDraftAction(state.run!, { type: 'SPIN' }, players) })),
      reroll: (kind) => set((state) => ({ run: applyDraftAction(state.run!, { type: 'REROLL', kind }, players) })),
      pick: (id, slot) => set((state) => ({ run: applyDraftAction(state.run!, { type: 'PICK', id, slot }, players) })),
      start: () => {
        set((state) => state.run && !state.run.season ? {
          run: startSeason(state.run),
          playback: { runId: state.run.id, revealed: 0, overtimePeriod: null },
        } : state);
        set((state) => state.run ? { run: finishSeason(state.run, opponents) } : state);
      },
      revealNext: () => set((state) => state.run?.season && state.playback ? {
        playback: advancePlayback(state.playback, state.run.season.gameLog),
      } : state),
      skipSeason: () => set((state) => state.run?.season ? {
        playback: { runId: state.run.id, revealed: state.run.season.gameLog.length, overtimePeriod: null },
      } : state),
    }),
    {
      name: saveKey,
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ run: state.run, playback: state.playback }),
      migrate: (saved) => saved as { run: RunSave | null },
      merge: (saved, current) => {
        const recovered = recoverRun(saved, data, crypto.randomUUID());
        if (recovered.notice && !recovered.run) {
          const raw = storage.getItem(saveKey);
          if (typeof raw === 'string' && !raw.includes('"invalid":true')) backupSave(raw);
        }
        const playback = recovered.run?.season
          ? restorePlayback((saved as { playback?: unknown })?.playback, recovered.run.id, recovered.run.season.gameLog)
          : null;
        return { ...current, ...recovered, playback };
      },
      skipHydration: true,
    },
  ),
);
