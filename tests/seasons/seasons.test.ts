import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@/progression/Collections';
import { COSMETICS, cosmeticKey, findCosmeticByKey, isUnlocked } from '@/progression/Cosmetics';
import { giftOf } from '@/progression/DailyGifts';
import type { GameReport } from '@/progression/GameReport';
import { achievementsOf } from '@/progression/Achievements';
import { advance, objectivesOfDay } from '@/progression/Objectives';
import { EMPTY_PROFILE } from '@/progression/Profile';
import {
  lookShown,
  nextSeasonAfter,
  SEASON_SPANS,
  seasonAt,
  seasonLooksOverAt,
  seasonOfLook,
  weekEventAt,
} from '@/seasons/EventCalendar';
import { SEASONS } from '@/seasons/SeasonData';
import { SeasonProgress } from '@/seasons/SeasonProgress';
import { tierProgress, tierReached, tiersOf } from '@/seasons/SeasonTrack';
import { WEEKLY_GOAL_POINTS, WEEKLY_TARGETS, weeklyObjective } from '@/seasons/WeeklyGoals';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import { SEASON_KEY, SeasonService } from '@/services/SeasonService';
import type { ElementName } from '@/session/Elements';

const utc = (iso: string) => new Date(iso);

const game = (elements: Partial<Record<ElementName, number>> = {}): GameReport => ({
  modeId: 'sand',
  daily: false,
  variant: null,
  reason: 'topOut',
  durationMs: 120_000,
  clears: 3,
  lines: 3,
  bestAtOnce: 1,
  bestCombo: 1,
  elements,
});

/** A clock the test moves by hand. */
class FrozenClock {
  constructor(private date: Date) {}

  readonly now = (): Date => this.date;

  set(date: Date): void {
    this.date = date;
  }
}

const ZONE = process.env.TZ;
afterEach(() => {
  process.env.TZ = ZONE;
});

describe('The events calendar', () => {
  it('starts each week on Monday at midnight UTC, the same week in every time zone', () => {
    const instants = [
      '2026-12-13T23:59:59.999Z',
      '2026-12-14T00:00:00.000Z',
      '2027-01-03T12:00:00Z',
    ];
    for (const iso of instants) {
      const keys = [
        'Pacific/Auckland',
        'America/Los_Angeles',
        'Asia/Kolkata',
        'Europe/Paris',
        'UTC',
      ].map((zone) => {
        process.env.TZ = zone;
        const event = weekEventAt(new Date(iso));
        return `${event?.span.season.id} ${event?.key} ${event?.element}`;
      });
      expect(new Set(keys).size, iso).toBe(1);
    }
    expect(weekEventAt(utc('2026-12-13T23:59:59.999Z'))).toMatchObject({
      key: '20261207',
      element: 'acid',
      span: { season: { id: 'preseason' } },
    });
    expect(weekEventAt(utc('2026-12-14T00:00:00Z'))).toMatchObject({
      key: '20261214',
      index: 0,
      element: 'fire',
      span: { season: { id: 'embers' } },
    });
  });

  it('runs the seasons one after the other, from data: preseason, Embers, Tides, Storm', () => {
    expect(seasonAt(utc('2026-10-25T23:59:59Z'))).toBeNull();
    expect(nextSeasonAfter(utc('2026-10-25T23:59:59Z'))?.season.id).toBe('preseason');
    const at = (iso: string) => seasonAt(utc(iso))?.season.id ?? null;
    expect(at('2026-10-26T00:00:00Z')).toBe('preseason');
    expect(at('2026-12-13T23:59:59Z')).toBe('preseason');
    expect(at('2026-12-14T00:00:00Z')).toBe('embers');
    expect(at('2027-01-24T23:59:59Z')).toBe('embers');
    expect(at('2027-01-25T00:00:00Z')).toBe('tides');
    expect(at('2027-03-08T00:00:00Z')).toBe('storm');
    expect(at('2027-04-18T23:59:59Z')).toBe('storm');
    expect(at('2027-04-19T00:00:00Z')).toBeNull();
    // No gap and no overlap: each season starts when the one before ends, on a Monday.
    SEASON_SPANS.forEach((span, index) => {
      expect(span.startsAt.getUTCDay(), span.season.id).toBe(1);
      const next = SEASON_SPANS[index + 1];
      if (next) expect(next.startsAt.getTime()).toBe(span.endsAt.getTime());
    });
    expect(SEASON_SPANS.map((span) => span.season.weeks.length)).toEqual([7, 6, 6, 6]);
  });

  it('features the season’s element of each week, in order', () => {
    const embers = SEASONS[1];
    embers.weeks.forEach((element, index) => {
      const monday = new Date(Date.UTC(2026, 11, 14 + index * 7, 9));
      expect(weekEventAt(monday)).toMatchObject({ index, element });
    });
  });
});

