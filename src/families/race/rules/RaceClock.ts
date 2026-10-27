import { CLOCK, GAINS } from './RaceTuning';

/**
 * The time a clear brings (1.34): two seconds a line (a region in the Sand),
 * N more in a combo ×N, five more for four lines at once.
 */
export function clearGainMs(lines: number, combo: number): number {
  if (lines <= 0) return 0;
  const big = lines >= GAINS.bigClearLines ? GAINS.bigClearMs : 0;
  const chain = combo > 0 ? (combo + 1) * GAINS.comboStepMs : 0;
  return lines * GAINS.lineMs + big + chain;
}

/**
 * The race's clock (1.34): it starts at 1:30 and counts down while a world
 * plays; it holds 99 s at most, what a gain brings above spilling over (as
 * points, the race's affair); an overflow costs 10 s but never leaves less
 * than 5 s. Only its end ends the run.
 */
export class RaceClock {
  private left: number = CLOCK.startMs;

  /** Time left (ms), never negative. */
  get leftMs(): number {
    return Math.max(0, this.left);
  }

  get expired(): boolean {
    return this.left <= 0;
  }

  /** What a gain of `ms` would spill over the cap (ms). */
  spill(ms: number): number {
    return Math.max(0, this.left + ms - CLOCK.capMs);
  }

  gain(ms: number): void {
    this.left = Math.min(CLOCK.capMs, this.left + ms);
  }

  /** The stack overflowed: 10 s lost, never under 5 s (a clock already under keeps its time). */
  overflow(): void {
    this.left = Math.max(
      this.left - CLOCK.overflowCostMs,
      Math.min(this.left, CLOCK.overflowFloorMs),
    );
  }

  tick(deltaMs: number): void {
    this.left -= deltaMs;
  }
}
