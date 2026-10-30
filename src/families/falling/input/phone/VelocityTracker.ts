import { GESTURE_TUNING } from './GestureTuning';

const { windowMs, minSamples, stopMs } = GESTURE_TUNING.flick;
/** Across a pause, a finger that moved no further than a tap's slop had stopped. */
const STILL = GESTURE_TUNING.tap.maxTravel;
/**
 * A stroke from rest, read from its two ends as the finger lifts, leaves the
 * glass faster than it averaged (twice as fast, speeding up evenly): half of
 * that gap is taken.
 */
const FROM_REST = 1.5;
/** Room for the window's samples, even from a 240 Hz touch screen. */
const CAPACITY = 32;

/** A finger's motion at its newest sample: its velocity (px/ms) and its travel in the window (px). */
export interface Motion {
  readonly vx: number;
  readonly vy: number;
  readonly dx: number;
  readonly dy: number;
  /** How fast its speed grows along the motion (px/ms²): above 0 while it speeds up (1.40). */
  readonly acceleration: number;
}

/** Σtᵏ for k = 0 to 4, times taken from the newest sample. */
type TimeSums = readonly [number, number, number, number, number];
/** Σp, Σtp, Σt²p along an axis. */
type AxisSums = readonly [number, number, number];

/**
 * A finger's velocity as phones read it (Android's and Flutter's trackers):
 * a least-squares curve (a parabola, a line where it cannot be solved)
 * through its samples of the last 100 ms, three of them at least, read at the
 * newest sample, so that a flick that follows a slow drag counts at its own
 * speed. A pause of 40 ms where the finger stayed put cuts the window, and a
 * finger that has not moved for 40 ms has stopped. The samples live in a
 * fixed ring.
 *
 * A browser that gives no coalesced samples (Firefox on Android, Safari
 * before iOS 18.2) merges them while the page is busy (an ad loading): a
 * pause the finger moved across is samples lost, not a stop, and does not
 * cut the window. Short of three samples there, a parabola through them
 * would point anywhere: the last stroke tells the speed instead, from the
 * sample before the newest one. A jump across such a gap (40 to 200 ms), or
 * the first stroke of a touch, started from rest: as the finger lifts, it
 * counts as faster than it averaged.
 */
export class VelocityTracker {
  private readonly xs = new Float64Array(CAPACITY);
  private readonly ys = new Float64Array(CAPACITY);
  private readonly times = new Float64Array(CAPACITY);
  private count = 0;
  /** Where the next sample goes. */
  private head = 0;

  add(x: number, y: number, time: number): void {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.times[this.head] = time;
    this.head = (this.head + 1) % CAPACITY;
    this.count = Math.min(this.count + 1, CAPACITY);
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
  }

  /** The motion at `now`, as the finger moves: null when it has stopped, or with too few samples. */
  motion(now: number): Motion | null {
    return this.read(now, false);
  }

  /** The motion as the finger lifts: a stroke read from its ends counts as one from rest. */
  motionAtLift(now: number): Motion | null {
    return this.read(now, true);
  }

  private read(now: number, lifting: boolean): Motion | null {
    if (this.count === 0) return null;
    const newest = (this.head + CAPACITY - 1) % CAPACITY;
    const end = this.at(this.times, newest);
    if (now - end > stopMs) return null;
    const t: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    const x: [number, number, number] = [0, 0, 0];
    const y: [number, number, number] = [0, 0, 0];
    let oldest = newest;
    let later = newest;
    for (let taken = 0, index = newest; taken < this.count; taken++) {
      const time = this.at(this.times, index);
      if (now - time > windowMs || this.stopped(index, later)) break;
      const dt = time - end;
      const px = this.at(this.xs, index);
      const py = this.at(this.ys, index);
      const dt2 = dt * dt;
      t[0] += 1;
      t[1] += dt;
      t[2] += dt2;
      t[3] += dt2 * dt;
      t[4] += dt2 * dt2;
      x[0] += px;
      x[1] += dt * px;
      x[2] += dt2 * px;
      y[0] += py;
      y[1] += dt * py;
      y[2] += dt2 * py;
      oldest = index;
      later = index;
      index = (index + CAPACITY - 1) % CAPACITY;
    }
    if (t[0] < minSamples) return this.sparse(newest, lifting);
    const vx = slope(t, x);
    const vy = slope(t, y);
    if (vx === null || vy === null) return null;
    const speed = Math.hypot(vx, vy);
    return {
      vx,
      vy,
      dx: this.at(this.xs, newest) - this.at(this.xs, oldest),
      dy: this.at(this.ys, newest) - this.at(this.ys, oldest),
      acceleration: speed > 0 ? (bend(t, x) * vx + bend(t, y) * vy) / speed : 0,
    };
  }

