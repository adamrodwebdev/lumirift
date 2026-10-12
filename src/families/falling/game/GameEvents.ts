import type { ClearedRow } from '../board/Board';
import type { Piece } from '../pieces/Piece';
import type { PieceType } from '../pieces/PieceType';

export type GameState = 'ready' | 'running' | 'paused' | 'over';

/**
 * blockOut: a new piece cannot appear. lockOut: a piece locked entirely above
 * the visible well. topOut: rising rows pushed blocks out. timeUp: timed mode.
 */
export type GameOverReason = 'blockOut' | 'lockOut' | 'topOut' | 'timeUp';

export interface LinesClearedEvent {
  readonly lines: number;
  readonly pureLines: number;
  readonly points: number;
  /** Consecutive clearing locks before this one. */
  readonly combo: number;
  /** True when the clear came from a flip of the well, not from a lock. */
  readonly cascade: boolean;
  /** The removed rows, with their tones, top to bottom (index before removal). */
  readonly rows: readonly ClearedRow[];
}

export interface GameEventMap {
  state: { readonly state: GameState };
  spawn: { readonly piece: Piece };
  /** A successful sideways move. */
  move: { readonly piece: Piece };
  /** A successful rotation (`kicked`: the piece had to be pushed off a wall or block). */
  rotate: { readonly piece: Piece; readonly kicked: boolean };
  /** Emitted before `lock`: `piece` is where it landed, `distance` how far it fell. */
  hardDrop: { readonly piece: Piece; readonly distance: number };
  lock: { readonly piece: Piece };
  hold: { readonly type: PieceType };
  clear: LinesClearedEvent;
  levelUp: { readonly level: number };
  garbage: { readonly rows: number };
  flip: { readonly lines: number };
  mirror: Readonly<Record<string, never>>;
  /** Mode-specific announcement; `id` is a translation key suffix. */
  notice: { readonly id: string; readonly value?: number };
  over: { readonly reason: GameOverReason };
}
