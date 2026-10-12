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
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';

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
    const tones = Array.from({ length: 300 }, () => {
      const spec = game.preview(1)[0]!;
      (game as unknown as { upcoming: unknown[] }).upcoming.shift();
      return spec.tone;
    });
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
