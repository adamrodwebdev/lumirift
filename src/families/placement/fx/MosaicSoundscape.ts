import { GameTimers } from '@/core/GameTimers';
import { PlayerVoice } from '@/fx/PlayerVoice';
import * as sounds from '@/fx/sounds';
import type { AudioEngine, SoundRecipe } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { JokerId } from '../jokers/Joker';
import type { PlacementSession } from '../PlacementSession';
import { BREAK_MS, FLIGHT_MS } from './MosaicEffects';

const JOKER_SOUNDS: Readonly<Record<JokerId, (voice: PlayerVoice) => SoundRecipe>> = {
  rotate: (voice) => voice.rotate(),
  reroll: () => sounds.shuffle,
  bomb: () => sounds.bomb,
  undo: () => sounds.rewind,
  cube: () => sounds.tick(0),
};

/**
 * Sounds and vibrations of the Mosaic, in step with its visuals and with the
 * music. The stage gives it the game's time (`update`), as to the effects.
 */
export class MosaicSoundscape {
  private readonly timers = new GameTimers();
  private readonly voice = new PlayerVoice();
  /** Cancels the sound of a new hand, when a joker that redeals has its own. */
  private cancelDeal: () => void = () => {};

  constructor(
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
  ) {}

  attach(session: PlacementSession): () => void {
    const { audio, haptics } = this;
    const offs = [
      session.onGame('place', () => {
        // A tile set down is heard, never felt (1.41: vibrations for the weighty moments).
        audio.play(sounds.tile);
      }),
      session.onGame('clear', ({ lines, streak }) => {
        this.later(() => audio.play(sounds.ceramicBreak(lines, streak)));
        haptics.pulse(lines >= 3 ? [30, 40, 70] : 16 + lines * 10);
      }),
      session.onGame('perfect', () => audio.play(sounds.pureLine)),
      // A new hand lands piece after piece; a joker that redeals (reroll,
      // undo) has its own sound, which wins.
      session.onGame('deal', () => {
        this.cancelDeal = this.timers.soon(() => audio.play(sounds.deal));
      }),
      session.onGame('jokerGained', () => audio.play(sounds.bonus)),
      session.onGame('jokerUsed', ({ joker }) => {
        this.cancelDeal();
        audio.play(JOKER_SOUNDS[joker](this.voice));
        if (joker === 'bomb') haptics.pulse([40, 30, 80]);
      }),
      session.onGame('over', ({ reason }) => {
        if (reason === 'victory') return;
        audio.play(sounds.gameOver);
        haptics.pulse([60, 40, 120]);
      }),
      session.onGame('boss', ({ event }) => {
        if (event.type === 'throw' && event.stones.length > 0) {
          audio.play(sounds.roar);
          this.later(() => {
            audio.play(sounds.stoneThud);
            haptics.pulse([30, 20, 50]);
          }, FLIGHT_MS);
        } else if (event.type === 'parry') audio.play(sounds.parry);
        else if (event.type === 'hurt') audio.play(sounds.bossHit(event.damage >= 15));
        else if (event.type === 'phase') audio.play(sounds.rumble);
        else if (event.type === 'defeated') {
          audio.play(sounds.newRecord);
          haptics.pulse([40, 30, 40, 30, 160]);
        }
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

  /** The break is heard when the tiles break, after their little jump (game time). */
  private later(play: () => void, delayMs = BREAK_MS): void {
    this.timers.after(delayMs, play);
  }
}
