import { Board } from '@/families/falling/board/Board';
import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { FlipMode } from '@/families/falling/modes/FlipMode';
import { MirrorMode } from '@/families/falling/modes/MirrorMode';
import { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import { TILT_WELL, TiltMode } from '@/families/falling/modes/TiltMode';
import type { EngineModeId } from '@/session/ModeId';
import { autoplay, FixedRandom, painted } from './autoplay';
import type { Scene } from './Scene';

/** A cleared line stays on screen this long before the next piece (ms), as in a game. */
const CLEAR_DELAY_MS = 280;

/**
 * A well that turns (flip, tilt, mirror): the stack is seen for a moment,
 * the well turns, then the AI plays on what is left.
 */
function turningWell(
  modeId: EngineModeId,
  game: Game,
  turnAtMs: number,
  turn: (session: FallingSession) => void,
): Scene {
  const session = new FallingSession(modeId, game);
  const hand = autoplay(session);
  let clock = 0;
  return {
    session,
    drive: (delta) => {
      const before = clock;
      clock += delta;
      if (before < turnAtMs && clock >= turnAtMs) turn(session);
      if (clock >= turnAtMs) hand.drive(delta);
    },
    dispose: () => {
      hand.dispose();
      session.dispose();
    },
  };
}

/**
 * Flip: a stack full of holes; the well turns upside down, every column
 * settles, and the four rows it fills clear at once.
 */
export function flip(): Scene {
  // Every column holds at least four blocks: once settled, four rows are full.
  const rows = painted([
    '...#......',
    '#..#...#..',
    '##...#.#..',
    '.###.##.##',
    '#.###..###',
    '##..#####.',
    '.#####.#.#',
    '#.##.##.##',
    '##.##.###.',
  ]);
  const game = new Game(new FlipMode(), {
    random: new FixedRandom(),
    board: Board.fromRows(rows),
    lineClearDelayMs: CLEAR_DELAY_MS,
  });
  return turningWell('flip', game, 800, (session) => session.execute({ type: 'ability' }));
}

/**
 * Tilt: a stack built up the left wall; the well turns a quarter, the wall
 * becomes the floor, and the two rows it fills clear.
 */
export function tilt(): Scene {
  // Every row holds at least two blocks: once turned, the floor's two rows are full.
  const rows = painted([
    '##..........',
    '##..........',
    '##..........',
    '##..........',
    '###.........',
    '###.........',
    '####........',
    '###.........',
    '###......#..',
    '####.##.##.#',
    '#####.######',
    '####.#######',
  ]);
  const game = new Game(new TiltMode(), {
    random: new FixedRandom(),
    board: Board.fromRows(rows, TILT_WELL.width, TILT_WELL.height),
    lineClearDelayMs: CLEAR_DELAY_MS,
  });
  return turningWell('tilt', game, 900, () => game.tiltWell());
}

/** Mirror: a ramp with its well on the left; reflected, the AI clears it on the right. */
export function mirror(): Scene {
  const rows = painted([
    '........##',
    '.......###',
    '.....#####',
    '....######',
    '...#######',
    '.#########',
    '.#########',
  ]);
  const game = new Game(new MirrorMode(), {
    random: new FixedRandom(),
    board: Board.fromRows(rows),
    lineClearDelayMs: CLEAR_DELAY_MS,
  });
  return turningWell('mirror', game, 700, () => game.mirrorWell());
}

/** The Heart of the Rift swelling under the well; an I clears its shards' rows and wounds it. */
export function riftHeart(): Scene {
  const board = Board.fromRows([
    'T.........',
    'TT....S...',
    'TJJ..SS..L',
    'JJLLOOSZZ.',
    'IIIIOOZZL.',
    'SSLZZOOJL.',
  ]);
  // Two rows of rubble with a shard each, their hole in the same column as the stack's.
  board.pushGarbageRow(9, 2);
  board.pushGarbageRow(9, 6);
  // Already swelling: the holes of the next rows glow on the floor.
  const mode = new RiftHeartMode({ bossDelayMs: 1900 });
  const session = new FallingSession(
    'classic',
    new Game(mode, { random: new FixedRandom(), board, lineClearDelayMs: CLEAR_DELAY_MS }),
  );
  const hand = autoplay(session);
  return {
    session,
    drive: hand.drive,
    dispose: () => {
      hand.dispose();
      session.dispose();
    },
  };
}

export const FALLING_SCENES = { flip, tilt, mirror, riftHeart } as const;
