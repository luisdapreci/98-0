'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import playerData from '../../data/processed/players.json';
import coachData from '../../data/processed/coaches.json';
import franchiseData from '../../data/processed/franchises.json';
import opponentData from '../../data/processed/opponents.json';
import type { DraftSlot, RerollKind } from '../engine/draft';
import { applyDraftAction, createDailyRun, createRun, finishSeason, recoverRun, selectIQMode, startPostseason, startSeason } from '../engine/run';
import { DAILY_VERSION, dailyCommitmentKey, utcDate } from '../engine/daily';
import { rotatingChallengeForDate, DAILY_ROTATION_VERSION } from '../engine/daily-calendar';
import type { DailyAttempt, DailyEntry } from '../engine/daily';
import { readDailyEntries, recordDailyResult, writeDailyEntries } from './daily-storage';
import { RIVALRY_VERSION } from '../engine/rivalry';
import type { RunSave } from '../engine/run';
import { advancePlayback, finishSeriesPlayback, restorePlayback } from '../engine/playback';
import type { SeasonPlayback } from '../engine/playback';
import type { Coach, IQMode, OpponentPool, Player, PlayoffPool } from '../engine/types';

export const players = playerData as Player[];
export const coaches = coachData as Coach[];
export const franchises = franchiseData;
const opponents = opponentData.regularSeasonPool as OpponentPool;
const playoffs = opponentData.playoffPool as PlayoffPool;
const data = { players, coaches, opponents, playoffs };
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
  dailyEntries: DailyEntry[];
  refreshDaily: () => Promise<void>;
  startDaily: (expectedDate?: string) => Promise<void>;
  playback: SeasonPlayback | null;
  postseasonPlayback: SeasonPlayback | null;
  notice: string | null;
  clearNotice: () => void;
  newRun: () => void;
  chooseMode: (mode: IQMode) => void;
  chooseCoach: (id: string) => void;
  spin: () => void;
  reroll: (kind: RerollKind) => void;
  pick: (id: string, slot: DraftSlot) => void;
  start: () => void;
  revealNext: () => void;
  skipSeason: () => void;
  startPlayoffs: () => void;
  revealPostseason: () => void;
  finishPostseasonSeries: () => void;
  skipPostseason: () => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      run: null,
      dailyEntries: [],
      refreshDaily: async () => {
        try {
          const refresh = () => {
            const run = get().run;
            set({ dailyEntries: run?.daily && run.season ? recordDailyResult(run) : readDailyEntries() });
          };
          if (navigator.locks) await navigator.locks.request('98-0-daily-start', refresh);
          else refresh();
        } catch {
          set({ notice: 'Daily records could not be saved or opened. Check browser storage; existing records have not been cleared.' });
        }
      },
      startDaily: async (expectedDate) => {
        if (!navigator.locks) throw new Error('Daily requires a browser with local lock support. Ordinary runs remain available.');
        await navigator.locks.request('98-0-daily-start', () => {
          const current = get().run;
          if (current?.daily && !current.season) return;
          if (current?.daily && current.season) recordDailyResult(current);
          const entries = readDailyEntries();
          const now = Date.now();
          const date = utcDate(now);
          if (expectedDate && expectedDate !== date) throw new Error('The Daily date changed. Reopen Daily to view the new challenge.');
          const challenge = rotatingChallengeForDate(date);
          if (!challenge) throw new Error('Daily rotation begins September 17, 2026 UTC. Check your device date.');
          const attempt: DailyAttempt = { version: DAILY_VERSION, calendarVersion: DAILY_ROTATION_VERSION, challengeId: challenge.id, date, startedAt: now,
            kind: entries.some((entry) => dailyCommitmentKey(entry.attempt) === dailyCommitmentKey({ date, version: DAILY_VERSION }) && entry.attempt.kind === 'local') ? 'practice' : 'local',
            attemptId: crypto.randomUUID() };
          const run = createDailyRun(attempt, coaches, players);
          writeDailyEntries([...entries, { attempt }]);
          set({ run, dailyEntries: [...entries, { attempt }],
            playback: null, postseasonPlayback: null, notice: null });
        });
      },
      playback: null,
      postseasonPlayback: null,
      notice: null,
      clearNotice: () => set({ notice: null }),
      newRun: () => set({ run: createRun(crypto.randomUUID(), coaches, null, RIVALRY_VERSION, 'mid'), playback: null, postseasonPlayback: null }),
      chooseMode: (mode) => set((state) => {
        if (!state.run) return state;
        const run = selectIQMode(state.run, mode, coaches, crypto.randomUUID());
        return run === state.run ? state : { run, playback: null, postseasonPlayback: null };
      }),
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
        if (get().run?.daily) get().refreshDaily();
      },
      revealNext: () => set((state) => state.run?.season && state.playback ? {
        playback: advancePlayback(state.playback, state.run.season.gameLog),
      } : state),
      skipSeason: () => set((state) => state.run?.season ? {
        playback: { runId: state.run.id, revealed: state.run.season.gameLog.length, overtimePeriod: null },
      } : state),
      startPlayoffs: () => set((state) => {
        if (!state.run?.season?.qualified || state.run.postseason || state.playback?.revealed !== 82) return state;
        const run = startPostseason(state.run, playoffs);
        return run.postseason ? { run, postseasonPlayback: { runId: `${run.id}:postseason`, revealed: 0, overtimePeriod: null } } : state;
      }),
      revealPostseason: () => set((state) => state.run?.postseason && state.postseasonPlayback ? {
        postseasonPlayback: advancePlayback(state.postseasonPlayback, state.run.postseason.gameLog),
      } : state),
      finishPostseasonSeries: () => set((state) => state.run?.postseason && state.postseasonPlayback ? {
        postseasonPlayback: finishSeriesPlayback(state.postseasonPlayback, state.run.postseason.gameLog),
      } : state),
      skipPostseason: () => set((state) => state.run?.postseason ? {
        postseasonPlayback: { runId: `${state.run.id}:postseason`, revealed: state.run.postseason.gameLog.length, overtimePeriod: null },
      } : state),
    }),
    {
      name: saveKey,
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ run: state.run, playback: state.playback, postseasonPlayback: state.postseasonPlayback }),
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
        const postseasonPlayback = recovered.run?.postseason
          ? restorePlayback((saved as { postseasonPlayback?: unknown })?.postseasonPlayback ?? {}, `${recovered.run.id}:postseason`, recovered.run.postseason.gameLog)
          : null;
        return { ...current, ...recovered, playback, postseasonPlayback };
      },
      skipHydration: true,
    },
  ),
);
