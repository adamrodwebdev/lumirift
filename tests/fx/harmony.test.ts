import { describe, expect, it } from 'vitest';
import { degree, PROGRESSION, ROOT, SCALE, semitone } from '@/fx/harmony';

describe('harmony', () => {
  it('counts the degrees of D minor pentatonic from D3', () => {
    expect(degree(0)).toBeCloseTo(ROOT);
    expect(degree(1)).toBeCloseTo(semitone(ROOT, 3)); // F3
    expect(degree(5)).toBeCloseTo(ROOT * 2); // D4
    expect(degree(13)).toBeCloseTo(880, 0); // A5
    expect(degree(-5)).toBeCloseTo(ROOT / 2); // D2
  });

  it('keeps every chord tone inside the key or a step from it', () => {
    const inKey = (step: number) => SCALE.includes((((step % 12) + 12) % 12) as never);
    for (const chord of PROGRESSION) {
      expect(chord.filter(inKey).length).toBeGreaterThanOrEqual(2);
    }
  });
});
