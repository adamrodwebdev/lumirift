import { SeededRandom } from '@/core/Random';
import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { RaceSession } from './RaceSession';
import { openWorld } from './RaceWorlds';

export {
  RaceSession,
  type RaceEventMap,
  type RaceStage,
  type RaceWarning,
  type TimeReason,
} from './RaceSession';
export { RACE_WORLDS, type RaceWorld } from './rules/ShiftSchedule';

/** Entry point of the rift family chunk (see `ModeCatalog`): the Rift Race. */
export function createRaceSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'race') throw new Error(`"${modeId}" is not a rift mode`);
  return new RaceSession(openWorld, new SeededRandom(options.random.nextInt(2 ** 32)));
}
