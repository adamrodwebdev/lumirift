import type { ModeId } from '@/session/ModeId';

/**
 * A small picture of each mode, as data: blocks on a 12 × 8 grid (drawn as
 * the game's own gems), plus strokes in a 120 × 80 box. Tones are the
 * game's (`Tone`), so the pictures follow the palette.
 */
export type ArtShape =
  | {
      readonly kind: 'blocks';
      readonly tone: number;
      readonly cells: readonly (readonly [number, number])[];
    }
  | { readonly kind: 'path'; readonly d: string; readonly tone: number; readonly dashed?: boolean }
  | {
      readonly kind: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    };

export const ART_WIDTH = 120;
export const ART_HEIGHT = 80;
/** One block of the grid, in art units; a block leaves a 1-unit gap around it. */
export const ART_CELL = 10;
/** The width of the strokes, in art units. */
export const ART_STROKE = 2.5;
/** Room left around a picture once cropped to what it shows (art units). */
export const ART_MARGIN = 4;

/** A rectangle of the 120 × 80 box. */
export interface ArtBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type Point = readonly [x: number, y: number];

/**
 * The points an SVG path goes through or bends towards: its ends and its
 * control points (a curve stays inside them). Commands M L H V Q T C Z, in
 * absolute or relative form, as the pictures use them.
 */
export function pathPoints(d: string): Point[] {
  const tokens = d.match(/[a-z]|-?\d*\.?\d+/gi) ?? [];
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  /** The last quadratic control point, mirrored by T. */
  let control: Point | null = null;
  let command = '';
  let i = 0;
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i]!)) command = tokens[i++]!;
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    switch (command.toUpperCase()) {
      case 'M':
        x = ox + next();
        y = oy + next();
        [startX, startY] = [x, y];
        points.push([x, y]);
        control = null;
        // More pairs after a move are lines.
        command = relative ? 'l' : 'L';
        break;
      case 'L':
        x = ox + next();
        y = oy + next();
        points.push([x, y]);
        control = null;
        break;
      case 'H':
        x = ox + next();
        points.push([x, y]);
        control = null;
        break;
      case 'V':
        y = oy + next();
        points.push([x, y]);
        control = null;
        break;
      case 'Q': {
        const bend: Point = [ox + next(), oy + next()];
        x = ox + next();
        y = oy + next();
        points.push(bend, [x, y]);
        control = bend;
        break;
      }
      case 'T': {
        const bend: Point = control ? [2 * x - control[0], 2 * y - control[1]] : [x, y];
        x = ox + next();
        y = oy + next();
        points.push(bend, [x, y]);
        control = bend;
        break;
      }
      case 'C': {
        const first: Point = [ox + next(), oy + next()];
        const second: Point = [ox + next(), oy + next()];
        x = ox + next();
        y = oy + next();
        points.push(first, second, [x, y]);
        control = null;
        break;
      }
      case 'Z':
        [x, y] = [startX, startY];
        control = null;
        break;
      default:
        throw new Error(`Unsupported path command "${command}"`);
    }
  }
  return points;
}

/**
 * The part of the box a picture covers, with a margin: the pictures are
 * cropped to it, so that each one fills its tile.
 */
export function artBounds(shapes: readonly ArtShape[]): ArtBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const take = (x0: number, y0: number, x1: number, y1: number) => {
    left = Math.min(left, x0);
    top = Math.min(top, y0);
    right = Math.max(right, x1);
    bottom = Math.max(bottom, y1);
  };
  const half = ART_STROKE / 2;
  for (const shape of shapes) {
    if (shape.kind === 'blocks')
      for (const [x, y] of shape.cells)
        take(x * ART_CELL + 1, y * ART_CELL - 9, x * ART_CELL + ART_CELL - 1, y * ART_CELL - 1);
    else if (shape.kind === 'ellipse')
      take(
        shape.cx - shape.rx - half,
        shape.cy - shape.ry - half,
        shape.cx + shape.rx + half,
        shape.cy + shape.ry + half,
      );
    else for (const [x, y] of pathPoints(shape.d)) take(x - half, y - half, x + half, y + half);
  }
  if (right < left) return { x: 0, y: 0, width: ART_WIDTH, height: ART_HEIGHT };
  const x = Math.max(0, left - ART_MARGIN);
  const y = Math.max(0, top - ART_MARGIN);
  return {
    x,
    y,
    width: Math.min(ART_WIDTH, right + ART_MARGIN) - x,
    height: Math.min(ART_HEIGHT, bottom + ART_MARGIN) - y,
  };
}

const row = (y: number, from: number, to: number, skip: readonly number[] = []) =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, y] as const).filter(
    ([x]) => !skip.includes(x),
  );
const blocks = (tone: number, cells: readonly (readonly [number, number])[]): ArtShape => ({
  kind: 'blocks',
  tone,
  cells,
});
const path = (d: string, tone = 12, dashed = false): ArtShape => ({
  kind: 'path',
  d,
  tone,
  dashed,
});

