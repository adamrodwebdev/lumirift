interface Timer {
  at: number;
  readonly every: number | null;
  readonly run: () => void;
}

/**
 * The time of the clip set (1.39): the page's wall-clock time replaced by the
 * set's own clock. `setTimeout`, `setInterval`, `requestAnimationFrame`,
 * `performance.now()` and the CSS animations follow `advance(ms)`, never the
 * speed of the machine, so two takes of a scene draw the same frames, and the
 * stages' timers (a moment's banner, a throttled sound, a pulse) last their
 * game time while the recorder takes a second to film a frame.
 */
export class SetTime {
  /** Far from zero, like a page open for a while: no "last time" starts out recent. */
  private now = 60_000;
  private nextId = 1;
  private readonly timers = new Map<number, Timer>();
  private readonly frames = new Map<number, FrameRequestCallback>();
  /** Each CSS animation's own time on the set's clock. */
  private readonly animations = new WeakMap<Animation, number>();
  /** The machine's timer, for the page's own waits (a stage mounting, the first picture). */
  readonly realTimeout: (callback: () => void, ms: number) => void;

  constructor(private readonly page: Window & typeof globalThis) {
    const timeout = page.setTimeout.bind(page);
    this.realTimeout = (callback, ms) => void timeout(callback, ms);
  }

  /** From now on, the page's timers, frames and `performance.now()` run on the set's clock. */
  install(): void {
    const page = this.page;
    const timer =
      (repeat: boolean) =>
      (handler: TimerHandler, delay = 0, ...args: unknown[]): number => {
        const id = this.nextId++;
        const ms = Math.max(0, delay || 0);
        const run = () => (typeof handler === 'function' ? handler(...args) : undefined);
        this.timers.set(id, { at: this.now + ms, every: repeat ? Math.max(1, ms) : null, run });
        return id;
      };
    // Any id may come back (one of Node's timers in a test): only the set's own are known.
    const clear = (id?: unknown) => {
      if (typeof id === 'number') this.timers.delete(id);
    };
    page.setTimeout = timer(false) as typeof setTimeout;
    page.setInterval = timer(true) as typeof setInterval;
    page.clearTimeout = clear;
    page.clearInterval = clear;
    page.requestAnimationFrame = (callback) => {
      const id = this.nextId++;
      this.frames.set(id, callback);
      return id;
    };
    page.cancelAnimationFrame = (id) => void this.frames.delete(id);
    Object.defineProperty(page.performance, 'now', { configurable: true, value: () => this.now });
  }

  /**
   * Moves the clock: the timers due run in their order, each at its own time,
   * then the frame callbacks asked for before this frame.
   */
  advance(ms: number): void {
    const end = this.now + ms;
    for (let next = this.due(end); next; next = this.due(end)) {
      const [id, timer] = next;
      this.now = Math.max(this.now, timer.at);
      if (timer.every === null) this.timers.delete(id);
      else timer.at += timer.every;
      timer.run();
    }
    this.now = end;
    const frames = [...this.frames.values()];
    this.frames.clear();
    for (const frame of frames) frame(this.now);
  }

  /** The CSS animations and transitions, moved by the set's clock: a new one starts at 0. */
  stepAnimations(ms: number): void {
    for (const animation of this.page.document.getAnimations()) {
      const known = this.animations.get(animation);
      const time = known === undefined ? 0 : known + ms;
      this.animations.set(animation, time);
      animation.pause();
      animation.currentTime = time;
    }
  }

  /** The earliest timer due by `end` (the first one set, between equals). */
  private due(end: number): [number, Timer] | null {
    let next: [number, Timer] | null = null;
    for (const entry of this.timers) {
      if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
    }
    return next;
  }
}
