import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { ELEMENT_GAP, SandGame, STEP_MS, WIND_EVERY_MS } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL, SandGrid, WIND_MAX_DRIFT } from '@/families/sand/engine/SandGrid';
import { SandPiece } from '@/families/sand/engine/SandPiece';

const G = GRAINS_PER_CELL;

function started(seed = 4) {
  const game = new SandGame({ random: new SeededRandom(seed) });
  game.start();
  return game;
}

/** Puts a fire piece of the given shape, its left cell at grain `x`, at the top. */
function withFire(game: SandGame, x: number) {
  const piece = new SandPiece('O', Tone.Fire, 0, 0);
  const left = Math.min(...piece.localCells.map((cell) => cell.x)) * G;
  (game as unknown as { _active: SandPiece })._active = piece.moved(x - left, 0);
}

describe('Sand elements', () => {
  it('aims fire: it burns at once the region it touches most, for half the points', () => {
    const game = started();
    const { grid } = game;
    const floor = grid.height - 1;
    for (let x = 0; x < grid.width; x++) {
      grid.put(x, floor, x < 30 ? Tone.ChromaA : Tone.ChromaB, 0);
    }
    // The fire covers grains 28 to 39: 2 of A, 10 of B.
    withFire(game, 28);
    const target = game.elementTarget();
    expect(target).toHaveLength(30);
    expect(target!.every((i) => grid.tones[i] === Tone.ChromaB)).toBe(true);

    const onBurn = vi.fn();
    game.events.on('burn', onBurn);
    game.hardDrop();
    expect(onBurn).toHaveBeenCalledWith(expect.objectContaining({ grains: 30, points: 15 }));
    expect(game.score).toBe(15);
    // The fire is consumed with the region: only the A row is left.
    expect(grid.grainCount()).toBe(30);
    expect([...grid.tones].filter((tone) => tone === Tone.Fire)).toHaveLength(0);
  });

  it('shows no target when the fire touches nothing it can burn', () => {
    const game = started();
    withFire(game, 0);
    expect(game.elementTarget()).toBeNull();
  });

  it('puts fire out with water, in a puff of steam', () => {
    const game = started();
    const { grid } = game;
    grid.put(10, grid.height - 1, Tone.Water, 0);
    grid.put(10, grid.height - 2, Tone.Fire, 0);
    const onQuench = vi.fn();
    game.events.on('quench', onQuench);
    game.update(STEP_MS);
    expect(onQuench).toHaveBeenCalledOnce();
    // Nothing left but a cloud of steam where they met.
    expect(grid.grainCount()).toBeGreaterThan(0);
    expect([...grid.tones].every((tone) => tone === 0 || tone === Tone.Steam)).toBe(true);
  });

  it(`deals at least ${ELEMENT_GAP} sand pieces between two elements`, () => {
    const game = started(9);
    const tones = game.preview(600).map(({ tone }) => tone);
    const elements = tones
      .map((tone, i) => (tone === Tone.Water || tone === Tone.Fire ? i : -1))
      .filter((i) => i >= 0);
    expect(elements.length).toBeGreaterThan(20);
    for (let k = 1; k < elements.length; k++) {
      expect(elements[k]! - elements[k - 1]!).toBeGreaterThan(ELEMENT_GAP);
    }
  });

  it('alternates the direction of the gusts', () => {
    const game = started();
    const directions: number[] = [];
    game.events.on('wind', ({ phase, direction }) => {
      if (phase === 'soon') directions.push(direction);
    });
    for (let t = 0; t < WIND_EVERY_MS * 5; t += 100) game.update(100);
    expect(directions.length).toBeGreaterThanOrEqual(3);
    for (let k = 1; k < directions.length; k++) expect(directions[k]).toBe(-directions[k - 1]!);
  });
});

describe('Sand grid elements', () => {
  it('sets water in the most common colour around it, the one below on a tie', () => {
    const grid = new SandGrid(3, 3);
    // A A A / B W A / B B B: four of each, B is below.
    for (let x = 0; x < 3; x++) grid.put(x, 0, Tone.ChromaA, 0);
    grid.put(0, 1, Tone.ChromaB, 0);
    grid.put(1, 1, Tone.Water, 0);
    grid.put(2, 1, Tone.ChromaA, 0);
    for (let x = 0; x < 3; x++) grid.put(x, 2, Tone.ChromaB, 0);
    // The sand around holds still (sand would otherwise sink through the water).
    for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) grid.fix(i);
    grid.life[4] = 1;
    grid.simulate(new SeededRandom(1));
    expect(grid.get(1, 1)).toBe(Tone.ChromaB);
  });

  it('lets the wind move only loose grains, one cell at most per gust', () => {
    const grid = new SandGrid(40, 3);
    for (let x = 0; x < 5; x++) {
      grid.put(x, 1, Tone.ChromaA, 0);
      grid.put(x, 2, Tone.ChromaB, 0);
    }
    grid.blow(1);
    grid.resetDrift();
    const rng = new SeededRandom(2);
    for (let i = 0; i < 400; i++) grid.simulate(rng);
    const xs = [...grid.tones].map((tone, i) => (tone ? i % 40 : -1)).filter((x) => x >= 0);
    expect(Math.max(...xs)).toBeGreaterThan(4);
    expect(Math.max(...xs)).toBeLessThanOrEqual(4 + WIND_MAX_DRIFT + 2);
    expect(grid.grainCount()).toBe(10);
  });
});
