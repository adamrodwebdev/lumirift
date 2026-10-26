import { describe, expect, it } from 'vitest';
import {
  AD_TUNING,
  continueAllowed,
  interstitialAllowed,
  outcomeOf,
  rewardedAllowed,
  type BreakContext,
} from '@/ads/AdPolicy';
import { AdScheduler } from '@/ads/AdScheduler';

const MINUTE = 60_000;
const playgama = AD_TUNING.playgama;
const crazygames = AD_TUNING.crazygames;

/** A regular, well into a visit, long after the last ad, leaving a won game. */
const regular: BreakContext = {
  moment: 'replay',
  outcome: 'won',
  playedMs: 60 * MINUTE,
  visitPlayedMs: 10 * MINUTE,
  sinceLastAdMs: Infinity,
  adFree: false,
};

describe('the ad policy', () => {
  it('lets a new player play eight minutes before the first interstitial', () => {
    const newcomer = { ...regular, visitPlayedMs: 8 * MINUTE };
    expect(interstitialAllowed({ ...newcomer, playedMs: 7 * MINUTE + 59_000 }, playgama)).toBe(
      false,
    );
    expect(interstitialAllowed({ ...newcomer, playedMs: 8 * MINUTE + 1000 }, playgama)).toBe(true);
  });

  it('never shows one after a defeat, whatever the player has played', () => {
    expect(interstitialAllowed({ ...regular, outcome: 'lost' }, playgama)).toBe(false);
    expect(interstitialAllowed({ ...regular, outcome: 'ended' }, playgama)).toBe(true);
  });

  it('lets each visit start with three minutes of play, and spaces ads by three minutes', () => {
    expect(interstitialAllowed({ ...regular, visitPlayedMs: 2 * MINUTE }, playgama)).toBe(false);
    expect(interstitialAllowed({ ...regular, sinceLastAdMs: 2 * MINUTE }, playgama)).toBe(false);
    expect(interstitialAllowed({ ...regular, sinceLastAdMs: 3 * MINUTE }, playgama)).toBe(true);
  });

  it('never shows one to the owner of no-ads, nor on our site or the demo', () => {
    expect(interstitialAllowed({ ...regular, adFree: true }, playgama)).toBe(false);
    expect(interstitialAllowed(regular, AD_TUNING.web)).toBe(false);
    expect(interstitialAllowed(regular, AD_TUNING.demo)).toBe(false);
  });

  it('keeps CrazyGames away from navigation buttons: no ad on the way to a menu', () => {
    expect(interstitialAllowed({ ...regular, moment: 'leave' }, crazygames)).toBe(false);
    expect(interstitialAllowed(regular, crazygames)).toBe(true);
    expect(interstitialAllowed({ ...regular, moment: 'leave' }, AD_TUNING.yandex)).toBe(true);
  });

  it('offers no reward in a new player’s first three minutes', () => {
    expect(rewardedAllowed(2 * MINUTE + 59_000, playgama)).toBe(false);
    expect(rewardedAllowed(3 * MINUTE, playgama)).toBe(true);
    expect(rewardedAllowed(60 * MINUTE, AD_TUNING.web)).toBe(false);
  });

  it('offers a continue rarely: after five minutes of life, a run of two, ten minutes apart', () => {
    const lost = { playedMs: 30 * MINUTE, sinceOfferMs: Infinity, runMs: 3 * MINUTE };
    expect(continueAllowed(lost, playgama)).toBe(true);
    expect(continueAllowed({ ...lost, playedMs: 4 * MINUTE }, playgama)).toBe(false);
    expect(continueAllowed({ ...lost, runMs: 90_000 }, playgama)).toBe(false);
    expect(continueAllowed({ ...lost, sinceOfferMs: 9 * MINUTE }, playgama)).toBe(false);
    expect(continueAllowed({ ...lost, sinceOfferMs: 10 * MINUTE }, playgama)).toBe(true);
    // Not on CrazyGames (another way to earn it first), nor where ads are off.
    expect(continueAllowed(lost, crazygames)).toBe(false);
    expect(rewardedAllowed(60 * MINUTE, crazygames)).toBe(false);
    expect(continueAllowed(lost, AD_TUNING.web)).toBe(false);
  });

  it('reads how a game ended: the verdict first, then its reason', () => {
    expect(outcomeOf('topOut')).toBe('lost');
    expect(outcomeOf('blockOut')).toBe('lost');
    expect(outcomeOf('defeat')).toBe('lost');
    expect(outcomeOf('noMoves')).toBe('lost');
    expect(outcomeOf('victory')).toBe('won');
    expect(outcomeOf('guardian')).toBe('won');
    expect(outcomeOf('shapeComplete')).toBe('won');
    expect(outcomeOf('timeUp')).toBe('ended');
    // A survival level won at the bell, a timed level lost on the clock.
    expect(outcomeOf('timeUp', true)).toBe('won');
    expect(outcomeOf('timeUp', false)).toBe('lost');
  });
});

describe('AdScheduler', () => {
  it('counts the visit from its start, and the interval from the ad that really played', () => {
    let played = 30 * MINUTE;
    let now = 0;
    const ads = new AdScheduler(
      playgama,
      () => ({ playedMs: played, adFree: false }),
      () => now,
    );
    // A regular back: the visit's own grace first.
    expect(ads.breakAllowed('replay', 'won')).toBe(false);
    played += 3 * MINUTE;
    expect(ads.breakAllowed('replay', 'won')).toBe(true);
    ads.adShown();
    now += 2 * MINUTE;
    played += 2 * MINUTE;
    expect(ads.breakAllowed('replay', 'won')).toBe(false);
    now += MINUTE;
    expect(ads.breakAllowed('replay', 'won')).toBe(true);
    expect(ads.breakAllowed('replay', 'lost')).toBe(false);
  });

  it('follows the player: rewards after the first minutes, nothing once no-ads is bought', () => {
    let player = { playedMs: MINUTE, adFree: false };
    const ads = new AdScheduler(
      playgama,
      () => player,
      () => 0,
    );
    expect(ads.rewardedAllowed).toBe(false);
    player = { playedMs: 40 * MINUTE, adFree: false };
    expect(ads.rewardedAllowed).toBe(true);
    player = { playedMs: 40 * MINUTE, adFree: true };
    expect(ads.breakAllowed('replay', 'won')).toBe(false);
  });
});
