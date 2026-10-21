/**
 * The chase of the player's record during one game: the record to beat, read
 * when the game starts, and the moment the live score goes past it (once per
 * game). A first game, with no record yet, has nothing to beat.
 */
export class RecordChase {
  private _beaten = false;

  constructor(private readonly record: number | null) {}

  get beaten(): boolean {
    return this._beaten;
  }

  /** The best to show beside the score: the record, then the score once past it. */
  shown(score: number): number | null {
    if (this.record === null) return null;
    return Math.max(this.record, Math.round(score));
  }

  /** Follows the live score; true only at the moment it beats the record. */
  update(score: number): boolean {
    if (this._beaten || this.record === null || this.record <= 0) return false;
    if (Math.round(score) <= this.record) return false;
    this._beaten = true;
    return true;
  }
}
