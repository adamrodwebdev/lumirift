import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { MosaicGame } from './engine/MosaicGame';
import { PlacementSession } from './PlacementSession';

export { PlacementSession, type MosaicCommand, type MosaicView } from './PlacementSession';

/** Entry point of the placement family chunk (see `ModeCatalog`). */
export function createPlacementSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'mosaic') throw new Error(`"${modeId}" is not a placement mode`);
  return new PlacementSession(
    modeId,
    new MosaicGame({
      random: options.random,
      timeLimitMs: options.timeLimitMs,
      ...(options.boosts ? { boosts: options.boosts } : {}),
      ...(options.boss === 'ceramicGolem' ? { boss: options.boss } : {}),
      ...(options.bossHealth === undefined ? {} : { bossHealth: options.bossHealth }),
    }),
  );
}
