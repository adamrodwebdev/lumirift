import { describe, expect, it } from 'vitest';
import { LINK } from '@/families/falling/board/Links';
import {
  chunkPose,
  crackPath,
  crackY,
  halfBand,
  openingLight,
  pieceLight,
  RIFT,
  RIFT_WOBBLE,
  riftChunks,
  riftPhase,
  riftRuns,
  riftSeams,
  seamLight,
} from '@/families/falling/fx/RiftOpening';
import { LINE_CLEAR_DELAY_MS } from '@/families/falling';

/** A seeded random source: the same pieces for the same seed. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/**
 * A full row of ten blocks from four pieces: an I lying flat (0–3), two
 * blocks of one piece (4–5), a lone block (6), three of one piece (7–9).
 */
function row(): { tones: Uint8Array; links: Uint8Array } {
  const tones = new Uint8Array([1, 1, 1, 1, 3, 3, 4, 5, 5, 5]);
  const links = new Uint8Array(10);
  for (const [from, to] of [
    [0, 3],
    [4, 5],
    [7, 9],
  ] as const) {
    for (let x = from; x <= to; x++) {
      if (x < to) links[x]! |= LINK.east;
      if (x > from) links[x]! |= LINK.west;
    }
  }
  return { tones, links };
}

/** The piece each column belongs to, in the row above. */
const PIECE = [0, 0, 0, 0, 1, 1, 2, 3, 3, 3];

