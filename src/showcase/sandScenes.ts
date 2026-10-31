import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { SandGame } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import type { ElementTone } from '@/families/sand/engine/Elements';
import { PAIRS_SCRIPT } from '@/families/sand/engine/Showcase';
import { SandSession } from '@/families/sand/SandSession';
import type { Scene } from './Scene';

/** Where the first piece of each pair goes, in cells from where it appears. */
const AIMS = [-3, 3, 0, -2, 2] as const;
/** A piece is seen for this long before it moves, then dropped a moment later (ms). */
const LOOK_MS = 320;
const DROP_MS = 520;

/** Moves the falling piece by whole cells (negative: to the left). */
function slide(session: SandSession, cells: number): void {
  for (let i = 0; i < Math.abs(cells); i++) {
    session.execute({ type: 'move', direction: cells < 0 ? -1 : 1 });
  }
}

/** The Sand's elements: lightning through water (the shock), fire on oil (the blaze), a vine. */
export function elements(variant = 0): Scene {
  const script = PAIRS_SCRIPT;
  const game = new SandGame({
    random: new SeededRandom(17 + variant),
    hazards: false,
    script,
    bed: { rows: 7.2, variant },
  });
  const session = new SandSession('sand', game);
  let since = 0;
  let aimed = false;
  const off = session.onGame('spawn', () => {
    since = 0;
    aimed = false;
  });
  const drive = (delta: number) => {
    if (!game.active) return;
    since += delta;
    if (!aimed && since >= LOOK_MS) {
      aimed = true;
      // The second piece of a pair lands where it appears: on the first one.
      const above = script.find((piece) => piece.at === game.rank)?.above ?? false;
      slide(session, above ? 0 : AIMS[(game.rank + variant) % AIMS.length]!);
    }
    if (since >= DROP_MS) session.execute({ type: 'hardDrop' });
  };
  return {
    session,
    drive,
    dispose: () => {
      off();
      session.dispose();
    },
  };
}

/** The bolt falls this long after the Wyrm comes out (ms). */
const BOLT_AFTER_MS = 450;

/** The Dune Wyrm: red cracks, it bursts out of the sand, a lightning bolt on its bare head. */
export function duneWorm(): Scene {
  const game = new SandGame({
    random: new SeededRandom(3),
    hazards: false,
    boss: 'duneWorm',
    bossDelayMs: 0,
    script: [{ at: 3, tone: Tone.Lightning, type: 'O' }],
    bed: { rows: 8.4, variant: 1 },
  });
  const session = new SandSession('sand', game);
  const wyrm = game.worm!;
  // Two pieces of sand while it gathers under the cracks; the bolt waits for its head.
  const drops = [
    { atMs: 450, cells: 2 },
    { atMs: 1150, cells: -3 },
  ];
  let clock = 0;
  let outAt: number | null = null;
  let struck = false;
  const drive = (delta: number) => {
    clock += delta;
    const drop = drops[0];
    if (drop && clock >= drop.atMs) {
      drops.shift();
      slide(session, drop.cells);
      session.execute({ type: 'hardDrop' });
    }
    // It is seen out of the sand, its weak point glowing, before the bolt falls.
    if (wyrm.exposed) outAt ??= clock;
    const bolt = game.active;
    if (struck || outAt === null || clock < outAt + BOLT_AFTER_MS) return;
    if (bolt?.tone !== Tone.Lightning) return;
    struck = true;
    // Right above its head (an O is two cells wide), then down.
    slide(session, Math.round((wyrm.headX - (bolt.x + GRAINS_PER_CELL)) / GRAINS_PER_CELL));
    session.execute({ type: 'hardDrop' });
  };
  return { session, drive, dispose: () => session.dispose() };
}

/*
 * The clip factory's scenes (1.39): longer than the reel's, so that a clip of
 * 7 to 15 s sees the pile build up before its moment. The pieces come at a
 * calmer pace, and each scene has three variants (its bed, its seed, where
 * its sand goes), so that a returning element never shows the same clip.
 */

/** A clip's pieces are seen for this long before they move, then dropped a moment later (ms). */
const CLIP_LOOK_MS = 450;
const CLIP_DROP_MS = 760;
/** The sand laid before the elements, by variant: where each piece goes, in cells from where it appears. */
const BUILD_AIMS = [
  [-4, 3, -1],
  [3, -4, 1],
  [-3, 4, 0],
] as const;
/** A pool: two long pieces side by side across the middle of the well. */
const POOL_AIMS = [-2, 2] as const;

