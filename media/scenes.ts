import type { RandomSource } from '@/core/Random';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { AI_PROFILES, AiPlayer } from '@/families/falling/ai/AiPlayer';
import { Board } from '@/families/falling/board/Board';
import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import type { OfferedPiece } from '@/families/placement/engine/Dealer';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame, type SlotId } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { PlacementSession } from '@/families/placement/PlacementSession';
import { SandGame } from '@/families/sand/engine/SandGame';
import { SandSession } from '@/families/sand/SandSession';
import { TowerMode } from '@/families/volume/TowerMode';
import type { GameSession } from '@/session/GameSession';

/**
 * The scenes of the preview videos: real games of the real engines, set up
 * to show the most spectacular moment of each family within four seconds,
 * then played by the AI (falling, Tower) or by a script (Sand, Mosaic).
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

/** Four rows waiting for an I in the right column: a four-line shatter at once. */
export function classic(): Scene {
  const board = well(
    [
      '..........',
      'T.........',
      'TT....S...',
      'TJJ..SS..L',
      'JJLLOOSZZ.',
      'IIIIOOZZL.',
      'SSLZZOOJL.',
      'SSLLZOOJJ.',
    ],
    10,
    20,
  );
  const session = new FallingSession(
    'classic',
    new Game(new ClassicMode(), { random: new FixedRandom(), board, lineClearDelayMs: 280 }),
  );
  return { session, drive: ai(session) };
}

/** The glass tower, rings almost full, turning to follow the AI. */
export function tower(): Scene {
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
  const session = new FallingSession(
    'tower',
    new Game(new TowerMode(), { random: new FixedRandom(), board, lineClearDelayMs: 280 }),
    'volume',
  );
  return { session, drive: ai(session) };
}

/** Bands of sand, one notch away from linking the walls; the pieces fill the notches. */
export function sand(): Scene {
  const game = new SandGame({ random: new SeededRandom(3) });
  const { grid } = game;
  const bands = [Tone.ChromaA, Tone.ChromaB, Tone.ChromaC, Tone.ChromaD];
  const H = grid.height;
  for (let y = 0; y < 42; y++) {
    const index = Math.floor(y / 6);
    const band = bands[index % bands.length]!;
    // Every band but the top one is cut by a block of another colour: none links the walls.
    const cut = index < 6 ? (index * 17 + 6) % 48 : -1;
    for (let x = 0; x < grid.width; x++) {
      // A notch in the top band, where the first piece lands.
      if (y >= 36 && x >= 24 && x < 36) continue;
      const tone = x >= cut && x < cut + 6 ? bands[(index + 2) % bands.length]! : band;
      grid.put(x, H - 1 - y, tone, (x * 7 + y) & 3);
    }
  }
  const queue = (game as unknown as { upcoming: { type: string; tone: Tone }[] }).upcoming;
  queue.push(
    { type: 'O', tone: bands[Math.floor(41 / 6) % bands.length]! },
    { type: 'I', tone: Tone.Fire },
    { type: 'O', tone: Tone.Water },
    { type: 'T', tone: Tone.ChromaB },
  );
  const session = new SandSession('sand', game);
  let timer = 0;
  let drops = 0;
  const drive = (delta: number) => {
    timer += delta;
    if (timer < 700 || drops >= 4) return;
    timer = 0;
    drops++;
    session.execute({ type: 'softDrop', active: true });
    if (drops > 1) session.execute({ type: 'move', direction: drops % 2 ? -1 : 1 });
    session.execute({ type: 'hardDrop' });
  };
  return { session, drive };
}

/** A ceramic board two pieces away from clearing rows and columns at once. */
export function mosaic(): Scene {
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
  // Glazed tiles of every colour (Grid.fromRows would lay grey ones).
  const grid = new Grid();
  const tile = Shape.parse('#');
  const glazes = [Tone.I, Tone.O, Tone.T, Tone.S, Tone.Z, Tone.J, Tone.L];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') grid.place(tile, x, y, glazes[(x * 3 + y * 5) % glazes.length]!);
    }
  });
  const game = new MosaicGame({ random: new SeededRandom(5), grid });
  const session = new PlacementSession('mosaic', game);
  // Read when needed: the game deals a new hand (a new array) when it starts.
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
      // The interface draws the hand it is told about.
      game.events.emit('deal', { hand: [...hand()] });
      step = 1;
    }
    timer += delta;
    if (timer < 900 || step > plan.length) return;
    timer = 0;
    const move = plan[step - 1]!;
    session.execute({ type: 'place', slot: move.slot, x: move.x, y: move.y });
    step++;
  };
  return { session, drive };
}

export const SCENES = { classic, tower, sand, mosaic } as const;
export type SceneName = keyof typeof SCENES;
