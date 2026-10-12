import { Tone } from '@/core/Tone';
import * as sounds from '@/fx/sounds';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { SandSession } from '../SandSession';

/** Sounds and vibrations of the sand well. */
export class SandSoundscape {
  constructor(
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
  ) {}

  attach(session: SandSession): () => void {
    const { audio, haptics } = this;
    const offs = [
      session.onGame('move', () => audio.play(sounds.tick)),
      session.onGame('rotate', () => audio.play(sounds.rotate)),
      session.onGame('hardDrop', () => haptics.pulse(10)),
      session.onGame('lock', ({ piece }) =>
        audio.play(piece.tone === Tone.Water ? sounds.splash : sounds.pour),
      ),
      session.onGame('clear', ({ regions }) => {
        audio.play(sounds.sweep(regions));
        haptics.pulse(regions > 1 ? [30, 40, 70] : 30);
      }),
      session.onGame('quench', () => audio.play(sounds.splash)),
      session.onGame('burn', () => {
        audio.play(sounds.crackle);
        haptics.pulse([20, 20, 40]);
      }),
      session.onGame('wind', ({ phase }) => {
        if (phase === 'soon') audio.play(sounds.warning);
        if (phase === 'start') audio.play(sounds.gust);
      }),
      session.onGame('levelUp', () => audio.play(sounds.levelUp)),
      session.onGame('over', () => {
        audio.play(sounds.gameOver);
        haptics.pulse([60, 40, 120]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }
}
