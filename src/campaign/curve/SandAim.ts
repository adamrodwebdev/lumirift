import { Tone } from '@/core/Tone';
import type { Rotation } from '@/families/falling/pieces/PieceType';
import { shapeCells } from '@/families/falling/pieces/Shapes';
import type { SandView } from '@/families/sand';
import { isElement } from '@/families/sand/engine/Elements';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import type { SandPiece } from '@/families/sand/engine/SandPiece';

/** Where a Sand player wants its piece: the left of its box (grains) and its turn. */
export interface SandPlan {
  readonly x: number;
  readonly rotation: Rotation;
}

const G = GRAINS_PER_CELL;
/** Elements that take sand away go where the pile is highest; the others fill the hollows. */
const DESTRUCTIVE: ReadonlySet<Tone> = new Set([Tone.Fire, Tone.Lightning, Tone.Acid]);
/** The partner an element looks for at the surface: lightning shocks water, fire lights oil. */
const PARTNER: Readonly<Partial<Record<Tone, Tone>>> = {
  [Tone.Lightning]: Tone.Water,
  [Tone.Fire]: Tone.Oil,
};
const isColour = (tone: number) => tone >= Tone.ChromaA && tone <= Tone.ChromaD;

/** The sand seen from above: each column's first grain (its row) and its tone. */
interface Surface {
  readonly top: Int16Array;
  readonly tone: Uint8Array;
}

function surfaceOf(view: SandView): Surface {
  const { grid } = view;
  const top = new Int16Array(grid.width).fill(grid.height);
  const tone = new Uint8Array(grid.width);
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const found = grid.get(x, y);
      if (found === Tone.Empty || found === Tone.Steam) continue;
      top[x] = y;
      tone[x] = found;
      break;
    }
  }
  return { top, tone };
}

/** The left of the box (grains) that puts the piece's middle over column `gx`, within the well. */
function centredOn(piece: SandPiece, gx: number, width: number): number {
  const cells = shapeCells(piece.type, piece.rotation);
  const left = Math.min(...cells.map((cell) => cell.x));
  const right = Math.max(...cells.map((cell) => cell.x));
  const middle = ((left + right + 1) * G) / 2;
  const x = Math.round((gx - middle) / G) * G;
  return Math.max(-left * G, Math.min(width - (right + 1) * G, x));
}

/** The middle of the highest stretch of sand among the columns chosen, or null. */
function highest(surface: Surface, chosen: (x: number) => boolean): number | null {
  let top = Infinity;
  let from = -1;
  let to = -1;
  for (let x = 0; x < surface.top.length; x++) {
    if (!chosen(x)) continue;
    const y = surface.top[x]!;
    if (y < top) {
      top = y;
      from = to = x;
    } else if (y === top && to === x - 1) to = x;
  }
  return from < 0 ? null : Math.round((from + to) / 2);
}

function lowest(surface: Surface): number {
  let best = 0;
  for (let x = 1; x < surface.top.length; x++) if (surface.top[x]! > surface.top[best]!) best = x;
  return best;
}

/**
 * Where an element works: lightning and fire on the Wyrm when it shows,
 * lightning on water and fire on oil, what removes sand on the highest
 * point, the rest in the hollows.
 */
function elementTarget(view: SandView, piece: SandPiece, surface: Surface): number {
  const worm = view.worm;
  const wormAt = worm?.warnAt ?? (worm?.exposed ? Math.round(worm.headX) : null);
  const hunts = piece.tone === Tone.Lightning || piece.tone === Tone.Fire;
  if (wormAt !== null && hunts) return wormAt;
  const partner = PARTNER[piece.tone];
  const partnerAt =
    partner === undefined ? null : highest(surface, (x) => surface.tone[x] === partner);
  if (partnerAt !== null) return partnerAt;
  if (!DESTRUCTIVE.has(piece.tone)) return lowest(surface);
  return highest(surface, () => true) ?? view.grid.width / 2;
}

/** A region of one colour reaching the surface: its colour and how far it spreads. */
interface Region {
  readonly tone: number;
  readonly from: number;
  readonly to: number;
}

/**
 * How a player who aims places a Sand piece (the rule as the screen tells
 * it): each colour where it stretches a region of its colour the most
 * toward both walls, low rather than high; each element where it works.
 */
export function aimSand(view: SandView, piece: SandPiece): SandPlan {
  const surface = surfaceOf(view);
  const { width } = view.grid;
  if (isElement(piece.tone)) {
    const target = elementTarget(view, piece, surface);
    return { x: centredOn(piece, target, width), rotation: piece.rotation };
  }
  const regions = regionsOf(view, surface);
  let best: SandPlan = { x: piece.x, rotation: piece.rotation };
  let bestScore = -Infinity;
  for (let turn = 0; turn < 4; turn++) {
    const rotation = ((piece.rotation + turn) % 4) as Rotation;
    const cells = shapeCells(piece.type, rotation);
    const left = Math.min(...cells.map((cell) => cell.x));
    const right = Math.max(...cells.map((cell) => cell.x));
    for (let x = -left * G; x + (right + 1) * G <= width; x += G) {
      const score = linkScore({ cells, x, tone: piece.tone, surface, regions, width });
      if (score > bestScore) {
        bestScore = score;
        best = { x, rotation };
      }
    }
  }
  return best;
}

/** The colour region under each column's surface grain, or null. */
function regionsOf(view: SandView, surface: Surface): (Region | null)[] {
  const { grid } = view;
  const W = grid.width;
  const byColumn: (Region | null)[] = new Array<Region | null>(W).fill(null);
  for (let x = 0; x < W; x++) {
    if (byColumn[x] || !isColour(surface.tone[x]!) || surface.top[x]! >= grid.height) continue;
    const grains = grid.connected(surface.top[x]! * W + x);
    let from = W;
    let to = -1;
    const members = new Set(grains);
    for (const i of grains) {
      from = Math.min(from, i % W);
      to = Math.max(to, i % W);
    }
    const region: Region = { tone: surface.tone[x]!, from, to };
    for (let column = x; column < W; column++) {
      if (members.has(surface.top[column]! * W + column)) byColumn[column] = region;
    }
  }
  return byColumn;
}

interface LinkSpot {
  readonly cells: readonly { x: number; y: number }[];
  readonly x: number;
  readonly tone: number;
  readonly surface: Surface;
  readonly regions: readonly (Region | null)[];
  readonly width: number;
}

/** How far a spot stretches its colour between the walls (a link is worth most), less its height. */
function linkScore({ cells, x, tone, surface, regions, width }: LinkSpot): number {
  const columns = new Map<number, number>();
  for (const cell of cells) columns.set(cell.x, Math.max(columns.get(cell.x) ?? 0, cell.y));
  let land = Infinity;
  for (const [cx, cy] of columns) {
    for (let gx = x + cx * G; gx < x + (cx + 1) * G; gx++) {
      land = Math.min(land, surface.top[gx]! - (cy + 1) * G);
    }
  }
  const left = x + Math.min(...columns.keys()) * G;
  const right = x + (Math.max(...columns.keys()) + 1) * G - 1;
  // The grains spread about a cell on each side as they settle.
  let from = Math.max(0, left - G);
  let to = Math.min(width - 1, right + G);
  for (let gx = from; gx <= to; gx++) {
    const region = regions[gx];
    if (region?.tone !== tone) continue;
    from = Math.min(from, region.from);
    to = Math.max(to, region.to);
  }
  const span = (to - from + 1) / width;
  const links = from === 0 && to === width - 1 ? 1 : 0;
  return span + 2 * links + 0.05 * (land / G);
}