  /** Fewer than three samples in the window: the last stroke, from the sample before the newest. */
  private sparse(newest: number, lifting: boolean): Motion | null {
    if (this.count < 2) return null;
    const before = (newest + CAPACITY - 1) % CAPACITY;
    const gap = this.at(this.times, newest) - this.at(this.times, before);
    // A jump the page merged, or the touch's first stroke: from rest.
    const fromRest = gap > stopMs || this.count === 2;
    return this.between(newest, lifting && fromRest ? FROM_REST : 1);
  }

  /** Whether the finger stayed put for 40 ms or more from sample `earlier` to sample `later`. */
  private stopped(earlier: number, later: number): boolean {
    const pause = this.at(this.times, later) - this.at(this.times, earlier);
    const travel = Math.hypot(
      this.at(this.xs, later) - this.at(this.xs, earlier),
      this.at(this.ys, later) - this.at(this.ys, earlier),
    );
    return pause > stopMs && travel <= STILL;
  }

  /**
   * The stroke from the sample before `newest` to it (200 ms at most), its
   * speed times `boost`; a stroke from rest (a boost) speeds up evenly across
   * its gap, otherwise its speed is taken as steady.
   */
  private between(newest: number, boost: number): Motion | null {
    const before = (newest + CAPACITY - 1) % CAPACITY;
    const gap = this.at(this.times, newest) - this.at(this.times, before);
    if (gap <= 0 || gap > 2 * windowMs) return null;
    const dx = this.at(this.xs, newest) - this.at(this.xs, before);
    const dy = this.at(this.ys, newest) - this.at(this.ys, before);
    const speed = (Math.hypot(dx, dy) / gap) * boost;
    return {
      vx: (dx / gap) * boost,
      vy: (dy / gap) * boost,
      dx,
      dy,
      acceleration: boost > 1 ? speed / gap : 0,
    };
  }

  private at(values: Float64Array, index: number): number {
    return values[index] ?? 0;
  }
}

/**
 * How fast the speed changes along an axis at the newest sample: twice the
 * square term of the least-squares parabola, 0 when it cannot be solved.
 */
function bend([s0, s1, s2, s3, s4]: TimeSums, [r0, r1, r2]: AxisSums): number {
  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) <= 1e-9 * s0 * s2 * s4) return 0;
  const detC = s0 * (s2 * r2 - r1 * s3) - s1 * (s1 * r2 - r1 * s2) + r0 * (s1 * s3 - s2 * s2);
  return (2 * detC) / det;
}

/**
 * The speed along an axis at the newest sample: the slope at t = 0 of the
 * least-squares parabola, or of the line when the parabola cannot be solved
 * (samples bunched in time); null when neither can.
 */
function slope([s0, s1, s2, s3, s4]: TimeSums, [r0, r1, r2]: AxisSums): number | null {
  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) > 1e-9 * s0 * s2 * s4) {
    const detB = s0 * (r1 * s4 - s3 * r2) - r0 * (s1 * s4 - s3 * s2) + s2 * (s1 * r2 - r1 * s2);
    return detB / det;
  }
  const spread = s0 * s2 - s1 * s1;
  return spread > 0 ? (s0 * r1 - s1 * r0) / spread : null;
}
