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
   * one (1.6 px/ms) plays at once, without waiting for the lift; at the lift,
   * 1.1 px/ms is enough (a drag slows down before it lifts, a flick leaves the
   * glass at full speed). A quick soft drag reads up to 1.45 px/ms at its peak
   * in the recorded traces.
   */
  flick: {
    windowMs: 100,
    minSamples: 3,
    stopMs: 40,
    speed: 1.1,
    firmSpeed: 1.6,
    minTravel: 24,
    maxAngle: 30,
  },
  /**
   * Moves, a notch a cell: a dead zone of a third of a notch is crossed before
   * the first move, and again whenever the drag turns back. A finger rushing
   * up or down (0.55 px/ms, near the vertical, its travel too: a flick on its
   * way) moves nothing sideways: its arc is no move.
   */
  notch: { deadZone: 1 / 3, rushSpeed: 0.55 },
  /** A soft drop: a mostly vertical drag, 1.5 cells down since it turned down; a cell back up ends it. */
  softDrop: { cells: 1.5, maxAngle: 30, releaseCells: 1 },
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
