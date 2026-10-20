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
