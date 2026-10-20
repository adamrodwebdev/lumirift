import type { FallingCommand } from '../FallingSession';

/** A tap: short and nearly still. */
const TAP_MAX_MS = 250;
const TAP_MAX_TRAVEL = 12;
/** Two fingers down and up together, nearly still: the other rotation. */
const TWO_FINGER_TAP_MS = 400;
const TWO_FINGER_TRAVEL = 16;
/** Fast vertical swipe → hard drop (down) or hold (up), in pixels per millisecond. */
const FLICK_SPEED = 1.1;
/** A swipe must cover this many cells to count. */
const FLICK_CELLS = 2;
/** Slow downward drag beyond this many cells → soft drop while held. */
const SOFT_DROP_CELLS = 1.2;

interface Gesture {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  anchorX: number;
  moved: boolean;
  softDropping: boolean;
}

interface Finger {
  readonly startX: number;
  readonly startY: number;
}

/**
 * Touch gestures, anywhere on the game screen: drag sideways to move cell by
 * cell, tap to rotate, tap with two fingers to rotate the other way, flick
 * down to hard drop, drag down slowly to soft drop, flick up to hold.
 */
export class WellGestures {
  private gesture: Gesture | null = null;
  private readonly fingers = new Map<number, Finger>();
  /** Two fingers on the screen: a tap of both rotates the other way. */
  private pair: { startTime: number; moved: boolean } | null = null;

  constructor(
    private readonly execute: (command: FallingCommand) => void,
    /** Current cell size in CSS pixels. */
    private readonly cellSize: () => number,
  ) {}

  down(id: number, x: number, y: number, time: number): void {
    this.fingers.set(id, { startX: x, startY: y });
    if (this.fingers.size === 1) {
      this.pair = null;
      this.gesture = {
        id,
        startX: x,
        startY: y,
        startTime: time,
        anchorX: x,
        moved: false,
        softDropping: false,
      };
      return;
    }
    // A second finger turns the gesture into a two-finger one; a third ends it.
    this.endSingle();
    this.pair = this.fingers.size === 2 ? { startTime: time, moved: false } : null;
  }

  move(id: number, x: number, y: number): void {
    const finger = this.fingers.get(id);
    if (!finger) return;
    if (this.pair) {
      if (Math.hypot(x - finger.startX, y - finger.startY) > TWO_FINGER_TRAVEL)
        this.pair.moved = true;
      return;
    }
    const gesture = this.gesture;
    if (!gesture || gesture.id !== id) return;
    const cell = this.cellSize();
    while (Math.abs(x - gesture.anchorX) >= cell) {
      const direction = x > gesture.anchorX ? 1 : -1;
      this.execute({ type: 'move', direction });
      gesture.anchorX += direction * cell;
      gesture.moved = true;
    }
    const dropping = y - gesture.startY > cell * SOFT_DROP_CELLS;
    if (dropping !== gesture.softDropping) {
      gesture.softDropping = dropping;
      gesture.moved = true;
      this.execute({ type: 'softDrop', active: dropping });
    }
  }

  up(id: number, x: number, y: number, time: number): void {
    if (!this.fingers.delete(id)) return;
    if (this.pair) {
      // The pair counts once both fingers are up.
      if (this.fingers.size > 0) return;
      const { startTime, moved } = this.pair;
      this.pair = null;
      if (!moved && time - startTime <= TWO_FINGER_TAP_MS)
        this.execute({ type: 'rotate', direction: -1 });
      return;
    }
    const gesture = this.gesture;
    if (!gesture || gesture.id !== id) return;
    this.gesture = null;
    const elapsed = Math.max(1, time - gesture.startTime);
    const dx = x - gesture.startX;
    const dy = y - gesture.startY;
    const cell = this.cellSize();
    if (gesture.softDropping) this.execute({ type: 'softDrop', active: false });

    const vertical = Math.abs(dy) > Math.abs(dx);
    const fast = Math.abs(dy) / elapsed >= FLICK_SPEED;
    if (vertical && fast && dy > cell * FLICK_CELLS) {
      this.execute({ type: 'hardDrop' });
    } else if (vertical && fast && dy < -cell * FLICK_CELLS && !gesture.moved) {
      this.execute({ type: 'hold' });
    } else if (!gesture.moved && elapsed <= TAP_MAX_MS && Math.hypot(dx, dy) <= TAP_MAX_TRAVEL) {
      this.execute({ type: 'rotate', direction: 1 });
    }
  }

  cancel(): void {
    this.endSingle();
    this.fingers.clear();
    this.pair = null;
  }

  private endSingle(): void {
    if (this.gesture?.softDropping) this.execute({ type: 'softDrop', active: false });
    this.gesture = null;
  }
}
