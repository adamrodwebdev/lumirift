import { PIECE_TYPES, type PieceType, type Rotation } from './PieceType';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Parses "x,y x,y …" into cells. `0 - y` flips the sign without producing -0. */
const cells = (text: string, flipY = false): Cell[] =>
  text.split(' ').map((pair) => {
    const [x = 0, y = 0] = pair.split(',').map(Number);
    return { x, y: flipY ? 0 - y : y };
  });

interface ShapeDefinition {
  /** Side of the square bounding box the piece rotates in. */
  readonly size: number;
  /** Cells in spawn orientation, y pointing down. */
  readonly spawn: readonly Cell[];
}

const DEFINITIONS: Record<PieceType, ShapeDefinition> = {
  I: { size: 4, spawn: cells('0,1 1,1 2,1 3,1') },
  O: { size: 2, spawn: cells('0,0 1,0 0,1 1,1') },
  T: { size: 3, spawn: cells('1,0 0,1 1,1 2,1') },
  S: { size: 3, spawn: cells('1,0 2,0 0,1 1,1') },
  Z: { size: 3, spawn: cells('0,0 1,0 1,1 2,1') },
  J: { size: 3, spawn: cells('0,0 0,1 1,1 2,1') },
  L: { size: 3, spawn: cells('2,0 0,1 1,1 2,1') },
};

/** Clockwise quarter turn inside the bounding box: true rotation as in SRS. */
const rotateClockwise = (shape: readonly Cell[], size: number): Cell[] =>
  shape.map(({ x, y }) => ({ x: size - 1 - y, y: x }));

type Orientations = readonly [Cell[], Cell[], Cell[], Cell[]];

const orientationsOf = ({ size, spawn }: ShapeDefinition): Orientations => {
  const right = rotateClockwise(spawn, size);
  const half = rotateClockwise(right, size);
  return [[...spawn], right, half, rotateClockwise(half, size)];
};

/** Every orientation precomputed once: moving a piece never allocates cells. */
const ORIENTATIONS = new Map<PieceType, Orientations>(
  PIECE_TYPES.map((type) => [type, orientationsOf(DEFINITIONS[type])]),
);

export const shapeCells = (type: PieceType, rotation: Rotation): readonly Cell[] =>
  ORIENTATIONS.get(type)?.[rotation] ?? [];

export const shapeSize = (type: PieceType): number => DEFINITIONS[type].size;

/*
 * SRS wall kicks, copied from the reference tables (y pointing up) and
 * converted to y pointing down when parsed. Key: `${from}>${to}`.
 */
const kicks = (table: Record<string, string>): ReadonlyMap<string, readonly Cell[]> =>
  new Map(Object.entries(table).map(([key, text]) => [key, cells(text, true)]));

const JLSTZ_KICKS = kicks({
  '0>1': '0,0 -1,0 -1,1 0,-2 -1,-2',
  '1>0': '0,0 1,0 1,-1 0,2 1,2',
  '1>2': '0,0 1,0 1,-1 0,2 1,2',
  '2>1': '0,0 -1,0 -1,1 0,-2 -1,-2',
  '2>3': '0,0 1,0 1,1 0,-2 1,-2',
  '3>2': '0,0 -1,0 -1,-1 0,2 -1,2',
  '3>0': '0,0 -1,0 -1,-1 0,2 -1,2',
  '0>3': '0,0 1,0 1,1 0,-2 1,-2',
});

const I_KICKS = kicks({
  '0>1': '0,0 -2,0 1,0 -2,-1 1,2',
  '1>0': '0,0 2,0 -1,0 2,1 -1,-2',
  '1>2': '0,0 -1,0 2,0 -1,2 2,-1',
  '2>1': '0,0 1,0 -2,0 1,-2 -2,1',
  '2>3': '0,0 2,0 -1,0 2,1 -1,-2',
  '3>2': '0,0 -2,0 1,0 -2,-1 1,2',
  '3>0': '0,0 1,0 -2,0 1,-2 -2,1',
  '0>3': '0,0 -1,0 2,0 -1,2 2,-1',
});

const NO_KICK: readonly Cell[] = cells('0,0');

export const kickOffsets = (type: PieceType, from: Rotation, to: Rotation): readonly Cell[] => {
  if (type === 'O') return NO_KICK;
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS;
  return table.get(`${from}>${to}`) ?? NO_KICK;
};
