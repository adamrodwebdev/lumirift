import type { Tone } from '@/core/Tone';
import type { Shape } from '@/families/placement/engine/Shape';
import type { Aim, DunesGame } from './engine/DunesGame';
import type { DunesCommand } from './DunesSession';

/** A piece held over the board: where it would go, and whether it fits there. */
export interface DunesPreview extends Aim {
  readonly shape: Shape;
  readonly tone: Tone;
  readonly valid: boolean;
}

/**
 * The player's choices in Dunes (1.37), without the DOM: the piece picked
 * (keys 1 to 3, a tap), the cursor moved by the arrows, the piece put down
 * where it is held or tapped. The stage renders; the controller decides.
 */
export class DunesController {
  private _selected: number | null = null;
  private _cursor = { x: 3, y: 2 };

  constructor(
    private readonly game: DunesGame,
    private readonly execute: (command: DunesCommand) => boolean,
  ) {}

  /** The slot picked, while its piece is still in the hand. */
  get selected(): number | null {
    if (this._selected !== null && !this.game.hand[this._selected]) this._selected = null;
    return this._selected;
  }

  get cursor(): { readonly x: number; readonly y: number } {
    return this._cursor;
  }

  /** Picks a piece (again: lets it go); the cursor keeps it on the board. */
  selectSlot(slot: number): void {
    if (!this.game.hand[slot]) return;
    this._selected = this._selected === slot ? null : slot;
    if (this._selected !== null) this._cursor = this.anchor(slot, this._cursor.x, this._cursor.y);
  }

  moveCursor(dx: number, dy: number): void {
    const slot = this.selected;
    const x = this._cursor.x + dx;
    const y = this._cursor.y + dy;
    this._cursor =
      slot === null
        ? {
            x: Math.max(0, Math.min(this.game.board().columns - 1, x)),
            y: Math.max(0, Math.min(this.game.board().rows - 1, y)),
          }
        : this.anchor(slot, x, y);
  }

  /** The piece picked goes down at the cursor. */
  confirm(): boolean {
    const slot = this.selected;
    if (slot === null) return false;
    return this.drop(slot, this._cursor.x, this._cursor.y);
  }

  /** A piece dragged onto the board goes down there. */
  drop(slot: number, x: number, y: number): boolean {
    const done = this.execute({ type: 'place', slot, x, y });
    if (done) this._selected = null;
    return done;
  }

  /** A tap on a cell puts the piece picked there (its top-left corner). */
  tapCell(x: number, y: number): boolean {
    const slot = this.selected;
    if (slot === null) return false;
    const at = this.anchor(slot, x, y);
    return this.drop(slot, at.x, at.y);
  }

  cancel(): void {
    this._selected = null;
  }

  swap(): boolean {
    const done = this.execute({ type: 'swap' });
    if (done) this._selected = null;
    return done;
  }

  /** Where a piece of a slot would go with its top-left corner at a cell, and whether it fits. */
  previewAt(slot: number, x: number, y: number): DunesPreview | null {
    const piece = this.game.hand[slot];
    if (!piece) return null;
    const at = this.anchor(slot, x, y);
    return {
      slot,
      ...at,
      shape: piece.shape,
      tone: piece.tone,
      valid: this.game.canPlace(slot, at.x, at.y),
    };
  }

  /** The piece picked, at the cursor (the keyboard's preview). */
  keyboardPreview(): DunesPreview | null {
    const slot = this.selected;
    return slot === null ? null : this.previewAt(slot, this._cursor.x, this._cursor.y);
  }

  /** Keeps a piece inside the board. */
  private anchor(slot: number, x: number, y: number): { x: number; y: number } {
    const shape = this.game.hand[slot]?.shape;
    const board = this.game.board();
    if (!shape) return { x, y };
    return {
      x: Math.max(0, Math.min(board.columns - shape.width, x)),
      y: Math.max(0, Math.min(board.rows - shape.height, y)),
    };
  }
}
