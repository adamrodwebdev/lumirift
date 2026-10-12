import {
  shapeTone,
  type PieceType,
  type Rotation,
  type RotationDirection,
  type Tone,
} from './PieceType';
import { shapeCells, shapeSize, type Cell } from './Shapes';

/** Seen in a mirror, S and Z swap, and so do J and L. */
const MIRROR_TYPE: Readonly<Record<PieceType, PieceType>> = {
  I: 'I',
  O: 'O',
  T: 'T',
  S: 'Z',
  Z: 'S',
  J: 'L',
  L: 'J',
};

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

  /**
   * The same piece reflected left to right in a well of the given width: the
   * shape becomes its mirror twin and keeps exactly the mirrored cells. A
   * piece coloured by its shape takes the colour of its new shape.
   */
  mirrored(boardWidth: number): Piece {
    const type = MIRROR_TYPE[this.type];
    const rotation = ((4 - this.rotation) % 4) as Rotation;
    const tone = this.tone === shapeTone(this.type) ? shapeTone(type) : this.tone;
    const x = boardWidth - this.x - shapeSize(this.type);
    return new Piece(type, tone, x, this.y, rotation);
  }
}
