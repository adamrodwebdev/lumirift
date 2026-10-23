import type { RandomSource } from '@/core/Random';
import { GRAINS_PER_CELL, type SandGrid } from './SandGrid';

/** Wind holds off while the sand is this close to the top (in grains). */
export const WIND_SAFE_GRAINS = 3 * GRAINS_PER_CELL;
/** Wind: first gust after this long, then every this long (ms, ± a third), announced ahead. */
export const WIND_EVERY_MS = 30_000;
export const WIND_WARNING_MS = 3_000;
export const WIND_GUST_MS = 2_500;

/** A gust announced (`soon`), blowing (`start`), or over (`end`), and its side. */
export interface WindChange {
  readonly phase: 'soon' | 'start' | 'end';
  readonly direction: -1 | 1;
}

/**
 * The wind of a game of Sand (1.28): a gust every half minute or so, warned
 * three seconds ahead, never on the same side twice in a row, and never while
 * the sand nears the top (the wind must not decide a game). It blows on the
 * grid and tells each change (`tell`); the game makes them its events.
 */
export class SandWind {
  private direction: -1 | 1;
  private at: number;
  private phase: 'waiting' | 'warned' | 'blowing' = 'waiting';

  constructor(
    private readonly grid: SandGrid,
    private readonly random: RandomSource,
    private readonly tell: (change: WindChange) => void,
  ) {
    this.direction = random.next() < 0.5 ? -1 : 1;
    this.at = this.nextGustDelay();
  }

  /** Milliseconds before the next gust at `now`, 0 while it blows. */
  inMs(now: number): number {
    return this.phase === 'blowing' ? 0 : Math.max(0, this.at - now);
  }

  /** The game's time goes by (`now`, ms of play). */
  update(now: number): void {
    if (this.phase === 'waiting' && now >= this.at - WIND_WARNING_MS) {
      // Never a gust when the sand nears the top: the wind must not decide a game.
      if (this.grid.sandHeight() > this.grid.height - WIND_SAFE_GRAINS) {
        this.at = now + WIND_WARNING_MS + WIND_GUST_MS;
        return;
      }
      this.phase = 'warned';
      this.tell({ phase: 'soon', direction: this.direction });
    } else if (this.phase === 'warned' && now >= this.at) {
      this.phase = 'blowing';
      this.grid.resetDrift();
      this.grid.blow(this.direction);
      this.tell({ phase: 'start', direction: this.direction });
    } else if (this.phase === 'blowing' && now >= this.at + WIND_GUST_MS) {
      this.grid.calm();
      this.tell({ phase: 'end', direction: this.direction });
      // Gusts alternate: the sand is never pushed the same way twice in a row.
      this.direction = this.direction === 1 ? -1 : 1;
      this.at = now + this.nextGustDelay();
      this.phase = 'waiting';
    }
  }

  private nextGustDelay(): number {
    return WIND_EVERY_MS * (2 / 3 + this.random.next() * (2 / 3));
  }
}
