'use client';

import { useEffect } from 'react';
import { SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { gameAudio, useAudioSettings } from '../lib/game-audio';

export function SoundControls() {
  const { enabled, volume, error } = useAudioSettings();
  useEffect(() => gameAudio.initialize(), []);
  return <div className="sound-controls" role="group" aria-label="Game audio">
    <button className="icon-button" onClick={gameAudio.toggle} aria-pressed={enabled}
      aria-label={enabled ? 'Mute game sound' : 'Enable game sound'} title={enabled ? 'Mute game sound' : 'Enable game sound'}>
      {enabled && volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
    <details className="sound-settings">
      <summary aria-label="Sound settings" title="Sound settings"><SlidersHorizontal size={16} /></summary>
      <div className="sound-popover">
        <label htmlFor="sound-volume">VOLUME <output>{Math.round(volume * 100)}%</output></label>
        <input id="sound-volume" aria-label="Sound volume" type="range" min="0" max="100" step="5"
          value={Math.round(volume * 100)} onChange={(event) => gameAudio.setVolume(Number(event.target.value) / 100)} />
        <button className="text-button" disabled={!enabled || volume === 0} onClick={() => gameAudio.play('lock')}>Test sound</button>
      </div>
    </details>
    {error && <span className="sound-error" role="status">{error}</span>}
  </div>;
}