import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { createSandSession, SandSession } from '@/families/sand';
import {
  ELEMENTS_AFTER,
  SandGame,
  STEP_MS,
  WIND_EVERY_MS,
  WIND_GUST_MS,
} from '@/families/sand/engine/SandGame';
import { TEASER_MS, WORM_HEALTH } from '@/families/sand/engine/DuneWorm';
import { GRAINS_PER_CELL, SAND_TONES } from '@/families/sand/engine/SandGrid';

const G = GRAINS_PER_CELL;

function started(seed = 4) {
  const game = new SandGame({ random: new SeededRandom(seed) });
  game.start();
  return game;
}

describe('SandGame', () => {
  it('spawns a centred piece at the top, with three pieces in preview', () => {
    const game = started();
    expect(game.active?.y).toBe(0);
    expect(game.active!.x % G).toBe(0);
    expect(game.preview()).toHaveLength(3);
  });

  it('takes the piece down a whole cell for a finger, as far as it fits (1.40)', () => {
    const game = started();
    const y = game.active!.y;
    expect(game.softStep()).toBe(true);
    expect(game.active!.y).toBe(y + G);
    while (game.softStep()) {
      /* down to the floor */
    }
    expect(game.softStep()).toBe(false);
    expect(game.active).not.toBeNull();
  });

  it('slides a whole cell sideways, and stops at the walls', () => {
    const game = started();
    const x = game.active!.x;
    expect(game.moveLeft()).toBe(true);
    expect(game.active!.x).toBe(x - G);
    while (game.moveLeft()) {
      /* to the wall */
    }
    expect(game.active!.x).toBeGreaterThanOrEqual(-2 * G);
    expect(game.moveLeft()).toBe(false);
  });

  it('falls grain by grain', () => {
    const game = started();
    game.update(1000 / G);
    expect(game.active?.y).toBe(1);
  });

  it('crumbles into grains when it lands', () => {
    const game = started();
    const onLock = vi.fn();
    game.events.on('lock', onLock);
    game.hardDrop();
    expect(onLock).toHaveBeenCalledOnce();
    expect(game.grid.grainCount()).toBe(4 * G * G);
    expect(game.active).not.toBeNull();
  });

  it('clears a region of one colour linking the walls, and scores its grains', () => {
    const game = started();
    const { grid } = game;
    for (let x = 0; x < grid.width; x++) grid.put(x, grid.height - 1, Tone.ChromaA, 0);
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.update(STEP_MS);
    expect(onClear).toHaveBeenCalledWith(
      expect.objectContaining({ regions: 1, grains: grid.width, points: grid.width }),
    );
    expect(game.clears).toBe(1);
    expect(game.score).toBe(grid.width);
  });

  it('lets fire burn the region it touches', () => {
    const game = started();
    const { grid } = game;
    for (let x = 0; x < grid.width - 1; x++) grid.put(x, grid.height - 1, Tone.ChromaB, 0);
    grid.put(3, grid.height - 2, Tone.Fire, 0);
    const onBurn = vi.fn();
    game.events.on('burn', onBurn);
    game.update(STEP_MS);
    expect(onBurn).toHaveBeenCalledWith(expect.objectContaining({ grains: grid.width - 1 }));
    expect(grid.grainCount()).toBe(0);
  });

  it('deals water and fire now and then, never among the first pieces', () => {
    const game = started(9);
    const tones = game.preview(300).map(({ tone }) => tone);
    expect(tones.slice(0, ELEMENTS_AFTER)).not.toContain(Tone.Water);
    expect(tones.slice(0, ELEMENTS_AFTER)).not.toContain(Tone.Fire);
    expect(tones).toContain(Tone.Water);
    expect(tones).toContain(Tone.Fire);
  });

  it('announces a gust of wind, blows, then calms down', () => {
    const game = started();
    const phases: string[] = [];
    const notices: string[] = [];
    game.events.on('wind', ({ phase }) => phases.push(phase));
    game.events.on('notice', ({ id }) => notices.push(id));
    for (let t = 0; t < WIND_EVERY_MS * 1.5 + WIND_GUST_MS && game.state === 'running'; t += 100) {
      game.setSoftDrop(false);
      game.update(100);
      if (game.active && game.active.y > 10) game.hardDrop();
    }
    expect(phases.slice(0, 3)).toEqual(['soon', 'start', 'end']);
    expect(notices.some((id) => id.startsWith('windSoon'))).toBe(true);
  });

  it('leaves out wind, water and fire in a calm game (the first level)', () => {
    const game = new SandGame({ random: new SeededRandom(9), hazards: false });
    game.start();
    const phases: string[] = [];
    game.events.on('wind', ({ phase }) => phases.push(phase));
    const tones = game.preview(300).map(({ tone }) => tone);
    expect(tones).not.toContain(Tone.Water);
    expect(tones).not.toContain(Tone.Fire);
    for (let t = 0; t < WIND_EVERY_MS * 2 && game.state === 'running'; t += 100) {
      game.update(100);
      if (game.active && game.active.y > 10) game.hardDrop();
    }
    expect(phases).toEqual([]);
    expect(game.windInMs).toBeNull();
    const session = createSandSession('sand', {
      random: new SeededRandom(2),
      timeLimitMs: null,
      calm: true,
    });
    expect(session.indicators().map((indicator) => indicator.id)).not.toContain('windIn');
  });

  it('practises the elements without wind: early and often (the second level)', () => {
    const game = new SandGame({
      random: new SeededRandom(9),
      wind: false,
      elements: [Tone.Water, Tone.Lightning],
      elementPace: { after: 2, chance: 1 },
    });
    game.start();
    expect(game.windInMs).toBeNull();
    const tones = game.preview(12).map(({ tone }) => tone);
    // The active piece was the first: elements from the third piece on.
    expect(tones.slice(0, 1).some((tone) => tone === Tone.Water || tone === Tone.Lightning)).toBe(
      false,
    );
    expect(
      tones.filter((tone) => tone === Tone.Water || tone === Tone.Lightning).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('lets the Dune Wyrm show itself once the level is won (the teaser)', () => {
    const game = started();
    for (let t = 0; t < 600; t += STEP_MS) game.update(STEP_MS);
    const elapsed = game.elapsedMs;
    const score = game.score;
    const teased = vi.fn();
    const moves: string[] = [];
    game.events.on('tease', teased);
    let surface = 0;
    game.events.on('boss', ({ event }) => {
      moves.push(event.type);
      if (event.type === 'warn') surface = game.worm!.surfaceAt(event.x);
    });
    expect(game.worm).toBeNull();
    expect(game.tease()).toBe(TEASER_MS);
    expect(game.tease()).toBe(0);
    expect(teased).toHaveBeenCalledOnce();
    expect(game.isTeasing).toBe(true);
    expect(game.active).toBeNull();
    const worm = game.worm!;
    const from = worm.headX;
    for (let t = 0; t < 1000; t += STEP_MS) game.update(STEP_MS);
    // It swims in under the sand, towards the middle...
    expect(worm.headX).toBeGreaterThan(from + 20);
    expect(worm.out).toBe(false);
    // ...bursts out roaring and dives before the end window, out of reach all along.
    let highest = Number.POSITIVE_INFINITY;
    for (let t = 1000; t < TEASER_MS; t += STEP_MS) {
      game.update(STEP_MS);
      if (worm.exposed) highest = Math.min(highest, worm.headY);
    }
    // Its head and neck out of the sand: a silhouette, not a bump.
    expect(surface - highest).toBeGreaterThanOrEqual(20);
    expect(moves).toEqual(['warn', 'surge', 'dive']);
    expect(worm.out).toBe(false);
    expect(worm.health).toBe(WORM_HEALTH);
    // No piece comes, the clock stands still, the sand it throws scores nothing.
    expect(game.active).toBeNull();
    expect(game.elapsedMs).toBe(elapsed);
    expect(game.score).toBe(score);
    // A Guardian already in the well (a fight, the training's) leaves it instead (1.29).
    const boss = new SandGame({ random: new SeededRandom(4), boss: 'duneWorm' });
    boss.start();
    expect(boss.tease()).toBeGreaterThan(0);
    expect(boss.isTeasing).toBe(true);
  });

  it('warns where the next piece would appear once the sand leaves it no room', () => {
    const game = started();
    expect(game.spawnWarning()).toBeNull();
    const { grid } = game;
    for (let y = 2 * G; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) grid.put(x, y, SAND_TONES[(x >> 3) % 2]!, 0);
    }
    expect(game.spawnWarning()?.y).toBe(0);
  });

  it('ends when a new piece cannot appear', () => {
    const game = new SandGame({ random: new SeededRandom(1) });
    for (let y = 0; y < 3 * G; y++)
      for (let x = 0; x < game.grid.width; x++) game.grid.put(x, y, Tone.Garbage, 0);
    game.start();
    expect(game.overReason).toBe('blockOut');
  });

  it('runs out of time in a timed game', () => {
    const game = new SandGame({ random: new SeededRandom(1), timeLimitMs: 500 });
    game.start();
    game.update(500);
    expect(game.overReason).toBe('timeUp');
  });
});

describe('SandSession', () => {
  it('speaks the falling commands; holding is not part of Sand', () => {
    const session = createSandSession('sand', { random: new SeededRandom(2), timeLimitMs: null });
    if (!(session instanceof SandSession)) throw new Error('not a sand session');
    session.start();
    const x = session.view.active!.x;
    expect(session.execute({ type: 'move', direction: 1 })).toBe(true);
    expect(session.view.active!.x).toBe(x + G);
    expect(session.execute({ type: 'hold' })).toBe(false);
    expect(session.execute({ type: 'rotate', direction: 1 })).toBe(true);
    expect(session.execute({ type: 'hardDrop' })).toBe(true);
    expect(session.indicators().map((item) => item.id)).toEqual([
      'score',
      'regions',
      'level',
      'windIn',
    ]);
    expect(() =>
      createSandSession('classic', { random: new SeededRandom(2), timeLimitMs: null }),
    ).toThrow();
  });
});

describe('Rain over the well (1.28.1)', () => {
  it('never blocks a new piece nor counts as danger, and pieces fall through it', () => {
    const game = new SandGame({ random: new SeededRandom(3), hazards: false });
    const { grid } = game;
    // A shower over the rows where pieces enter: once, it held a piece in the
    // air there and ended level 1-1 in its first minute; it also lit the danger.
    for (let i = 0; i < 2 * G * grid.width; i++) grid.rainDrop(i);
    game.start();
    expect(game.state).toBe('running');
    expect(game.spawnWarning()).toBeNull();
    expect(game.pressure()).toBe(0);
    const piece = game.active!;
    game.hardDrop();
    const bottom = grid.width * (grid.height - 1);
    const landed = [...grid.tones.subarray(bottom)].filter((tone) => tone === piece.tone);
    expect(landed.length).toBeGreaterThanOrEqual(G);
  });
});
