import { Emitter } from '@/core/Emitter';

/** The last seconds of a timed game are counted down: from this much time left (ms). */
export const FINAL_SECONDS_MS = 10_000;

export interface FinalSecondsEventMap {
  /** The final seconds begin. */
  hurry: Readonly<Record<string, never>>;
  /** A second shown went by (9 down to 1). */
  tick: { readonly second: number };
}

/**
 * The count of a timed game's last seconds, as the clock shows them (whole
 * seconds, rounded down): a call when they begin, a tick for each second.
 */
export class FinalSeconds {
  readonly events = new Emitter<FinalSecondsEventMap>();
  private shown: number | null = null;

  /** True while the final seconds run: the clock shows them in red. */
  get urgent(): boolean {
    return this.shown !== null;
  }

  /** The time left this frame (ms), or null for a game without a clock. */
  update(timeLeftMs: number | null): void {
    if (timeLeftMs === null || timeLeftMs > FINAL_SECONDS_MS) {
      this.shown = null;
      return;
    }
    const second = Math.floor(timeLeftMs / 1000);
    if (this.shown === null) {
      this.shown = second;
      this.events.emit('hurry', {});
      return;
    }
    if (second === this.shown) return;
    this.shown = second;
    // The last one is the end of the game: it has its own sound.
    if (second > 0) this.events.emit('tick', { second });
  }

  reset(): void {
    this.shown = null;
  }
}
