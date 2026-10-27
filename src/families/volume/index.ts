import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { LINE_CLEAR_DELAY_MS } from '@/families/falling/rules/Timings';
import { CONTINUE_FREES } from '@/session/ContinueRule';
import type { GameSession, SessionOptions } from '@/session/GameSession';
import { Mercy } from '@/session/Mercy';
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
    ...(options.boosts ? { boosts: options.boosts } : {}),
    ...(options.boss === 'towerEye' ? { boss: options.boss } : {}),
    ...(options.bossHealth === undefined ? {} : { bossHealth: options.bossHealth }),
  });
  return new FallingSession(
    modeId,
    new Game(mode, {
      random: options.random,
      lineClearDelayMs: LINE_CLEAR_DELAY_MS,
      mercy: Mercy.of('volume', options.mercy ?? 0),
      ...(options.startLevel === undefined ? {} : { startLevel: options.startLevel }),
      ...(options.overflowGoesOn ? { overflowFrees: CONTINUE_FREES.volume } : {}),
      ...(options.boosts ? { boosts: options.boosts } : {}),
    }),
    'volume',
  );
}
