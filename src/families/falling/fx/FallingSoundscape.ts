import { clearImpact, comboBreakHeard, landingImpact } from '@/fx/Impact';
import { GameTimers } from '@/core/GameTimers';
import { PlayerVoice } from '@/fx/PlayerVoice';
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
 * plays the matching synthesised sound, in step with the visual effects. The
 * player's gestures play along with the music (PlayerVoice), and the Rhythm
 * mode's pulse leads it. The stage gives it the game's time (`update`), as
 * to the effects.
 */
export class FallingSoundscape {
  private readonly timers = new GameTimers();
  private readonly voice = new PlayerVoice();
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
      session.onGame('move', () => audio.play(this.voice.move())),
      session.onGame('rotate', () => audio.play(this.voice.rotate())),
      session.onGame('hold', () => audio.play(sounds.hold)),
      session.onGame('hardDrop', ({ distance }) => {
        this.hardDropped = true;
        this.landingIn = this.fall(distance);
        this.after(this.landingIn, () => {
          audio.play(sounds.hardDrop(distance));
          haptics.pulse(landingImpact(true, distance).vibrate);
        });
      }),
      session.onGame('lock', () => {
        // A hard drop already made its own, heavier impact; an ordinary landing
        // is heard, never felt (1.41: the vibrations are kept for the weighty moments).
        if (!this.hardDropped) audio.play(sounds.land);
        this.hardDropped = false;
      }),
      session.onGame('clear', ({ lines, combo, pureLines }) => {
        const landing = this.landingIn;
        this.after(landing, () => {
          audio.play(sounds.crack);
          if (lines >= 2) audio.play(sounds.clearBlow(lines));
          haptics.pulse(clearImpact(lines, combo).vibrate);
        });
        this.after(landing + CRACK_MS, () => {
          audio.play(sounds.shatter(lines, combo));
          if (combo >= 1) audio.play(sounds.comboStep(combo + 1));
          if (pureLines > 0) audio.play(sounds.pureLine);
        });
      }),
      // A combo of ×3 or more that breaks is heard falling (1.41).
      session.onGame('comboEnd', ({ combo }) => {
        if (comboBreakHeard(combo + 1)) audio.play(sounds.comboLost);
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
      session.onGame('beat', ({ count }) => {
        audio.pulse(count);
        audio.play(count % 4 === 1 ? sounds.kick : sounds.hat);
      }),
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
      this.timers.clear();
    };
  }

  /** Game time goes by, as for the visual effects: the sounds waiting for them follow. */
  update(deltaMs: number): void {
    this.timers.update(deltaMs);
  }

  /** Plays now, or after `delayMs` of game time, in step with the visuals (a landing, the crack turning into shards). */
  private after(delayMs: number, play: () => void): void {
    this.timers.after(delayMs, play);
  }
}
