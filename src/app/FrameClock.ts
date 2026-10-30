import { FrameCap } from './FrameCap';

/** `deltaMs`: the game's time (slowed down in slow motion); `realMs`: the wall clock's. */
export type FrameListener = (deltaMs: number, realMs: number) => void;

type RequestFrame = (callback: (time: number) => void) => number;
type CancelFrame = (handle: number) => void;

/** Longest step simulated in one frame: after a stall, the game slows down rather than jumps. */
export const MAX_FRAME_MS = 100;
/** How fast a lasting change of pace is reached (ms for about two thirds of the way). */
const PACE_EASE_MS = 220;
/**
 * A hit-stop's limits (1.41): a hold lasts 140 ms at most, and the holds take
 * 250 ms of each second at most, so that a chain of clears never stalls play.
 */
export const HOLD = { maxMs: 140, perSecondMs: 250 } as const;

/**
 * The game loop: one `requestAnimationFrame` for the whole screen, whose
 * listeners run in subscription order (simulation first, then input and
 * rendering). Time can run slower than the wall clock: a moment of slow
 * motion (`slow`), or a lasting pace (`setPace`, the rift surge); the
 * listeners get both times, so that the player's input keeps the real one.
 * A hit-stop (`hold`, 1.41) stops the game's time for a few tens of
 * milliseconds while the real time runs on. A `FrameCap` may hold the frames
 * drawn to 60 a second (touch screens).
 */
export class FrameClock {
  private readonly listeners: FrameListener[] = [];
  private handle: number | null = null;
  private last: number | null = null;
  private slowScale = 1;
  private slowMs = 0;
  private slowLeft = 0;
  private pace = 1;
  private paceTarget = 1;
  private holdLeft = 0;
  /** The real time since the start (ms), and the holds granted in the last second of it. */
  private realNow = 0;
  private readonly holds: { readonly at: number; readonly ms: number }[] = [];

  constructor(
    private readonly requestFrame: RequestFrame = (callback) => requestAnimationFrame(callback),
    private readonly cancelFrame: CancelFrame = (handle) => cancelAnimationFrame(handle),
    private readonly cap = new FrameCap(),
  ) {}

  /** The game's clock on this screen: 60 frames a second at most where `maxFps` says so. */
  static capped(maxFps: number | null): FrameClock {
    return new FrameClock(undefined, undefined, new FrameCap(maxFps));
  }

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
    this.cap.reset();
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

  /**
   * A hit-stop: the game's time stands still for `ms` of real time (140 at
   * most) while the real time runs on (the input, the camera). A hold during
   * another lasts the longer of the two; what the budget of the second has
   * left caps it.
   */
  hold(ms: number): void {
    while (this.holds.length > 0 && this.holds[0]!.at <= this.realNow - 1000) this.holds.shift();
    const used = this.holds.reduce((sum, { ms: held }) => sum + held, 0);
    const longer = Math.max(0, Math.min(ms, HOLD.maxMs) - this.holdLeft);
    const granted = Math.min(longer, HOLD.perSecondMs - used);
    if (granted <= 0) return;
    this.holdLeft += granted;
    this.holds.push({ at: this.realNow, ms: granted });
  }

  /** True while a hit-stop holds the game's time. */
  get held(): boolean {
    return this.holdLeft > 0;
  }

  /** A lasting pace, reached smoothly: 1/3 runs time at a third of its speed until set back to 1. */
  setPace(scale: number): void {
    this.paceTarget = Math.min(1, Math.max(0, scale));
  }

  private scaleFor(real: number): number {
    if (this.slowLeft <= 0) return 1;
    const done = 1 - this.slowLeft / this.slowMs;
    this.slowLeft -= real;
    if (done < 0.5) return this.slowScale;
    return this.slowScale + (1 - this.slowScale) * ((done - 0.5) / 0.5);
  }

  private readonly tick = (time: number): void => {
    // The next frame first: a part that fails (a renderer) never stops the game.
    this.handle = this.requestFrame(this.tick);
    if (!this.cap.admits(time)) return;
    const real = this.last === null ? 0 : Math.min(time - this.last, MAX_FRAME_MS);
    this.last = time;
    this.pace += (this.paceTarget - this.pace) * (1 - Math.exp(-real / PACE_EASE_MS));
    this.realNow += real;
    // A hold that ends within the frame lets the rest of the frame play.
    const held = Math.min(real, this.holdLeft);
    this.holdLeft -= held;
    const delta = (real - held) * Math.min(this.scaleFor(real), this.pace);
    for (const listener of [...this.listeners]) {
      try {
        listener(delta, real);
      } catch (error) {
        // Said, not hidden; the other parts play the frame all the same.
        console.error(error);
      }
    }
  };
}
