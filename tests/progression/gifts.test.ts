import { describe, expect, it } from 'vitest';
import { daysBetween } from '@/core/Day';
import { COLLECTIONS } from '@/progression/Collections';
import {
  COSMETICS,
  cosmeticKey,
  findCosmetic,
  findCosmeticByKey,
  isUnlocked,
} from '@/progression/Cosmetics';
import {
  GIFT_DAYS,
  GIFT_LOOKS,
  GIFT_XP,
  giftOf,
  LOOK_FALLBACK_XP,
  WELCOME_BACK_XP,
} from '@/progression/DailyGifts';
import { nextStreakBonus, streakBonus } from '@/progression/Experience';
import type { GameReport } from '@/progression/GameReport';
import {
  currentStreak,
  giftCalendar,
  giftOpensItself,
  justClaimed,
} from '@/progression/GiftCalendar';
import { achievementsOf } from '@/progression/Achievements';
import { EMPTY_PROFILE, Profile, type ProfileData } from '@/progression/Profile';
import { GiftService } from '@/services/GiftService';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { PROFILE_KEY, ProfileService } from '@/services/ProfileService';
import type { ModeId } from '@/session/ModeId';

const MODES: readonly ModeId[] = ['classic', 'sand', 'mosaic', 'tower'];

const game = (patch: Partial<GameReport> = {}): GameReport => ({
  modeId: 'classic',
  daily: false,
  variant: null,
  reason: 'topOut',
  durationMs: 60_000,
  clears: 4,
  lines: 6,
  bestAtOnce: 3,
  bestCombo: 2,
  ...patch,
});

/** A player who has played once, on `day`. */
const played = (day = '20261026'): Profile => {
  const profile = new Profile();
  profile.recordGame(game(), day, MODES);
  return profile;
};

/** The experience a claim on `day` brings. */
const claimXp = (profile: Profile, day: string, doubled = false): number => {
  const before = profile.snapshot.xp;
  profile.claimGift(day, doubled);
  return profile.snapshot.xp - before;
};

/** A clock the test moves by hand. */
class FrozenClock {
  constructor(private date: Date) {}

  readonly now = (): Date => this.date;

  set(date: Date): void {
    this.date = date;
  }
}

describe('The gifts of the calendar', () => {
  it('gives experience on days 1 to 6, then the first look the player does not have', () => {
    const none = () => false;
    expect(GIFT_XP).toHaveLength(GIFT_DAYS - 1);
    GIFT_XP.forEach((amount, day) => expect(giftOf(day, none)).toEqual({ kind: 'xp', amount }));
    expect(giftOf(6, none)).toMatchObject({
      kind: 'look',
      cosmetic: { kind: 'material', id: 'obsidian' },
    });
    const obsidian = (cosmetic: { kind: string; id: string }) => cosmetic.id === 'obsidian';
    expect(giftOf(6, obsidian)).toMatchObject({
      kind: 'look',
      cosmetic: { kind: 'ambiance', id: 'cosmos' },
    });
    expect(giftOf(6, () => true)).toEqual({ kind: 'xp', amount: LOOK_FALLBACK_XP });
  });

  it('gives a look from far ahead first, the objectives’ prizes last', () => {
    const level = (key: string) => {
      const unlock = findCosmeticByKey(key)!.unlock;
      return unlock.by === 'level' ? unlock.value : Infinity;
    };
    const levels = GIFT_LOOKS.map(level);
    expect(levels[0]).toBe(Math.max(...levels.filter(Number.isFinite)));
    expect(levels.slice(-2)).toEqual([Infinity, Infinity]);
  });

  it('only gives looks of the game, never a Guardian trophy, the streak gold or a collection prize', () => {
    for (const key of GIFT_LOOKS) {
      const cosmetic = COSMETICS.find((each) => cosmeticKey(each) === key);
      expect(cosmetic, key).toBeDefined();
      expect(['level', 'objectives'], key).toContain(cosmetic!.unlock.by);
    }
  });
});

