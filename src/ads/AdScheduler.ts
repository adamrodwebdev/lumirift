import type { BreakMoment } from '@/platform/Platform';
import {
  continueAllowed,
  interstitialAllowed,
  rewardedAllowed,
  type AdTuning,
  type GameOutcome,
} from './AdPolicy';

/** What the scheduler reads of the player, each time it is asked. */
export interface AdPlayer {
  /** Play since the first launch (ms). */
  readonly playedMs: number;
  /** No-ads was bought. */
  readonly adFree: boolean;
}

/**
 * The ad policy for one visit (1.31): it remembers when the visit began and
 * when the last interstitial played, and answers the run's questions (may
 * this break show one, may a reward be offered) with the channel's tuning.
 */
export class AdScheduler {
  /** The player's play when the visit began: the visit's play is what came after. */
  private readonly visitStartMs: number;
  private lastAdAt: number | null = null;
  /** The player's play when the last continue was offered, or null. */
  private lastOfferPlayedMs: number | null = null;

  constructor(
    private readonly tuning: AdTuning | null,
    private readonly player: () => AdPlayer,
    /** Real time, in ms (the clock is injected). */
    private readonly now: () => number,
  ) {
    this.visitStartMs = player().playedMs;
  }

  /** Whether the break after a game that ended so may show an interstitial. */
  breakAllowed(moment: BreakMoment, outcome: GameOutcome): boolean {
    const { playedMs, adFree } = this.player();
    return interstitialAllowed(
      {
        moment,
        outcome,
        playedMs,
        visitPlayedMs: playedMs - this.visitStartMs,
        sinceLastAdMs: this.lastAdAt === null ? Infinity : this.now() - this.lastAdAt,
        adFree,
      },
      this.tuning,
    );
  }

  /** An ad really played (an interstitial, or a rewarded one the player chose): the interval starts. */
  adShown(): void {
    this.lastAdAt = this.now();
  }

  /** Whether a rewarded offer may show (the double experience, later the gifts). */
  get rewardedAllowed(): boolean {
    return rewardedAllowed(this.player().playedMs, this.tuning);
  }

  /** Whether a game lost after `runMs` of play may continue for an ad (1.31). */
  continueAllowed(runMs: number): boolean {
    const { playedMs } = this.player();
    const sinceOfferMs =
      this.lastOfferPlayedMs === null ? Infinity : playedMs - this.lastOfferPlayedMs;
    return continueAllowed({ playedMs, sinceOfferMs, runMs }, this.tuning);
  }

  /** A continue was offered: the next one waits its interval of play. */
  continueOffered(): void {
    this.lastOfferPlayedMs = this.player().playedMs;
  }
}
