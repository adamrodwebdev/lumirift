/**
 * Two fingers turn the tower (1.28): the surface follows them, so dragging
 * right brings the left columns forward. One finger plays the piece
 * (WellGestures); a second one, put down, turns the tower until both lift.
 */
export class TowerTurn {
  /** The fingers down, and where each one is across the screen. */
  private readonly fingers = new Map<number, number>();
  private turning = false;

  constructor(
    /** Turns the tower by this many columns (negative: to the left). */
    private readonly turn: (columns: number) => void,
    /** The width of a column, face on, in screen pixels. */
    private readonly columnSize: () => number,
  ) {}

  down(pointerId: number, x: number): void {
    this.fingers.set(pointerId, x);
    if (this.fingers.size >= 2) this.turning = true;
  }

  /** A finger moves; false when it is not one of the fingers down. */
  move(pointerId: number, x: number): boolean {
    if (!this.fingers.has(pointerId)) return false;
    if (!this.turning) {
      this.fingers.set(pointerId, x);
      return true;
    }
    const before = this.middle();
    this.fingers.set(pointerId, x);
    this.turn(-(this.middle() - before) / this.columnSize());
    return true;
  }

  /** A finger lifts (or the browser takes it back): the turn ends with the last one. */
  up(pointerId: number): void {
    this.fingers.delete(pointerId);
    if (this.fingers.size === 0) this.turning = false;
  }

  private middle(): number {
    let sum = 0;
    for (const x of this.fingers.values()) sum += x;
    return sum / this.fingers.size;
  }
}
