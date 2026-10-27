import { SeededRandom, type RandomSource } from '@/core/Random';
import { AI_PROFILES, AiPlayer } from '@/families/falling/ai/AiPlayer';
import type { FallingSession } from '@/families/falling/FallingSession';

/** Always the same draws: the bag deals I O T S Z J L, so a well opens with an I. */
export class FixedRandom implements RandomSource {
  next(): number {
    return 0.999;
  }
  nextInt(max: number): number {
    return Math.floor(0.999 * max);
  }
}

/** The colours of a stack drawn in '#': patches the size of a piece, as a game leaves them. */
export function painted(rows: readonly string[]): string[] {
  const letters = 'ITOSZJL';
  return rows.map((row, y) =>
    row.replace(/#/g, (_mark, x: number) => letters[((x >> 1) + (y >> 1) * 3) % letters.length]!),
  );
}

/** The falling family's best AI plays the session, quick to think unless the scene asks it to wait. */
export function autoplay(
  session: FallingSession,
  thinkMs = 90,
): {
  readonly drive: (deltaMs: number) => void;
  readonly dispose: () => void;
} {
  const player = new AiPlayer(session, { ...AI_PROFILES.expert, thinkMs }, new SeededRandom(4));
  const detach = player.attach();
  return { drive: (delta) => player.update(delta), dispose: detach };
}
