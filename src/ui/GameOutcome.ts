import type { GameProgress } from '@/progression/Profile';
import type { CampaignResult, SeasonGain, TrainingResult } from '@/run/GameEnding';
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
  /** Set for the race: the week's record after this game. */
  readonly week?: { readonly best: string; readonly isNewBest: boolean };
  /** Experience, objectives and unlocks the game brought. */
  readonly progress: GameProgress;
  /** Set for a campaign level. */
  readonly campaign?: CampaignResult;
  /** Set for a step of the portals' training. */
  readonly training?: TrainingResult;
  /** Set for the Guardian challenge: the game's points and, on a victory, their factor. */
  readonly guardian?: { readonly points: string; readonly factor: string | null };
  /** The record was close (the score three quarters of it or more): the points missing, the bar's fill. */
  readonly closeTo?: { readonly gap: number; readonly fill: number };
  /** While a season runs (1.36): its title, and what this game brought it. */
  readonly season?: SeasonGain & { readonly title: string };
}

/** A game whose end is not settled yet (a continue on offer): nothing earned to show. */
export const NO_PROGRESS: GameProgress = {
  xp: [],
  total: 0,
  levelBefore: 0,
  levelAfter: 0,
  completed: [],
  unlocked: [],
  streak: 0,
};

/** A score this share of the record or more is "so close": the window shows the gap. */
const CLOSE_SHARE = 0.75;

/** The record within reach, for the window: the points missing and the bar's fill; or nothing. */
export function closeTo(
  kind: ResultKind,
  amount: number,
  best: number | null,
): Pick<GameOutcome, 'closeTo'> {
  return kind === 'score' && best !== null && amount < best && amount >= best * CLOSE_SHARE
    ? { closeTo: { gap: best - amount, fill: amount / best } }
    : {};
}

/** The continue the end window offers (1.31): what it frees, its ring, the ad playing. */
export interface ContinueCard {
  /** What it frees, in the family's words. */
  readonly clears: string;
  /** How long its ring runs (ms); 0 once stopped (an ad that did not play). */
  readonly ringMs: number;
  /** The ad is playing: the buttons wait. */
  readonly busy: boolean;
}
