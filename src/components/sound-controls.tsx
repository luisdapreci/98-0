'use client';

import { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameAudio, useAudioSettings } from '../lib/game-audio';

export function SoundControls() {
  const { enabled, error } = useAudioSettings();
  useEffect(() => gameAudio.initialize(), []);
  return <div className="sound-controls" role="group" aria-label="Game audio">
    <button className="icon-button" onClick={gameAudio.toggle} aria-pressed={enabled}
      aria-label={enabled ? 'Mute game sound' : 'Enable game sound'} title={enabled ? 'Mute game sound' : 'Enable game sound'}>
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
    {error && <span className="sound-error" role="status">{error}</span>}
  </div>;
}