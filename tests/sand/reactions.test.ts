import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { elementsAt, ELEMENTS, UNLOCK_LEVEL } from '@/families/sand/engine/Elements';
import { SandGame, STEP_MS } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL, SandGrid } from '@/families/sand/engine/SandGrid';
import { SandPiece } from '@/families/sand/engine/SandPiece';
import { SandReactions } from '@/families/sand/engine/SandReactions';
import { SHOWCASE } from '@/families/sand/engine/Showcase';

const G = GRAINS_PER_CELL;
const rng = () => new SeededRandom(7);

/** Runs physics and chemistry together, as the game does. */
function run(grid: SandGrid, steps: number, reactions = new SandReactions(grid, rng())) {
  const random = rng();
  const seen: string[] = [];
  for (let k = 0; k < steps; k++) {
    grid.simulate(random);
    for (const reaction of reactions.step()) seen.push(reaction.kind);
  }
  return seen;
}

const count = (grid: SandGrid, tone: Tone) => [...grid.tones].filter((t) => t === tone).length;
const fill = (grid: SandGrid, x0: number, y0: number, x1: number, y1: number, tone: Tone) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid.put(x, y, tone, 0);
};

function started(options: Partial<ConstructorParameters<typeof SandGame>[0]> = {}) {
  const game = new SandGame({ random: new SeededRandom(4), hazards: false, ...options });
  game.start();
  return game;
}

/** Makes the falling piece a given element, its left cell at grain `x`. */
function falling(game: SandGame, tone: Tone, x: number, type: 'O' | 'I' = 'O') {
  const piece = new SandPiece(type, tone, 0, 0);
  const left = Math.min(...piece.localCells.map((cell) => cell.x)) * G;
  (game as unknown as { _active: SandPiece })._active = piece.moved(x - left, 0);
}

describe('Matter', () => {
  it('floats oil on water, and sinks sand through both', () => {
    const grid = new SandGrid(6, 12);
    fill(grid, 0, 0, 5, 1, Tone.Oil);
    fill(grid, 0, 2, 5, 3, Tone.Water);
    grid.put(2, 4, Tone.ChromaA, 0);
    for (const i of grid.life.keys()) grid.life[i] = 5000;
    run(grid, 80);
    const rowOf = (tone: Tone) =>
      Math.min(
        ...[...grid.tones.keys()].filter((i) => grid.tones[i] === tone).map((i) => (i / 6) | 0),
      );
    expect(rowOf(Tone.Oil)).toBeLessThan(rowOf(Tone.Water));
    expect(grid.get(2, 11)).toBe(Tone.ChromaA);
  });

  it('lets steam rise, never block a piece nor count as height, and fall back as rain', () => {
    const grid = new SandGrid(12, 40);
    fill(grid, 0, 36, 11, 39, Tone.Steam);
    expect(grid.isOpen(0, 36)).toBe(true);
    expect(grid.sandHeight()).toBe(0);
    run(grid, 60);
    expect(count(grid, Tone.Steam)).toBeGreaterThan(0);
    const highest = [...grid.tones.keys()].find((i) => grid.tones[i] === Tone.Steam)!;
    expect((highest / 12) | 0).toBeLessThan(20);
    run(grid, 400);
    expect(count(grid, Tone.Steam)).toBe(0);
    // Part of it condensed at the top and rained down.
    expect(
      count(grid, Tone.Water) + [...grid.tones].filter((t) => t >= 8 && t <= 11).length,
    ).toBeGreaterThan(0);
  });

  it('keeps ice still until it melts away by itself', () => {
    const grid = new SandGrid(6, 12);
    fill(grid, 0, 2, 5, 3, Tone.Ice);
    run(grid, 50);
    expect(grid.get(0, 2)).toBe(Tone.Ice);
  });
});

