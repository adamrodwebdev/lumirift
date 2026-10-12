import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';

export const MIRROR_EVERY_LINES = 10;
export const MIRROR_WARNING_MS = 3_000;
export const MIRROR_REFLEX_MS = 5_000;

/**
 * Every ten lines, after a warning, the well is reflected left to right. Lines
 * cleared shortly after a reflection count double. Controls never change.
 */
export class MirrorMode extends AbstractMode {
  readonly id = 'mirror';

  private nextAt = MIRROR_EVERY_LINES;
  private countdown: number | null = null;
  private reflexUntil = Number.NEGATIVE_INFINITY;

  override attach(game: Game): void {
    game.events.on('clear', ({ points }) => {
      if (game.elapsedMs <= this.reflexUntil) game.awardPoints(points, 'reflexBonus');
      if (this.countdown === null && game.lines >= this.nextAt) {
        this.nextAt += MIRROR_EVERY_LINES;
        this.countdown = MIRROR_WARNING_MS;
        game.notify('mirrorSoon', MIRROR_WARNING_MS);
      }
    });
  }

  protected override tick(game: Game, deltaMs: number): void {
    if (this.countdown === null) return;
    this.countdown -= deltaMs;
    if (this.countdown > 0) return;
    this.countdown = null;
    game.mirrorWell();
    this.reflexUntil = game.elapsedMs + MIRROR_REFLEX_MS;
  }

  protected override ownIndicators(game: Game): Indicator[] {
    if (this.countdown !== null) {
      return [{ id: 'mirrorIn', value: Math.max(0, this.countdown), format: 'duration' }];
    }
    const indicators: Indicator[] = [
      { id: 'nextMirror', value: this.nextAt - game.lines, format: 'count' },
    ];
    const reflexLeft = this.reflexUntil - game.elapsedMs;
    if (reflexLeft > 0) indicators.push({ id: 'reflex', value: reflexLeft, format: 'duration' });
    return indicators;
  }
}
