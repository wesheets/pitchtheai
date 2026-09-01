'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const MUSIC_PREFERENCE = 'pitchtheai:music';

export function LandingSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  const startMusic = useCallback(async () => {
    if (!audioRef.current) {
      const audio = new Audio('/audio/elevenlabs-cinematic.mp3');
      audio.loop = true;
      audio.volume = 0.42;
      audioRef.current = audio;
    }
    try {
      await audioRef.current.play();
      window.sessionStorage.setItem(MUSIC_PREFERENCE, 'on');
      setEnabled(true);
    } catch {
      // The next explicit interaction can unlock browser audio.
    }
  }, []);

  const stopMusic = useCallback(() => {
    audioRef.current?.pause();
    window.sessionStorage.setItem(MUSIC_PREFERENCE, 'off');
    setEnabled(false);
  }, []);

  useEffect(() => {
    const preference = window.sessionStorage.getItem(MUSIC_PREFERENCE);
    if (preference === 'off') return;
    const unlock = (event: PointerEvent | KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.landing-sound-toggle')
      )
        return;
      void startMusic();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      audioRef.current?.pause();
    };
  }, [startMusic]);

  return (
    <button
      type="button"
      className="landing-sound-toggle"
      aria-pressed={enabled}
      onClick={() => (enabled ? stopMusic() : void startMusic())}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
      <span>{enabled ? 'Sound on' : 'Sound off'}</span>
    </button>
  );
}
