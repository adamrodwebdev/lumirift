import type { RandomSource } from '@/core/Random';
import type { MosaicCommand, MosaicView } from '@/families/placement';
import type { JokerId } from '@/families/placement/jokers/Joker';
import type { SlotId } from '@/families/placement/engine/MosaicGame';
import type { Grid } from '@/families/placement/engine/Grid';
import { afterPlacing, canPlaceAll } from '@/families/placement/engine/HandSolver';
import { Shape } from '@/families/placement/engine/Shape';

/** A piece of the hand and where it goes. */
export interface MosaicMove {
  readonly slot: SlotId;
  readonly x: number;
  readonly y: number;
}

/** How a Mosaic player picks its next move, or null when nothing fits. */
export interface MosaicChoice {
  choose(view: MosaicView): MosaicMove | null;
}

/** Every move the hand allows now. */
function movesOf(view: MosaicView): MosaicMove[] {
  const moves: MosaicMove[] = [];
  const size = view.grid.size;
  for (const { slot, piece } of view.pieces()) {
    for (let y = 0; y <= size - piece.shape.height; y++) {
      for (let x = 0; x <= size - piece.shape.width; x++) {
        if (view.canPlace(slot, x, y)) moves.push({ slot, x, y });
      }
    }
  }
  return moves;
}

const linesOf = (view: MosaicView, move: MosaicMove): number => {
  const { rows, columns } = view.linesIfPlaced(move.slot, move.x, move.y);
  return rows.length + columns.length;
};

/**
 * A newcomer: any piece anywhere it fits; a line it sees is taken half the
 * time.
 */
export class CasualChoice implements MosaicChoice {
  constructor(private readonly random: RandomSource) {}

  choose(view: MosaicView): MosaicMove | null {
    const moves = movesOf(view);
    if (moves.length === 0) return null;
    if (this.random.next() < 0.5) {
      const clearing = moves.filter((move) => linesOf(view, move) > 0);
      if (clearing.length > 0) return clearing[this.random.nextInt(clearing.length)]!;
    }
    return moves[this.random.nextInt(moves.length)]!;
  }
}

/** The big pieces a board should keep room for. */
const SQUARE = Shape.parse('###|###|###');
const LONG = Shape.parse('#####');
const TALL = LONG.rotated();

/**
 * How good a board is to play on: few tiles, no lone holes, room for the
 * square and the long pieces.
 */
export function boardValue(grid: Grid): number {
  let tiles = 0;
  let lone = 0;
  const empty = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < grid.size && y < grid.size && grid.isFree(x, y);
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.isFree(x, y)) {
        tiles++;
        continue;
      }
      const open = [empty(x - 1, y), empty(x + 1, y), empty(x, y - 1), empty(x, y + 1)];
      if (!open.some(Boolean)) lone++;
    }
  }
  const room =
    (grid.fitsAnywhere(SQUARE) ? 4 : 0) +
    (grid.fitsAnywhere(LONG) ? 2 : 0) +
    (grid.fitsAnywhere(TALL) ? 2 : 0);
  return room - 0.25 * tiles - 3 * lone;
}

/** What a move is worth to a player: the higher, the better. */
export type MoveValue = (view: MosaicView, move: MosaicMove) => number;

const boardAfter = (view: MosaicView, move: MosaicMove): Grid =>
  afterPlacing(view.grid, view.pieceAt(move.slot)!.shape, move.x, move.y);

/** A stone parried (a cell the Golem aims at, filled first) is worth this much. */
const PARRY_VALUE = 3;

/** The cells the Golem aims at (they glow) that a move fills: stones parried. */
function parried(view: MosaicView, move: MosaicMove): number {
  const targets = view.golem?.targets ?? [];
  if (targets.length === 0) return 0;
  const piece = view.pieceAt(move.slot)!;
  return piece.shape.cells.filter((cell) =>
    targets.some((target) => target.x === move.x + cell.x && target.y === move.y + cell.y),
  ).length;
}

/** Lines first, then the board the move leaves and the stones it parries. */
export const clearValue: MoveValue = (view, move) =>
  10 * linesOf(view, move) + boardValue(boardAfter(view, move)) + PARRY_VALUE * parried(view, move);

/** Rows (or columns) this many cells short of full, side by side with the same gaps, wait for one piece. */
const NEAR_FULL = 3;

