import { ELEMENT_TONES } from '@/families/sand/engine/Elements';
import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { DunesGame } from './engine/DunesGame';
import { DunesSession } from './DunesSession';

export { DunesSession, type DunesCommand } from './DunesSession';

/** Entry point of the Dunes chunk (see `ModeCatalog`): the placed sand, a web test (1.37). */
export function createDunesSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'dunes') throw new Error(`"${modeId}" is not a mode of Dunes`);
  return new DunesSession(
    modeId,
    new DunesGame({
      random: options.random,
      ...(options.featuredElement ? { featured: ELEMENT_TONES[options.featuredElement] } : {}),
    }),
  );
}
