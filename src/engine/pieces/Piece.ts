import type { PieceType, Rotation, RotationDirection, Tone } from './PieceType';
import { shapeCells, shapeSize, type Cell } from './Shapes';

/**
 * The falling piece: an immutable value object. Each move returns a new piece,
 * which the game keeps only if the board accepts it.
 */
export class Piece {
  constructor(
    readonly type: PieceType,
    readonly tone: Tone,
    readonly x: number,
    readonly y: number,
    readonly rotation: Rotation = 0,
  ) {}

  /** Spawn position: centred, bounding box on the top (hidden) row. */
  static spawn(type: PieceType, tone: Tone, boardWidth: number): Piece {
    const x = Math.floor((boardWidth - shapeSize(type)) / 2);
    return new Piece(type, tone, x, 0);
  }

  /** Cells relative to the bounding box (shared, never mutate). */
  get localCells(): readonly Cell[] {
    return shapeCells(this.type, this.rotation);
  }

  /** Absolute cells on the board. */
  cells(): Cell[] {
    return this.localCells.map((cell) => ({ x: cell.x + this.x, y: cell.y + this.y }));
  }

  moved(dx: number, dy: number): Piece {
    return new Piece(this.type, this.tone, this.x + dx, this.y + dy, this.rotation);
  }

  rotated(direction: RotationDirection): Piece {
    const rotation = ((this.rotation + direction + 4) % 4) as Rotation;
    return new Piece(this.type, this.tone, this.x, this.y, rotation);
  }

  withTone(tone: Tone): Piece {
    return new Piece(this.type, tone, this.x, this.y, this.rotation);
  }
}