describe('the rift that opens a cleared row (1.44)', () => {
  it('runs, splits, swallows and closes in turn, the row gone before the next piece', () => {
    let previous = riftPhase(0);
    expect(previous).toEqual({ run: 0, split: 0, swallow: 0, flare: 0, close: 0 });
    for (let age = 5; age <= RIFT.endMs; age += 5) {
      const phase = riftPhase(age);
      for (const beat of ['run', 'split', 'swallow', 'flare', 'close'] as const)
        expect(phase[beat]).toBeGreaterThanOrEqual(previous[beat]);
      previous = phase;
    }
    expect(riftPhase(RIFT.runMs)).toMatchObject({ run: 1, split: 0 });
    expect(riftPhase(RIFT.runMs + RIFT.splitMs).split).toBe(1);
    // The pieces hold, then go ever faster: a quarter of the way at two thirds of the swallow.
    expect(riftPhase(RIFT.swallowFrom).swallow).toBe(0);
    expect(riftPhase(RIFT.swallowFrom + (RIFT.swallowMs * 2) / 3).swallow).toBeLessThan(0.3);
    // Every piece is swallowed before the next piece enters the well.
    expect(RIFT.swallowFrom + RIFT.swallowMs).toBeLessThanOrEqual(LINE_CLEAR_DELAY_MS);
    expect(riftPhase(LINE_CLEAR_DELAY_MS).swallow).toBe(1);
    // The rows above start to fall once the pieces are more than half gone (they start slowly).
    expect(riftPhase(RIFT.fallFrom).swallow).toBeGreaterThan(0.5);
    expect(seamLight(riftPhase(RIFT.endMs), false)).toEqual({ width: 0, strength: 0 });
  });

  it('cuts a row into runs of one or two blocks, never across two pieces', () => {
    const { tones, links } = row();
    for (let seed = 1; seed <= 40; seed++) {
      const runs = riftRuns(tones, links, seeded(seed));
      const columns = runs.flatMap(([x0, x1]) => Array.from({ length: x1 - x0 }, (_, i) => x0 + i));
      expect(columns).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const [x0, x1] of runs) {
        expect(x1 - x0).toBeGreaterThanOrEqual(1);
        expect(x1 - x0).toBeLessThanOrEqual(2);
        expect(PIECE[x1 - 1]).toBe(PIECE[x0]);
      }
    }
    // Empty cells belong to no piece of the row.
    tones[6] = 0;
    const runs = riftRuns(tones, links, seeded(7));
    expect(runs.some(([x0, x1]) => x0 <= 6 && 6 < x1)).toBe(false);
  });

  it('cuts each run along the crack into a piece above it and a piece below it', () => {
    const { tones, links } = row();
    const random = seeded(3);
    const path = crackPath(10, random);
    expect(path.length).toBe(21 * 2);
    for (let i = 0; i < 21; i++) {
      expect(path[i * 2]).toBe(i / 2);
      expect(Math.abs(path[i * 2 + 1]! - 0.5)).toBeLessThanOrEqual(RIFT_WOBBLE);
    }
    expect(crackY(path, 0.25)).toBeCloseTo((path[1]! + path[3]!) / 2, 5);
    const runs = riftRuns(tones, links, random);
    const chunks = riftChunks(runs, path, random);
    expect(chunks).toHaveLength(runs.length * 2);
    for (const chunk of chunks) {
      expect(chunk.seamY).toBeCloseTo(crackY(path, chunk.pivotX), 5);
      if (chunk.upper) expect(chunk.pivotY).toBeLessThan(chunk.seamY);
      else expect(chunk.pivotY).toBeGreaterThan(chunk.seamY);
      // The outline: the row's edge on one side, the crack on the other.
      const ys = Array.from(chunk.outline.filter((_, i) => i % 2 === 1));
      expect(ys).toContain(chunk.upper ? 0 : 1);
      for (const y of ys) {
        if (chunk.upper) expect(y).toBeLessThanOrEqual(0.5 + RIFT_WOBBLE);
        else expect(y).toBeGreaterThanOrEqual(0.5 - RIFT_WOBBLE);
      }
    }
    // Light shows where two pieces meet, never at the walls.
    expect(riftSeams(runs, 10)).toEqual(runs.slice(0, -1).map(([, x1]) => x1));
  });

  it('parts the halves, then draws every piece in, squashed onto the seam', () => {
    const { tones, links } = row();
    const random = seeded(11);
    const chunks = riftChunks(riftRuns(tones, links, random), crackPath(10, random), random);
    const split = riftPhase(RIFT.swallowFrom);
    const gone = riftPhase(RIFT.swallowFrom + RIFT.swallowMs);
    for (const chunk of chunks) {
      const parted = chunkPose(chunk, split, false);
      if (chunk.upper) expect(parted.dy).toBeLessThan(0);
      else expect(parted.dy).toBeGreaterThan(0);
      const swallowed = chunkPose(chunk, gone, false);
      expect(swallowed.scaleY).toBe(0);
      expect(chunk.pivotY + swallowed.dy).toBeCloseTo(chunk.seamY, 5);
    }
    // Calmer effects: nothing moves, the pieces fade where they are.
    for (let age = 0; age <= RIFT.endMs; age += 30)
      expect(chunkPose(chunks[0]!, riftPhase(age), true)).toEqual({
        dy: 0,
        scaleX: 1,
        scaleY: 1,
        turn: 0,
      });
    expect(pieceLight(gone, true).alpha).toBe(0);
    expect(pieceLight(riftPhase(0), false)).toEqual({ alpha: 1, glow: 0, tint: 0 });
  });

  it('squashes a brick’s halves on the Tower’s glass in to the seam', () => {
    const cut = 0.4;
    const split = riftPhase(RIFT.swallowFrom);
    const upper = halfBand(true, cut, split, false);
    const lower = halfBand(false, cut, split, false);
    // The halves part around the seam.
    expect(upper.top + upper.height).toBeLessThan(cut);
    expect(lower.top).toBeGreaterThan(cut);
    const gone = riftPhase(RIFT.swallowFrom + RIFT.swallowMs);
    expect(halfBand(true, cut, gone, false)).toEqual({ top: cut, height: 0 });
    expect(halfBand(false, cut, gone, false)).toEqual({ top: cut, height: 0 });
    expect(halfBand(true, cut, gone, true)).toEqual({ top: 0, height: cut });
  });

  it('lights a RIFT!’s rows as one opening while the seams swallow, gone before they close', () => {
    expect(openingLight(0)).toBe(0);
    const peak = Math.max(...Array.from({ length: 80 }, (_, i) => openingLight(i * 5)));
    expect(peak).toBeGreaterThan(0.9);
    expect(openingLight(RIFT.endMs)).toBe(0);
  });
});
