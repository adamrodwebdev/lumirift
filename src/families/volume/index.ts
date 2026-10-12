import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { LINE_CLEAR_DELAY_MS } from '@/families/falling/rules/Timings';
import type { GameSession, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { TowerMode } from './TowerMode';

/**
 * Entry point of the volume family chunk (see `ModeCatalog`). The Tower plays
 * the falling engine itself; only the well wraps around, and the stage draws
 * it as a cylinder.
 */
export function createVolumeSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'tower') throw new Error(`"${modeId}" is not a volume mode`);
  const mode = new TowerMode({
    timeLimitMs: options.timeLimitMs,
    ...(options.today ? { today: options.today } : {}),
  });
  return new FallingSession(
    modeId,
    new Game(mode, { random: options.random, lineClearDelayMs: LINE_CLEAR_DELAY_MS }),
    'volume',
  );
}
