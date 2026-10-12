import type { GameProgress } from '@/progression/Profile';

/** What the game-over dialog shows; values are already formatted for the current language. */
export interface GameOutcome {
  readonly reason: string;
  readonly value: string;
  readonly best: string;
  readonly isNewBest: boolean;
  /** Experience, objectives and unlocks the game brought. */
  readonly progress: GameProgress;
}
