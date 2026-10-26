import type { BreakMoment, PlatformId } from '@/platform/Platform';

/**
 * The game's one ad policy (1.31), the same on every channel: pure rules
 * over what the player has lived (their play since the first launch, this
 * visit's play, the time since the last ad, how the game just ended), and a
 * tuning table per channel. The portals' own caps still apply on top.
 */

/** How a game ended, for the break that follows it. */
export type GameOutcome = 'won' | 'lost' | 'ended';

/** How a channel paces its ads (ms are of play, but for the interval, of real time). */
export interface AdTuning {
  /** A new player's play before the first interstitial: they play first. */
  readonly firstAfterMs: number;
  /** A visit's play before its first interstitial: a player back plays first too. */
  readonly visitGraceMs: number;
  /** At least this much real time between two interstitials. */
  readonly intervalMs: number;
  /** A break on the way to a menu may show one (CrazyGames forbids ads on navigation buttons). */
  readonly onLeave: boolean;
  /** A new player's play before any rewarded offer. */
  readonly rewardedAfterMs: number;
  /**
   * The channel offers the rewarded continue (1.31). CrazyGames asks for
   * another way to earn every ad's reward and one revive a session at most:
   * not there until an earned continue exists.
   */
  readonly continues: boolean;
  /** A new player's play before a lost game may continue for an ad. */
  readonly continueAfterMs: number;
  /** Play between two continue offers: never at every defeat (the portals forbid it). */
  readonly continueIntervalMs: number;
  /** Only a run this long is worth a continue. */
  readonly continueMinRunMs: number;
}

const MINUTE = 60_000;

/** Eight minutes before a newcomer's first interstitial, three for rewards and each visit, five to continue. */
const STANDARD: AdTuning = {
  firstAfterMs: 8 * MINUTE,
  visitGraceMs: 3 * MINUTE,
  intervalMs: 3 * MINUTE,
  onLeave: true,
  rewardedAfterMs: 3 * MINUTE,
  continues: true,
  continueAfterMs: 5 * MINUTE,
  continueIntervalMs: 10 * MINUTE,
  continueMinRunMs: 2 * MINUTE,
};

/** Each channel's pacing; null where the game shows no ad (our site, the demo). */
export const AD_TUNING: Readonly<Record<PlatformId, AdTuning | null>> = {
  web: null,
  demo: null,
  crazygames: { ...STANDARD, onLeave: false, continues: false },
  playgama: STANDARD,
  yandex: STANDARD,
};

/** What the policy weighs at a break. */
export interface BreakContext {
  readonly moment: BreakMoment;
  readonly outcome: GameOutcome;
  /** The player's play since the first launch. */
  readonly playedMs: number;
  /** The play of this visit. */
  readonly visitPlayedMs: number;
  /** Real time since the last interstitial; Infinity before the first. */
  readonly sinceLastAdMs: number;
  /** The player bought no-ads: never an interstitial again. */
  readonly adFree: boolean;
}

/**
 * Whether a break may show an interstitial: never after a defeat (the
 * rewarded continue takes its place), never in a newcomer's first minutes or
 * a visit's, never twice inside the interval, never for the no-ads owner.
 */
export function interstitialAllowed(context: BreakContext, tuning: AdTuning | null): boolean {
  if (!tuning || context.adFree || context.outcome === 'lost') return false;
  if (context.moment === 'leave' && !tuning.onLeave) return false;
  return (
    context.playedMs >= tuning.firstAfterMs &&
    context.visitPlayedMs >= tuning.visitGraceMs &&
    context.sinceLastAdMs >= tuning.intervalMs
  );
}

/** Whether a rewarded offer may show: never in a new player's first minutes. */
export function rewardedAllowed(playedMs: number, tuning: AdTuning | null): boolean {
  return tuning !== null && playedMs >= tuning.rewardedAfterMs;
}

/** What the policy weighs when a game is lost to its board. */
export interface ContinueContext {
  /** The player's play since the first launch. */
  readonly playedMs: number;
  /** Play since the last continue offered; Infinity before the first. */
  readonly sinceOfferMs: number;
  /** How long the lost game was played. */
  readonly runMs: number;
}

/**
 * Whether a lost game may continue for an ad: a newcomer learns to lose
 * first, a short run is simply played again, and the offer stays rare (the
 * portals forbid one at every defeat; players resent being asked each time).
 */
export function continueAllowed(context: ContinueContext, tuning: AdTuning | null): boolean {
  return (
    tuning !== null &&
    tuning.continues &&
    context.playedMs >= tuning.continueAfterMs &&
    context.sinceOfferMs >= tuning.continueIntervalMs &&
    context.runMs >= tuning.continueMinRunMs
  );
}

/** The ends a player feels as losing: the well or the board full, the duel lost, no piece left. */
const DEFEATS: ReadonlySet<string> = new Set([
  'blockOut',
  'lockOut',
  'topOut',
  'noMoves',
  'defeat',
  'outOfPieces',
]);
/** The ends a player feels as winning. */
const VICTORIES: ReadonlySet<string> = new Set(['victory', 'guardian', 'goal', 'shapeComplete']);

/**
 * How a game's end counts for its break: a level's verdict when there is
 * one (a survival level won at the bell), else its reason; a timed game
 * that runs out (the daily challenge) simply ends.
 */
export function outcomeOf(reason: string, won: boolean | null = null): GameOutcome {
  if (won !== null) return won ? 'won' : 'lost';
  if (VICTORIES.has(reason)) return 'won';
  return DEFEATS.has(reason) ? 'lost' : 'ended';
}
