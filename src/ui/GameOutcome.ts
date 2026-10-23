import type { GameProgress } from '@/progression/Profile';
import type { CampaignResult } from '@/run/GameEnding';
import type { ResultKind } from '@/session/GameSession';

export type { CampaignResult } from '@/run/GameEnding';

/** What the game-over dialog shows; values are already formatted for the current language. */
export interface GameOutcome {
  readonly reason: string;
  /** The result as a number (whole points or milliseconds): the end screen counts up to it. */
  readonly amount: number;
  readonly kind: ResultKind;
  readonly value: string;
  readonly best: string;
  readonly isNewBest: boolean;
  /** Experience, objectives and unlocks the game brought. */
  readonly progress: GameProgress;
  /** Set for a campaign level. */
  readonly campaign?: CampaignResult;
  /** Set for the Guardian challenge: the game's points and, on a victory, their factor. */
  readonly guardian?: { readonly points: string; readonly factor: string | null };
}
