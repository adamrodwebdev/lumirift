/** Time constant of the camera easing towards its target (ms). */
const EASING_MS = 110;
/** One press of a camera key turns the tower by this many columns. */
export const TURN_STEP = 2.5;

/**
 * The camera around the tower. Its position is the column shown face on, as a
 * continuous number (13.5: between columns 13 and 14). It follows the falling
 * piece; the player may turn it by hand, until the next piece appears.
 */
export class TowerCamera {
  private _position: number;
  private target: number;
  private manual = 0;

  constructor(
    private readonly columns: number,
    start = columns / 2,
  ) {
    this._position = start;
    this.target = start;
  }

  get position(): number {
    return this._position;
  }

  /** Keeps the given horizontal position (the piece's centre) face on. */
  follow(x: number): void {
    this.target = x;
  }

  /** Turns by hand: positive shows the columns on the right. */
  turn(columns: number): void {
    this.manual += columns;
  }

  /** Back to following the piece (a new piece has appeared). */
  recentre(): void {
    this.manual = 0;
  }

  /** Eases towards the target, the short way round; `smooth` false jumps there. */
  update(deltaMs: number, smooth: boolean): void {
    const gap = this.shortest(this.target + this.manual - this._position);
    const step = smooth ? 1 - Math.exp(-Math.max(0, deltaMs) / EASING_MS) : 1;
    // Keep the number small; the angle is periodic anyway.
    this._position = this.wrap(this._position + gap * step);
  }

  /** The signed distance in (-columns / 2, columns / 2], the short way round. */
  private shortest(distance: number): number {
    const half = this.columns / 2;
    const d = this.wrap(distance + half) - half;
    return d === -half ? half : d;
  }

  private wrap(x: number): number {
    const r = x % this.columns;
    return r < 0 ? r + this.columns : r;
  }
}
