import { FRAME_MS } from '@/campaign/curve/CurveBot';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import { CURVE_PLAYERS } from '@/campaign/curve/CurvePlayers';
import { SeededRandom } from '@/core/Random';
import { createSandSession } from '@/families/sand';
import { GameTracker } from '@/progression/GameReport';
import type { ElementName } from '@/session/Elements';

/** A free game of Sand as the bot played it, the week's element featured (1.36). */
export interface SandWeekGame {
  readonly durationMs: number;
  /** The featured element's deeds in it. */
  readonly deeds: number;
}

/** A free game is cut here: the rate of deeds is what counts, not how long the bot holds on. */
export const SAND_GAME_CAP_MS = 3 * 60_000;

/** Each player decides with its own draws, the same for a seed. */
const DECISIONS = 0x2545f491;

/** One free game of Sand, played frame by frame by the curve bot's Sand player. */
export function playSandWeek(
  skill: PlayerSkill,
  seed: number,
  featured: ElementName,
): SandWeekGame {
  const session = createSandSession('sand', {
    random: new SeededRandom(seed),
    timeLimitMs: null,
    featuredElement: featured,
  });
  const player = CURVE_PLAYERS.sand({
    session,
    skill,
    random: new SeededRandom(seed ^ DECISIONS),
    goal: null,
  });
  const tracker = new GameTracker(session);
  // Set from the session's event: an object, so that the loop reads it afresh.
  const ending = { over: false };
  const off = session.events.on('over', () => (ending.over = true));
  session.start();
  for (let t = 0; !ending.over && t < SAND_GAME_CAP_MS; t += FRAME_MS) {
    player.update(FRAME_MS);
    if (session.state === 'running') tracker.tick(FRAME_MS);
    session.update(FRAME_MS);
  }
  const report = tracker.report({
    modeId: 'sand',
    daily: false,
    variant: null,
    reason: ending.over ? 'over' : 'cap',
  });
  off();
  player.dispose();
  tracker.dispose();
  session.dispose();
  return { durationMs: report.durationMs, deeds: report.elements?.[featured] ?? 0 };
}
