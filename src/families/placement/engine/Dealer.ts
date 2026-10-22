import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import type { Grid } from './Grid';
import { afterPlacing, canPlaceAll } from './HandSolver';
import { Shape, SHAPES, type ShapeEntry } from './Shape';

/** A piece offered to the player. */
export interface OfferedPiece {
  /** Unique within a game: lets the interface follow a piece across turns. */
  readonly id: number;
  readonly shape: Shape;
  readonly tone: Tone;
}

export const HAND_SIZE = 3;
/** Random hands drawn before building one by hand. */
export const CANDIDATE_HANDS = 12;
/** Every this many hands, big pieces (5 cells or more) come 10 % more often, up to twice. */
export const RAMP_HANDS = 15;
/** Above this many tiles, small pieces (3 cells or fewer) come twice as often. */
export const RESCUE_TILES = 40;

/** The seven glazes of the Mosaic, shared with the shape tones of the other families. */
const GLAZES: readonly Tone[] = [Tone.I, Tone.O, Tone.T, Tone.S, Tone.Z, Tone.J, Tone.L];

/**
 * Deals fair hands: every hand can be placed in full, in some order, on the
 * board it is dealt to (the players' first complaint about the genre is the
 * impossible hand). Big pieces grow more common as the game goes on; a
 * crowded board gets smaller pieces.
 */
export class Dealer {
  private nextId = 1;

  constructor(
    private readonly random: RandomSource,
    private readonly entries: readonly ShapeEntry[] = SHAPES,
  ) {}

  /** Three pieces that can all be placed on this grid (when any can). */
  hand(grid: Grid, handsPlayed: number): OfferedPiece[] {
    const weights = this.weights(grid, handsPlayed);
    for (let k = 0; k < CANDIDATE_HANDS; k++) {
      const shapes = Array.from({ length: HAND_SIZE }, () => this.draw(weights));
      if (canPlaceAll(grid, shapes)) return shapes.map((shape) => this.piece(shape));
    }
    return this.build(grid, weights).map((shape) => this.piece(shape));
  }

  /** A given shape, in a random glaze (the cube joker). */
  /** A piece of this shape, glazed at random unless a tone is given. */
  piece(shape: Shape, tone?: Tone): OfferedPiece {
    return {
      id: this.nextId++,
      shape,
      tone: tone ?? GLAZES[this.random.nextInt(GLAZES.length)]!,
    };
  }

  /** The same piece turned a quarter (the rotation joker). */
  turned(piece: OfferedPiece): OfferedPiece {
    return { id: this.nextId++, shape: piece.shape.rotated(), tone: piece.tone };
  }

  /** The weight of each shape for this deal. */
  private weights(grid: Grid, handsPlayed: number): number[] {
    const ramp = Math.min(2, 1 + 0.1 * Math.floor(handsPlayed / RAMP_HANDS));
    const crowded = grid.tileCount() > RESCUE_TILES;
    return this.entries.map(({ shape, weight }) => {
      if (shape.size >= 5) return weight * ramp;
      if (crowded && shape.size <= 3) return weight * 2;
      return weight;
    });
  }

  private draw(weights: readonly number[], allowed?: readonly boolean[]): Shape {
    let total = 0;
    weights.forEach((weight, i) => (total += allowed && !allowed[i] ? 0 : weight));
    let pick = this.random.next() * total;
    for (let i = 0; i < this.entries.length; i++) {
      if (allowed && !allowed[i]) continue;
      pick -= weights[i]!;
      if (pick < 0) return this.entries[i]!.shape;
    }
    return this.entries[0]!.shape;
  }

  /**
   * No random hand could be proven playable: build one piece at a time on a
   * simulated board, each piece among those that fit after the previous ones.
   */
  private build(grid: Grid, weights: readonly number[]): Shape[] {
    let board = grid;
    const shapes: Shape[] = [];
    for (let k = 0; k < HAND_SIZE; k++) {
      const allowed = this.entries.map(({ shape }) => board.fitsAnywhere(shape));
      const shape = allowed.some(Boolean) ? this.draw(weights, allowed) : this.draw(weights);
      shapes.push(shape);
      const spot = firstSpot(board, shape);
      if (spot) board = afterPlacing(board, shape, spot.x, spot.y);
    }
    return shapes;
  }
}

function firstSpot(grid: Grid, shape: Shape): { x: number; y: number } | null {
  for (let y = 0; y <= grid.size - shape.height; y++) {
    for (let x = 0; x <= grid.size - shape.width; x++) if (grid.fits(shape, x, y)) return { x, y };
  }
  return null;
}

/** The single cell of the cube joker. */
export const CUBE = Shape.parse('#');
