import { LINK } from '../board/Links';
import { Tone } from '../pieces/PieceType';

/**
 * The rift that opens a cleared row (lot 30, 1.44; CAHIER § 9 sexies): the
 * crack runs from the piece that completed the row to both walls, the row
 * splits along its light, its crystals break into pieces the seam swallows,
 * then the seam flares and closes. Nothing crosses the stack: the pieces stay
 * in their row. Pure rules: the beats, the pieces and where each one is at a
 * moment; `FallingEffects` runs them, the painters draw them.
 */

/** The opening's beats, in ms of game time from the landing. */
export const RIFT = {
  /** The crack runs from the piece to both walls. */
  runMs: 90,
  /** The row splits along it: its halves part, light shows between its pieces. */
  splitMs: 60,
  /**
   * The seam swallows the pieces, from the end of the split: they hold, then
   * are drawn in ever faster (eased in, as on the mockup), all gone before
   * the next piece comes (280 ms).
   */
  swallowFrom: 120,
  swallowMs: 150,
  /** A flare as the last pieces go, then the seam closes. */
  flareFrom: 230,
  closeFrom: 270,
  endMs: 360,
  /** The rows above start to fall into the gap, before the next piece comes (280 ms). */
  fallFrom: 250,
} as const;

/** How far the crack wobbles about the row's middle, in cells: each half keeps some height. */
export const RIFT_WOBBLE = 0.24;
/** How far the two halves part at the split, in cells. */
const PART = 0.1;

/** Where the opening is at a moment: each beat from 0 (not begun) to 1 (done). */
export interface RiftPhase {
  readonly run: number;
  readonly split: number;
  readonly swallow: number;
  readonly flare: number;
  readonly close: number;
}

const span = (t: number, from: number, length: number) =>
  Math.min(1, Math.max(0, (t - from) / length));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k ** 3;

/** The opening at `age` ms after the landing. */
export function riftPhase(age: number): RiftPhase {
  return {
    run: easeOut(span(age, 0, RIFT.runMs)),
    split: easeOut(span(age, RIFT.runMs, RIFT.splitMs)),
    swallow: easeIn(span(age, RIFT.swallowFrom, RIFT.swallowMs)),
    flare: span(age, RIFT.flareFrom, RIFT.closeFrom - RIFT.flareFrom),
    close: span(age, RIFT.closeFrom, RIFT.endMs - RIFT.closeFrom),
  };
}

/** A row's crack: a point (x, y) every half cell from wall to wall, wobbling about its middle. */
export function crackPath(width: number, random: () => number): Float32Array {
  const points = width * 2 + 1;
  const path = new Float32Array(points * 2);
  for (let i = 0; i < points; i++) {
    path[i * 2] = i / 2;
    path[i * 2 + 1] = 0.5 + (random() * 2 - 1) * RIFT_WOBBLE;
  }
  return path;
}

/** The crack's height at `x` cells along its row. */
export function crackY(path: Float32Array, x: number): number {
  const last = path.length / 2 - 1;
  const at = Math.max(0, Math.min(last, x * 2));
  const i = Math.min(last - 1, Math.floor(at));
  return path[i * 2 + 1]! + (path[i * 2 + 3]! - path[i * 2 + 1]!) * (at - i);
}

/**
 * The crack that joins the rows of a clear of several lines at its origin
 * (1.44): its x every half row, from the top of the first row.
 */
export function joinPath(rows: number, origin: number, random: () => number): Float32Array {
  return Float32Array.from({ length: rows * 2 + 1 }, () => origin + (random() - 0.5) * 0.4);
}

/** A piece of a cleared row: one or two blocks of one piece, above or below the crack. */
export interface RiftChunk {
  /** The blocks it holds: columns `x0` (included) to `x1` (excluded). */
  readonly x0: number;
  readonly x1: number;
  readonly upper: boolean;
  /** Its centre, in cells from the row's top-left corner. */
  readonly pivotX: number;
  readonly pivotY: number;
  /** The crack's height under (or over) its centre: where the seam swallows it. */
  readonly seamY: number;
  /** How far it turns once swallowed (radians). */
  readonly turn: number;
  /** Its outline, x/y pairs in cells from the row's top-left corner. */
  readonly outline: Float32Array;
}

/**
 * A row's runs: one or two blocks, never across two pieces (`links`: each
 * block's east and west bits). Empty cells belong to none.
 */
export function riftRuns(
  tones: Uint8Array,
  links: Uint8Array,
  random: () => number,
): (readonly [number, number])[] {
  const runs: (readonly [number, number])[] = [];
  const width = tones.length;
  let x = 0;
  while (x < width) {
    if (tones[x] === Tone.Empty) {
      x++;
      continue;
    }
    let end = x + 1;
    while (end < width && tones[end] !== Tone.Empty && (links[end - 1]! & LINK.east) !== 0) end++;
    for (let from = x; from < end;) {
      const length = Math.min(end - from, random() < 0.5 ? 1 : 2);
      runs.push([from, from + length]);
      from += length;
    }
    x = end;
  }
  return runs;
}

