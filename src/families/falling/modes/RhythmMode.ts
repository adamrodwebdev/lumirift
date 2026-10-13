import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';

export const RHYTHM_BASE_BPM = 100;
export const RHYTHM_BPM_PER_LEVEL = 5;
/** A lock this close to a beat (before or after) is on the beat. */
export const RHYTHM_WINDOW_MS = 120;
export const RHYTHM_MAX_GROOVE = 4;

/**
 * A pulse runs under the game. Each piece locked on the beat raises the groove,
 * which multiplies the points of the lines; a piece off the beat resets it.
 * The pulse is visible (the well's frame) as well as audible.
 */
export class RhythmMode extends AbstractMode {
  readonly id = 'rhythm';

  private phase = 0;
  private beats = 0;
  private groove = 1;
  private onBeatLocks = 0;

  override attach(game: Game): void {
    game.events.on('lock', () => {
      const period = this.period(game);
      const distance = Math.min(this.phase, period - this.phase);
      const onBeat = distance <= RHYTHM_WINDOW_MS + this.boosts.rhythmWindowMs;
      const previous = this.groove;
      this.groove = onBeat ? Math.min(RHYTHM_MAX_GROOVE, this.groove + 1) : 1;
      if (onBeat) this.onBeatLocks++;
      game.groove(this.groove, onBeat);
      if (this.groove === RHYTHM_MAX_GROOVE && previous < RHYTHM_MAX_GROOVE) {
        game.notify('grooveMax', RHYTHM_MAX_GROOVE);
      }
    });
  }

  /** Beats per minute: faster with each level. */
  bpm(game: Game): number {
    return RHYTHM_BASE_BPM + RHYTHM_BPM_PER_LEVEL * (game.level - 1);
  }

  override clearMultiplier(): number {
    return this.groove;
  }

  protected override tick(game: Game, deltaMs: number): void {
    this.phase += deltaMs;
    const period = this.period(game);
    while (this.phase >= period) {
      this.phase -= period;
      this.beats++;
      game.beat(this.beats);
    }
  }

  protected override ownIndicators(game: Game): Indicator[] {
    return [
      { id: 'groove', value: this.groove, format: 'count' },
      { id: 'onBeat', value: this.onBeatLocks, format: 'count' },
      { id: 'bpm', value: this.bpm(game), format: 'count' },
    ];
  }

  private period(game: Game): number {
    return 60_000 / this.bpm(game);
  }
}
