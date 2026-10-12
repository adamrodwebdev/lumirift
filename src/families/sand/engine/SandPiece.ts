import type { Tone } from '@/core/Tone';
import type { PieceType, Rotation, RotationDirection } from '@/families/falling/pieces/PieceType';
import { shapeCells, shapeSize, type Cell } from '@/families/falling/pieces/Shapes';
import { GRAINS_PER_CELL } from './SandGrid';

/**
 * The falling piece of the sand well: the shapes of the falling family, at
 * the scale of grains. It slides a whole cell sideways but falls grain by
 * grain, so it lands smoothly on the uneven sand. Immutable.
 */
export class SandPiece {
  constructor(
    readonly type: PieceType,
    readonly tone: Tone,
    /** Left of the bounding box, in grains. */
    readonly x: number,
    /** Top of the bounding box, in grains. */
    readonly y: number,
    readonly rotation: Rotation = 0,
  ) {}

  /** Centred at the top of the well. */
  static spawn(type: PieceType, tone: Tone, widthInGrains: number): SandPiece {
    const cells = widthInGrains / GRAINS_PER_CELL;
    const x = Math.floor((cells - shapeSize(type)) / 2) * GRAINS_PER_CELL;
    return new SandPiece(type, tone, x, 0);
  }

  /** Cells of the shape (each one covers GRAINS_PER_CELL² grains). */
  get localCells(): readonly Cell[] {
    return shapeCells(this.type, this.rotation);
  }

  moved(dx: number, dy: number): SandPiece {
    return new SandPiece(this.type, this.tone, this.x + dx, this.y + dy, this.rotation);
  }

  rotated(direction: RotationDirection): SandPiece {
    const rotation = ((this.rotation + direction + 4) % 4) as Rotation;
    return new SandPiece(this.type, this.tone, this.x, this.y, rotation);
  }
}
