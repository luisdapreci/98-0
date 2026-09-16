export const ENGINE_VERSION = 'season-3';
export const DATA_VERSION = '2026-09-14';
export const RANDOM_VERSION = 'fnv1a-mulberry32-1';

export function streamSeed(seed: string, stream: string): number {
  let hash = 2166136261;
  for (const character of JSON.stringify([RANDOM_VERSION, seed, stream])) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return hash;
}

export function createRandom(initialState: number) {
  if (!Number.isInteger(initialState) || initialState < 0 || initialState > 0xffffffff)
    throw new Error('Random state must be an unsigned 32-bit integer.');
  let state = initialState;
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    state: () => state,
  };
}

export function randomStream(seed: string, stream: string) {
  return createRandom(streamSeed(seed, stream));
}

export function shuffle<Value>(values: readonly Value[], random: () => number): Value[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const selected = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[selected]] = [shuffled[selected]!, shuffled[index]!];
  }
  return shuffled;
}