import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import type { DunesSession } from '@/families/dunes';
import {
  colourOf,
  DUNES_TONES,
  runOf,
  type CellMap,
  type Spot,
} from '@/families/dunes/engine/DunesBoard';
import type { DunesGame } from '@/families/dunes/engine/DunesGame';
import { BOLT_REACH } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import type { CurvePlayer, PlayerSkill } from './CurvePlayer';

/** How a player of Dunes of a skill plays (1.37): its pace, its blunders, its eye for the elements. */
export interface DunesSkill {
  /** Time it takes for each piece (ms of play). */
  readonly thinkMs: number;
  /** The share of its pieces put down anywhere they fit. */
  readonly blunders: number;
  /** It aims fire and lightning at what they would hit (else it puts them down as sand). */
  readonly aims: boolean;
}

/** A newcomer is slow and puts a piece in five anywhere; a regular links; an expert aims its elements too. */
export const DUNES_SKILLS: Readonly<Record<PlayerSkill, DunesSkill>> = {
  newcomer: { thinkMs: 3500, blunders: 0.2, aims: false },
  regular: { thinkMs: 2200, blunders: 0, aims: false },
  expert: { thinkMs: 1400, blunders: 0, aims: true },
};

/** A move: a piece of the hand and where it goes. */
interface Move extends Spot {
  readonly slot: number;
}

/**
 * A player of Dunes for the curve bot: each piece put down where it rests
 * best, read at the scale of cells (where it comes to rest, the colours it
 * touches, the band of its colour it carries toward both walls). Stuck, it
 * swaps. It acts only through the session's commands.
 */
export class DunesCurvePlayer implements CurvePlayer {
  private timer: number;

  constructor(
    private readonly session: DunesSession,
    private readonly skill: DunesSkill,
    private readonly random: RandomSource,
  ) {
    this.timer = skill.thinkMs;
  }

  /** Waiting for the next hand (the sand settling) is dead time. */
  get idle(): boolean {
    return this.session.game.dealing;
  }

  update(deltaMs: number): void {
    const { game } = this.session;
    if (game.state !== 'running' || game.dealing) return;
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    this.timer += this.skill.thinkMs;
    const move = this.choose(game);
    if (move) this.session.execute({ type: 'place', ...move });
    else this.session.execute({ type: 'swap' });
  }

  dispose(): void {
    // Nothing to release: it listens to nothing.
  }

  private choose(game: DunesGame): Move | null {
    const board = game.board();
    const moves = game.hand.flatMap((piece, slot) =>
      piece ? board.spots(piece.shape).map((spot) => ({ slot, ...spot })) : [],
    );
    if (moves.length === 0) return null;
    if (this.random.next() < this.skill.blunders) {
      return moves[this.random.nextInt(moves.length)]!;
    }
    let best = moves[0]!;
    let bestValue = -Infinity;
    for (const move of moves) {
      const value = this.value(game, board, move) + this.random.next() * 0.01;
      if (value > bestValue) {
        best = move;
        bestValue = value;
      }
    }
    return best;
  }

  private value(game: DunesGame, board: CellMap, move: Move): number {
    const piece = game.hand[move.slot]!;
    const rest = restOf(board, piece.shape, move);
    // Low is better: the room up top is the life of the run.
    const low = rest.y * 0.6;
    if (piece.tone === Tone.Fire || piece.tone === Tone.Lightning) {
      if (!this.skill.aims) return low;
      return low + this.elementValue(game, move);
    }
    if (!DUNES_TONES.includes(piece.tone)) return low + rest.y * 0.4;
    // A band of one colour reaching both walls is a link: the run of the piece's colour along
    // the surface after it lands, and the runs of the other colours it would bury.
    const before = surfaceOf(game, board);
    const after = landed(before, piece.shape, rest, piece.tone);
    let value = low + 3 * runOf(after.colours, piece.tone);
    if (runOf(after.colours, piece.tone) >= board.columns) value += 30;
    for (const tone of DUNES_TONES) {
      if (tone === piece.tone) continue;
      value -= 2 * Math.max(0, runOf(before.colours, tone) - runOf(after.colours, tone));
    }
    return value;
  }

  /** What a fire or lightning piece would do there: grains it removes, the Wyrm's head above all. */
  private elementValue(game: DunesGame, move: Move): number {
    const piece = game.hand[move.slot]!;
    const worm = game.worm;
    if (piece.tone === Tone.Lightning && worm?.exposed && !game.isShowing) {
      const column = (move.x + piece.shape.width / 2) * GRAINS_PER_CELL;
      if (Math.abs(worm.headX - column) < BOLT_REACH) return 60;
    }
    return (game.targetAt(move)?.length ?? 0) / 40;
  }
}

/** Where a piece put at a spot comes to rest, cell by cell: as low as it falls. */
function restOf(board: CellMap, shape: { readonly cells: readonly Spot[] }, at: Spot): Spot {
  let y = at.y;
  while (shape.cells.every((cell) => board.isFree(at.x + cell.x, y + 1 + cell.y))) y++;
  return { x: at.x, y };
}

/** The surface of the sand, column by column: the row of its top cell, and that cell's colour. */
interface Surface {
  readonly tops: readonly number[];
  readonly colours: readonly (Tone | null)[];
}

function surfaceOf(game: DunesGame, board: CellMap): Surface {
  const tops: number[] = [];
  const colours: (Tone | null)[] = [];
  for (let x = 0; x < board.columns; x++) {
    let y = 0;
    while (y < board.rows && board.isFree(x, y)) y++;
    tops.push(y);
    colours.push(y < board.rows ? colourOf(game.grid, x, y) : null);
  }
  return { tops, colours };
}

/**
 * The surface once the piece has crumbled: its columns take its colour,
 * and so do the columns beside it lower than its bottom (sand flows down
 * its slopes).
 */
function landed(
  surface: Surface,
  shape: { readonly cells: readonly Spot[] },
  rest: Spot,
  tone: Tone,
): Surface {
  const tops = [...surface.tops];
  const colours = [...surface.colours];
  const columns = new Set(shape.cells.map((cell) => rest.x + cell.x));
  const bottom = Math.max(...shape.cells.map((cell) => rest.y + cell.y));
  for (const x of columns) {
    tops[x] = Math.min(
      tops[x]!,
      ...shape.cells.filter((c) => rest.x + c.x === x).map((c) => rest.y + c.y),
    );
    colours[x] = tone;
  }
  for (const x of columns) {
    for (const side of [x - 1, x + 1]) {
      if (side < 0 || side >= tops.length || columns.has(side)) continue;
      if (tops[side]! > bottom + 1) colours[side] = tone;
    }
  }
  return { tops, colours };
}
