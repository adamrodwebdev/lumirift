/** Above this level the speed stops increasing (pieces already fall ~1 row per frame). */
export const MAX_GRAVITY_LEVEL = 20;
export const LINES_PER_LEVEL = 10;
/** Soft drop falls this many times faster than gravity, and never slower than 50 ms a row. */
const SOFT_DROP_FACTOR = 20;
const MAX_SOFT_DROP_MS = 50;

/** The genre's standard speed curve: time for a piece to fall one row. */
export class GravityCurve {
  rowIntervalMs(level: number): number {
    const l = Math.min(Math.max(level, 1), MAX_GRAVITY_LEVEL) - 1;
    return (0.8 - l * 0.007) ** l * 1000;
  }

  softDropIntervalMs(level: number): number {
    return Math.min(this.rowIntervalMs(level) / SOFT_DROP_FACTOR, MAX_SOFT_DROP_MS);
  }

  levelFor(startLevel: number, lines: number): number {
    return startLevel + Math.floor(lines / LINES_PER_LEVEL);
  }
}
