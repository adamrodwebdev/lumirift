import { describe, expect, it } from 'vitest';
import { LINK } from '@/families/falling/board/Links';
import { PIECE_TYPES, type Rotation } from '@/families/falling/pieces/PieceType';
import { shapeCells, shapeLinks } from '@/families/falling/pieces/Shapes';
import { constellationLinks, lowestBlocks } from '@/families/falling/render/LandingBeam';

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

describe('the landing beam (1.43) and its constellation (1.45)', () => {
  it('links each block to its neighbours: three links a piece, four for the O, in every rotation', () => {
    const into = new Int8Array(32);
    for (const type of PIECE_TYPES) {
      for (const rotation of ROTATIONS) {
        const cells = shapeCells(type, rotation);
        const count = constellationLinks(cells, into);
        expect(count, `${type} ${rotation}`).toBe(type === 'O' ? 4 : 3);
        for (let i = 0; i < count; i++) {
          const a = cells[into[i * 2]!]!;
          const b = cells[into[i * 2 + 1]!]!;
          expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
        }
      }
    }
  });

  it('draws the same links as the crystal joins its blocks', () => {
    const into = new Int8Array(32);
    for (const type of PIECE_TYPES) {
      for (const rotation of ROTATIONS) {
        const cells = shapeCells(type, rotation);
        const links = shapeLinks(type, rotation);
        const count = constellationLinks(cells, into);
        // Every east and south join of the crystal is one link of the constellation.
        const joins = links.reduce(
          (sum, bits) =>
            sum + ((bits & LINK.east) !== 0 ? 1 : 0) + ((bits & LINK.south) !== 0 ? 1 : 0),
          0,
        );
        expect(count, `${type} ${rotation}`).toBe(joins);
      }
    }
  });

  it('tells apart what the shafts alone could not: T, J and L lying flat', () => {
    const into = new Int8Array(32);
    const lows = new Int8Array(4);
    const flat = (['T', 'J', 'L'] as const).map((type) => shapeCells(type, 0));
    // The shafts: the same lowest block in each of the three columns.
    const shafts = flat.map((cells) => Array.from(lowestBlocks(cells, lows)).join());
    expect(new Set(shafts).size).toBe(1);
    // The constellation: three different shapes.
    const shapes = flat.map((cells) => {
      const count = constellationLinks(cells, into);
      return cells
        .map(({ x, y }) => `${x},${y}`)
        .sort()
        .join(' ')
        .concat(` / ${count}`);
    });
    expect(new Set(shapes).size).toBe(3);
  });

  it('keeps what fits: never more links than its buffer holds', () => {
    const into = new Int8Array(4);
    expect(constellationLinks(shapeCells('O', 0), into)).toBe(2);
  });
});