/** A well whose falling pieces go where `aims` says, rank after rank, then drop. */
function aimedScene(game: SandGame, aims: readonly number[], stopAt = Infinity): Scene {
  const session = new SandSession('sand', game);
  let since = 0;
  let aimed = false;
  const off = session.onGame('spawn', () => {
    since = 0;
    aimed = false;
  });
  const drive = (delta: number) => {
    // A challenge's decision: the piece waits, the factory freezes the frame.
    if (!game.active || game.rank >= stopAt) return;
    since += delta;
    if (!aimed && since >= CLIP_LOOK_MS) {
      aimed = true;
      slide(session, aims[game.rank - 1] ?? 0);
    }
    if (since >= CLIP_DROP_MS) session.execute({ type: 'hardDrop' });
  };
  return {
    session,
    drive,
    dispose: () => {
      off();
      session.dispose();
    },
  };
}

/** The pool's element and what sets it off: oil and fire (the blaze), water and lightning (the shock). */
interface PoolStaging {
  readonly pool: ElementTone;
  readonly spark: ElementTone;
}

/** Sand builds up, a pool of one element lies across it, the other drops onto it. */
function poolScene({ pool, spark }: PoolStaging, variant: number): Scene {
  const build = BUILD_AIMS[variant % BUILD_AIMS.length]!;
  const first = build.length + 1;
  const game = new SandGame({
    random: new SeededRandom(31 + variant * 7),
    hazards: false,
    script: [
      { at: first, tone: pool, type: 'I' },
      { at: first + 1, tone: pool, type: 'I' },
      // Right above the pool's second piece: it lands in the middle of the pool.
      { at: first + 2, tone: spark, type: 'O', above: true },
    ],
    // Six bands of sand under the pool: a shock or a blaze as large as the moment was staged.
    bed: { rows: 6, variant },
  });
  return aimedScene(game, [...build, ...POOL_AIMS, 0]);
}

/** Fire lands on a pool of oil and the whole pool blazes (the week of fire). */
export function fireOnOil(variant = 0): Scene {
  return poolScene({ pool: Tone.Oil, spark: Tone.Fire }, variant);
}

/** Lightning falls into a pool of water and shocks every colour it touches. */
export function lightningInWater(variant = 0): Scene {
  return poolScene({ pool: Tone.Water, spark: Tone.Lightning }, variant);
}

/** A challenge's two answers, where the fire goes: on the oil (A) or on the water (B). */
export type FireChoice = 'A' | 'B';
/**
 * Where the pieces go, in cells from where they appear: a square of sand in
 * the middle as a wall, oil on its left, water on its right; the fire goes
 * over one or the other.
 */
const CHOICE_AIMS = { wall: 0, oil: -3, water: 3, A: -3, B: 3 } as const;
/**
 * The challenge's three variants. The seed 2 leaves a gap under its water
 * that lets the fire through to the sand: the answer must stay clear.
 */
const CHOICE_SEEDS = [0, 1, 3] as const;

/**
 * The fire challenge: a pool of oil and a pool of water, a wall of sand
 * between them, then a piece of fire at the top. Without a choice, the scene
 * stops at that decision (the factory freezes it, with its A and B); with
 * one, the fire goes there: the oil blazes (A) or the water puts it out (B),
 * and the engine counts what burns.
 */
export function fireChoice(variant = 0, choice: FireChoice | null = null): Scene {
  const seed = CHOICE_SEEDS[variant % CHOICE_SEEDS.length]!;
  const build = BUILD_AIMS[seed % BUILD_AIMS.length]!.slice(0, 2);
  const first = build.length + 1;
  const fire = first + 3;
  const game = new SandGame({
    random: new SeededRandom(53 + seed * 11),
    hazards: false,
    script: [
      { at: first, tone: Tone.ChromaB, type: 'O' },
      { at: first + 1, tone: Tone.Oil, type: 'I' },
      { at: first + 2, tone: Tone.Water, type: 'I' },
      { at: fire, tone: Tone.Fire, type: 'O' },
    ],
    bed: { rows: 6, variant: seed },
  });
  const { wall, oil, water } = CHOICE_AIMS;
  const aims = [...build, wall, oil, water, choice ? CHOICE_AIMS[choice] : 0];
  return aimedScene(game, aims, choice ? Infinity : fire);
}

export const SAND_SCENES = {
  elements,
  duneWorm,
  fireOnOil,
  lightningInWater,
  fireChoice,
} as const;
