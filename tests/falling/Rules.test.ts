import { describe, expect, it } from 'vitest';
import { GravityCurve } from '@/families/falling/rules/GravityCurve';
import { Scoring } from '@/families/falling/rules/Scoring';

describe('Scoring', () => {
  const scoring = new Scoring();

  it('scores line clears by size and level', () => {
    expect(scoring.clear({ lines: 1, pureLines: 0, level: 1, combo: 0 })).toBe(100);
    expect(scoring.clear({ lines: 2, pureLines: 0, level: 1, combo: 0 })).toBe(300);
    expect(scoring.clear({ lines: 3, pureLines: 0, level: 2, combo: 0 })).toBe(1000);
    expect(scoring.clear({ lines: 4, pureLines: 0, level: 3, combo: 0 })).toBe(2400);
  });

  it('adds a combo bonus', () => {
    expect(scoring.clear({ lines: 1, pureLines: 0, level: 2, combo: 3 })).toBe(200 + 300);
  });

  it('ignores pure lines unless the mode counts them', () => {
    expect(scoring.clear({ lines: 1, pureLines: 1, level: 1, combo: 0 })).toBe(100);
    const chroma = new Scoring(true);
    expect(chroma.clear({ lines: 1, pureLines: 1, level: 1, combo: 0 })).toBe(400);
    expect(chroma.clear({ lines: 2, pureLines: 1, level: 1, combo: 0 })).toBe(750);
  });

  it('scores drops per row', () => {
    expect(scoring.softDrop(5)).toBe(5);
    expect(scoring.hardDrop(5)).toBe(10);
  });
});

describe('GravityCurve', () => {
  const gravity = new GravityCurve();

  it('falls one row per second at level 1 and faster each level', () => {
    expect(gravity.rowIntervalMs(1)).toBe(1000);
    for (let level = 2; level <= 20; level++) {
      expect(gravity.rowIntervalMs(level)).toBeLessThan(gravity.rowIntervalMs(level - 1));
    }
  });

  it('stops accelerating after level 20', () => {
    expect(gravity.rowIntervalMs(30)).toBe(gravity.rowIntervalMs(20));
  });

  it('makes soft drop at least 20 times faster', () => {
    expect(gravity.softDropIntervalMs(1)).toBe(50);
    expect(gravity.softDropIntervalMs(15)).toBeLessThan(gravity.rowIntervalMs(15));
  });

  it('levels up every ten lines', () => {
    expect(gravity.levelFor(1, 9)).toBe(1);
    expect(gravity.levelFor(1, 10)).toBe(2);
    expect(gravity.levelFor(5, 25)).toBe(7);
  });
});