describe('Reactions', () => {
  it('sets oil ablaze with fire: the blaze eats far more sand than a flame, then dies out', () => {
    const grid = new SandGrid(30, 30);
    fill(grid, 0, 20, 29, 29, Tone.ChromaA);
    fill(grid, 0, 16, 29, 19, Tone.Oil);
    grid.put(15, 15, Tone.Fire, 0);
    const before = count(grid, Tone.ChromaA);
    const seen = run(grid, 400);
    expect(seen).toContain('blaze');
    expect(seen).toContain('scorch');
    expect(count(grid, Tone.ChromaA)).toBeLessThan(before - 30);
    expect(count(grid, Tone.Blaze)).toBe(0);
    expect(count(grid, Tone.Oil)).toBe(0);
  });

  it('melts ice with fire into water and steam', () => {
    const grid = new SandGrid(12, 20);
    fill(grid, 2, 14, 9, 19, Tone.Ice);
    grid.put(5, 13, Tone.Fire, 0);
    const seen = run(grid, 2);
    expect(seen).toContain('melt');
    expect(count(grid, Tone.Ice)).toBe(0);
    expect(count(grid, Tone.Water)).toBeGreaterThan(0);
    expect(count(grid, Tone.Steam)).toBeGreaterThan(0);
  });

  it('freezes water touching ice, little by little', () => {
    const grid = new SandGrid(12, 12);
    fill(grid, 0, 10, 11, 11, Tone.Ice);
    fill(grid, 0, 8, 11, 9, Tone.Water);
    for (const i of grid.life.keys()) if (grid.tones[i] === Tone.Water) grid.life[i] = 5000;
    const seen = run(grid, 200);
    expect(seen).toContain('freeze');
    expect(count(grid, Tone.Ice)).toBeGreaterThan(24);
  });

  it('lets acid eat the sand under it, and water dilute it', () => {
    const grid = new SandGrid(10, 30);
    fill(grid, 0, 10, 9, 29, Tone.ChromaB);
    fill(grid, 4, 6, 5, 9, Tone.Acid);
    const before = count(grid, Tone.ChromaB);
    expect(run(grid, 120)).toContain('dissolve');
    expect(count(grid, Tone.ChromaB)).toBeLessThan(before);

    const diluted = new SandGrid(6, 6);
    diluted.put(2, 5, Tone.Acid, 0);
    diluted.put(3, 5, Tone.Water, 0);
    run(diluted, 1);
    expect(count(diluted, Tone.Acid)).toBe(0);
  });

  it('grows a watered seed into a still vine of the colour it sprouted on', () => {
    const grid = new SandGrid(40, 30);
    fill(grid, 0, 25, 39, 29, Tone.ChromaC);
    fill(grid, 18, 23, 21, 24, Tone.Seed);
    const reactions = new SandReactions(grid, rng());
    grid.put(19, 22, Tone.Water, 0);
    const seen = run(grid, 200, reactions);
    expect(seen).toContain('sprout');
    const vine = [...grid.fixed.keys()].filter((i) => grid.fixed[i]);
    expect(vine.length).toBeGreaterThan(30);
    expect(vine.every((i) => grid.tones[i] === Tone.ChromaC)).toBe(true);
    expect(reactions.growing).toBe(0);
  });

  it('sprouts an unwatered seed at last, with a shorter vine', () => {
    const grid = new SandGrid(40, 30);
    fill(grid, 0, 25, 39, 29, Tone.ChromaD);
    fill(grid, 18, 23, 21, 24, Tone.Seed);
    for (const i of grid.life.keys()) if (grid.tones[i] === Tone.Seed) grid.life[i] = 2;
    expect(run(grid, 120)).toContain('sprout');
  });

  it('runs fire up a vine like a fuse', () => {
    const grid = new SandGrid(40, 30);
    fill(grid, 0, 25, 39, 29, Tone.ChromaC);
    for (let x = 0; x < 20; x++) {
      grid.put(x, 24, Tone.ChromaA, 0);
      grid.fix(24 * 40 + x);
    }
    grid.put(0, 23, Tone.Fire, 0);
    expect(run(grid, 3)).toContain('fuse');
    expect(count(grid, Tone.Blaze)).toBeGreaterThan(10);
  });
});

