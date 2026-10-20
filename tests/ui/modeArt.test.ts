import { describe, expect, it } from 'vitest';
import {
  ART_HEIGHT,
  ART_MARGIN,
  ART_WIDTH,
  artBounds,
  MODE_ART,
  pathPoints,
} from '@/ui/hub/modeArt';

describe('pathPoints', () => {
  it('follows absolute and relative moves and lines', () => {
    expect(pathPoints('M60 8 v26 M53 15 l7 -7 7 7')).toEqual([
      [60, 8],
      [60, 34],
      [53, 15],
      [60, 8],
      [67, 15],
    ]);
  });

  it('keeps the control points of curves, mirrored by T', () => {
    expect(pathPoints('M10 46 q8 -5 16 0 t16 0')).toEqual([
      [10, 46],
      [18, 41],
      [26, 46],
      [34, 51],
      [42, 46],
    ]);
  });

  it('goes back to the start on Z, and along on H', () => {
    expect(pathPoints('M30 10 H50 Z l5 5')).toEqual([
      [30, 10],
      [50, 10],
      [35, 15],
    ]);
  });

  it('rejects a command the pictures do not use', () => {
    expect(() => pathPoints('M0 0 A5 5 0 0 1 10 10')).toThrow(/A/);
  });
});

describe('artBounds', () => {
  it('fits blocks exactly, plus the margin', () => {
    expect(artBounds([{ kind: 'blocks', tone: 1, cells: [[2, 7]] }])).toEqual({
      x: 21 - ART_MARGIN,
      y: 61 - ART_MARGIN,
      width: 8 + 2 * ART_MARGIN,
      height: 8 + 2 * ART_MARGIN,
    });
  });

  it('keeps every picture inside its box, cropped to what it shows', () => {
    for (const [mode, shapes] of Object.entries(MODE_ART)) {
      const box = artBounds(shapes);
      expect(box.x, mode).toBeGreaterThanOrEqual(0);
      expect(box.y, mode).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, mode).toBeLessThanOrEqual(ART_WIDTH);
      expect(box.y + box.height, mode).toBeLessThanOrEqual(ART_HEIGHT);
      expect(box.width * box.height, mode).toBeLessThan(ART_WIDTH * ART_HEIGHT);
    }
  });

  it('includes the strokes: the wave of the Tide, the arrow of the Flip', () => {
    // The wave runs from x = 10 at y = 46; the arrow goes up to y = 8.
    expect(artBounds(MODE_ART.tide).x).toBeLessThanOrEqual(10 - ART_MARGIN);
    expect(artBounds(MODE_ART.flip).y).toBeLessThanOrEqual(8 - ART_MARGIN);
  });
});
