import * as sounds from '@/fx/sounds';
import type { AudioEngine, SoundRecipe } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { JokerId } from '../jokers/Joker';
import type { PlacementSession } from '../PlacementSession';
import { BREAK_MS } from './MosaicEffects';

const JOKER_SOUNDS: Readonly<Record<JokerId, SoundRecipe>> = {
  rotate: sounds.rotate,
  reroll: sounds.shuffle,
  bomb: sounds.bomb,
  undo: sounds.rewind,
  cube: sounds.tick,
};

/** Sounds and vibrations of the Mosaic, in step with its visuals. */
export class MosaicSoundscape {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private dealSound: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
  ) {}

  attach(session: PlacementSession): () => void {
    const { audio, haptics } = this;
    const offs = [
      session.onGame('place', () => {
        audio.play(sounds.tile);
        haptics.pulse(8);
      }),
      session.onGame('clear', ({ lines, streak }) => {
        this.later(() => audio.play(sounds.ceramicBreak(lines, streak)));
        haptics.pulse(lines >= 3 ? [30, 40, 70] : 16 + lines * 10);
      }),
      session.onGame('perfect', () => audio.play(sounds.pureLine)),
      // A new hand lands piece after piece; a joker that redeals (reroll,
      // undo) has its own sound, which wins.
      session.onGame('deal', () => {
        this.dealSound = this.later(() => audio.play(sounds.deal), 0);
      }),
      session.onGame('jokerGained', () => audio.play(sounds.bonus)),
      session.onGame('jokerUsed', ({ joker }) => {
        this.cancel(this.dealSound);
        audio.play(JOKER_SOUNDS[joker]);
        if (joker === 'bomb') haptics.pulse([40, 30, 80]);
      }),
      session.onGame('over', () => {
        audio.play(sounds.gameOver);
        haptics.pulse([60, 40, 120]);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      this.timers.forEach((timer) => clearTimeout(timer));
      this.timers.clear();
    };
  }

  /** The break is heard when the tiles break, after their little jump. */
  private later(play: () => void, delayMs = BREAK_MS): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      play();
    }, delayMs);
    this.timers.add(timer);
    return timer;
  }

  private cancel(timer: ReturnType<typeof setTimeout> | undefined): void {
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }
}
