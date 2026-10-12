import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Shape, SHAPES, type ShapeEntry } from './Shape';

/** A piece offered to the player. */
export interface OfferedPiece {
  /** Unique within a game: lets the interface follow a piece across turns. */
  readonly id: number;
  readonly shape: Shape;
  readonly tone: Tone;
}

/** The seven glazes of the Mosaic, shared with the shape tones of the other families. */
const GLAZES: readonly Tone[] = [Tone.I, Tone.O, Tone.T, Tone.S, Tone.Z, Tone.J, Tone.L];

/** Deals pieces at random, the common ones more often than the big ones. */
export class Dealer {
  private readonly total: number;
  private nextId = 1;

  constructor(
    private readonly random: RandomSource,
    private readonly entries: readonly ShapeEntry[] = SHAPES,
  ) {
    this.total = entries.reduce((sum, item) => sum + item.weight, 0);
  }

  deal(): OfferedPiece {
    let pick = this.random.next() * this.total;
    let shape = this.entries[this.entries.length - 1]!.shape;
    for (const item of this.entries) {
      pick -= item.weight;
      if (pick < 0) {
        shape = item.shape;
        break;
      }
    }
    return this.piece(shape);
  }

  /** A given shape, in a random glaze (the cube joker). */
  piece(shape: Shape): OfferedPiece {
    return { id: this.nextId++, shape, tone: GLAZES[this.random.nextInt(GLAZES.length)]! };
  }

  /** The same piece turned a quarter (the rotation joker). */
  turned(piece: OfferedPiece): OfferedPiece {
    return { id: this.nextId++, shape: piece.shape.rotated(), tone: piece.tone };
  }
}

/** The single cell of the cube joker. */
export const CUBE = Shape.parse('#');