describe('The calendar day by day', () => {
  it('waits for the first game, then gives one gift a local day', () => {
    const fresh = new Profile();
    expect(giftCalendar(fresh.snapshot, '20261026')).toMatchObject({
      started: false,
      ready: false,
    });
    fresh.claimGift('20261026', false);
    expect(fresh.snapshot.xp).toBe(0);

    const profile = played();
    expect(giftOpensItself(profile.snapshot, '20261026')).toBe(true);
    expect(claimXp(profile, '20261026')).toBe(GIFT_XP[0]);
    expect(claimXp(profile, '20261026')).toBe(0);
    expect(giftCalendar(profile.snapshot, '20261026')).toMatchObject({ ready: false, next: 1 });
    expect(claimXp(profile, '20261027')).toBe(GIFT_XP[1]);
  });

  it('crosses midnight, the end of a month and the end of a year', () => {
    const profile = played('20261030');
    for (const day of ['20261030', '20261031', '20261101']) profile.claimGift(day, false);
    expect(profile.snapshot.gifts).toMatchObject({ next: 3, lastDay: '20261101' });

    const winter = played('20261230');
    for (const day of ['20261230', '20261231', '20270101', '20270102'])
      winter.claimGift(day, false);
    expect(winter.snapshot.gifts).toMatchObject({ next: 4, lastDay: '20270102' });
    expect(daysBetween('20261231', '20270101')).toBe(1);
    expect(daysBetween('20260228', '20260301')).toBe(1);
  });

  it('gives nothing twice when the clock goes back a day (a flight west, a clock turned back)', () => {
    const profile = played('20261027');
    profile.claimGift('20261027', false);
    profile.visit('20261027');
    const before = profile.snapshot;
    profile.claimGift('20261026', false);
    profile.visit('20261026');
    expect(profile.snapshot).toEqual(before);
    expect(giftCalendar(profile.snapshot, '20261026').ready).toBe(false);
  });

  it('pauses the cycle when days are missed, and never resets it', () => {
    const profile = played('20261020');
    for (const day of ['20261020', '20261021', '20261022']) profile.claimGift(day, false);
    expect(claimXp(profile, '20261026')).toBe(GIFT_XP[3]);
    expect(profile.snapshot.gifts.next).toBe(4);
  });

  it('gives a look on the seventh day, then starts the cycle again', () => {
    const profile = played('20261001');
    for (let day = 1; day < GIFT_DAYS; day += 1) profile.claimGift(`2026100${day}`, false);
    const seventh = giftCalendar(profile.snapshot, '20261007').days[6]!;
    expect(seventh.state).toBe('today');
    if (seventh.gift.kind !== 'look') throw new Error('day 7 gives a look');
    const look = seventh.gift.cosmetic;
    expect(profile.isUnlocked(look)).toBe(false);
    // The first look of the list the player does not have yet.
    expect(cosmeticKey(look)).toBe(
      GIFT_LOOKS.find((key) => !profile.isUnlocked(findCosmeticByKey(key)!)),
    );

    profile.claimGift('20261007', false);
    expect(profile.snapshot.gifted).toEqual([cosmeticKey(look)]);
    expect(profile.isUnlocked(look)).toBe(true);
    expect(profile.snapshot.gifts.next).toBe(0);
    // The next week's seventh day: another look.
    const next = giftCalendar(profile.snapshot, '20261008').days[6]!.gift;
    expect(next.kind === 'look' && cosmeticKey(next.cosmetic)).not.toBe(cosmeticKey(look));
  });

  it('doubles the experience when an ad was watched, never a look', () => {
    const profile = played();
    expect(claimXp(profile, '20261026', true)).toBe(2 * GIFT_XP[0]!);
  });

  it('shows the days claimed, today, tomorrow and those to come', () => {
    const profile = played();
    profile.claimGift('20261026', false);
    profile.claimGift('20261027', false);
    const states = (day: string) =>
      giftCalendar(profile.snapshot, day).days.map((each) => each.state);
    expect(states('20261027')).toEqual([
      'claimed',
      'claimed',
      'tomorrow',
      'coming',
      'coming',
      'coming',
      'coming',
    ]);
    expect(states('20261028')).toEqual([
      'claimed',
      'claimed',
      'today',
      'coming',
      'coming',
      'coming',
      'coming',
    ]);
  });

  it('keeps the week in view right after a claim: the day ticked, tomorrow’s next', () => {
    const third = justClaimed(giftCalendar(played().snapshot, '20261026'));
    expect(third).toMatchObject({ ready: false, next: 0 });
    expect(third.days.map((day) => day.state)).toEqual([
      'claimed',
      'tomorrow',
      'coming',
      'coming',
      'coming',
      'coming',
      'coming',
    ]);
    // The seventh day claimed: the whole week ticked, the new one for later.
    const week: ProfileData = {
      ...EMPTY_PROFILE,
      games: 9,
      gifts: { next: 6, lastDay: '20261020', shownDay: null },
    };
    const seventh = justClaimed(giftCalendar(week, '20261021'));
    expect(seventh.days.every((day) => day.state === 'claimed')).toBe(true);
  });

  it('opens by itself once a day, and only when a gift waits', () => {
    const profile = played();
    profile.markGiftShown('20261026');
    expect(giftOpensItself(profile.snapshot, '20261026')).toBe(false);
    expect(giftCalendar(profile.snapshot, '20261026').ready).toBe(true);
    expect(giftOpensItself(profile.snapshot, '20261027')).toBe(true);
    profile.claimGift('20261027', false);
    expect(giftOpensItself(profile.snapshot, '20261027')).toBe(false);
  });
});

