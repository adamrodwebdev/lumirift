export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * A piece's outline: cells relative to its top-left corner. Immutable; a
 * rotation returns a new shape.
 */
export class Shape {
  readonly cells: readonly Cell[];
  readonly width: number;
  readonly height: number;

  constructor(cells: readonly Cell[]) {
    const minX = Math.min(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    this.cells = cells
      .map(({ x, y }) => ({ x: x - minX, y: y - minY }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    this.width = Math.max(...this.cells.map((cell) => cell.x)) + 1;
    this.height = Math.max(...this.cells.map((cell) => cell.y)) + 1;
  }

  /** Reads "##.|.##": rows separated by "|", "#" for a cell. */
  static parse(text: string): Shape {
    const cells: Cell[] = [];
    text.split('|').forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push({ x, y });
    });
    return new Shape(cells);
  }

  get size(): number {
    return this.cells.length;
  }

  /** A quarter turn clockwise. */
  rotated(): Shape {
    return new Shape(this.cells.map(({ x, y }) => ({ x: this.height - 1 - y, y: x })));
  }

  /** Same outline, same key: lets rotations that change nothing be recognised. */
  get key(): string {
    return this.cells.map(({ x, y }) => `${x},${y}`).join(' ');
  }
}

export interface ShapeEntry {
  readonly shape: Shape;
  /** How often it is dealt, relative to the others. */
  readonly weight: number;
}

const entry = (text: string, weight: number): ShapeEntry => ({ shape: Shape.parse(text), weight });

/** Every rotation of an outline, each listed once, sharing the weight. */
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
 * The pieces of the Mosaic, from one to nine cells; pieces never turn, so
 * each orientation is a piece of its own. Small pieces are the lifesavers,
 * the 3 × 3 square and the big corner the run-killers: they are rarer.
 * (Weights per orientation: bars of 2 and 3 at 3, small corner at 2, T and
 * S / Z at 1, L / J at 0.75, big corner at 0.6.)
 */
export const SHAPES: readonly ShapeEntry[] = [
  entry('#', 2),
  ...turns('##', 6),
  ...turns('###', 6),
  ...turns('####', 4),
  ...turns('#####', 2),
  entry('##|##', 4),
  ...turns('###|###', 3),
  entry('###|###|###', 1.5),
  ...turns('##|#.', 8),
  ...turns('###|#..', 3),
  ...turns('###|..#', 3),
  ...turns('###|.#.', 4),
  ...turns('.##|##.', 2),
  ...turns('##.|.##', 2),
  ...turns('###|#..|#..', 2.4),
];
