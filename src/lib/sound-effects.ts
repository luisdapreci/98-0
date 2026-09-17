export type SoundCue = 'reels' | 'lock' | 'coach' | 'switch' | 'start' | 'stop' | 'win' | 'loss'
  | 'overtime' | 'advance' | 'champion' | 'eliminated' | 'perfect' | 'tension';

type Voice = {
  at: number;
  duration: number;
  frequency: number;
  end?: number;
  gain: number;
  wave?: OscillatorType | 'noise';
  attack?: number;
  filter?: number;
};

const bounce = (at = 0, gain = 0.45): Voice[] => [
  { at, duration: 0.19, frequency: 125, end: 48, gain, attack: 0.006 },
  { at, duration: 0.045, frequency: 450, gain: gain * 0.16, wave: 'noise', filter: 650 },
];
const squeak = (at = 0): Voice => ({ at, duration: 0.13, frequency: 580, end: 820, gain: 0.035, wave: 'sine', attack: 0.012 });
const swish = (at = 0): Voice => ({ at, duration: 0.22, frequency: 900, gain: 0.13, wave: 'noise', attack: 0.045, filter: 1100 });
const whistle = (at = 0): Voice[] => [
  { at, duration: 0.18, frequency: 650, end: 740, gain: 0.04, attack: 0.035 },
  { at, duration: 0.16, frequency: 870, end: 940, gain: 0.018, attack: 0.03 },
];
const buzzer = (at = 0, duration = 0.22): Voice => ({ at, duration, frequency: 100, gain: 0.09, wave: 'triangle', attack: 0.012, filter: 380 });
const crowd = (at = 0, duration = 0.8): Voice => ({ at, duration, frequency: 450, gain: 0.11, wave: 'noise', attack: 0.16, filter: 800 });
const notes = (frequencies: readonly number[], spacing = 0.12): Voice[] => frequencies.map((frequency, index) =>
  ({ at: index * spacing, duration: 0.28, frequency: frequency / 2, gain: 0.095, wave: 'sine', attack: 0.02 }));

export const SOUND_CUES: Record<SoundCue, readonly Voice[]> = {
  reels: [
    ...[0, 0.055, 0.115, 0.185, 0.265, 0.36, 0.47, 0.6].map((at, index): Voice =>
      ({ at, duration: 0.045, frequency: 360 - index * 20, end: 110, gain: 0.09, wave: 'triangle', attack: 0.006, filter: 650 })),
    ...bounce(0.69, 0.28),
  ],
  lock: [...bounce(), { at: 0.07, duration: 0.085, frequency: 460, end: 160, gain: 0.07, wave: 'triangle', filter: 700 }, swish(0.13)],
  coach: [...notes([330, 440, 550]), ...bounce(0.06, 0.2)],
  switch: [{ at: 0, duration: 0.09, frequency: 260, end: 360, gain: 0.075, wave: 'sine', attack: 0.008 }],
  start: [...bounce(), ...bounce(0.19, 0.3), squeak(0.31), ...whistle(0.37)],
  stop: [...whistle(), buzzer(0.12, 0.1)],
  win: [swish(), { at: 0.075, duration: 0.14, frequency: 330, end: 440, gain: 0.06, wave: 'sine', attack: 0.012 }],
  loss: [buzzer(0, 0.15), ...bounce(0.045, 0.2)],
  overtime: [buzzer(0, 0.3), ...whistle(0.35), ...bounce(0.58, 0.25)],
  advance: [crowd(), ...notes([392, 494, 587, 784]), swish(0.38)],
  champion: [crowd(0, 1.6), ...notes([392, 494, 587, 784, 988, 1175], 0.18), ...bounce(0.1), swish(0.95)],
  eliminated: [buzzer(0, 0.38), ...notes([330, 262, 196], 0.2)],
  perfect: [crowd(0, 2), ...notes([523, 659, 784, 1047, 1319, 1568], 0.22), swish(1.2)],
  tension: [...bounce(0, 0.24), ...bounce(0.19, 0.16)],
};

export function renderSound(context: BaseAudioContext, destination: AudioNode, cue: SoundCue): () => void {
  const output = context.createGain();
  output.gain.value = 0.65;
  output.connect(destination);
  const sources: AudioScheduledSourceNode[] = [];
  let remaining = SOUND_CUES[cue].length;
  let cancelled = false;
  for (const voice of SOUND_CUES[cue]) {
    const start = context.currentTime + voice.at;
    const end = start + voice.duration;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(voice.gain, start + (voice.attack ?? 0.003));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end - 0.002);
    envelope.gain.linearRampToValueAtTime(0, end);
    envelope.connect(output);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.filter ?? 1400;
    filter.Q.value = 0.5;
    filter.connect(envelope);
    let source: AudioScheduledSourceNode;
    if (voice.wave === 'noise') {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * voice.duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let noiseState = 48271;
      for (let index = 0; index < samples.length; index++) {
        noiseState = (noiseState * 16807) % 2147483647;
        samples[index] = noiseState / 1073741823.5 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = voice.wave ?? 'sine';
      oscillator.frequency.setValueAtTime(voice.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(voice.end ?? voice.frequency, end);
      source = oscillator;
    }
    source.connect(filter);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      if (--remaining === 0) output.disconnect();
    };
    source.start(start);
    source.stop(end);
    sources.push(source);
  }
  return () => {
    if (cancelled) return;
    cancelled = true;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(0, context.currentTime, 0.006);
    for (const source of sources) source.stop(context.currentTime + 0.03);
  };
}