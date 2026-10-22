import type { CampaignLevel } from '@/campaign/Levels';
import type { GameProgress } from '@/progression/Profile';
import type { BossId, ResultKind } from '@/session/GameSession';

/** A campaign level's ending: won or not, its stars, and the way on. */
export interface CampaignResult {
  readonly levelId: string;
  readonly won: boolean;
  readonly stars: number;
  /** Stars added to the campaign by this game (a better result than before). */
  readonly gained: number;
  /** The level after this one, open now that this one is won; null at the end. */
  readonly next: CampaignLevel | null;
  /** A Guardian the won level teased, and the level where it waits. */
  readonly teaser?: { readonly boss: BossId; readonly levelId: string };
}

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
}
