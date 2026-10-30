import type { FallingCommand } from '../../FallingSession';
import { GESTURE_TUNING, nearVertical } from './GestureTuning';
import { VelocityTracker, type Motion } from './VelocityTracker';

const { tap: TAP, pair: PAIR, flick: FLICK, notch: NOTCH, softDrop: SOFT } = GESTURE_TUNING;

/** A finger at a moment: a pointer event, or one of the samples coalesced into it. */
export interface TouchPoint {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

/** The player's touch preferences, read as a touch begins. */
export interface TouchPrefs {
  /** Cells of piece for a cell of finger (0.8 to 1.6). */
  readonly dragSpeed: number;
  /** A tap turns the way of its side (the left half, the other way); otherwise every tap turns right. */
  readonly tapSides: boolean;
  /** Flicks drop and hold; with the buttons as well, the buttons do (and flicks do nothing). */
  readonly flicks: boolean;
}

/** Which piece is in play: a flick drops only the one in play as the touch began. */
export interface PieceWatch {
  /** The pieces that have entered so far; the one in play is the last. */
  readonly entered: number;
  /** A piece is in play (none while the next one waits to enter). */
  readonly inPlay: boolean;
}

/** The play surface: its middle parts the sides, its bottom edge is the phone's. */
export interface SurfaceBounds {
  readonly left: number;
  readonly width: number;
  readonly bottom: number;
}

export interface PhoneGestureOptions {
  readonly execute: (command: FallingCommand) => void;
  /** A cell's size in CSS pixels (in the Tower, a column face on). */
  readonly cellSize: () => number;
  readonly prefs: () => TouchPrefs;
  readonly bounds: () => SurfaceBounds;
  readonly pieces: PieceWatch;
  /** A second finger's tap turns the piece during a drag; not where two fingers turn the tower. */
  readonly secondFingerTurns: boolean;
}

/** The touch of the finger that plays: a tap, a drag or a flick. */
interface Drag extends Sides {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  /** Begun on the screen's bottom edge: a flick up there is the phone's. */
  readonly fromEdge: boolean;
  /** The piece this touch may drop (the misdrop guard). */
  readonly ticket: number;
  /** Still a tap: short and nearly still so far. */
  still: boolean;
  /** A flick has played: the rest of the touch is ignored. */
  done: boolean;
  /** The last sample's x. */
  lastX: number;
  /** The sideways notches: counted from `anchor`, the way of `heading`, the drag's furthest point that way. */
  anchor: number;
  heading: -1 | 0 | 1;
  extreme: number;
  /** The notches played since `anchor`. */
  notches: number;
  /** Where the drag last turned down (or last moved the piece sideways): the soft drop counts from there. */
  topX: number;
  topY: number;
  /** The rows played down since `topY`. */
  rows: number;
}

/** How fast a flick must be, down (a drop) and up (a hold). */
interface FlickSpeeds {
  readonly down: number;
  readonly up: number;
}

/** Which way a tap turns: its side, as the touch began. */
interface Sides {
  readonly prefs: TouchPrefs;
  readonly middle: number;
}

/** A second finger, put down during a drag: a tap of it turns the piece (the drag's sides). */
interface Helper extends Sides {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
  still: boolean;
}

/** Two fingers from the start: a tap of both turns the other way. */
interface Pair {
  readonly startTime: number;
  still: boolean;
}

/**
 * The phone gestures (1.32), anywhere on the game screen, for the falling
 * well, the Sand and the Tower: the piece follows a drag sideways and down, a
 * notch a cell to the nearest cell (1.40), tap a side to turn (the right half
 * clockwise), flick down to drop, flick up to hold. A firm flick plays at
 * once (a flick up also at the lift), and a drop only for the piece in play
 * as the touch began; the rest of that touch is ignored. A second finger's tap
 * turns the piece without breaking the drag; two fingers tapping together turn
 * it the other way.
 */
export class PhoneGestures {
  private drag: Drag | null = null;
  private helper: Helper | null = null;
  private pair: Pair | null = null;
  /** The fingers down, and where each one came down. */
  private readonly fingers = new Map<number, { readonly x: number; readonly y: number }>();
  private readonly tracker = new VelocityTracker();

  constructor(private readonly options: PhoneGestureOptions) {}

