import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { SandGame } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
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
    bed: { share: 0.36, variant },
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
    bed: { share: 0.42, variant: 1 },
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

export const SAND_SCENES = { elements, duneWorm } as const;
