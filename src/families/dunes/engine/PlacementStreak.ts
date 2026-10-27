import { COMBO_MAX, type ComboView } from '@/session/ComboGauge';

/** Pieces put down without a clear that a chain survives: the next one without a clear ends it. */
export const STREAK_GRACE = 2;

/**
 * The combo of Dunes (1.37): no clock in a calm mode, so the chain counts
 * pieces, not seconds (as the Mosaic's streak does). Each clear raises the
 * multiplier by one, up to ×10; a piece put down with no clear since the
 * last one uses a grace; past the grace the chain is over. The Sand's badge
 * shows it: what the next clear scores with, and the grace left as its ring.
 */
export class PlacementStreak implements ComboView {
  /** The multiplier of the last clear, 0 without a chain. */
  private chain = 0;
  private misses = 0;
  /** Something cleared (or an element worked) since the last piece. */
  private lively = false;

  get next(): number {
    return this.chain > 0 ? Math.min(COMBO_MAX, this.chain + 1) : 1;
  }

  get fill(): number {
    return this.chain > 0 ? (STREAK_GRACE + 1 - this.misses) / (STREAK_GRACE + 1) : 0;
  }

  /** A clear: returns the multiplier it scores with. */
  clear(): number {
    const multiplier = this.next;
    this.chain = multiplier;
    this.misses = 0;
    this.lively = true;
    return multiplier;
  }

  /** An element did its work (a burn, a bolt, a vine…): the piece that brought it keeps the chain. */
  feed(): void {
    if (this.chain > 0) this.lively = true;
  }

  /** A piece is put down: returns the multiplier reached when the chain ends now, else 0. */
  placed(): number {
    if (this.chain === 0) return 0;
    if (this.lively) {
      this.lively = false;
      this.misses = 0;
      return 0;
    }
    this.misses++;
    if (this.misses <= STREAK_GRACE) return 0;
    const reached = this.chain;
    this.chain = 0;
    this.misses = 0;
    return reached;
  }
}