/** The most rows or columns side by side with the same few gaps: lines one piece could clear at once. */
export function alignedLines(grid: Grid): number {
  let best = 0;
  for (const across of [true, false]) {
    let run = 0;
    let previous = '';
    for (let i = 0; i < grid.size; i++) {
      let mask = '';
      let gaps = 0;
      for (let j = 0; j < grid.size; j++) {
        const free = across ? grid.isFree(j, i) : grid.isFree(i, j);
        mask += free ? '.' : '#';
        if (free) gaps++;
      }
      const waiting = gaps > 0 && gaps <= NEAR_FULL;
      run = waiting && mask === previous ? run + 1 : waiting ? 1 : 0;
      previous = waiting ? mask : '';
      best = Math.max(best, run);
    }
  }
  return best;
}

/** Above this share of the board, a small clear is taken: the board needs the room. */
const CROWDED = 0.6;

/**
 * For a goal of lines at once: a clear that big wins; smaller ones are kept
 * for it while the board has room, and lines are lined up for one piece.
 */
export function bigClearValue(target: number): MoveValue {
  return (view, move) => {
    const lines = linesOf(view, move);
    if (lines >= target) return 1000 + lines;
    const after = boardAfter(view, move);
    const crowded = after.tileCount() > CROWDED * after.size * after.size;
    const small = lines === 0 ? 0 : crowded ? 10 * lines : -4 * lines;
    return small + 5 * Math.min(target, alignedLines(after)) + boardValue(after);
  };
}

/** A regular: the move worth the most now. */
export class GreedyChoice implements MosaicChoice {
  constructor(private readonly value: MoveValue = clearValue) {}

  choose(view: MosaicView): MosaicMove | null {
    let best: MosaicMove | null = null;
    let bestValue = -Infinity;
    for (const move of movesOf(view)) {
      const value = this.value(view, move);
      if (value > bestValue) {
        bestValue = value;
        best = move;
      }
    }
    return best;
  }
}

/** Moves an expert weighs further: whether the rest of the hand still fits after each. */
const LOOKAHEAD_WIDTH = 8;
/** Placements the solver may try to prove the rest of the hand fits. */
const LOOKAHEAD_BUDGET = 400;

/** An expert: the best moves that leave room for the rest of the hand. */
export class LookaheadChoice implements MosaicChoice {
  constructor(private readonly value: MoveValue = clearValue) {}

  choose(view: MosaicView): MosaicMove | null {
    const ranked = movesOf(view)
      .map((move) => ({ move, value: this.value(view, move) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, LOOKAHEAD_WIDTH);
    const hand = view.pieces();
    const safe = ranked.find(({ move }) => {
      const rest = hand.filter(({ slot }) => slot !== move.slot).map(({ piece }) => piece.shape);
      return canPlaceAll(boardAfter(view, move), rest, LOOKAHEAD_BUDGET);
    });
    return (safe ?? ranked[0])?.move ?? null;
  }
}

/** The jokers a stuck player reaches for, the surest first (an undo would only lead back here). */
const RESCUES: readonly JokerId[] = ['reroll', 'bomb', 'cube', 'rotate', 'undo'];

/** The cell whose 3 × 3 square holds the most tiles: where a bomb frees the most room. */
function crowdedCell(view: MosaicView): { x: number; y: number } {
  const { grid } = view;
  let best = { x: 1, y: 1 };
  let most = -1;
  for (let y = 1; y < grid.size - 1; y++) {
    for (let x = 1; x < grid.size - 1; x++) {
      let tiles = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (!grid.isFree(x + dx, y + dy)) tiles++;
      }
      if (tiles > most) {
        most = tiles;
        best = { x, y };
      }
    }
  }
  return best;
}

/** A piece of the hand that would fit once turned, for the rotate joker; or null. */
function turnable(view: MosaicView): MosaicMove['slot'] | null {
  for (const { slot, piece } of view.pieces()) {
    let shape = piece.shape;
    for (let turn = 0; turn < 3; turn++) {
      shape = shape.rotated();
      if (view.grid.fitsAnywhere(shape)) return slot;
    }
  }
  return null;
}

/**
 * When no piece of the hand fits, the game waits for a joker: the one a
 * player would press, aimed where it helps; null when none can help.
 */
export function rescueOf(view: MosaicView): MosaicCommand | null {
  for (const id of RESCUES) {
    const index = view.jokers.indexOf(id);
    if (index < 0) continue;
    if (id === 'reroll') return { type: 'joker', index };
    if (id === 'bomb' && !view.grid.isEmpty())
      return { type: 'joker', index, ...crowdedCell(view) };
    if (id === 'cube' && view.pieceAt('bonus') === null && view.grid.hasEmptyCell()) {
      return { type: 'joker', index };
    }
    const slot = id === 'rotate' ? turnable(view) : null;
    if (slot !== null) return { type: 'joker', index, slot };
    if (id === 'undo' && view.canUndo) return { type: 'joker', index };
  }
  return null;
}
