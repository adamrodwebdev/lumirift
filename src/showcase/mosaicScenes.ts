import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame, type SlotId } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { PlacementSession } from '@/families/placement/PlacementSession';
import type { Scene } from './Scene';

/** One placement every so often (ms), the pace of a player who knows the board. */
const PLACE_EVERY_MS = 750;

/** The Ceramic Golem throwing its stones while the player clears rows and columns. */
export function ceramicGolem(): Scene {
  const rows = [
    '##.#####',
    '##.#####',
    '##.###..',
    '........',
    '#####.##',
    '#####.##',
    '#####.##',
    '##.##.##',
  ];
  const grid = new Grid();
  const tile = Shape.parse('#');
  const glazes = [Tone.I, Tone.O, Tone.T, Tone.S, Tone.Z, Tone.J, Tone.L];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') grid.place(tile, x, y, glazes[(x * 3 + y * 5) % glazes.length]!);
    }
  });
  const game = new MosaicGame({
    random: new SeededRandom(5),
    grid,
    boss: 'ceramicGolem',
    opening: [
      { shape: Shape.parse('#|#|#'), tone: Tone.I },
      { shape: Shape.parse('#|#|#'), tone: Tone.T },
      { shape: Shape.parse('########'), tone: Tone.Z },
    ],
  });
  const session = new PlacementSession('mosaic', game);
  const golem = game.golem!;
  // Two rows, then three, then one: each placement clears.
  const plan: readonly { slot: SlotId; x: number; y: number }[] = [
    { slot: 0, x: 2, y: 0 },
    { slot: 1, x: 5, y: 4 },
    { slot: 2, x: 0, y: 3 },
  ];
  let aimed = false;
  let timer = 0;
  let step = 0;
  const drive = (delta: number) => {
    if (game.state !== 'running') return;
    if (!aimed) {
      // It aims away from the planned moves, and throws after the first one.
      aimed = true;
      golem.restore({
        health: golem.health,
        targets: [
          { x: 6, y: 2 },
          { x: 2, y: 7 },
        ],
        countdown: 1,
      });
    }
    timer += delta;
    const move = plan[step];
    if (timer < PLACE_EVERY_MS || !move) return;
    timer = 0;
    step++;
    session.execute({ type: 'place', slot: move.slot, x: move.x, y: move.y });
  };
  return { session, drive, dispose: () => session.dispose() };
}

export const MOSAIC_SCENES = { ceramicGolem } as const;
