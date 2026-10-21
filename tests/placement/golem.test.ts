import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import {
  CeramicGolem,
  clearDamage,
  PARRY_DAMAGE,
  PERFECT_DAMAGE,
  SHATTER_DAMAGE,
} from '@/families/placement/engine/CeramicGolem';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { createPlacementSession } from '@/families/placement';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { advance } from '@/progression/Objectives';
import { ProfileService } from '@/services/ProfileService';
import type { ModeId } from '@/session/ModeId';

const DOT = Shape.parse('#');
const types = (golem: CeramicGolem) => golem.drain().map((event) => event.type);

describe('The Ceramic Golem', () => {
  it('aims at free cells on different rows and columns, then throws a stone on each', () => {
    const grid = new Grid();
    const golem = new CeramicGolem(grid, new SeededRandom(4));
    golem.start();
    expect(types(golem)).toEqual(['aim']);
    const targets = [...golem.targets];
    expect(targets).toHaveLength(2);
    expect(new Set(targets.map((t) => t.x)).size).toBe(2);
    expect(new Set(targets.map((t) => t.y)).size).toBe(2);
    expect(golem.countdown).toBe(3);
    golem.endTurn();
    golem.endTurn();
    expect(grid.stoneCount()).toBe(0);
    golem.endTurn();
    expect(types(golem)).toEqual(['throw', 'aim']);
    for (const { x, y } of targets) expect(grid.get(x, y)).toBe(Tone.Stone);
  });

  it('is parried by a piece set on the cells it aims at', () => {
    const grid = new Grid();
    const golem = new CeramicGolem(grid, new SeededRandom(4));
    golem.start();
    golem.drain();
    const [parried, other] = golem.targets;
    grid.place(DOT, parried!.x, parried!.y, Tone.I);
    golem.placed([parried!]);
    expect(golem.health).toBe(GUARDIAN_HEALTH - PARRY_DAMAGE);
    expect(golem.targets).toEqual([other]);
    golem.endTurn();
    golem.endTurn();
    golem.endTurn();
    expect(grid.get(parried!.x, parried!.y)).toBe(Tone.I);
    expect(grid.stoneCount()).toBe(1);
  });

  it('is hurt by clears, more with several lines, a streak, its stones broken, a clean board', () => {
    expect(clearDamage(1, 1)).toBe(4);
    expect(clearDamage(2, 1)).toBe(11);
    expect(clearDamage(3, 1)).toBe(18);
    expect(clearDamage(1, 9)).toBe(8);
    const golem = new CeramicGolem(new Grid(), new SeededRandom(1));
    golem.struck(2, 1, 1, true);
    expect(golem.health).toBe(GUARDIAN_HEALTH - 11 - SHATTER_DAMAGE - PERFECT_DAMAGE);
    expect(types(golem)).toEqual(['hurt', 'hurt', 'hurt', 'phase']);
  });

  it('goes through its phases and falls at 0, aiming no more', () => {
    const golem = new CeramicGolem(new Grid(), new SeededRandom(1));
    golem.start();
    const seen: string[] = [];
    while (!golem.defeated) {
      golem.struck(4, 9, 0, false);
      seen.push(...types(golem));
    }
    expect(seen.filter((type) => type === 'phase')).toHaveLength(2);
    expect(seen.at(-1)).toBe('defeated');
    expect(golem.targets).toEqual([]);
  });
});

describe('Stones on the board', () => {
  it('fill their cell, crack in a cleared line, break in the next one', () => {
    const grid = Grid.fromRows(['#######.', ...Array(7).fill('........')]);
    expect(grid.putStone(7, 0)).toBe(true);
    expect(grid.putStone(7, 0)).toBe(false);
    const cracked: { x: number; y: number }[] = [];
    const removed = grid.clearLines(grid.fullLines(), cracked);
    expect(removed).toHaveLength(7);
    expect(cracked).toEqual([{ x: 7, y: 0 }]);
    expect(grid.get(7, 0)).toBe(Tone.CrackedStone);
    for (let x = 0; x < 7; x++) grid.place(DOT, x, 0, Tone.I);
    const again = grid.clearLines(grid.fullLines());
    expect(again.map((tile) => tile.tone)).toContain(Tone.CrackedStone);
    expect(grid.isEmpty()).toBe(true);
  });

  it('are blown away whole by the bomb joker', () => {
    const grid = new Grid();
    grid.putStone(3, 3);
    expect(grid.clearArea(3, 3)).toHaveLength(1);
    expect(grid.isEmpty()).toBe(true);
  });
});

describe('A boss level of Mosaic', () => {
  const golemGame = () => {
    const game = new MosaicGame({ random: new SeededRandom(7), boss: 'ceramicGolem' });
    game.start();
    return game;
  };

  it('ends in victory when the Golem falls', () => {
    const game = golemGame();
    const golem = game.golem!;
    while (golem.health > 4) golem.struck(1, 1, 0, false);
    // One more clear finishes it: a row full but for its first cell, and a cube to fill it.
    for (let x = 1; x < 8; x++) game.grid.place(DOT, x, 7, Tone.I);
    game.giveCube();
    expect(game.place('bonus', 0, 7)).toBe(true);
    expect(game.state).toBe('over');
    expect(game.overReason).toBe('victory');
  });

  it('undoes the Golem with the placement: its health, aim and countdown come back', () => {
    const game = golemGame();
    const before = game.golem!.snapshot();
    const { slot, piece } = game.pieces()[0]!;
    const target = game.golem!.targets[0]!;
    const x = Math.min(target.x, 8 - piece.shape.width);
    const y = Math.min(target.y, 8 - piece.shape.height);
    expect(game.place(slot, x, y)).toBe(true);
    expect(game.golem!.countdown).toBe(before.countdown - 1);
    expect(game.useJoker(game.jokers.indexOf('undo'))).toBe(true);
    expect(game.golem!.snapshot()).toEqual(before);
  });

  it('reports the Golem to the game screen, and only on its level', () => {
    const options = { random: new SeededRandom(1), timeLimitMs: null };
    const boss = createPlacementSession('mosaic', { ...options, boss: 'ceramicGolem' });
    expect(boss.boss?.()).toEqual({
      id: 'ceramicGolem',
      health: GUARDIAN_HEALTH,
      maxHealth: GUARDIAN_HEALTH,
    });
    expect(createPlacementSession('mosaic', options).boss?.()).toBeNull();
  });

  it('is no duel: its fall does not count for the duel objective', () => {
    const objective = { kind: 'duel', tier: 'hard', target: 1 } as const;
    const report = {
      modeId: 'mosaic',
      daily: false,
      variant: null,
      reason: 'victory',
      durationMs: 120_000,
      clears: 12,
      lines: 14,
      bestAtOnce: 2,
      bestCombo: 4,
      boss: 'ceramicGolem',
    } as const;
    expect(advance(objective, report)).toBe(0);
    expect(advance(objective, { ...report, modeId: 'duel', variant: 'normal' })).toBe(1);
  });

  it('gives its Kintsugi to the player who defeats it', () => {
    const modes: readonly ModeId[] = ['mosaic'];
    const service = new ProfileService(new MemoryStorage(), () => modes);
    const progress = service.recordGame(
      {
        modeId: 'mosaic',
        daily: false,
        variant: null,
        reason: 'victory',
        durationMs: 120_000,
        clears: 12,
        lines: 14,
        bestAtOnce: 2,
        bestCombo: 4,
        boss: 'ceramicGolem',
      },
      '20261021',
    );
    expect(progress.unlocked.map((c) => c.id)).toContain('kintsugi');
  });
});
