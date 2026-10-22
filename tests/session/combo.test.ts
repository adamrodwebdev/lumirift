import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { SandGame, STEP_MS } from '@/families/sand/engine/SandGame';
import { SAND_TONES } from '@/families/sand/engine/SandGrid';
import { COMBO_FEED, COMBO_MAX, ComboGauge, comboWindowMs } from '@/session/ComboGauge';

describe('ComboGauge', () => {
  it('raises the multiplier at each clear before the gauge runs dry, up to ×10', () => {
    const gauge = new ComboGauge();
    expect(gauge.fill).toBe(0);
    expect(gauge.next).toBe(1);
    const reached = Array.from({ length: 12 }, () => {
      gauge.update(1000);
      return gauge.clear();
    });
    expect(reached).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, COMBO_MAX, COMBO_MAX]);
    expect(gauge.fill).toBe(1);
  });

  it('runs dry after its window, shorter as the multiplier climbs', () => {
    expect(comboWindowMs(1)).toBeGreaterThan(comboWindowMs(5));
    expect(comboWindowMs(10)).toBe(5000);
    const gauge = new ComboGauge();
    gauge.clear();
    gauge.clear();
    expect(gauge.update(comboWindowMs(2) - 1)).toBe(0);
    expect(gauge.update(2)).toBe(2);
    expect(gauge.next).toBe(1);
    expect(gauge.fill).toBe(0);
  });

  it('is fed by the elements while it runs, never past full', () => {
    const gauge = new ComboGauge();
    gauge.feed();
    expect(gauge.fill).toBe(0);
    gauge.clear();
    gauge.update(comboWindowMs(1) / 2);
    gauge.feed();
    expect(gauge.fill).toBeCloseTo(0.5 + COMBO_FEED);
    gauge.feed();
    gauge.feed();
    expect(gauge.fill).toBe(1);
  });
});

describe('the combo of the Sand', () => {
  /** A row of one colour across the floor: it links the walls at the next step. */
  const floorRow = (game: SandGame, index: number) => {
    const { grid } = game;
    for (let x = 0; x < grid.width; x++) grid.put(x, grid.height - 1, SAND_TONES[index]!, 0);
  };

  it('multiplies a clear made before the gauge runs dry, then lets the chain go', () => {
    const game = new SandGame({ random: new SeededRandom(4), hazards: false });
    game.start();
    const clears: [number, number][] = [];
    const ends: number[] = [];
    game.events.on('clear', ({ multiplier, points }) => clears.push([multiplier, points]));
    game.events.on('comboEnd', ({ multiplier }) => ends.push(multiplier));
    floorRow(game, 0);
    game.update(STEP_MS);
    floorRow(game, 1);
    game.update(STEP_MS);
    expect(clears.map(([multiplier]) => multiplier)).toEqual([1, 2]);
    expect(clears[1]![1]).toBe(clears[0]![1] * 2);
    expect(game.comboGauge.next).toBe(3);
    // Left alone longer than its window: the chain is over.
    for (let t = 0; t <= comboWindowMs(2); t += STEP_MS) game.update(STEP_MS);
    expect(ends).toEqual([2]);
    floorRow(game, 2);
    game.update(STEP_MS);
    expect(clears.at(-1)![0]).toBe(1);
  });
});