  down(point: TouchPoint): void {
    this.fingers.set(point.id, { x: point.x, y: point.y });
    if (this.fingers.size === 1) {
      this.pair = null;
      this.helper = null;
      this.drag = this.begin(point);
      return;
    }
    const drag = this.drag;
    if (
      this.fingers.size === 2 &&
      this.options.secondFingerTurns &&
      drag &&
      !drag.still &&
      !drag.done
    ) {
      const { prefs, middle } = drag;
      this.helper = {
        id: point.id,
        x: point.x,
        y: point.y,
        time: point.time,
        still: true,
        prefs,
        middle,
      };
      return;
    }
    // Two fingers play together (a third one ends it all): the drag ends.
    this.endDrag();
    this.helper = null;
    this.pair = this.fingers.size === 2 ? { startTime: point.time, still: true } : null;
  }

  move(point: TouchPoint): void {
    const finger = this.fingers.get(point.id);
    if (!finger) return;
    if (this.pair) {
      if (Math.hypot(point.x - finger.x, point.y - finger.y) > PAIR.maxTravel)
        this.pair.still = false;
      return;
    }
    const helper = this.helper;
    if (helper?.id === point.id) {
      if (Math.hypot(point.x - helper.x, point.y - helper.y) > TAP.maxTravel) helper.still = false;
      return;
    }
    const drag = this.drag;
    if (!drag || drag.id !== point.id || drag.done) return;
    const shift = point.x - drag.lastX;
    this.sample(drag, point);
    const motion = this.tracker.motion(point.time);
    if (this.flick(drag, motion, { down: FLICK.firmSpeed, up: FLICK.firmSpeed })) return;
    const cell = this.options.cellSize();
    if (motion && isRush(motion)) {
      // A flick on its way, or a quick soft drop: its arc sideways is no move.
      drag.anchor += shift;
      drag.extreme += shift;
    } else {
      this.slide(drag, point, cell);
    }
    this.descend(drag, point, cell);
  }

  up(point: TouchPoint): void {
    if (!this.fingers.delete(point.id)) return;
    if (this.pair) {
      // The pair counts once both fingers are up.
      if (this.fingers.size > 0) return;
      const { startTime, still } = this.pair;
      this.pair = null;
      if (still && point.time - startTime <= PAIR.maxMs)
        this.options.execute({ type: 'rotate', direction: -1 });
      return;
    }
    const helper = this.helper;
    if (helper?.id === point.id) {
      this.helper = null;
      if (helper.still && point.time - helper.time <= TAP.maxMs) this.turn(helper.x, helper);
      return;
    }
    const drag = this.drag;
    if (!drag || drag.id !== point.id) return;
    this.drag = null;
    if (drag.done) return;
    // The lift only repeats where the finger last was (a roll of it as it leaves the
    // glass would read as a jerk): as Android does, the tracker leaves it out, and reads
    // the flick at its time. A flick up holds from the gentler speed, a stroke from rest
    // counting as leaving the glass faster than it averaged. A drop there is a firm flick,
    // or a gentler one still speeding up, read as the finger moved: a jump a busy page
    // merged could as well be a quick soft drag, and a drop by accident costs more than a
    // flick to repeat (1.40).
    if (
      this.flick(drag, this.tracker.motionAtLift(point.time), { down: Infinity, up: FLICK.speed })
    )
      return;
    const moving = this.tracker.motion(point.time);
    const down = moving && moving.acceleration >= FLICK.speedingUp ? FLICK.speed : FLICK.firmSpeed;
    if (this.flick(drag, moving, { down, up: Infinity })) return;
    const still =
      drag.still && Math.hypot(point.x - drag.startX, point.y - drag.startY) <= TAP.maxTravel;
    if (still && point.time - drag.startTime <= TAP.maxMs) this.turn(drag.startX, drag);
  }

  /** The browser took the touch back (or the game paused): every gesture is dropped whole. */
  cancel(): void {
    this.endDrag();
    this.fingers.clear();
    this.helper = null;
    this.pair = null;
  }

  private begin(point: TouchPoint): Drag {
    const { prefs, bounds, pieces } = this.options;
    const surface = bounds();
    this.tracker.reset();
    this.tracker.add(point.x, point.y, point.time);
    return {
      id: point.id,
      startX: point.x,
      startY: point.y,
      startTime: point.time,
      prefs: prefs(),
      middle: surface.left + surface.width / 2,
      fromEdge: surface.bottom - point.y < GESTURE_TUNING.bottomEdge,
      // Down while the next piece waits to enter: the touch belongs to it.
      ticket: pieces.inPlay ? pieces.entered : pieces.entered + 1,
      still: true,
      done: false,
      lastX: point.x,
      anchor: point.x,
      heading: 0,
      extreme: point.x,
      notches: 0,
      topX: point.x,
      topY: point.y,
      rows: 0,
    };
  }

