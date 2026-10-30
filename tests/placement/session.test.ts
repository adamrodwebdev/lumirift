import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { effectsProfile } from '@/fx/EffectsProfile';
import { createPlacementSession, PlacementSession } from '@/families/placement';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { BREAK_MS, MosaicEffects } from '@/families/placement/fx/MosaicEffects';
import type { JokerId } from '@/families/placement/jokers/Joker';
import { MosaicController } from '@/families/placement/MosaicController';
import type { TonePalette } from '@/render/TonePalette';

const EMPTY = '........';
const PALETTE = {
  color: () => ({ r: 180, g: 90, b: 60 }),
  effects: { embers: ['#ffc43c', '#ff6e28', '#8a8076'], clay: '#f5eee1' },
} as unknown as TonePalette;

/** A started session whose board and hand are set by the test. */
function setup(rows: string[] | null, shapes: string[]) {
  const game = new MosaicGame({
    random: new SeededRandom(2),
    ...(rows ? { grid: Grid.fromRows(rows) } : {}),
  });
  const session = new PlacementSession('mosaic', game);
  session.start();
  // Tests give their own jokers: drop the undo every game starts with.
  (game as unknown as { inventory: JokerId[] }).inventory = [];
  const hand = (game as unknown as { hand: unknown[] }).hand;
  shapes.forEach((text, i) => (hand[i] = { id: 50 + i, shape: Shape.parse(text), tone: 2 }));
  const controller = new MosaicController(session.view, (command) => session.execute(command));
  return { game, session, controller };
}

const giveJoker = (game: MosaicGame, joker: JokerId) =>
  (game as unknown as { inventory: JokerId[] }).inventory.push(joker);

describe('createPlacementSession', () => {
  it('creates a Mosaic session, timed for the daily challenge', () => {
    const session = createPlacementSession('mosaic', {
      random: new SeededRandom(1),
      timeLimitMs: 2000,
    });
    session.start();
    expect(session.family).toBe('placement');
    expect(session.indicators().map((item) => item.id)).toEqual([
      'score',
      'timeLeft',
      'lines',
      'streak',
    ]);
    expect(() =>
      createPlacementSession('classic', { random: new SeededRandom(1), timeLimitMs: null }),
    ).toThrow();
  });
});

describe('PlacementSession', () => {
  it('places pieces and reports clears in the shared vocabulary', () => {
    const { session } = setup(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const onClear = vi.fn();
    session.events.on('clear', onClear);
    expect(session.execute({ type: 'place', slot: 0, x: 7, y: 0 })).toBe(true);
    expect(onClear).toHaveBeenCalledWith({ lines: 1, points: 10, combo: 0 });
    expect(session.result()).toEqual({ modeId: 'mosaic', kind: 'score', value: 11 + 300 });
  });

  it('announces jokers and clean boards', () => {
    const { session } = setup(
      ['#######.', '#######.', ...Array<string>(6).fill(EMPTY)],
      ['#|#', '#', '#'],
    );
    const notices: string[] = [];
    session.events.on('notice', ({ id }) => notices.push(id));
    session.execute({ type: 'place', slot: 0, x: 7, y: 0 });
    expect(notices).toContain('perfectGrid');
    expect(notices.some((id) => id.startsWith('jokerGained.'))).toBe(true);
  });

  it('ignores commands while paused', () => {
    const { session } = setup(null, ['#', '#', '#']);
    session.pause();
    expect(session.execute({ type: 'place', slot: 0, x: 0, y: 0 })).toBe(false);
  });
});

describe('MosaicController', () => {
  it('selects a piece and places it at the keyboard cursor, kept inside the board', () => {
    const { controller, session } = setup(null, ['###', '#', '#']);
    controller.selectSlot(0);
    controller.moveCursor(10, 10);
    expect(controller.cursor).toEqual({ x: 7, y: 7 });
    const preview = controller.keyboardPreview();
    expect(preview).toMatchObject({ x: 5, y: 7, valid: true });
    expect(controller.confirm()).toBe(true);
    expect(session.view.grid.toRows()[7]).toBe('.....###');
    expect(controller.selected).toBeNull();
  });

  it('previews the lines a placement would clear', () => {
    const { controller } = setup(['######..', ...Array<string>(7).fill(EMPTY)], ['##', '#', '#']);
    expect(controller.previewAt(0, 6, 0)?.lines).toEqual({ rows: [0], columns: [] });
    expect(controller.previewAt(0, 0, 0)?.valid).toBe(false);
  });

  it('drops a dragged piece', () => {
    const { controller, session } = setup(null, ['##|##', '#', '#']);
    expect(controller.drop(0, 2, 2)).toBe(true);
    expect(session.view.grid.tileCount()).toBe(4);
  });

  it('uses a joker without target at once, and waits for the target of the others', () => {
    const { controller, game } = setup(Array<string>(8).fill('########'), ['###', '#', '#']);
    giveJoker(game, 'bomb');
    giveJoker(game, 'rotate');
    controller.chooseJoker(0);
    expect(controller.pendingJokerId).toBe('bomb');
    controller.tapCell(4, 4);
    expect(game.grid.tileCount()).toBe(64 - 9);
    controller.chooseJoker(0); // rotate, now first
    controller.selectSlot(0);
    expect(game.pieceAt(0)?.shape.key).toBe(Shape.parse('#|#|#').key);
    expect(controller.pendingJoker).toBeNull();
  });

  it('cancels a selection and a waiting joker', () => {
    const { controller, game } = setup(null, ['#', '#', '#']);
    giveJoker(game, 'bomb');
    controller.selectSlot(1);
    controller.chooseJoker(0);
    controller.cancel();
    expect(controller.selected).toBeNull();
    expect(controller.pendingJoker).toBeNull();
  });
});

describe('MosaicEffects', () => {
  const effectsFor = (session: PlacementSession, level: 'full' | 'off' = 'full') => {
    const effects = new MosaicEffects(
      session.view,
      () => effectsProfile(level, true),
      () => PALETTE,
      String,
    );
    effects.attach(session);
    return effects;
  };

  it('makes placed tiles bounce, and cleared tiles jump then shatter', () => {
    const { session } = setup(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const effects = effectsFor(session);
    session.execute({ type: 'place', slot: 0, x: 7, y: 0 });
    expect(effects.pops).toHaveLength(1);
    expect(effects.cracking).toHaveLength(8);
    expect(effects.popups[0]?.text).toBe('+10');
    effects.update(BREAK_MS);
    expect(effects.cracking).toHaveLength(0);
    expect(effects.pool.count).toBeGreaterThan(8);
  });

  it('blows the bomb at once', () => {
    const { session, game } = setup(Array<string>(8).fill('########'), ['#', '#', '#']);
    const effects = effectsFor(session);
    giveJoker(game, 'bomb');
    session.execute({ type: 'joker', index: 0, x: 3, y: 3 });
    expect(effects.pool.count).toBeGreaterThan(9);
    expect(effects.camera.active || effects.flash > 0).toBe(true);
  });

  it('stays still when effects are off', () => {
    const { session } = setup(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const effects = effectsFor(session, 'off');
    session.execute({ type: 'place', slot: 0, x: 7, y: 0 });
    effects.update(BREAK_MS);
    expect(effects.pool.count).toBe(0);
    expect(effects.pops).toHaveLength(0);
  });
});
