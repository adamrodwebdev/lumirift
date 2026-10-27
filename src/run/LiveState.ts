import type { LiveState } from '@/campaign/Goals';
import type { GameTracker } from '@/progression/GameReport';
import type { GameSession } from '@/session/GameSession';

/** What a level's goal reads of a game: its tracked counts, its result, its Guardian, its shape. */
export function liveStateOf(game: GameSession, tracker: GameTracker | null): LiveState {
  const boss = game.boss?.() ?? null;
  return {
    ...(tracker?.live ?? { durationMs: 0, clears: 0, lines: 0, bestAtOnce: 0 }),
    score: game.result().value,
    bossDamage: boss ? boss.maxHealth - boss.health : 0,
    fill: Math.floor((game.filled?.() ?? 0) * 100),
  };
}
