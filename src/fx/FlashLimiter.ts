/** WCAG 2.3.1: no more than three flashes in any one-second period. */
export const MAX_FLASHES_PER_SECOND = 3;

/** Grants or refuses a flash so that bright flashes never exceed the safe rate. */
export class FlashLimiter {
  private readonly recent: number[] = [];

  tryFlash(nowMs: number): boolean {
    while (this.recent.length > 0 && nowMs - this.recent[0]! >= 1000) this.recent.shift();
    if (this.recent.length >= MAX_FLASHES_PER_SECOND) return false;
    this.recent.push(nowMs);
    return true;
  }
}
