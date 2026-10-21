import type { RandomSource } from '@/core/Random';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { AI_PROFILES, AiPlayer } from '@/families/falling/ai/AiPlayer';
import { Board } from '@/families/falling/board/Board';
import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import type { OfferedPiece } from '@/families/placement/engine/Dealer';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame, type SlotId } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { PlacementSession } from '@/families/placement/PlacementSession';
import { SandGame } from '@/families/sand/engine/SandGame';
import { SAND_TONES } from '@/families/sand/engine/SandGrid';
import { SandPiece } from '@/families/sand/engine/SandPiece';
import { SandSession } from '@/families/sand/SandSession';
import { TowerMode } from '@/families/volume/TowerMode';
import type { GameSession } from '@/session/GameSession';

/**
 * The scenes of the preview videos (1.17): real games of the real engines,
 * set up to show within a few seconds what no other game of the genre has,
 * the elements of the Sand and the four Guardians of the rift, then played
 * by the AI (falling, Tower) or by a script (Sand, Mosaic). The engines'
 * private state is set here only to stage a moment; nothing is faked.
 */
export interface Scene {
  readonly session: GameSession;
  /** Called every frame: the player's moves. */
  readonly drive: (deltaMs: number) => void;
}

/** Always the same draws: the bag deals I O T S Z J L, so a well opens with an I. */
class FixedRandom implements RandomSource {
  next(): number {
    return 0.999;
  }
  nextInt(max: number): number {
    return Math.floor(0.999 * max);
  }
}

const TONES: Readonly<Record<string, Tone>> = {
  I: Tone.I,
  O: Tone.O,
  T: Tone.T,
  S: Tone.S,
  Z: Tone.Z,
  J: Tone.J,
  L: Tone.L,
};

/** Writes a private field of an engine, to stage a moment. */
const stage = (target: object, fields: Record<string, unknown>) => Object.assign(target, fields);

/** A well drawn in letters (one per tone, '.' empty), bottom row last. */
function well(rows: readonly string[], width: number, visible: number, wraps = false): Board {
  const board = new Board(width, visible, Board.HIDDEN_ROWS, wraps);
  const set = (board as unknown as { set(x: number, y: number, tone: Tone): void }).set.bind(board);
  const top = board.height - rows.length;
  rows.forEach((row, r) => {
    for (let x = 0; x < width; x++) {
      const tone = TONES[row[x] ?? '.'];
      if (tone !== undefined) set(x, top + r, tone);
    }
  });
  return board;
}

const ai = (session: FallingSession) => {
  const player = new AiPlayer(session, { ...AI_PROFILES.expert, thinkMs: 90 }, new SeededRandom(4));
  player.attach();
  return (delta: number) => player.update(delta);
};

/** Bands of coloured sand, every one cut by another colour: the elements land on them. */
function sandBands(game: SandGame, rows: number): void {
  const { grid } = game;
  for (let y = 0; y < rows; y++) {
    const index = Math.floor(y / 6);
    const band = SAND_TONES[index % SAND_TONES.length]!;
    const cut = (index * 17 + 6) % 48;
    for (let x = 0; x < grid.width; x++) {
      const tone = x >= cut && x < cut + 6 ? SAND_TONES[(index + 2) % SAND_TONES.length]! : band;
      grid.put(x, grid.height - 1 - y, tone, (x * 7 + y) & 3);
    }
  }
}

/** Drops the falling piece every `everyMs`, `count` times. */
function dropper(session: GameSession, everyMs: number, count: number) {
  let timer = 0;
  let drops = 0;
  return (delta: number) => {
    timer += delta;
    if (timer < everyMs || drops >= count) return;
    timer = 0;
    drops++;
    session.execute({ type: 'hardDrop' });
  };
}

/** The Sand's elements: lightning into water (the shock), then fire onto oil (the blaze). */
export function elements(): Scene {
  const game = new SandGame({
    random: new SeededRandom(3),
    hazards: false,
    script: [
      { at: 0, tone: Tone.Water, type: 'I' },
      { at: 1, tone: Tone.Lightning, type: 'O', above: true },
      { at: 2, tone: Tone.Oil, type: 'I' },
      { at: 3, tone: Tone.Fire, type: 'O', above: true },
    ],
  });
  sandBands(game, 60);
  const session = new SandSession('sand', game);
  return { session, drive: dropper(session, 650, 4) };
}

