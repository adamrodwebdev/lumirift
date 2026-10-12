import { describe, expect, it } from 'vitest';
import { Piece } from '@/engine/pieces/Piece';
import { PIECE_TYPES, Tone, type Rotation } from '@/engine/pieces/PieceType';
import { kickOffsets, shapeCells } from '@/engine/pieces/Shapes';

const sorted = (cells: readonly { x: number; y: number }[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

describe('Shapes', () => {
  it('gives four cells in every orientation', () => {
    for (const type of PIECE_TYPES) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        expect(shapeCells(type, rotation)).toHaveLength(4);
      }
    }
  });

  it('rotates the T piece clockwise like the standard system', () => {
    // Right state: stem pointing right.
    expect(sorted(shapeCells('T', 1))).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ]);
  });

  it('keeps the O piece in place when it rotates', () => {
    for (const rotation of [1, 2, 3] as Rotation[]) {
      expect(sorted(shapeCells('O', rotation))).toEqual(sorted(shapeCells('O', 0)));
    }
  });

  it('comes back to the spawn state after four turns either way', () => {
    const piece = new Piece('L', Tone.L, 3, 0);
    let cw = piece;
    let ccw = piece;
    for (let i = 0; i < 4; i++) {
      cw = cw.rotated(1);
      ccw = ccw.rotated(-1);
    }
    expect(cw.rotation).toBe(0);
    expect(ccw.rotation).toBe(0);
  });

  it('starts every kick list with the plain rotation', () => {
    expect(kickOffsets('T', 0, 1)[0]).toEqual({ x: 0, y: 0 });
    expect(kickOffsets('I', 1, 2)).toHaveLength(5);
    expect(kickOffsets('O', 0, 1)).toHaveLength(1);
  });

  it('spawns centred', () => {
    expect(Piece.spawn('T', Tone.T, 10).x).toBe(3);
    expect(Piece.spawn('I', Tone.I, 10).x).toBe(3);
    expect(Piece.spawn('O', Tone.O, 10).x).toBe(4);
  });
});
