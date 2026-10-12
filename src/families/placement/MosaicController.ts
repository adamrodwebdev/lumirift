import type { Tone } from '@/core/Tone';
import type { Lines } from './engine/Grid';
import type { SlotId } from './engine/MosaicGame';
import type { Shape } from './engine/Shape';
import { JOKERS, type JokerId } from './jokers/Joker';
import type { MosaicCommand, MosaicView } from './PlacementSession';

/** What the board shows under the cursor or the finger. */
export interface Preview {
  readonly shape: Shape;
  readonly tone: Tone;
  readonly x: number;
  readonly y: number;
  readonly valid: boolean;
  /** Rows and columns that would clear. */
  readonly lines: Lines;
}

/**
 * The player's choices between two moves, without any DOM: which piece is
 * selected, where the keyboard cursor is, which joker waits for a target.
 * Pointer and keyboard both go through it, so they behave the same way.
 */
export class MosaicController {
  selected: SlotId | null = null;
  cursor = { x: 3, y: 3 };
  /** Inventory index of a joker waiting for its target (a piece or a cell). */
  pendingJoker: number | null = null;

  constructor(
    private readonly view: MosaicView,
    private readonly execute: (command: MosaicCommand) => boolean,
  ) {}

  get pendingJokerId(): JokerId | null {
    return this.pendingJoker === null ? null : (this.view.jokers[this.pendingJoker] ?? null);
  }

  /** Selects a piece, or applies the waiting "piece" joker to it. */
  selectSlot(slot: SlotId): void {
    const joker = this.pendingJokerId;
    if (joker && JOKERS[joker].target === 'piece') {
      this.execute({ type: 'joker', index: this.pendingJoker!, slot });
      this.pendingJoker = null;
      return;
    }
    if (!this.view.pieceAt(slot)) return;
    this.selected = this.selected === slot ? null : slot;
  }

  /** Arms a joker; one without target is used at once. */
  chooseJoker(index: number): void {
    const id = this.view.jokers[index];
    if (id === undefined) return;
    if (JOKERS[id].target === 'none') {
      this.execute({ type: 'joker', index });
      this.pendingJoker = null;
      return;
    }
    this.pendingJoker = this.pendingJoker === index ? null : index;
    if (JOKERS[id].target === 'cell') this.selected = null;
  }

  moveCursor(dx: number, dy: number): void {
    const size = this.view.grid.size;
    this.cursor = {
      x: Math.min(size - 1, Math.max(0, this.cursor.x + dx)),
      y: Math.min(size - 1, Math.max(0, this.cursor.y + dy)),
    };
  }

  /** Enter: drops the selected piece, or fires the waiting joker, at the cursor. */
  confirm(): boolean {
    return this.actAt(this.cursor.x, this.cursor.y);
  }

  /** A tap or click on a cell of the board. */
  tapCell(x: number, y: number): boolean {
    this.cursor = { x, y };
    return this.actAt(x, y);
  }

  /** A piece dragged and dropped with its top-left cell at (x, y). */
  drop(slot: SlotId, x: number, y: number): boolean {
    const placed = this.execute({ type: 'place', slot, x, y });
    if (placed) this.selected = null;
    return placed;
  }

  cancel(): void {
    this.selected = null;
    this.pendingJoker = null;
  }

  /** The selected piece at the keyboard cursor, clamped inside the board. */
  keyboardPreview(): Preview | null {
    if (this.selected === null) return null;
    const piece = this.view.pieceAt(this.selected);
    if (!piece) return null;
    const { x, y } = this.anchor(piece.shape, this.cursor.x, this.cursor.y);
    return this.previewAt(this.selected, x, y);
  }

  previewAt(slot: SlotId, x: number, y: number): Preview | null {
    const piece = this.view.pieceAt(slot);
    if (!piece) return null;
    const valid = this.view.canPlace(slot, x, y);
    return {
      shape: piece.shape,
      tone: piece.tone,
      x,
      y,
      valid,
      lines: valid ? this.view.linesIfPlaced(slot, x, y) : { rows: [], columns: [] },
    };
  }

  /** Keeps a shape anchored at (x, y) inside the board. */
  anchor(shape: Shape, x: number, y: number): { x: number; y: number } {
    const size = this.view.grid.size;
    return {
      x: Math.min(size - shape.width, Math.max(0, x)),
      y: Math.min(size - shape.height, Math.max(0, y)),
    };
  }

  private actAt(x: number, y: number): boolean {
    const joker = this.pendingJokerId;
    if (joker && JOKERS[joker].target === 'cell') {
      const used = this.execute({ type: 'joker', index: this.pendingJoker!, x, y });
      if (used) this.pendingJoker = null;
      return used;
    }
    if (this.selected === null) return false;
    const piece = this.view.pieceAt(this.selected);
    if (!piece) return false;
    const at = this.anchor(piece.shape, x, y);
    return this.drop(this.selected, at.x, at.y);
  }
}
