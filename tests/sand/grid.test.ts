import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { FIRE_LIFE_STEPS, SandGrid, WATER_LIFE_STEPS } from '@/families/sand/engine/SandGrid';

const random = () => new SeededRandom(3);
const settle = (grid: SandGrid, rng = random(), max = 500) => {
  for (let i = 0; i < max; i++) if (grid.simulate(rng) === 0) return i;
  return max;
};

describe('SandGrid physics', () => {
  it('lets a grain fall to the floor', () => {
    const grid = new SandGrid(5, 10);
    grid.put(2, 0, Tone.ChromaA, 0);
    settle(grid);
    expect(grid.get(2, 9)).toBe(Tone.ChromaA);
    expect(grid.grainCount()).toBe(1);
  });

  it('piles grains into a slope instead of a column', () => {
    const grid = new SandGrid(21, 20);
    for (let y = 0; y < 10; y++) grid.put(10, y, Tone.ChromaB, 0);
    settle(grid);
    expect(grid.sandHeight()).toBeLessThan(10);
    expect(grid.grainCount()).toBe(10);
  });

  it('spreads water sideways, then sets it in the colour around it', () => {
    const grid = new SandGrid(10, 4);
    for (let x = 0; x < 10; x++) grid.put(x, 3, Tone.ChromaC, 0);
    grid.put(5, 0, Tone.Water, 0);
    const rng = random();
    for (let i = 0; i < WATER_LIFE_STEPS + 5; i++) grid.simulate(rng);
    expect([...grid.tones].filter((tone) => tone === Tone.Water)).toHaveLength(0);
    expect(grid.grainCount()).toBe(11);
    expect([...grid.tones].filter((tone) => tone === Tone.ChromaC)).toHaveLength(11);
  });

  it('lets fire die out when it touches nothing it can burn', () => {
    const grid = new SandGrid(5, 5);
    grid.put(2, 4, Tone.Fire, 0);
    const rng = random();
    for (let i = 0; i < FIRE_LIFE_STEPS + 1; i++) grid.simulate(rng);
    expect(grid.grainCount()).toBe(0);
  });

  it('pushes grains with the wind', () => {
    const grid = new SandGrid(20, 2);
    for (let x = 0; x < 5; x++) grid.put(x, 1, Tone.ChromaA, 0);
    grid.blow(1);
    const rng = random();
    for (let i = 0; i < 60; i++) grid.simulate(rng);
    const xs = [...grid.tones].map((tone, i) => (tone ? i % 20 : -1)).filter((x) => x >= 0);
    expect(Math.max(...xs)).toBeGreaterThan(4);
  });
});

describe('SandGrid regions', () => {
  it('finds a region of one colour linking the two walls, even when it winds', () => {
    const grid = new SandGrid(6, 4);
    // A staircase of A from the left wall to the right wall.
    const path: [number, number][] = [
      [0, 3],
      [1, 3],
      [1, 2],
      [2, 2],
      [3, 2],
      [3, 1],
      [4, 1],
      [5, 1],
    ];
    for (const [x, y] of path) grid.put(x, y, Tone.ChromaA, 0);
    grid.put(2, 3, Tone.ChromaB, 0);
    const regions = grid.spanningRegions();
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveLength(path.length);
  });

  it('ignores regions that do not reach the other wall, and other colours', () => {
    const grid = new SandGrid(6, 2);
    for (let x = 0; x < 5; x++) grid.put(x, 1, Tone.ChromaA, 0);
    grid.put(5, 1, Tone.ChromaB, 0);
    expect(grid.spanningRegions()).toHaveLength(0);
  });

  it('finds what fire touches and the region it belongs to', () => {
    const grid = new SandGrid(6, 3);
    for (let x = 0; x < 6; x++) grid.put(x, 2, Tone.ChromaD, 0);
    grid.put(3, 1, Tone.Fire, 0);
    const [contact] = grid.fireContacts();
    expect(contact).toBeDefined();
    expect(grid.region(contact!.seed)).toHaveLength(6);
    grid.remove(grid.region(contact!.seed));
    expect(grid.grainCount()).toBe(1);
  });
});

describe('Rain (1.28.1)', () => {
  it('falls as no obstacle and leaves the pile alone, then lands as water', () => {
    const grid = new SandGrid(6, 20);
    for (let x = 0; x < 6; x++) grid.put(x, 19, Tone.ChromaA, 0);
    // Steam cooled at the top of the well: a drop of rain.
    grid.rainDrop(1 * 6 + 2);
    const rng = random();
    grid.simulate(rng);
    expect(grid.get(2, 2)).toBe(Tone.Water);
    expect(grid.isOpen(2, 2)).toBe(true);
    expect(grid.sandHeight()).toBe(1);
    settle(grid, rng, 60);
    const landed = [...grid.tones.keys()].filter((i) => grid.tones[i] === Tone.Water);
    expect(landed).toHaveLength(1);
    const at = landed[0]!;
    expect(Math.floor(at / 6)).toBe(18);
    expect(grid.isOpen(at % 6, 18)).toBe(false);
    expect(grid.sandHeight()).toBe(2);
  });
});

describe('A cloud cooling (1.28.1)', () => {
  it('thins out grain by grain: its rain falls over time, never as one line', () => {
    const grid = new SandGrid(30, 40);
    // A cloud born at once, at the end of its life, high in the well.
    for (let x = 0; x < 30; x++) grid.set(2 * 30 + x, Tone.Steam, 0, 1);
    const rng = random();
    const cooling = new Set<number>();
    let left = 30;
    for (let step = 1; step <= 200 && left > 0; step++) {
      grid.simulate(rng);
      const steam = grid.tones.filter((tone) => tone === Tone.Steam).length;
      if (steam < left) cooling.add(step);
      left = steam;
    }
    expect(left).toBe(0);
    expect(cooling.size).toBeGreaterThanOrEqual(8);
  });
});
