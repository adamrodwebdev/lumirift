/**
 * Ratio of the ellipse's height to its width: how far above the tower the
 * eye sits. Rings look like flat ellipses, the front lower than the back.
 */
export const TILT = 0.14;
/** Light comes from the front left (radians from face on). */
const LIGHT_ANGLE = -0.45;

/** A cell side seen face on, as a share of the radius (2π / 20 for 20 columns). */
const arc = (columns: number) => (2 * Math.PI) / columns;

/**
 * Orthographic projection of the cylinder seen slightly from above: a
 * horizontal position (in columns) becomes an angle around the tower, then a
 * screen position. Pure arithmetic, in device pixels; nothing is drawn here.
 */
export class CylinderProjection {
  /** Radius of the tower. */
  radius = 0;
  /** Height of a row. */
  rowHeight = 0;
  /** Centre of the tower on screen. */
  centreX = 0;
  /** Screen y of the top of the visible well (the top ring's centre line). */
  top = 0;
  /** Column face on (from `TowerCamera`). */
  camera = 0;

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {}

  /** Size of the whole tower on screen, for a given radius. */
  static size(columns: number, rows: number, radius: number): { width: number; height: number } {
    const row = radius * arc(columns);
    const ellipse = radius * TILT;
    return { width: radius * 2, height: rows * row + ellipse * 2 };
  }

  /** The largest radius for which the tower fits in the box. */
  static fit(columns: number, rows: number, width: number, height: number): number {
    return Math.max(1, Math.min(width / 2, height / (rows * arc(columns) + TILT * 2)));
  }

  /** Lays the tower out for a radius; the canvas is `size()` large. */
  layout(radius: number): void {
    this.radius = radius;
    this.rowHeight = radius * arc(this.columns);
    this.centreX = radius;
    this.top = radius * TILT;
  }

  /** Angle of a horizontal position, 0 being face on. */
  angle(x: number): number {
    return (x - this.camera) * arc(this.columns);
  }

  /** Screen x of a horizontal position. */
  screenX(x: number): number {
    return this.centreX + this.radius * Math.sin(this.angle(x));
  }

  /** Screen y of a point at height `y` (in rows from the top) on the given position. */
  screenY(x: number, y: number): number {
    return this.top + y * this.rowHeight + this.radius * TILT * Math.cos(this.angle(x));
  }

  /** 1 face on, 0 on the edge, negative on the back. */
  depth(x: number): number {
    return Math.cos(this.angle(x));
  }

  /** Darkening of a column of the front (0: none), from its angle to the light. */
  shadow(x: number): number {
    return Math.min(0.7, (1 - Math.cos(this.angle(x) - LIGHT_ANGLE)) * 0.45);
  }

  /** Brightness of the specular glint on a column (0 to 1). */
  glint(x: number): number {
    return Math.max(0, Math.cos(this.angle(x) - LIGHT_ANGLE)) ** 24;
  }

  /**
   * The affine transform that maps the unit square onto the face of a column
   * (left edge `x`) between heights `y` and `y + height`: the face is a
   * parallelogram, so a sprite drawn on the unit square lands exactly on it.
   */
  face(x: number, y: number, height: number): [number, number, number, number, number, number] {
    const x0 = this.screenX(x);
    const x1 = this.screenX(x + 1);
    const y0 = this.screenY(x, y);
    const y1 = this.screenY(x + 1, y);
    return [x1 - x0, y1 - y0, 0, height * this.rowHeight, x0, y0];
  }

  /** The column under a screen x on the front, as a continuous position (for the pointer). */
  columnAt(screenX: number): number {
    const s = Math.max(-1, Math.min(1, (screenX - this.centreX) / this.radius));
    return this.camera + Math.asin(s) / arc(this.columns);
  }
}
