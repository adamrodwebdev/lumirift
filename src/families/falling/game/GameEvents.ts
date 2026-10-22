import type { ClearedRow, RemovedCell } from '../board/Board';
import type { Piece } from '../pieces/Piece';
import type { PieceType } from '../pieces/PieceType';
import type { Cell } from '../pieces/Shapes';

export type GameState = 'ready' | 'running' | 'paused' | 'over';

/**
 * blockOut: a new piece cannot appear. lockOut: a piece locked entirely above
 * the visible well. topOut: rising rows pushed blocks out. timeUp: timed mode.
 * outOfPieces / shapeComplete: the end of a Silhouette.
 */
export type GameOverReason =
  | 'blockOut'
  | 'lockOut'
  | 'topOut'
  | 'timeUp'
  | 'outOfPieces'
  | 'shapeComplete'
  /** A Guardian of the rift defeated (the Tower's boss level). */
  | 'victory';

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
  /** Cleared in danger: these points again, as a bonus (see `Tension`). */
  closeCall: { readonly points: number };
  levelUp: { readonly level: number };
  garbage: { readonly rows: number };
  /** Stones dropped on top of columns by a mode rule (the Eye of the Tower's strike). */
  stones: { readonly cells: readonly Cell[] };
  flip: { readonly lines: number };
  mirror: Readonly<Record<string, never>>;
  /** Groups of same-coloured blocks fused (Fusion); the chain counts the reactions. */
  /** A bomb went off (the Tower): `bombs` with the ones it set off. */
  blast: {
    readonly x: number;
    readonly y: number;
    readonly cells: readonly RemovedCell[];
    readonly bombs: number;
    readonly points: number;
  };
  fusion: {
    readonly cells: readonly RemovedCell[];
    readonly chain: number;
    readonly points: number;
  };
  /** The well turned a quarter left (Tilt). */
  tilt: { readonly lines: number };
  /** A beat of the rhythm (Rhythm); every fourth one is a downbeat. */
  beat: { readonly count: number };
  /** The groove after a lock: up when the piece landed on the beat. */
  groove: { readonly level: number; readonly onBeat: boolean };
  /** A second chance: the bottom rows vanished instead of the game ending. */
  rescue: { readonly rows: number };
  /** Mode-specific announcement; `id` is a translation key suffix. */
  notice: { readonly id: string; readonly value?: number };
  over: { readonly reason: GameOverReason };
}
