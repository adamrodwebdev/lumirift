import { Tone } from '@/core/Tone';
import { Shape, type ShapeEntry } from '@/families/placement/engine/Shape';
import type { ElementTone } from '@/families/sand/engine/Elements';

/*
 * The pieces of Dunes (1.37): what the hand deals. Pure data. Pieces never
 * turn (as in the Mosaic): each orientation is a piece of its own.
 */

const entry = (text: string, weight: number): ShapeEntry => ({ shape: Shape.parse(text), weight });

/** Every orientation of an outline, each listed once, sharing the weight. */
const turns = (text: string, weight: number): ShapeEntry[] => {
  const shapes: Shape[] = [];
  let shape = Shape.parse(text);
  for (let i = 0; i < 4; i++) {
    if (!shapes.some((known) => known.key === shape.key)) shapes.push(shape);
    shape = shape.rotated();
  }
  return shapes.map((variant) => ({ shape: variant, weight: weight / shapes.length }));
};

/**
 * The pieces of sand, from one cell to four: a board of 9 × 12 has no room
 * for the Mosaic's big squares and long bars. Bars and small corners are the
 * workhorses (they bridge a gap, they lay a band), the cell is the lifesaver.
 */
export const DUNES_SHAPES: readonly ShapeEntry[] = [
  entry('#', 3),
  ...turns('##', 6),
  ...turns('###', 6),
  ...turns('####', 2.5),
  entry('##|##', 4),
  ...turns('##|#.', 6),
  ...turns('###|#..', 3),
  ...turns('###|..#', 3),
  ...turns('###|.#.', 3),
  ...turns('.##|##.', 2),
  ...turns('##.|.##', 2),
];

/** The smallest piece: while a cell is free, it fits. */
export const SINGLE = Shape.parse('#');

/**
 * Each element comes as a small piece: a pour of water to fill a hollow, a
 * pair of flames or of drops, a single bolt or seed (a bolt strikes one
 * column; a seed sprouts one vine).
 */
export const ELEMENT_SHAPES: Readonly<Record<ElementTone, readonly Shape[]>> = {
  [Tone.Water]: [Shape.parse('###'), Shape.parse('#|#|#')],
  [Tone.Fire]: [Shape.parse('##'), Shape.parse('#|#')],
  [Tone.Oil]: [Shape.parse('##'), Shape.parse('#|#')],
  [Tone.Ice]: [Shape.parse('##'), Shape.parse('#|#')],
  [Tone.Lightning]: [SINGLE],
  [Tone.Seed]: [SINGLE],
  [Tone.Acid]: [Shape.parse('##'), Shape.parse('#|#')],
};
