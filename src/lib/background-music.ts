export function prepareMusicLoop(buffer: AudioBuffer) {
  const fadeFrames = Math.min(Math.round(3 * buffer.sampleRate), Math.floor(buffer.length / 2));
  if (fadeFrames < 2) throw new Error('Music track is too short.');
  const tailStart = buffer.length - fadeFrames;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < fadeFrames; frame++) {
      const progress = frame / (fadeFrames - 1);
      samples[tailStart + frame] = samples[tailStart + frame]! * (1 - progress) + samples[frame]! * progress;
    }
  }
  return { buffer, loopStart: fadeFrames / buffer.sampleRate };
}

export function createBackgroundMusic(context: AudioContext, output: AudioNode,
  canPlay: () => boolean, onError: () => void) {
  const controller = new AbortController();
  let loading: Promise<ReturnType<typeof prepareMusicLoop>> | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let disposed = false;
  let failed = false;

  return {
    async start() {
      if (disposed || failed || source || !canPlay()) return;
      try {
        loading ??= fetch('/audio/background-music.mp3', { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error('Music could not load.');
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .then(prepareMusicLoop);
        const loop = await loading;
        if (disposed || source || !canPlay() || context.state !== 'running') return;
        source = context.createBufferSource();
        source.buffer = loop.buffer;
        source.loop = true;
        source.loopStart = loop.loopStart;
        source.loopEnd = loop.buffer.duration;
        gain = context.createGain();
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, context.currentTime + 0.75);
        source.connect(gain).connect(output);
        source.start();
      } catch {
        if (!disposed && !failed) {
          failed = true;
          onError();
        }
      }
    },
    dispose() {
      disposed = true;
      controller.abort();
      source?.stop();
      source?.disconnect();
      gain?.disconnect();
      source = null;
      gain = null;
      loading = null;
    },
  };
}