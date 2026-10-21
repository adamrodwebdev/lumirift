import * as sounds from '@/fx/sounds';
import type { AudioEngine, SoundRecipe } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { FallingSession } from '../FallingSession';
import { CRACK_MS } from './FallingEffects';

/** Notices that deserve a sound, by id. */
const NOTICE_SOUNDS: Readonly<Record<string, SoundRecipe>> = {
  mirrorSoon: sounds.warning,
  tiltSoon: sounds.warning,
  perfect: sounds.pureLine,
  sent: sounds.attack,
  reflexBonus: sounds.bonus,
  chargeGained: sounds.bonus,
};

/**
 * Sounds and vibrations of the falling family: it listens to the engine and
 * plays the matching synthesised sound, in step with the visual effects.
 */
export class FallingSoundscape {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private hardDropped = false;
  /** While a hard-dropped piece is shown falling, its landing and clear sound when it lands. */
  private landingIn = 0;

  /** `fall`: how long the picture of a hard drop takes to land (0: drawn at once). */
  constructor(
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
    private readonly fall: (distance: number) => number = () => 0,
  ) {}

  attach(session: FallingSession): () => void {
    const { audio, haptics } = this;
    const offs = [
      session.onGame('move', () => audio.play(sounds.tick)),
      session.onGame('rotate', () => audio.play(sounds.rotate)),
      session.onGame('hold', () => audio.play(sounds.hold)),
      session.onGame('hardDrop', ({ distance }) => {
        this.hardDropped = true;
        this.landingIn = this.fall(distance);
        this.after(this.landingIn, () => {
          audio.play(sounds.hardDrop(distance));
          haptics.pulse(14);
        });
      }),
      session.onGame('lock', () => {
        // A hard drop already made its own, heavier impact.
        if (!this.hardDropped) {
          audio.play(sounds.land);
          haptics.pulse(6);
        }
        this.hardDropped = false;
      }),
      session.onGame('clear', ({ lines, combo, pureLines }) => {
        const landing = this.landingIn;
        this.after(landing, () => {
          audio.play(sounds.crack);
          haptics.pulse(lines >= 4 ? [30, 40, 80] : 18 + lines * 8);
        });
        this.after(landing + CRACK_MS, () => {
          audio.play(sounds.shatter(lines, combo));
          if (pureLines > 0) audio.play(sounds.pureLine);
        });
      }),
      session.onGame('spawn', () => {
        this.landingIn = 0;
      }),
      session.onGame('levelUp', () => audio.play(sounds.levelUp)),
      session.onGame('garbage', () => {
        audio.play(sounds.garbageRise);
        haptics.pulse(12);
      }),
      session.onGame('flip', () => {
        audio.play(sounds.flip);
        haptics.pulse([20, 30, 50]);
      }),
      session.onGame('mirror', () => audio.play(sounds.mirror)),
      session.onGame('tilt', () => {
        audio.play(sounds.flip);
        haptics.pulse([20, 30, 50]);
      }),
      session.onGame('blast', ({ bombs }) => {
        audio.play(sounds.bomb);
        haptics.pulse(bombs > 1 ? [50, 30, 50, 30, 120] : [40, 30, 90]);
      }),
      session.onGame('fusion', ({ chain }) => {
        audio.play(sounds.fusion(chain));
        haptics.pulse(16 + chain * 8);
      }),
      session.onGame('beat', ({ count }) => audio.play(count % 4 === 1 ? sounds.kick : sounds.hat)),
      session.onGame('groove', ({ level, onBeat }) => {
        if (onBeat) audio.play(sounds.onBeat(level));
      }),
      session.onGame('notice', ({ id }) => {
        const sound = NOTICE_SOUNDS[id];
        if (sound) audio.play(sound);
      }),
      session.onGame('over', ({ reason }) => {
        // A Guardian's fall has its own fanfare.
        if (reason === 'victory') return;
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

  /** Plays now, or after `delayMs`, in step with the visuals (a landing, the crack turning into shards). */
  private after(delayMs: number, play: () => void): void {
    if (delayMs <= 0) {
      play();
      return;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      play();
    }, delayMs);
    this.timers.add(timer);
  }
}