describe('Back after a week away', () => {
  it('brings a gift of welcome with the day’s, and the ads’ grace again', () => {
    const profile = played('20261001');
    profile.visit('20261001');
    profile.recordGame(game({ durationMs: 600_000 }), '20261001', MODES);
    profile.visit('20261007');
    expect(profile.snapshot.welcomeBack).toBe(false);
    profile.visit('20261014');
    expect(profile.snapshot).toMatchObject({
      welcomeBack: true,
      graceFromMs: profile.snapshot.playedMs,
    });
    expect(giftCalendar(profile.snapshot, '20261014').welcome).toBe(true);
    expect(claimXp(profile, '20261014')).toBe(GIFT_XP[0]! + WELCOME_BACK_XP);
    expect(profile.snapshot.welcomeBack).toBe(false);
  });

  it('is for players who have played: a visitor who never did is not welcomed back', () => {
    const visitor = new Profile();
    visitor.visit('20261001');
    visitor.visit('20261020');
    expect(visitor.snapshot).toMatchObject({ welcomeBack: false, lastVisit: '20261020' });
  });
});

describe('The daily streak', () => {
  it('pays its steps at 3, 7, 14 and 30 days, again with each new streak', () => {
    expect([1, 2, 3, 7, 14, 30, 31].map(streakBonus)).toEqual([0, 0, 75, 150, 300, 600, 0]);
    expect(nextStreakBonus(3)).toEqual({ days: 7, xp: 150 });
    expect(nextStreakBonus(30)).toBeNull();

    const profile = new Profile();
    const daily = (day: string) =>
      profile
        .recordGame(game({ daily: true }), day, MODES)
        .xp.find((line) => line.source === 'streak');
    expect(daily('20261029')).toBeUndefined();
    expect(daily('20261030')).toBeUndefined();
    expect(daily('20261031')).toEqual({ source: 'streak', amount: 75 });
    expect(daily('20261101')).toBeUndefined();
    expect(daily('20261110')).toBeUndefined(); // a day missed: a new streak
    daily('20261111');
    expect(daily('20261112')).toEqual({ source: 'streak', amount: 75 });
  });

  it('is shown alive on the day and the day after, then broken', () => {
    const data: ProfileData = {
      ...EMPTY_PROFILE,
      streak: { count: 4, best: 4, lastDay: '20261231' },
    };
    expect(currentStreak(data, '20261231')).toBe(4);
    expect(currentStreak(data, '20270101')).toBe(4);
    expect(currentStreak(data, '20270102')).toBe(0);
  });
});

