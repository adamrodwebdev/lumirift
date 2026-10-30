/**
 * The time a player needs to read a text (1.40): a moment to notice it, then
 * about eighteen signs a second, between 1.5 and 7 s. Longer languages
 * (French, Russian) get their own time from their own words.
 */
export const READING = { noticeMs: 1200, perSignMs: 55, minMs: 1500, maxMs: 7000 } as const;

/** Signs as a reader sees them (a letter and its accents are one), in any language. */
const graphemes =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function readingMs(text: string): number {
  const trimmed = text.trim();
  const signs = graphemes ? Array.from(graphemes.segment(trimmed)).length : trimmed.length;
  return Math.min(
    READING.maxMs,
    Math.max(READING.minMs, READING.noticeMs + READING.perSignMs * signs),
  );
}

/**
 * A line of guidance kept on screen its reading time at least (1.40): told
 * every frame what the game would show now, it keeps the line shown until it
 * has been read, then shows whatever is wanted then (the latest). The game
 * goes on meanwhile.
 */
export class ReadingHold<T> {
  private shown: T | null = null;
  private shownMs = 0;

  constructor(
    private readonly readingTime: (line: T) => number,
    private readonly same: (a: T, b: T) => boolean = Object.is,
  ) {}

  /** The line to show. */
  get line(): T | null {
    return this.shown;
  }

  /** A frame of `realMs`; `wanted` is what the game would show now. */
  update(wanted: T | null, realMs: number): void {
    this.shownMs += realMs;
    const shown = this.shown;
    if (wanted === shown || (wanted !== null && shown !== null && this.same(wanted, shown))) return;
    if (shown === null || this.shownMs >= this.readingTime(shown)) this.replace(wanted);
  }

  /** Shows `line` at once: the player's own choice (a guide skipped), never held. */
  replace(line: T | null): void {
    this.shown = line;
    this.shownMs = 0;
  }
}

/** A delay that can be called off. */
export type Schedule = (callback: () => void, ms: number) => () => void;

/**
 * The messages over the well (1.40), each kept its reading time: one that
 * comes while another is still being read waits its turn (only the latest
 * waits); a message read goes away.
 */
export class MessageQueue<T> {
  private current: T | null = null;
  private waiting: T | null = null;
  private cancel: (() => void) | null = null;

  constructor(
    private readonly readingTime: (message: T) => number,
    private readonly schedule: Schedule,
    /** Told what to show now, or null for nothing. */
    private readonly onShow: (message: T | null) => void,
  ) {}

  add(message: T): void {
    if (this.current !== null) this.waiting = message;
    else this.show(message);
  }

  /** Everything goes at once (a new game). */
  clear(): void {
    this.cancel?.();
    this.cancel = null;
    this.current = null;
    this.waiting = null;
    this.onShow(null);
  }

  private show(message: T): void {
    this.current = message;
    this.onShow(message);
    this.cancel = this.schedule(() => this.read(), this.readingTime(message));
  }

  private read(): void {
    const next = this.waiting;
    this.waiting = null;
    this.cancel = null;
    if (next !== null) {
      this.show(next);
      return;
    }
    this.current = null;
    this.onShow(null);
  }
}