describe('Lightning', () => {
  it('shocks through water: every region of sand touching it breaks, for full points', () => {
    const game = started();
    const { grid } = game;
    const floor = grid.height - 1;
    // Two colours on the floor, a pool of water over both.
    for (let x = 0; x < grid.width; x++)
      grid.put(x, floor, x < 30 ? Tone.ChromaA : Tone.ChromaB, 0);
    fill(grid, 10, floor - 3, 50, floor - 1, Tone.Water);
    for (const i of grid.life.keys()) if (grid.tones[i] === Tone.Water) grid.life[i] = 5000;
    falling(game, Tone.Lightning, 24);
    const target = game.elementTarget();
    expect(target?.length).toBeGreaterThan(grid.width);
    const onStrike = vi.fn();
    game.events.on('strike', onStrike);
    game.hardDrop();
    expect(onStrike).toHaveBeenCalledOnce();
    const strike = onStrike.mock.calls[0]![0];
    expect(strike.kind).toBe('shock');
    expect(strike.grains).toBe(grid.width);
    expect(strike.points).toBe(grid.width);
    expect(game.score).toBe(grid.width);
    // The bolt leaves nothing of itself behind.
    expect(count(grid, Tone.Lightning)).toBe(0);
  });

  it('shatters the region of sand it strikes, for half the points', () => {
    const game = started();
    const { grid } = game;
    const floor = grid.height - 1;
    for (let x = 0; x < grid.width; x++)
      grid.put(x, floor, x < 30 ? Tone.ChromaA : Tone.ChromaB, 0);
    falling(game, Tone.Lightning, 6);
    const onStrike = vi.fn();
    game.events.on('strike', onStrike);
    game.hardDrop();
    expect(onStrike.mock.calls[0]![0].kind).toBe('shatter');
    expect(count(grid, Tone.ChromaA)).toBe(0);
    expect(count(grid, Tone.ChromaB)).toBe(30);
    expect(game.score).toBe(15);
  });
});

describe('Dealing elements', () => {
  it('brings the elements in level after level, water and fire first', () => {
    expect(elementsAt(1)).toEqual([Tone.Water, Tone.Fire]);
    expect(elementsAt(9)).toHaveLength(ELEMENTS.length);
    for (const tone of ELEMENTS) expect(UNLOCK_LEVEL[tone]).toBeGreaterThanOrEqual(1);
  });

  it('deals the first level its show, even in a calm game', () => {
    const game = started({ script: SHOWCASE });
    const tones = Array.from({ length: 12 }, () => {
      const spec = game.preview(1)[0]!;
      (game as unknown as { upcoming: unknown[] }).upcoming.shift();
      return spec.tone;
    });
    // The first piece is already the active one: the preview starts at rank 2.
    for (const { at, tone } of SHOWCASE) expect(tones[at - 2]).toBe(tone);
    expect(tones.filter((tone) => tone >= Tone.Water).length).toBe(SHOWCASE.length);
  });

  it('announces each new reaction once per game', () => {
    const game = started();
    const { grid } = game;
    const notices: string[] = [];
    game.events.on('notice', ({ id }) => notices.push(id));
    fill(grid, 0, grid.height - 10, grid.width - 1, grid.height - 1, Tone.ChromaA);
    fill(grid, 0, grid.height - 14, grid.width - 1, grid.height - 11, Tone.Oil);
    grid.put(5, grid.height - 15, Tone.Fire, 0);
    grid.put(40, grid.height - 15, Tone.Fire, 0);
    for (let k = 0; k < 5; k++) game.update(STEP_MS);
    expect(notices.filter((id) => id === 'react.blaze')).toHaveLength(1);
  });
});