  private sample(drag: Drag, point: TouchPoint): void {
    this.tracker.add(point.x, point.y, point.time);
    drag.lastX = point.x;
    if (drag.still && Math.hypot(point.x - drag.startX, point.y - drag.startY) > TAP.maxTravel)
      drag.still = false;
  }

  /** A flick fast enough (its speed down or up) plays at once: a drop or a hold; the touch ends there. */
  private flick(drag: Drag, motion: Motion | null, speed: FlickSpeeds): boolean {
    if (!drag.prefs.flicks || !motion) return false;
    if (!isFlick(motion, motion.vy > 0 ? speed.down : speed.up)) return false;
    drag.done = true;
    if (motion.vy > 0) {
      const { pieces } = this.options;
      if (pieces.inPlay && pieces.entered === drag.ticket)
        this.options.execute({ type: 'hardDrop' });
    } else if (!drag.fromEdge) {
      this.options.execute({ type: 'hold' });
    }
    return true;
  }

  /**
   * Sideways, a notch a cell to the nearest cell (1.40): the first at half a
   * cell, then a cell apart; a turn back reads after a sixth of a cell, and the
   * notches count again from where the finger turned.
   */
  private slide(drag: Drag, point: TouchPoint, cell: number): void {
    const step = cell / drag.prefs.dragSpeed;
    const x = point.x;
    if (drag.heading === 0) {
      const offset = x - drag.anchor;
      if (Math.abs(offset) < step * NOTCH.first) return;
      drag.heading = offset > 0 ? 1 : -1;
      drag.extreme = x;
    } else if ((x - drag.extreme) * drag.heading > 0) {
      drag.extreme = x;
    } else if ((drag.extreme - x) * drag.heading > step * NOTCH.turn) {
      drag.heading = drag.heading > 0 ? -1 : 1;
      drag.anchor = drag.extreme;
      drag.extreme = x;
      drag.notches = 0;
    }
    const direction = drag.heading;
    // The n-th notch at n − ½ cells from the anchor: the piece goes where the finger rounds to.
    const due = Math.floor(((x - drag.anchor) * direction) / step + 1 - NOTCH.first);
    for (; drag.notches < due; drag.notches++) {
      this.options.execute({ type: 'move', direction });
      // A move steers: a soft drop counts from here.
      drag.topX = x;
      drag.topY = point.y;
      drag.rows = 0;
    }
  }

  /**
   * Down, the piece follows the finger the same way (1.40): a row a notch, the
   * first at half a cell, while the drag stays within 30° of vertical since it
   * turned down; back up, the rows count again from the top.
   */
  private descend(drag: Drag, point: TouchPoint, cell: number): void {
    // Only the piece in play as the touch began goes down: a finger still dragging as
    // the next one enters takes nothing down (as a flick drops only its own piece).
    const { pieces } = this.options;
    if (!pieces.inPlay || pieces.entered !== drag.ticket) return;
    const { x, y } = point;
    if (y <= drag.topY) {
      drag.topX = x;
      drag.topY = y;
      drag.rows = 0;
      return;
    }
    const step = cell / drag.prefs.dragSpeed;
    const down = y - drag.topY;
    if (!nearVertical(x - drag.topX, down, SOFT.maxAngle)) return;
    const due = Math.floor(down / step + 1 - SOFT.first);
    for (; drag.rows < due; drag.rows++) this.options.execute({ type: 'softStep' });
  }

  /** A tap turns the piece: the way of its side, or always right. */
  private turn(x: number, { prefs, middle }: Sides): void {
    const direction = prefs.tapSides && x < middle ? -1 : 1;
    this.options.execute({ type: 'rotate', direction });
  }

  private endDrag(): void {
    this.drag = null;
  }
}

/** Fast enough, far enough within the window and near the vertical: a flick. */
function isFlick({ vx, vy, dy }: Motion, speed: number): boolean {
  return (
    Math.hypot(vx, vy) >= speed &&
    Math.abs(dy) >= FLICK.minTravel &&
    Math.sign(dy) === Math.sign(vy) &&
    nearVertical(vx, vy, FLICK.maxAngle)
  );
}

/** A finger rushing up or down: a flick on its way, or a quick soft drop. */
function isRush({ vx, vy, dx, dy }: Motion): boolean {
  return (
    Math.hypot(vx, vy) >= NOTCH.rushSpeed &&
    nearVertical(vx, vy, FLICK.maxAngle) &&
    nearVertical(dx, dy, FLICK.maxAngle)
  );
}
