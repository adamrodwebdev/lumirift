import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { SandGame, type ScriptedPiece } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL, SAND_TONES } from '@/families/sand/engine/SandGrid';
import { SandSession } from '@/families/sand/SandSession';
import type { Scene } from './Scene';

/** The pairs that react, in the order they play: shock, blaze, vine. */
const PAIRS: readonly (readonly [Tone, Tone])[] = [
  [Tone.Water, Tone.Lightning],
  [Tone.Oil, Tone.Fire],
  [Tone.Seed, Tone.Water],
];
/** Where the first piece of each pair goes, in cells from where it appears. */
const AIMS = [-3, 3, 0, -2, 2] as const;
/** A piece is seen for this long before it moves, then dropped a moment later (ms). */
const LOOK_MS = 320;
const DROP_MS = 520;

/**
 * The script of the elements: a pair at once (the first lightning lands
 * within two seconds), then a piece of sand and the next pair. Each pair's
 * second piece appears right above the first.
 */
function choreography(): ScriptedPiece[] {
  const pieces: ScriptedPiece[] = [];
  let at = 1;
  for (const [first, second] of PAIRS) {
    pieces.push({ at: at++, tone: first, type: 'I' });
    pieces.push({ at: at++, tone: second, type: 'O', above: true });
    at++; // a piece of sand, dealt by chance
  }
  return pieces;
}

/** Bands of coloured sand, each cut by another colour: the elements have something to work on. */
function sandBed(game: SandGame, share: number, variant: number): void {
  const { grid } = game;
  const rows = Math.round(grid.height * share);
  for (let y = 0; y < rows; y++) {
    const band = Math.floor(y / 6);
    const tone = SAND_TONES[(band + variant) % SAND_TONES.length]!;
    const cut = (band * 17 + 6 + variant * 11) % (grid.width - 8);
    const other = SAND_TONES[(band + variant + 2) % SAND_TONES.length]!;
    for (let x = 0; x < grid.width; x++) {
      grid.put(x, grid.height - 1 - y, x >= cut && x < cut + 7 ? other : tone, (x * 7 + y) & 3);
    }
  }
}

/** Moves the falling piece by whole cells (negative: to the left). */
function slide(session: SandSession, cells: number): void {
  for (let i = 0; i < Math.abs(cells); i++) {
    session.execute({ type: 'move', direction: cells < 0 ? -1 : 1 });
  }
}

/** The Sand's elements: lightning through water (the shock), fire on oil (the blaze), a vine. */
export function elements(variant = 0): Scene {
  const script = choreography();
  const game = new SandGame({ random: new SeededRandom(17 + variant), hazards: false, script });
  sandBed(game, 0.36, variant);
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
  });
  sandBed(game, 0.42, 1);
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

export const SAND_SCENES = { elements, duneWorm } as const;
