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

  private readonly tick = (time: number): void => {
    const delta = this.last === null ? 0 : Math.min(time - this.last, MAX_FRAME_MS);
    this.last = time;
    for (const listener of [...this.listeners]) listener(delta);
    this.handle = this.requestFrame(this.tick);
  };
}
