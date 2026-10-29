/**
 * The tuning of the phone gestures (1.32): the rules `PhoneGestures` plays
 * by. Distances in CSS pixels or in cells, times in milliseconds. Flicks are
 * read as Android's and Flutter's trackers read them; the numbers come from
 * the research of 26 October (the genre's hits and their players' reviews)
 * and are held by the recorded traces of the tests.
 */
export const GESTURE_TUNING = {
  /** A tap: short and nearly still. */
  tap: { maxMs: 250, maxTravel: 12 },
  /** Two fingers down and up together, nearly still: the other rotation. */
  pair: { maxMs: 400, maxTravel: 16 },
  /**
   * A flick: its speed over its last 100 ms, from three samples at least
   * (`VelocityTracker`: where the finger stayed put for 40 ms the window
   * ends, a finger still for 40 ms has stopped), long enough within the
   * window and within 30° of vertical: it drops (down) or holds (up). A firm
   * one (1.6 px/ms) plays at once, without waiting for the lift, or as the
   * finger leaves the glass (where a busy page's merged samples show it). A
   * quick soft drag reads up to 1.45 px/ms at its peak in the recorded
   * traces: still moving as it leaves the glass, it is no drop (1.40, the lift
   * dropped from 1.1 px/ms before). At the lift, a gentler flick (1.1 px/ms)
   * drops only while it still speeds up (1.2 px/ms more every 100 ms): a flick
   * leaves the glass speeding up (1.8 at least in the traces), a soft drag
   * keeps its pace or slows down (0.7 at most, 95 times in 100). A flick
   * travels 40 px at least (24 before 1.40): a quick nudge a row down, read
   * from two samples on a 60 Hz screen, looks like a short flick from rest.
   * A flick up holds from 1.1 px/ms at the lift.
   */
  flick: {
    windowMs: 100,
    minSamples: 3,
    stopMs: 40,
    speed: 1.1,
    firmSpeed: 1.6,
    speedingUp: 0.012,
    minTravel: 40,
    maxAngle: 30,
  },
  /**
   * Moves, a notch a cell (1.40): the piece follows the finger to the nearest
   * cell, the first notch at half a cell, the next ones a cell apart (½, 1½,
   * 2½…). A turn back reads after a sixth of a cell, and the notches count
   * again from where the finger turned: a thumb's tremor moves nothing. A
   * finger rushing up or down (0.55 px/ms, near the vertical, its travel too:
   * a flick on its way) moves nothing sideways: its arc is no move.
   */
  notch: { first: 1 / 2, turn: 1 / 6, rushSpeed: 0.55 },
  /**
   * The soft drop follows the finger too (1.40): a row a notch of finger down,
   * the first at half a cell, within 30° of vertical since the drag last
   * turned down or moved sideways. The piece stops when the finger stops.
   */
  softDrop: { first: 1 / 2, maxAngle: 30 },
  /** The screen's bottom edge belongs to the phone (its home gesture): no hold from there. */
  bottomEdge: 32,
} as const;

/** Cells of piece for a cell of finger: the player's drag speed. */
export const DRAG_SPEED = { min: 0.8, max: 1.6, step: 0.1, standard: 1 } as const;

/**
 * The haptic budget (Android): a light tick a cell, a firmer one on a turn,
 * never two closer than 50 ms (players find more of it tiring).
 */
export const HAPTIC_BUDGET = { cellMs: 8, turnMs: 18, gapMs: 50 } as const;

/** Whether a motion lies within `maxAngle` degrees of the vertical. */
export function nearVertical(dx: number, dy: number, maxAngle: number): boolean {
  return Math.abs(dx) <= Math.abs(dy) * Math.tan((maxAngle * Math.PI) / 180);
}

/** A drag speed the settings may keep: within its range, on its steps (0.1). */
export function validDragSpeed(value: number): number {
  if (!Number.isFinite(value)) return DRAG_SPEED.standard;
  const clamped = Math.min(DRAG_SPEED.max, Math.max(DRAG_SPEED.min, value));
  return Number((Math.round(clamped / DRAG_SPEED.step) * DRAG_SPEED.step).toFixed(1));
}