/** Where two runs meet (columns, the walls excluded): light shows there as the row splits. */
export function riftSeams(runs: readonly (readonly [number, number])[], width: number): number[] {
  return runs.map(([, x1]) => x1).filter((x) => x < width);
}

/**
 * The pieces of a row, cut along its crack: `path` holds x/y pairs every half
 * cell, from the left wall (x = 0) to the right one.
 */
export function riftChunks(
  runs: readonly (readonly [number, number])[],
  path: Float32Array,
  random: () => number,
): RiftChunk[] {
  const chunks: RiftChunk[] = [];
  for (const [x0, x1] of runs) {
    const first = x0 * 2;
    const last = x1 * 2;
    const upper = [x0, 0, x1, 0];
    for (let i = last; i >= first; i--) upper.push(path[i * 2]!, path[i * 2 + 1]!);
    const lower: number[] = [];
    for (let i = first; i <= last; i++) lower.push(path[i * 2]!, path[i * 2 + 1]!);
    lower.push(x1, 1, x0, 1);
    // The crack under the run's middle (x = (x0 + x1) / 2, so point x0 + x1).
    const seamY = path[(x0 + x1) * 2 + 1]!;
    const pivotX = (x0 + x1) / 2;
    chunks.push({
      x0,
      x1,
      upper: true,
      pivotX,
      pivotY: seamY / 2,
      seamY,
      turn: (random() * 2 - 1) * 0.16,
      outline: Float32Array.from(upper),
    });
    chunks.push({
      x0,
      x1,
      upper: false,
      pivotX,
      pivotY: (seamY + 1) / 2,
      seamY,
      turn: (random() * 2 - 1) * 0.16,
      outline: Float32Array.from(lower),
    });
  }
  return chunks;
}

/** How a piece is lit at a moment: its opacity, the rift's glow on it, its share of a style's tint. */
export interface PieceLight {
  readonly alpha: number;
  /** How much of the rift's glow it takes, 0 to 1. */
  readonly glow: number;
  /** How much of a shatter style's colour it takes, 0 to 1: it shows as the row splits. */
  readonly tint: number;
}

/** How much of a shatter style's colour a piece takes once the row has split. */
const TINT = 0.6;

/**
 * A piece's light: it heats as the row splits, glows as the seam draws it in.
 * With `still` (calmer effects) it fades where it is.
 */
export function pieceLight(phase: RiftPhase, still: boolean): PieceLight {
  return {
    alpha: still ? 1 - phase.swallow : 1 - 0.45 * phase.swallow,
    glow: still ? 0.3 * phase.split : 0.5 * phase.swallow + 0.18 * phase.split,
    tint: TINT * phase.split,
  };
}

/** Where a piece is drawn at a moment: moved, turned and squashed about its centre. */
export interface ChunkPose {
  /** Down, in cells. */
  readonly dy: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly turn: number;
}

const STILL_POSE: ChunkPose = { dy: 0, scaleX: 1, scaleY: 1, turn: 0 };

/**
 * A piece's pose: the halves part at the split, then the seam draws each
 * piece in, squashed onto it. With `still` nothing moves.
 */
export function chunkPose(chunk: RiftChunk, phase: RiftPhase, still: boolean): ChunkPose {
  if (still) return STILL_POSE;
  const part = PART * phase.split * (1 - phase.swallow);
  return {
    dy: (chunk.upper ? -part : part) + (chunk.seamY - chunk.pivotY) * phase.swallow,
    scaleX: 1 - 0.3 * phase.swallow,
    scaleY: 1 - phase.swallow,
    turn: chunk.turn * phase.swallow,
  };
}

/**
 * A block's half on the Tower's glass (1.44), where the pieces only squash:
 * the band it covers in its cell (0 its top, 1 its bottom), its far edge
 * drawn in to the seam at `cut` as the rift swallows it.
 */
export function halfBand(
  upper: boolean,
  cut: number,
  phase: RiftPhase,
  still: boolean,
): { top: number; height: number } {
  const part = still ? 0 : PART * phase.split * (1 - phase.swallow);
  const k = still ? 0 : phase.swallow;
  return upper
    ? { top: cut * k - part, height: cut * (1 - k) }
    : { top: cut + part, height: (1 - cut) * (1 - k) };
}

/** The seam's light at a moment: its width (cells) and its strength (0 to 1). */
export function seamLight(phase: RiftPhase, still: boolean): { width: number; strength: number } {
  const part = still ? 0 : PART * phase.split * (1 - phase.swallow);
  return {
    width: (2 * part + 0.05 + (still ? 0 : 0.18 * phase.flare)) * (1 - phase.close),
    strength: (0.75 + 0.25 * phase.swallow) * (1 - phase.close),
  };
}

/** Light between the pieces at the split, 0 to 1: gone once they are swallowed. */
export function leakLight(phase: RiftPhase, still: boolean): number {
  return (still ? 0.5 : 1) * phase.split * (1 - phase.swallow);
}

/** A RIFT!'s opening (four lines), 0 to 1: the seams open into one light, then it fades. */
export function openingLight(age: number): number {
  return span(age, RIFT.swallowFrom, 90) * (1 - span(age, RIFT.flareFrom + 10, 120));
}