describe('The seasons’ data', () => {
  it('names only looks of its own, each one a look of the game, the crown brought by its set', () => {
    const keys = new Set(COSMETICS.map(cosmeticKey));
    expect(keys.size).toBe(COSMETICS.length);
    for (const season of SEASONS) {
      const own = new Set(season.looks.map((look) => `${look.kind}.${look.id}`));
      for (const key of Object.values(season.track.looks)) {
        expect(own.has(key), key).toBe(true);
        expect(findCosmeticByKey(key)?.unlock).toEqual({ by: 'season', value: season.id });
      }
      if (season.crown) {
        expect(own.has(season.crown)).toBe(true);
        expect(findCosmeticByKey(season.crown)?.unlock).toEqual({
          by: 'collection',
          value: season.id,
        });
        expect(COLLECTIONS.find((set) => set.id === season.id)).toMatchObject({
          items: Object.values(season.track.looks),
          reward: season.crown,
        });
      }
    }
  });

  it('gives a track look to no one by itself: only the track, or the gift once the season is over', () => {
    const ember = findCosmeticByKey('shatter.ember')!;
    const all = {
      ...achievementsOf(EMPTY_PROFILE),
      level: 50,
      objectivesDone: 999,
      bestStreak: 99,
    };
    expect(isUnlocked(ember, all)).toBe(false);
    expect(isUnlocked(ember, { ...all, gifted: ['shatter.ember'] })).toBe(true);
  });

  it('crowns a season’s set: its three looks gathered, the crown is the player’s', () => {
    const phoenix = findCosmeticByKey('material.phoenix')!;
    const some = { ...achievementsOf(EMPTY_PROFILE), gifted: ['shatter.ember', 'ambiance.embers'] };
    expect(isUnlocked(phoenix, some)).toBe(false);
    expect(isUnlocked(phoenix, { ...some, gifted: [...some.gifted, 'material.cinder'] })).toBe(
      true,
    );
  });
});

describe('A season’s track', () => {
  it('climbs a tier every so many points, experience on most, a look on some', () => {
    const tiers = tiersOf(SEASONS[1].track);
    expect(tiers).toHaveLength(30);
    expect(tiers[0]).toEqual({ tier: 1, points: 300, reward: { kind: 'xp', amount: 100 } });
    expect(tiers[4]!.reward).toEqual({ kind: 'look', key: 'shatter.ember' });
    expect(tiers[28]!.reward).toEqual({ kind: 'xp', amount: 290 });
    expect(tiers[29]!.reward).toEqual({ kind: 'look', key: 'material.cinder' });
    const track = SEASONS[1].track;
    expect([0, 299, 300, 1240, 9000, 20000].map((p) => tierReached(track, p))).toEqual([
      0, 0, 1, 4, 30, 30,
    ]);
    expect(tierProgress(track, 1240)).toEqual({ into: 40, needed: 300 });
    expect(tierProgress(track, 9000)).toEqual({ into: 0, needed: 0 });
    // The preseason: ten tiers of experience, and one look on the last.
    const preseason = tiersOf(SEASONS[0].track);
    expect(preseason).toHaveLength(10);
    expect(preseason.filter((tier) => tier.reward.kind === 'look')).toHaveLength(1);
  });
});

