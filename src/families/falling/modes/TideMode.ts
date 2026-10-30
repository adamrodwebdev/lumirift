import { WELL } from '@/core/Well';
import type { Indicator, ResultKind } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';

/**
 * The tide was paced for a well of 20 rows: in Lumirift's 18 (1.43) it rises
 * as much slower, so that it fills the same share of the well in the same time.
 */
const PACE = 20 / WELL.rows;
export const TIDE_START_INTERVAL_MS = Math.round(10_000 * PACE);
export const TIDE_INTERVAL_STEP_MS = Math.round(500 * PACE);
export const TIDE_MIN_INTERVAL_MS = Math.round(3_000 * PACE);
export const TIDE_DELAY_PER_LINE_MS = 1_000;
/** Chance that a new garbage row keeps the previous hole, so a well can be dug. */
const SAME_HOLE_CHANCE = 0.7;

/**
 * Garbage rows rise from the bottom, faster and faster; clearing lines buys
 * time. Ranked on the time survived.
 */
export class TideMode extends AbstractMode {
  readonly id = 'tide';
  override readonly result: ResultKind = 'time';

  private interval = TIDE_START_INTERVAL_MS;
  private untilRise = TIDE_START_INTERVAL_MS;
  private hole: number | null = null;
  private risen = 0;

  override attach(game: Game): void {
    game.events.on('clear', ({ lines }) => {
      this.untilRise += lines * TIDE_DELAY_PER_LINE_MS;
    });
  }

  override resultValue(game: Game): number {
    return game.elapsedMs;
  }

  protected override tick(game: Game, deltaMs: number): void {
    // Near the top, the early campaign's mercy holds the tide back.
    this.untilRise -= deltaMs * game.mercyPace;
    if (this.untilRise > 0) return;
    this.risen++;
    this.interval = Math.max(TIDE_MIN_INTERVAL_MS, this.interval - TIDE_INTERVAL_STEP_MS);
    this.untilRise += this.interval;
    game.raiseGarbage(this.nextHole(game));
  }

  protected override ownIndicators(): Indicator[] {
    return [
      { id: 'nextRise', value: Math.max(0, this.untilRise), format: 'duration' },
      { id: 'rowsRisen', value: this.risen, format: 'count' },
    ];
  }

  private nextHole(game: Game): number {
    if (this.hole === null || game.random.next() >= SAME_HOLE_CHANCE) {
      this.hole = game.random.nextInt(game.board.width);
    }
    return this.hole;
  }
}