/** The Dune Wyrm: red cracks, it bursts out of the sand, a lightning bolt on its head. */
export function worm(): Scene {
  const game = new SandGame({ random: new SeededRandom(3), hazards: false, boss: 'duneWorm' });
  sandBands(game, 60);
  const session = new SandSession('sand', game);
  const wyrm = game.worm!;
  // It warns at once, instead of roaming first.
  stage(wyrm, { timer: 0 });
  let struck = false;
  const drive = () => {
    if (struck || !wyrm.exposed) return;
    struck = true;
    // A bolt dropped right above its bare head.
    const left = Math.round(wyrm.headX) - 6;
    stage(game, { _active: new SandPiece('O', Tone.Lightning, 0, 0).moved(left, 0) });
    game.hardDrop();
  };
  return { session, drive };
}

/** The Eye of the Tower charging its gaze, blinded by a bomb that goes off in it. */
export function eye(): Scene {
  const ring = (gap: number, tones: string) =>
    Array.from({ length: 20 }, (_, x) =>
      x >= gap && x < gap + 4 ? '.' : tones[x % tones.length]!,
    ).join('');
  const board = well(
    [ring(8, 'ITOSZJL'), ring(8, 'LJZSOTI'), ring(8, 'OSZTLIJ'), ring(8, 'ZJLOITS')],
    20,
    16,
    true,
  );
  // A bomb gem in the bottom ring, right under where the Eye looks.
  const bombs = (board as unknown as { bombs: Uint8Array }).bombs;
  bombs[(board.height - 1) * board.width + 12] = 1;
  const mode = new TowerMode({ boss: 'towerEye' });
  const session = new FallingSession(
    'tower',
    new Game(mode, { random: new FixedRandom(), board, lineClearDelayMs: 280 }),
    'volume',
  );
  // Face on, already charging.
  stage(mode.eye!, { _centre: 10.5, _state: 'charge', timer: 2400 });
  return { session, drive: ai(session) };
}

/** The Ceramic Golem throwing its stones while the player clears rows and columns. */
export function golem(): Scene {
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
  const game = new MosaicGame({ random: new SeededRandom(5), grid, boss: 'ceramicGolem' });
  const session = new PlacementSession('mosaic', game);
  const hand = () => (game as unknown as { hand: OfferedPiece[] }).hand;
  const plan: { slot: SlotId; x: number; y: number }[] = [
    { slot: 0, x: 2, y: 0 },
    { slot: 1, x: 5, y: 4 },
    { slot: 2, x: 0, y: 3 },
  ];
  let timer = 0;
  let step = 0;
  const drive = (delta: number) => {
    if (step === 0 && game.state === 'running') {
      const tones = [Tone.I, Tone.T, Tone.Z];
      ['#|#|#', '#|#|#', '########'].forEach((text, i) => {
        hand()[i] = { id: 900 + i, shape: Shape.parse(text), tone: tones[i]! };
      });
      game.events.emit('deal', { hand: [...hand()] });
      // It aims away from the planned moves, and throws after the first one.
      stage(game.golem!, {
        _targets: [
          { x: 6, y: 2 },
          { x: 2, y: 7 },
        ],
        _countdown: 1,
      });
      step = 1;
    }
    timer += delta;
    if (timer < 750 || step > plan.length) return;
    timer = 0;
    const move = plan[step - 1]!;
    session.execute({ type: 'place', slot: move.slot, x: move.x, y: move.y });
    step++;
  };
  return { session, drive };
}

/** The Heart of the Rift swelling under the well; an I clears its shards' rows and wounds it. */
export function heart(): Scene {
  const board = well(
    ['T.........', 'TT....S...', 'TJJ..SS..L', 'JJLLOOSZZ.', 'IIIIOOZZL.', 'SSLZZOOJL.'],
    10,
    20,
  );
  // Two rows of rubble with a shard each, their hole in the same column as the stack's.
  board.pushGarbageRow(9, 2);
  board.pushGarbageRow(9, 6);
  const mode = new RiftHeartMode();
  const session = new FallingSession(
    'classic',
    new Game(mode, { random: new FixedRandom(), board, lineClearDelayMs: 280 }),
  );
  // Already swelling: the holes of the next rows glow on the floor.
  stage(mode.heart!, { untilBeat: 1900 });
  return { session, drive: ai(session) };
}

export const SCENES = { elements, worm, eye, golem, heart } as const;
export type SceneName = keyof typeof SCENES;
