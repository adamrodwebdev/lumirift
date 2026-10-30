import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { PhoneGestures } from '@/families/falling/input/phone/PhoneGestures';
import {
  CELL,
  edgeJitter,
  flickUp,
  Hand,
  hurriedSwipe,
  type Intent,
  moveThenFlick,
  quickSoftDescent,
  quickTap,
  replay,
  type Screen,
  shakyTap,
  slantedSoftDrag,
  SURFACE,
  thumbArc,
} from './gestureTraces';

/*
 * The gate of the phone gestures (lot 23), on recorded human-like touches:
 * the command meant 99 times in 100 for each case, and at most one hard drop
 * by accident in 500 touches that are no drop; on 60 and 120 Hz screens, and
 * on a page loading an ad in a browser that merges the samples of its long
 * tasks (Firefox on Android, Safari before iOS 18.2; Chrome keeps them all,
 * so it plays as a quiet page).
 *
 * One limit there, measured at about 2.5 %: a long task that swallows both the
 * end of a sideways drag and the start of the flick leaves one jump, and the
 * drag's last cell cannot be told from the flick's arc. The piece then drops
 * a cell short; it never drops by accident.
 *
 * Since 1.40, a second one, chosen: a jump a busy page merged could as well be
 * a quick soft drag, so a drop read at the lift takes the jump as it moved, not
 * as a stroke from rest. About 6 to 8 % of the flicks right after a move are
 * then missed on such a page (the piece is not dropped, the player flicks
 * again), and no quick soft descent is dropped by accident: one costs more
 * than the other.
 */
const SCREENS: readonly Screen[] = [
  { hz: 60, freeze: false },
  { hz: 120, freeze: false },
  { hz: 60, freeze: true },
  { hz: 120, freeze: true },
];

const TOUCHES = 1000;
const CASES = {
  quickTap,
  moveThenFlick,
  flickUp,
  thumbArc,
  edgeJitter,
  hurriedSwipe,
  quickSoftDescent,
} as const;
const NO_DROPS = [
  slantedSoftDrag,
  thumbArc,
  shakyTap,
  edgeJitter,
  quickSoftDescent,
  slantedSoftDrag,
] as const;

/** The misses allowed in 1000 touches: 1 %, but for the merged drag and flick of a busy page (8 %). */
const allowed = (name: string, { freeze }: Screen) =>
  freeze && name === 'moveThenFlick' ? 80 : TOUCHES / 100;

const seed = (name: string, { hz, freeze }: Screen) =>
  SeededRandom.fromString(`${name}:${hz}:${freeze}`);

function play(intent: Intent, screen: Screen, hand: Hand): FallingCommand[] {
  const commands: FallingCommand[] = [];
  const gestures = new PhoneGestures({
    execute: (command) => commands.push(command),
    cellSize: () => CELL,
    prefs: () => ({ dragSpeed: 1, tapSides: true, flicks: true }),
    bounds: () => SURFACE,
    pieces: { entered: 1, inPlay: true },
    secondFingerTurns: true,
  });
  replay(intent.trace, gestures, screen, hand);
  return intent.softDropsAside
    ? commands.filter(({ type }) => type !== 'softDrop' && type !== 'softStep')
    : commands;
}

describe.each(SCREENS)('the phone gestures at $hz Hz (a page loading an ad: $freeze)', (screen) => {
  it.each(Object.entries(CASES))('%s: the command meant, 99 times in 100', (name, make) => {
    const hand = new Hand(seed(name, screen), screen.hz);
    const misses: string[] = [];
    for (let i = 0; i < TOUCHES; i++) {
      const intent = make(hand);
      const commands = play(intent, screen, hand);
      if (JSON.stringify(commands) !== JSON.stringify(intent.meant))
        misses.push(`${JSON.stringify(intent.meant)} → ${JSON.stringify(commands)}`);
    }
    expect(misses.length, misses.slice(0, 4).join('\n')).toBeLessThanOrEqual(allowed(name, screen));
  });

  it('drops by accident at most once in 500 touches that are no drop', () => {
    const hand = new Hand(seed('noDrop', screen), screen.hz);
    let drops = 0;
    for (let i = 0; i < 5 * TOUCHES; i++) {
      const make = NO_DROPS[i % NO_DROPS.length]!;
      if (play(make(hand), screen, hand).some(({ type }) => type === 'hardDrop')) drops++;
    }
    expect(drops).toBeLessThanOrEqual(TOUCHES / 100);
  });
});
