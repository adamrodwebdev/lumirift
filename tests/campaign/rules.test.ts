import { describe, expect, it } from 'vitest';
import { levelById, LEVELS } from '@/campaign/Levels';
import { levelTimeMs, upgradeById, upgradeHelps } from '@/campaign/Upgrades';
import { dayKey, timeLeft } from '@/core/Day';
import { effectsProfile } from '@/fx/EffectsProfile';
import { DEMO_EDITION, FULL_EDITION, nextPlay } from '@/platform/Edition';
import { guardianBonusOpen, Profile } from '@/progression/Profile';
import { DailyChallenge } from '@/session/DailyChallenge';

/*
 * The rules the interface used to keep (1.27): the clock of a level, the
 * upgrades that help, Play's next game, the challenges' countdowns, the
 * Guardian's daily bonus, the effect levels.
 */

describe('rules out of the interface', () => {
  it('times a level with the hourglass, and leaves an untimed one untimed', () => {
    const timed = LEVELS.find((level) => level.timeLimitMs !== null)!;
    expect(levelTimeMs(timed, {})).toBe(timed.timeLimitMs);
    expect(levelTimeMs(timed, { hourglass: 2 })).toBe(timed.timeLimitMs! + 30_000);
    const untimed = LEVELS.find((level) => level.timeLimitMs === null)!;
    expect(levelTimeMs(untimed, { hourglass: 3 })).toBeNull();
  });

  it('says which upgrades help in a mode', () => {
    expect(upgradeHelps(upgradeById('prism'), 'mosaic', 'placement')).toBe(true);
    expect(upgradeHelps(upgradeById('feather'), 'tower', 'volume')).toBe(true);
    expect(upgradeHelps(upgradeById('feather'), 'mosaic', 'placement')).toBe(false);
    expect(upgradeHelps(upgradeById('ember'), 'sand', 'sand')).toBe(true);
    expect(upgradeHelps(upgradeById('rampart'), 'classic', 'falling')).toBe(false);
  });

  it('goes on with the campaign, then past the demo’s levels with a game of Sand', () => {
    const first = levelById('1-1')!;
    expect(nextPlay(FULL_EDITION, first)).toEqual({ kind: 'level', level: first });
    const beyond = LEVELS[DEMO_EDITION.campaignLevels!]!;
    expect(nextPlay(DEMO_EDITION, beyond)).toEqual({ kind: 'mode', modeId: 'sand' });
  });

  it('counts down to the next daily challenge (midnight) in hours and minutes', () => {
    const now = new Date(2026, 9, 12, 21, 15, 30);
    const daily = new DailyChallenge(now, ['classic']);
    expect(daily.endsAt).toEqual(new Date(2026, 9, 13));
    expect(timeLeft(daily.endsAt, now)).toEqual({ days: 0, hours: 2, minutes: 44 });
    expect(timeLeft(daily.endsAt, new Date(2026, 9, 13, 0, 0, 1))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
    });
    // Real time: a change of hour (25 October) would count its hour.
    expect(timeLeft(new Date(2026, 9, 15), now)).toEqual({ days: 2, hours: 2, minutes: 44 });
  });

  it('gives the Guardian challenge’s bonus to the day’s first attempt only', () => {
    const day = dayKey(new Date(2026, 9, 22));
    const profile = Profile.parse(null);
    expect(guardianBonusOpen(profile.snapshot, day)).toBe(true);
    profile.recordGame(
      {
        modeId: 'tower',
        daily: false,
        guardian: true,
        variant: null,
        reason: 'defeat',
        durationMs: 60_000,
        clears: 2,
        lines: 2,
        bestAtOnce: 1,
        bestCombo: 1,
      },
      day,
      { modes: ['tower'], daily: true },
    );
    expect(guardianBonusOpen(profile.snapshot, day)).toBe(false);
    expect(guardianBonusOpen(profile.snapshot, dayKey(new Date(2026, 9, 23)))).toBe(true);
  });

  it('lets the player’s shake through only at the full level of effects', () => {
    expect(effectsProfile('full', true).shake).toBe(true);
    expect(effectsProfile('full', false).shake).toBe(false);
    expect(effectsProfile('reduced', true)).toEqual({
      particles: 0.35,
      destruction: true,
      shake: false,
      motion: false,
      gameOverDelayMs: 600,
    });
    expect(effectsProfile('off', true).particles).toBe(0);
  });
});
