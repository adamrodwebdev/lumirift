import { Board } from '@/families/falling/board/Board';
import { FallingSession, type FallingCommand } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { FixedRandom, painted } from './autoplay';
import type { Scene } from './Scene';

/**
 * The moments the feel is judged on (lot 27, 1.41): a hard drop, one line, a
 * RIFT!, a combo, in the classic well, the same frames on every take. The
 * clip factory films them before and after a change of the effects, for the
 * two to be seen side by side (media/clips.ts, `FEEL_CLIPS`).
 */

/** A cleared line stays on screen this long before the next piece (ms), as in a game. */
const CLEAR_DELAY_MS = 280;

/** A command the hand plays, at its time since the scene started (ms). */
interface Cue {
  readonly at: number;
  readonly command: FallingCommand;
}

/** A classic game on a staged board; the bag deals I O T S Z J L. */
function classic(rows: readonly string[]): FallingSession {
  return new FallingSession(
    'classic',
    new Game(new ClassicMode(), {
      random: new FixedRandom(),
      board: Board.fromRows(painted(rows)),
      lineClearDelayMs: CLEAR_DELAY_MS,
    }),
  );
}

/** A hand that plays a script, each command at its time: the same moves on every take. */
function scripted(session: FallingSession, cues: readonly Cue[]): Scene {
  let clock = 0;
  let next = 0;
  return {
    session,
    drive: (delta) => {
      clock += delta;
      while (next < cues.length && cues[next]!.at <= clock) session.execute(cues[next++]!.command);
    },
    dispose: () => session.dispose(),
  };
}

const HARD_DROP: FallingCommand = { type: 'hardDrop' };
const TURN: FallingCommand = { type: 'rotate', direction: 1 };

/** Two hard drops from the top into an empty well: the I, then the O. */
export function feelDrop(): Scene {
  return scripted(classic([]), [
    { at: 600, command: HARD_DROP },
    { at: 1500, command: HARD_DROP },
  ]);
}

/** The I falls flat into the gap of the bottom row: one line. */
export function feelLine(): Scene {
  return scripted(classic(['##.....###', '###....###']), [{ at: 600, command: HARD_DROP }]);
}

/** The I, turned upright, falls into the shaft of four rows: a RIFT!. */
export function feelRift(): Scene {
  const row = '#####.####';
  return scripted(classic(['#..#...#..', row, row, row, row]), [
    { at: 450, command: TURN },
    { at: 700, command: HARD_DROP },
  ]);
}

/** A piece's moves: quarter turns clockwise, then columns (left below zero). */
interface Placement {
  readonly turns: number;
  readonly shift: number;
}

/** A piece every so often (ms): its turns, its moves, then the drop 0.3 s after. */
const PIECE_EVERY_MS = 750;

/** The cues of placements, one piece after the other from `startMs`. */
function placements(moves: readonly Placement[], startMs: number): Cue[] {
  return moves.flatMap(({ turns, shift }, i) => {
    const at = startMs + i * PIECE_EVERY_MS;
    const steps: FallingCommand[] = [
      ...Array.from({ length: turns }, () => TURN),
      ...Array.from({ length: Math.abs(shift) }, (): FallingCommand => ({
        type: 'move',
        direction: shift < 0 ? -1 : 1,
      })),
    ];
    return [
      ...steps.map((command, j) => ({ at: at + j * 50, command })),
      { at: at + 300, command: HARD_DROP },
    ];
  });
}

/**
 * A combo of five: in a well four columns wide (the stack holds the sides),
 * the I, O, T, S and Z each clear a line, played as the engine found they can.
 */
export function feelCombo(): Scene {
  const side = '###....###';
  const rows = [...Array.from({ length: 10 }, () => side), '####..####', '####...###'];
  return scripted(
    classic(rows),
    placements(
      [
        { turns: 0, shift: 0 },
        { turns: 0, shift: 0 },
        { turns: 3, shift: 2 },
        { turns: 0, shift: 0 },
        { turns: 1, shift: -1 },
      ],
      500,
    ),
  );
}

export const FEEL_SCENES = { feelDrop, feelLine, feelRift, feelCombo } as const;
