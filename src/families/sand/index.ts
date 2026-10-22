import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { SandGame } from './engine/SandGame';
import { PRACTICE_ELEMENTS, PRACTICE_PACE, SHOWCASE } from './engine/Showcase';
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
      ...(options.showcase ? { script: SHOWCASE } : {}),
      ...(options.practice
        ? { wind: false, elements: PRACTICE_ELEMENTS, elementPace: PRACTICE_PACE }
        : {}),
      ...(options.boss === 'duneWorm' ? { boss: 'duneWorm' as const } : {}),
      ...(options.boosts ? { boosts: options.boosts } : {}),
    }),
  );
}
