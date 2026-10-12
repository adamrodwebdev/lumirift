/** Particle budgets, from the richest to the most frugal. */
export const QUALITY_BUDGETS = [1600, 800, 300] as const;

/** Average frame time above which a window counts as slow (≈ 54 frames per second). */
export const SLOW_FRAME_MS = 18.5;
/** Longer frames are stalls (loading, tab switch, garbage collection), not slowness. */
export const STALL_MS = 50;
const WINDOW_MS = 2000;
/** Consecutive slow windows needed before giving up some detail. */
const SLOW_WINDOWS = 2;

/**
 * Watches the frame rate and lowers the particle budget when the device
 * struggles for several seconds in a row. It never raises it again during a
 * game: stable beats flickering.
 */
export class AdaptiveQuality {
  private level = 0;
  private elapsed = 0;
  private frames = 0;
  private slowWindows = 0;

  constructor(private readonly onChange: (budget: number) => void = () => undefined) {}

  get budget(): number {
    return QUALITY_BUDGETS[this.level]!;
  }

  /** 0 for the richest level, then 1, 2… */
  get detail(): number {
    return this.level;
  }

  sample(deltaMs: number): void {
    if (deltaMs <= 0 || deltaMs > STALL_MS) return;
    this.elapsed += deltaMs;
    this.frames++;
    if (this.elapsed < WINDOW_MS) return;
    const slow = this.elapsed / this.frames > SLOW_FRAME_MS;
    this.elapsed = 0;
    this.frames = 0;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= SLOW_WINDOWS && this.level < QUALITY_BUDGETS.length - 1) {
      this.level++;
      this.slowWindows = 0;
      this.onChange(this.budget);
    }
  }
}