const STACK: readonly ArtShape[] = [
  blocks(1, row(7, 2, 9, [6])),
  blocks(2, row(6, 2, 5)),
  blocks(5, row(6, 7, 9)),
];

export const MODE_ART: Readonly<Record<ModeId, readonly ArtShape[]>> = {
  classic: [
    ...STACK,
    blocks(3, [
      [6, 3],
      [5, 4],
      [6, 4],
      [7, 4],
    ]),
  ],
  tide: [
    blocks(2, row(7, 2, 9)),
    blocks(7, row(6, 2, 8)),
    path('M10 46 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0', 13),
    blocks(4, [
      [5, 2],
      [6, 2],
      [6, 3],
      [7, 3],
    ]),
  ],
  flip: [...STACK, path('M60 8 v26 M53 15 l7 -7 7 7 M53 27 l7 7 7 -7', 3)],
  chroma: [
    blocks(9, row(7, 2, 9)),
    blocks(10, row(6, 2, 7)),
    blocks(11, [
      [4, 3],
      [5, 3],
      [5, 4],
      [6, 4],
    ]),
  ],
  mirror: [
    blocks(1, [
      [2, 7],
      [3, 7],
      [3, 6],
      [8, 7],
      [9, 7],
      [8, 6],
    ]),
    blocks(6, [
      [4, 7],
      [7, 7],
    ]),
    path('M60 6 v58', 3, true),
  ],
  fusion: [
    blocks(5, [
      [3, 7],
      [4, 7],
      [4, 6],
      [5, 6],
      [5, 5],
      [6, 5],
    ]),
    blocks(1, row(7, 6, 9)),
    path('M37 54 L47 50 L57 46', 3),
  ],
  tilt: [
    path('M30 10 L86 18 L78 70 L22 62 Z', 12),
    blocks(7, row(6, 3, 7)),
    blocks(4, row(7, 3, 8)),
  ],
  silhouette: [
    path('M30 70 V40 H50 V20 H70 V40 H90 V70 Z', 3, true),
    blocks(2, row(7, 3, 8)),
    blocks(6, [
      [5, 6],
      [6, 6],
    ]),
  ],
  rhythm: [...STACK, path('M14 12 v14 M26 16 v10 M38 12 v14 M50 16 v10', 4)],
  duel: [
    blocks(1, [
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [2, 6],
      [3, 6],
    ]),
    blocks(12, [
      [7, 7],
      [8, 7],
      [10, 7],
      [7, 6],
      [9, 6],
      [10, 6],
    ]),
    path('M60 8 v58', 12, true),
    path('M44 20 l14 0 m-5 -5 l5 5 -5 5', 3),
  ],
  mosaic: [
    blocks(2, [
      [3, 2],
      [4, 2],
      [3, 3],
    ]),
    blocks(5, [
      [6, 3],
      [7, 3],
      [6, 4],
      [7, 4],
    ]),
    blocks(1, row(5, 3, 8, [5])),
    blocks(3, [
      [4, 6],
      [8, 6],
      [8, 4],
    ]),
  ],
  sand: [
    path('M12 70 Q30 50 48 62 T84 56 T110 70 Z', 9),
    path('M12 70 Q36 62 60 68 T110 66', 13),
    blocks(14, [
      [6, 2],
      [7, 2],
      [6, 3],
    ]),
  ],
  // Dunes (1.37): layers of settled sand, a pair put down over them, crumbling.
  dunes: [
    path('M12 72 Q34 58 56 66 T110 62 V72 Z', 10),
    path('M12 62 Q40 50 66 56 T110 52', 8),
    blocks(8, [
      [5, 2],
      [6, 2],
    ]),
    path('M54 32 L52 40 M62 32 L63 41 M70 32 L72 39', 8, true),
  ],
  // The race's clock, its hand near the top, over the three worlds it turns through.
  race: [
    { kind: 'ellipse', cx: 60, cy: 30, rx: 22, ry: 22 },
    path('M60 30 V14 M60 30 L72 37', 3),
    blocks(1, [
      [1, 7],
      [2, 7],
      [2, 6],
    ]),
    path('M46 78 Q53 68 60 74 T74 72', 9),
    { kind: 'ellipse', cx: 102, cy: 74, rx: 10, ry: 3 },
  ],
  tower: [
    { kind: 'ellipse', cx: 60, cy: 14, rx: 26, ry: 6 },
    { kind: 'ellipse', cx: 60, cy: 66, rx: 26, ry: 6 },
    path('M34 14 V66 M86 14 V66', 12),
    blocks(13, [
      [5, 6],
      [6, 6],
      [5, 5],
    ]),
    blocks(4, [
      [4, 6],
      [7, 6],
    ]),
  ],
};
