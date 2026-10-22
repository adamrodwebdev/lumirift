export type FrameListener = (deltaMs: number) => void;

type RequestFrame = (callback: (time: number) => void) => number;
type CancelFrame = (handle: number) => void;

/** Longest step simulated in one frame: after a stall, the game slows down rather than jumps. */
export const MAX_FRAME_MS = 100;

/**
 * The game loop: one `requestAnimationFrame` for the whole screen, whose
 * listeners run in subscription order (simulation first, then input and
 * rendering).
 */
export class FrameClock {
  private readonly listeners: FrameListener[] = [];
  private handle: number | null = null;
  private last: number | null = null;
  private slowScale = 1;
  private slowMs = 0;
  private slowLeft = 0;

  constructor(
    private readonly requestFrame: RequestFrame = (callback) => requestAnimationFrame(callback),
    private readonly cancelFrame: CancelFrame = (handle) => cancelAnimationFrame(handle),
  ) {}

  subscribe(listener: FrameListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = null;
    this.handle = this.requestFrame(this.tick);
  }

  stop(): void {
    if (this.handle !== null) this.cancelFrame(this.handle);
    this.handle = null;
  }

  /**
   * A moment of slow motion (a close call, the end of a game): time runs at
   * `scale` for the first half of `ms` (real time), then speeds back up to
   * its normal pace. The listeners only see shorter frames.
   */
  slow(scale: number, ms: number): void {
    this.slowScale = Math.min(1, Math.max(0, scale));
    this.slowMs = ms;
    this.slowLeft = ms;
  }

  /** True while a slow motion runs. */
  get slowed(): boolean {
    return this.slowLeft > 0;
  }

  private scaleFor(real: number): number {
    if (this.slowLeft <= 0) return 1;
    const done = 1 - this.slowLeft / this.slowMs;
    this.slowLeft -= real;
    if (done < 0.5) return this.slowScale;
    return this.slowScale + (1 - this.slowScale) * ((done - 0.5) / 0.5);
  }

  private readonly tick = (time: number): void => {
    const real = this.last === null ? 0 : Math.min(time - this.last, MAX_FRAME_MS);
    this.last = time;
    const delta = real * this.scaleFor(real);
    for (const listener of [...this.listeners]) listener(delta);
    this.handle = this.requestFrame(this.tick);
  };
}
