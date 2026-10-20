import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { SandGame } from './engine/SandGame';
import { SandSession } from './SandSession';

export { SandSession, type SandView } from './SandSession';

/** Entry point of the sand family chunk (see `ModeCatalog`). */
export function createSandSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'sand') throw new Error(`"${modeId}" is not a sand mode`);
  return new SandSession(
    modeId,
    new SandGame({
      random: options.random,
      timeLimitMs: options.timeLimitMs,
      hazards: options.calm !== true,
      ...(options.boosts ? { boosts: options.boosts } : {}),
    }),
  );
}