describe('The week’s goal', () => {
  it('is an objective of its own kind, never one of a day’s, counted from a game’s deeds', () => {
    const goal = weeklyObjective('fire');
    expect(goal).toMatchObject({ kind: 'element', target: WEEKLY_TARGETS.fire });
    expect(advance(goal, game({ fire: 9, water: 4 }))).toBe(9);
    expect(advance(goal, game())).toBe(0);
    for (let day = 1; day <= 60; day++) {
      const key = `202611${String(day % 30 || 30).padStart(2, '0')}`;
      expect(
        objectivesOfDay(key, { modes: ['sand', 'classic'], daily: true }).map((o) => o.kind),
      ).not.toContain('element');
    }
  });
});

describe('A player’s season', () => {
  const firstWeek = utc('2026-12-15T10:00:00Z');

  it('counts the experience of play as points, and the week’s goal once', () => {
    const season = new SeasonProgress();
    season.recordGame(game({ fire: 20 }), 120, firstWeek);
    expect(season.snapshot).toMatchObject({
      season: 'embers',
      points: 120,
      deeds: 20,
      done: false,
    });
    season.recordGame(game({ fire: 20 }), 80, firstWeek);
    expect(season.snapshot).toMatchObject({
      points: 200 + WEEKLY_GOAL_POINTS,
      deeds: WEEKLY_TARGETS.fire,
      done: true,
    });
    season.recordGame(game({ fire: 50 }), 10, firstWeek);
    expect(season.snapshot.points).toBe(210 + WEEKLY_GOAL_POINTS);
    // The next week: water's goal, from zero; the points stay.
    season.recordGame(game({ fire: 9, water: 5 }), 0, utc('2026-12-21T00:00:00Z'));
    expect(season.snapshot).toMatchObject({ week: '20261221', deeds: 5, done: false });
    expect(season.snapshot.points).toBe(210 + WEEKLY_GOAL_POINTS);
  });

  it('claims each tier reached once, never a tier ahead', () => {
    const season = new SeasonProgress();
    season.recordGame(game(), 650, firstWeek);
    expect(season.claimable(2, firstWeek)).toBe(true);
    expect(season.claimable(3, firstWeek)).toBe(false);
    season.claim(2, firstWeek);
    season.claim(2, firstWeek);
    season.claim(3, firstWeek);
    expect(season.snapshot.claimed).toEqual([2]);
  });

  it('starts a new season from zero, and gives what the last one left unclaimed', () => {
    const season = new SeasonProgress();
    season.recordGame(game(), 2500, utc('2026-12-10T00:00:00Z'));
    season.claim(1, utc('2026-12-10T00:00:00Z'));
    const after = utc('2026-12-14T00:00:01Z');
    expect(season.leftBehind(after).map((reward) => reward.kind)).toEqual(
      Array.from({ length: 9 }, (_, i) => (i === 8 ? 'look' : 'xp')),
    );
    season.catchUp(after);
    expect(season.snapshot).toMatchObject({ season: 'embers', points: 0, claimed: [] });
    expect(season.leftBehind(after)).toEqual([]);
  });

  it('reads saved data, keeping only what is valid', () => {
    const odd = SeasonProgress.parse({
      season: 'summer',
      points: -4,
      claimed: [1, 1, 'two', 99],
      week: 'monday',
      deeds: 3.7,
      done: 'yes',
    }).snapshot;
    expect(odd).toEqual({
      season: null,
      points: 0,
      claimed: [],
      week: null,
      deeds: 3,
      done: false,
    });
    const kept = SeasonProgress.parse({ season: 'embers', claimed: [1, 1, 30, 31] }).snapshot;
    expect(kept.claimed).toEqual([1, 30]);
  });
});

