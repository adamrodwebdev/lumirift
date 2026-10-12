import type { MosaicGame, SlotId } from '../engine/MosaicGame';

export const JOKER_IDS = ['rotate', 'reroll', 'bomb', 'undo', 'cube'] as const;
export type JokerId = (typeof JOKER_IDS)[number];

/** What a joker applies to: nothing, a piece of the hand, or a cell of the board. */
export type JokerTargetKind = 'none' | 'piece' | 'cell';

export interface JokerTarget {
  readonly slot?: SlotId;
  readonly x?: number;
  readonly y?: number;
}

/**
 * A joker: a strategy the game applies on demand. Adding a joker means adding
 * a class here, never changing the game.
 */
export interface Joker {
  readonly id: JokerId;
  readonly target: JokerTargetKind;
  canUse(game: MosaicGame, target: JokerTarget): boolean;
  use(game: MosaicGame, target: JokerTarget): void;
  /** Could this joker get a stuck game going again? (no piece fits) */
  canHelp(game: MosaicGame): boolean;
}

/** Turns a piece of the hand a quarter clockwise. */
class RotateJoker implements Joker {
  readonly id = 'rotate';
  readonly target = 'piece';

  canUse(game: MosaicGame, { slot }: JokerTarget): boolean {
    return slot !== undefined && game.pieceAt(slot) !== null;
  }

  use(game: MosaicGame, { slot }: JokerTarget): void {
    if (slot !== undefined) game.turnPiece(slot);
  }

  canHelp(game: MosaicGame): boolean {
    return game.pieces().some(({ piece }) => {
      let shape = piece.shape;
      for (let turn = 0; turn < 3; turn++) {
        shape = shape.rotated();
        if (game.grid.fitsAnywhere(shape)) return true;
      }
      return false;
    });
  }
}

/** Deals three new pieces. */
class RerollJoker implements Joker {
  readonly id = 'reroll';
  readonly target = 'none';

  canUse(): boolean {
    return true;
  }

  use(game: MosaicGame): void {
    game.redeal();
  }

  canHelp(): boolean {
    return true;
  }
}

/** Clears a 3 × 3 square around a cell. */
class BombJoker implements Joker {
  readonly id = 'bomb';
  readonly target = 'cell';

  canUse(game: MosaicGame, { x, y }: JokerTarget): boolean {
    return (
      x !== undefined &&
      y !== undefined &&
      x >= 0 &&
      y >= 0 &&
      x < game.grid.size &&
      y < game.grid.size
    );
  }

  use(game: MosaicGame, { x, y }: JokerTarget): void {
    if (x !== undefined && y !== undefined) game.bomb(x, y);
  }

  canHelp(game: MosaicGame): boolean {
    return !game.grid.isEmpty();
  }
}

/** Takes back the last placement. */
class UndoJoker implements Joker {
  readonly id = 'undo';
  readonly target = 'none';

  canUse(game: MosaicGame): boolean {
    return game.canUndo;
  }

  use(game: MosaicGame): void {
    game.undo();
  }

  canHelp(game: MosaicGame): boolean {
    return game.canUndo;
  }
}

/** Adds a single-cell piece, to put anywhere. */
class CubeJoker implements Joker {
  readonly id = 'cube';
  readonly target = 'none';

  canUse(game: MosaicGame): boolean {
    return game.pieceAt('bonus') === null;
  }

  use(game: MosaicGame): void {
    game.giveCube();
  }

  canHelp(game: MosaicGame): boolean {
    return game.pieceAt('bonus') === null && game.grid.hasEmptyCell();
  }
}

export const JOKERS: Readonly<Record<JokerId, Joker>> = {
  rotate: new RotateJoker(),
  reroll: new RerollJoker(),
  bomb: new BombJoker(),
  undo: new UndoJoker(),
  cube: new CubeJoker(),
};
