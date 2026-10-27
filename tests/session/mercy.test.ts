import { describe, expect, it } from 'vitest';
import { levelById } from '@/campaign/Levels';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { TideMode } from '@/families/falling/modes/TideMode';
import { LevelRun } from '@/run/RunKind';
import {
  Mercy,
  MERCY_BY_CHAPTER,
  MERCY_FROM,
  MERCY_FULL,
  MERCY_RULES,
  mercyOfChapter,
} from '@/session/Mercy';
import { ConstantRandom } from '../falling/helpers';

/** A well with its stack this many rows high, open on the right. */
const stacked = (rows: number) =>
  Board.fromRows(
    Array.from({ length: 20 }, (_, y) => (y < 20 - rows ? '..........' : '#########.')),
  );

describe('Mercy (1.33)', () => {
  it('slows the threat near the top only: none below its start, the slowest at the top', () => {
    const mercy = Mercy.of('falling', 1);
    expect(mercy.pace(0)).toBe(1);
    expect(mercy.pace(MERCY_FROM)).toBe(1);
    expect(mercy.pace((MERCY_FROM + MERCY_FULL) / 2)).toBeLessThan(1);
    expect(mercy.pace(MERCY_FULL)).toBeCloseTo(MERCY_RULES.falling.slowest);
    expect(mercy.pace(1)).toBeCloseTo(MERCY_RULES.falling.slowest);
    // Half the strength, half the slowing.
    expect(Mercy.of('falling', 0.5).pace(1)).toBeCloseTo((1 + MERCY_RULES.falling.slowest) / 2);
  });

  it('is full in chapter 1, fades out by chapter 4, and never slows the Mosaic', () => {
    expect(MERCY_BY_CHAPTER.map((_, k) => mercyOfChapter(k + 1))).toEqual([1, 2 / 3, 1 / 3, 0, 0]);
    expect(mercyOfChapter(9)).toBe(0);
    expect(Mercy.of('falling', 0)).toBe(Mercy.NONE);
    expect(Mercy.of('placement', 1).pace(1)).toBe(1);
  });

  it('comes with the early campaign levels only', () => {
    const optionsOf = (id: string) => {
      const level = levelById(id)!;
      return new LevelRun(level.modeId, level, {}).sessionOptions(1, new Date(2026, 9, 26));
    };
    expect(optionsOf('1-3').mercy).toBe(1);
    expect(optionsOf('2-1').mercy).toBeCloseTo(2 / 3);
    expect(optionsOf('4-1').mercy).toBeUndefined();
  });

  it('lets a piece fall slower over a high stack, and holds the tide back', () => {
    const fall = (mercy: Mercy) => {
      const game = new Game(new ClassicMode(), {
        random: new ConstantRandom(),
        board: stacked(16),
        mercy,
      });
      game.start();
      for (let t = 0; t < 3000; t += 16) game.update(16);
      return game.active!.y;
    };
    expect(fall(Mercy.of('falling', 1))).toBeLessThan(fall(Mercy.NONE));

    const risen = (mercy: Mercy) => {
      const game = new Game(new TideMode(), {
        random: new ConstantRandom(),
        board: stacked(15),
        mercy,
      });
      game.start();
      let rows = 0;
      for (let t = 0; t < 14_000; t += 16) {
        game.update(16);
        rows = game.board.stackHeight();
      }
      return rows;
    };
    expect(risen(Mercy.of('falling', 1))).toBeLessThan(risen(Mercy.NONE));
  });
});