describe('SeasonService', () => {
  it('gives the track’s rewards through the profile, and keeps the season across a reload', () => {
    const storage = new MemoryStorage();
    const clock = new FrozenClock(utc('2026-12-16T18:00:00Z'));
    const profiles = new ProfileService(storage, () => ({ modes: ['sand'], daily: true }));
    const seasons = new SeasonService(storage, profiles, clock.now);
    expect(seasons.view).toMatchObject({ span: { season: { id: 'embers' } }, tier: 0, ready: 0 });
    seasons.recordGame(game({ fire: 35 }), 1400);
    expect(seasons.view).toMatchObject({ tier: 5, ready: 5, week: { done: true } });
    seasons.claim(1);
    expect(profiles.current.xp).toBe(100);
    seasons.claimAll();
    expect(seasons.view.ready).toBe(0);
    expect(profiles.current.gifted).toContain('shatter.ember');

    const again = new SeasonService(
      storage,
      new ProfileService(storage, () => ({ modes: ['sand'], daily: true })),
      clock.now,
    );
    expect(again.view).toMatchObject({ points: 1400 + WEEKLY_GOAL_POINTS, tier: 5, ready: 0 });
    expect(JSON.parse(storage.get(SEASON_KEY)!)).toMatchObject({ season: 'embers' });
  });

  it('shows a lagging save as the calendar stands: the week’s goal fresh, a new season empty', () => {
    const storage = new MemoryStorage();
    const clock = new FrozenClock(utc('2027-01-20T12:00:00Z'));
    const seasons = new SeasonService(
      storage,
      new ProfileService(storage, () => ({ modes: [], daily: true })),
      clock.now,
    );
    seasons.recordGame(game({ fire: 40 }), 300);
    expect(seasons.view.week).toMatchObject({ done: true, deeds: 35 });
    clock.set(utc('2027-01-25T00:00:00Z'));
    expect(seasons.view).toMatchObject({
      span: { season: { id: 'tides' } },
      points: 0,
      week: { deeds: 0, done: false, event: { element: 'water' } },
    });
  });
});

describe('After a season', () => {
  it('its looks come first in the day-7 gift, the latest season first, never its crown', () => {
    const looks = seasonLooksOverAt(utc('2027-03-10T00:00:00Z'));
    expect(looks).toEqual([
      'shatter.ripple',
      'ambiance.lagoon',
      'material.tideglass',
      'shatter.ember',
      'ambiance.embers',
      'material.cinder',
      'shatter.riftspark',
    ]);
    const none = () => false;
    expect(giftOf(6, none, looks)).toMatchObject({ kind: 'look', cosmetic: { id: 'ripple' } });
    const owned = (cosmetic: { kind: string; id: string }) => cosmetic.id === 'ripple';
    expect(giftOf(6, owned, looks)).toMatchObject({ cosmetic: { id: 'lagoon' } });
    expect(seasonLooksOverAt(utc('2026-12-13T00:00:00Z'))).toEqual([]);
  });
});

describe('The Atelier, before a season', () => {
  it('shows a season’s looks from its start, or once the player has one, never months ahead', () => {
    const before = utc('2026-12-13T23:00:00Z');
    expect(seasonOfLook('shatter.ember')).toBe('embers');
    expect(seasonOfLook('material.neon')).toBeNull();
    expect(lookShown('material.neon', before, false)).toBe(true);
    expect(lookShown('shatter.riftspark', before, false)).toBe(true);
    expect(lookShown('shatter.ember', before, false)).toBe(false);
    expect(lookShown('shatter.ember', before, true)).toBe(true);
    expect(lookShown('shatter.ember', utc('2026-12-14T00:00:00Z'), false)).toBe(true);
  });
});
