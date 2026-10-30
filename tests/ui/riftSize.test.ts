import { describe, expect, it } from 'vitest';
import { riftPieceSize } from '@/ui/riftSize';

describe('riftPieceSize (1.43)', () => {
  it('sizes the next piece from the width of the well place, within its bounds', () => {
    // A 390-px phone in portrait: the well's place is the screen's width.
    expect(riftPieceSize(374)).toBe(56);
    // A desktop's middle column.
    expect(riftPieceSize(480)).toBe(72);
    expect(riftPieceSize(0)).toBe(40);
    expect(riftPieceSize(4000)).toBe(112);
  });
});
