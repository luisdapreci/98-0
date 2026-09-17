'use client';

import { useEffect } from 'react';
import { Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react';
import { gameAudio, useAudioSettings } from '../lib/game-audio';
import { gameHaptics, useHapticSettings } from '../lib/game-haptics';

export function SoundControls() {
  const { enabled, error } = useAudioSettings();
  const haptics = useHapticSettings();
  useEffect(() => gameAudio.initialize(), []);
  useEffect(() => gameHaptics.initialize(), []);
  return <>
    <div className="sound-controls" role="group" aria-label="Game audio">
    <button className="icon-button" onClick={gameAudio.toggle} aria-pressed={enabled}
      aria-label={enabled ? 'Mute game sound' : 'Enable game sound'} title={enabled ? 'Mute game sound' : 'Enable game sound'}>
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
    {error && <span className="sound-error" role="status">{error}</span>}
    </div>
    {haptics.supported && <div className="sound-controls" role="group" aria-label="Game haptics">
      <button className="icon-button" onClick={gameHaptics.toggle} aria-pressed={haptics.enabled}
        aria-label={haptics.enabled ? 'Disable game vibration' : 'Enable game vibration'}
        title={haptics.enabled ? 'Disable game vibration' : 'Enable game vibration'}>
        {haptics.enabled ? <Vibrate size={18} aria-hidden="true" /> : <VibrateOff size={18} aria-hidden="true" />}
      </button>
      {haptics.error && <span className="sound-error" role="status">{haptics.error}</span>}
    </div>}
  </>;
}