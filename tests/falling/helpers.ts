import { Board } from '@/families/falling/board/Board';
import type { RandomSource } from '@/core/Random';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import type { GameMode } from '@/families/falling/modes/GameMode';

/** Always returns the same value. 0.999 keeps every bag in I O T S Z J L order. */
export class ConstantRandom implements RandomSource {
  constructor(private readonly value = 0.999) {}
  next(): number {
    return this.value;
  }
  nextInt(max: number): number {
    return Math.floor(this.value * max);
  }
}

export interface TestGameOptions {
  readonly rows?: readonly string[];
  readonly mode?: GameMode;
  readonly startLevel?: number;
}

/** A started game whose pieces come in the order I O T S Z J L. */
export function startedGame({ rows, mode, startLevel }: TestGameOptions = {}): Game {
  const game = new Game(mode ?? new ClassicMode(), {
    random: new ConstantRandom(),
    ...(rows ? { board: Board.fromRows(rows) } : {}),
    ...(startLevel === undefined ? {} : { startLevel }),
  });
  game.start();
  return game;
}

/** Advances the game by `totalMs` in 16 ms frames, like the real loop. */
export function advance(game: Game, totalMs: number, frameMs = 16): void {
  for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) game.update(frameMs);
}
