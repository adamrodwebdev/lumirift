/** The longest chain: the multiplier stops at ×10. */
export const COMBO_MAX = 10;

/**
 * How long a full gauge lasts before it runs dry, by the multiplier reached:
 * generous at first, tighter at the top (ms).
 */
export const comboWindowMs = (multiplier: number): number =>
  Math.max(5000, 9000 - 450 * (multiplier - 1));

/** A reaction of the elements feeds a running gauge by this share of its window. */
export const COMBO_FEED = 0.25;

/** What the screen shows of a combo. */
export interface ComboView {
  /** The multiplier the next clear scores with, if it comes before the gauge runs dry. */
  readonly next: number;
  /** 0 (dry, no chain) to 1 (just filled). */
  readonly fill: number;
}

/**
 * The combo gauge (C1, the Sand first): a clear fills the gauge; each clear
 * before it runs dry raises the multiplier by one, up to ×10; when it runs
 * dry, the chain is over. Rules only: the game applies the multiplier.
 */
export class ComboGauge implements ComboView {
  /** The multiplier of the last clear, 0 without a chain. */
  private chain = 0;
  /** Time before the gauge runs dry (ms). */
  private left = 0;

  get next(): number {
    return this.chain > 0 ? Math.min(COMBO_MAX, this.chain + 1) : 1;
  }

  get fill(): number {
    return this.chain > 0 ? this.left / comboWindowMs(this.chain) : 0;
  }

  /** A clear: returns the multiplier it scores with; the gauge fills again. */
  clear(): number {
    const multiplier = this.next;
    this.chain = multiplier;
    this.left = comboWindowMs(multiplier);
    return multiplier;
  }

  /** A reaction of the elements: a running gauge gains a quarter of its window. */
  feed(): void {
    if (this.chain === 0) return;
    const window = comboWindowMs(this.chain);
    this.left = Math.min(window, this.left + window * COMBO_FEED);
  }

  /** Time passes; returns the multiplier reached when the gauge runs dry now, else 0. */
  update(deltaMs: number): number {
    if (this.chain === 0) return 0;
    this.left -= deltaMs;
    if (this.left > 0) return 0;
    const reached = this.chain;
    this.chain = 0;
    this.left = 0;
    return reached;
  }
}
