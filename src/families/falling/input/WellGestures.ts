import type { FallingCommand } from '../FallingSession';

/** A tap: short and nearly still. */
const TAP_MAX_MS = 250;
const TAP_MAX_TRAVEL = 12;
/** Fast downward swipe → hard drop (pixels per millisecond). */
const FLICK_SPEED = 1.1;
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

/**
 * Touch gestures on the well: drag sideways to move cell by cell, tap to
 * rotate, flick down to hard drop, drag down slowly to soft drop.
 */
export class WellGestures {
  private gesture: Gesture | null = null;

  constructor(
    private readonly execute: (command: FallingCommand) => void,
    /** Current cell size in CSS pixels. */
    private readonly cellSize: () => number,
  ) {}

  down(id: number, x: number, y: number, time: number): void {
    this.gesture = {
      id,
      startX: x,
      startY: y,
      startTime: time,
      anchorX: x,
      moved: false,
      softDropping: false,
    };
  }

  move(id: number, x: number, y: number): void {
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
    const gesture = this.gesture;
    if (!gesture || gesture.id !== id) return;
    this.gesture = null;
    const elapsed = Math.max(1, time - gesture.startTime);
    const dx = x - gesture.startX;
    const dy = y - gesture.startY;
    if (gesture.softDropping) this.execute({ type: 'softDrop', active: false });

    if (dy > this.cellSize() * 2 && dy / elapsed >= FLICK_SPEED && Math.abs(dy) > Math.abs(dx)) {
      this.execute({ type: 'hardDrop' });
    } else if (!gesture.moved && elapsed <= TAP_MAX_MS && Math.hypot(dx, dy) <= TAP_MAX_TRAVEL) {
      this.execute({ type: 'rotate', direction: 1 });
    }
  }

  cancel(): void {
    if (this.gesture?.softDropping) this.execute({ type: 'softDrop', active: false });
    this.gesture = null;
  }
}
