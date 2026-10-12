import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';
import type { WellSize } from './GameMode';

export const TILT_EVERY_LINES = 10;
export const TILT_WARNING_MS = 3_000;
/** A square well: it can turn and still be a well. */
export const TILT_WELL: WellSize = { width: 12, height: 12 };

/**
 * Every ten lines, after a warning, the well turns a quarter to the left: the
 * left wall becomes the floor and every column falls. The stack that was
 * built up the walls suddenly becomes the floor to play on.
 */
export class TiltMode extends AbstractMode {
  readonly id = 'tilt';
  override readonly well = TILT_WELL;

  private nextAt = TILT_EVERY_LINES;
  private countdown: number | null = null;

  override attach(game: Game): void {
    game.events.on('clear', () => {
      if (this.countdown !== null || game.lines < this.nextAt) return;
      this.nextAt += TILT_EVERY_LINES;
      this.countdown = TILT_WARNING_MS;
      game.notify('tiltSoon', TILT_WARNING_MS);
    });
  }

  protected override tick(game: Game, deltaMs: number): void {
    if (this.countdown === null) return;
    this.countdown -= deltaMs;
    if (this.countdown > 0) return;
    this.countdown = null;
    game.tiltWell();
  }

  protected override ownIndicators(game: Game): Indicator[] {
    if (this.countdown !== null) {
      return [{ id: 'tiltIn', value: Math.max(0, this.countdown), format: 'duration' }];
    }
    return [{ id: 'nextTilt', value: Math.max(0, this.nextAt - game.lines), format: 'count' }];
  }
}