describe('The collections', () => {
  it('gather looks of the game, and crown each one with a look of its own', () => {
    const keys = new Set(COSMETICS.map(cosmeticKey));
    const prizes = COLLECTIONS.map((collection) => collection.reward);
    expect(new Set(prizes).size).toBe(COLLECTIONS.length);
    for (const collection of COLLECTIONS) {
      for (const key of collection.items) expect(keys.has(key), key).toBe(true);
      expect(findCosmeticByKey(collection.reward)?.unlock).toEqual({
        by: 'collection',
        value: collection.id,
      });
    }
  });

  it('unlock their ambiance once every look is earned, gifted ones included', () => {
    const synthwave = findCosmetic('ambiance', 'synthwave')!;
    const at = (level: number, gifted: readonly string[] = []) =>
      isUnlocked(synthwave, { ...achievementsOf(EMPTY_PROFILE), level, gifted });
    expect(at(11)).toBe(false); // the Cosmos ambiance comes at level 12
    expect(at(12)).toBe(true);
    expect(at(11, ['ambiance.cosmos'])).toBe(true);
    const trophies = findCosmetic('ambiance', 'sanctum')!;
    const bosses = ['duneWorm', 'ceramicGolem', 'towerEye', 'riftHeart'] as const;
    expect(isUnlocked(trophies, { ...achievementsOf(EMPTY_PROFILE), bosses })).toBe(true);
    expect(
      isUnlocked(trophies, { ...achievementsOf(EMPTY_PROFILE), bosses: bosses.slice(1) }),
    ).toBe(false);
  });
});

describe('The saved calendar', () => {
  it('keeps its state across a reload, and drops what is not valid', () => {
    const profile = played();
    profile.claimGift('20261026', false);
    profile.visit('20261026');
    const again = Profile.parse(JSON.parse(JSON.stringify(profile.snapshot)));
    expect(again.snapshot.gifts).toEqual(profile.snapshot.gifts);
    expect(again.snapshot.lastVisit).toBe('20261026');
    expect(giftCalendar(again.snapshot, '20261026').ready).toBe(false);

    const odd = Profile.parse({
      games: 2,
      playedMs: 1000,
      gifts: { next: 9, lastDay: 'yesterday', shownDay: 20261026 },
      gifted: ['ambiance.aurora', 'ambiance.aurora', 'ambiance.nowhere', 7],
      lastVisit: '2026-10-26',
      welcomeBack: 'yes',
      graceFromMs: 5000,
    }).snapshot;
    expect(odd).toMatchObject({
      gifts: { next: 0, lastDay: null, shownDay: null },
      gifted: ['ambiance.aurora'],
      lastVisit: null,
      welcomeBack: false,
      graceFromMs: 1000,
    });
  });
});

describe('GiftService', () => {
  it('claims on the clock’s day, once, even across a reload of the page', () => {
    const storage = new MemoryStorage();
    const clock = new FrozenClock(new Date(2026, 9, 31, 23, 58));
    const service = () => new ProfileService(storage, () => MODES);
    const profiles = service();
    profiles.recordGame(game(), '20261031');
    const gifts = new GiftService(profiles, clock.now);
    gifts.visit();
    expect(gifts.opensItself).toBe(true);
    gifts.markShown();
    expect(gifts.opensItself).toBe(false);
    gifts.claim(false);
    expect(gifts.calendar).toMatchObject({ ready: false, next: 1 });

    // The page reloads before midnight: the gift is not there again.
    const reloaded = new GiftService(service(), clock.now);
    reloaded.claim(false);
    expect(JSON.parse(storage.get(PROFILE_KEY)!).gifts).toMatchObject({
      next: 1,
      lastDay: '20261031',
    });

    // Past midnight, into a new month: the next gift.
    clock.set(new Date(2026, 10, 1, 0, 1));
    expect(reloaded.calendar.ready).toBe(true);
    expect(reloaded.opensItself).toBe(true);
    reloaded.claim(true);
    expect(reloaded.calendar).toMatchObject({ ready: false, next: 2 });

    // A flight west takes the local day back to the 31st: no gift again.
    const saved = storage.get(PROFILE_KEY);
    clock.set(new Date(2026, 9, 31, 22, 30));
    reloaded.visit();
    reloaded.claim(false);
    expect(reloaded.calendar).toMatchObject({ ready: false, next: 2 });
    expect(storage.get(PROFILE_KEY)).toBe(saved);
  });
});
