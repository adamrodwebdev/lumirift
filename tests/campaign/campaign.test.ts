import { describe, expect, it } from 'vitest';
import { CampaignProgress } from '@/campaign/CampaignProgress';
import { CampaignRun } from '@/campaign/CampaignRun';
import type { LiveState } from '@/campaign/Goals';
import { CHAPTERS, guardianLevel, LEVELS, levelById, MAX_STARS } from '@/campaign/Levels';
import { boostsFor, nextRankCost, timeBonusMs, UPGRADES } from '@/campaign/Upgrades';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { CAMPAIGN_KEY, CampaignService } from '@/services/CampaignService';
import { NO_BOOSTS } from '@/session/Boosts';
import { levelOpening, modeOpen } from '@/campaign/ModeUnlocks';
import { isPrototype } from '@/session/ModeCatalog';
import { MODE_IDS } from '@/session/ModeId';

const state = (patch: Partial<LiveState> = {}): LiveState => ({
  lines: 0,
  clears: 0,
  bestAtOnce: 0,
  score: 0,
  bossDamage: 0,
  durationMs: 0,
  fill: 0,
  ...patch,
});

describe('Campaign levels', () => {
  it('has ten chapters of six levels, each with its duel, and Guardians after the duels', () => {
    expect(LEVELS).toHaveLength(69);
    for (const chapter of CHAPTERS) {
      const levels = LEVELS.filter((level) => level.chapter === chapter && !level.boss);
      expect(levels).toHaveLength(6);
      expect(levels.at(-1)!.modeId).toBe('duel');
    }
    const guardians = LEVELS.filter((level) => level.boss);
    expect(guardians).toMatchObject([
      { id: '2-7', chapter: 2, modeId: 'sand', boss: 'duneWorm' },
      { id: '3-7', chapter: 3, modeId: 'mosaic', boss: 'ceramicGolem' },
      { id: '4-7', chapter: 4, modeId: 'tower', boss: 'towerEye' },
      { id: '5-7', chapter: 5, modeId: 'classic', boss: 'riftHeart' },
      // The rematches (1.38): stronger, the Heart at full strength last.
      { id: '6-7', chapter: 6, modeId: 'sand', boss: 'duneWorm', bossHealth: 150 },
      { id: '7-7', chapter: 7, modeId: 'mosaic', boss: 'ceramicGolem', bossHealth: 150 },
      { id: '8-7', chapter: 8, modeId: 'tower', boss: 'towerEye', bossHealth: 150 },
      { id: '9-7', chapter: 9, modeId: 'classic', boss: 'riftHeart', bossHealth: 150 },
      { id: '10-7', chapter: 10, modeId: 'classic', boss: 'riftHeart', bossHealth: 200 },
    ]);
    for (const guardian of guardians) {
      expect(guardian.goal).toEqual({ kind: 'boss', target: guardian.bossHealth ?? 100 });
    }
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(69);
    expect(MAX_STARS).toBe(207);
  });

  it('keeps the first fight of each Guardian for its weekly challenge, not its rematch', () => {
    expect(guardianLevel('duneWorm')!.id).toBe('2-7');
    expect(guardianLevel('riftHeart')!.id).toBe('5-7');
  });

  it('visits every mode of the game, or opens it (the race, once its three worlds were seen)', () => {
    const played = new Set(LEVELS.map((level) => level.modeId));
    // A mode on test (Dunes, 1.37) has no level yet: it lives in its own build.
    for (const mode of MODE_IDS) {
      if (isPrototype(mode)) expect(played.has(mode)).toBe(false);
      else expect(played.has(mode) || levelOpening(mode) !== null).toBe(true);
    }
    const race = levelOpening('race')!;
    for (const world of ['classic', 'sand', 'tower'] as const) {
      expect(LEVELS.slice(0, LEVELS.indexOf(race)).some((level) => level.modeId === world)).toBe(
        true,
      );
    }
  });
});

describe('CampaignRun', () => {
  const lines = levelById('1-3')!; // 10 lines in 2 min 30

  it('opens the race once the Tower’s first level is won, every other mode from the start', () => {
    const fresh = new CampaignProgress({ stars: {}, ranks: {} });
    expect(modeOpen('race', fresh)).toBe(false);
    expect(modeOpen('tower', fresh)).toBe(true);
    const towerWon = new CampaignProgress({
      stars: Object.fromEntries(
        LEVELS.slice(0, LEVELS.indexOf(levelById('4-3')!) + 1).map((l) => [l.id, 1]),
      ),
      ranks: {},
    });
    expect(modeOpen('race', towerWon)).toBe(true);
  });

  it('ends the level as soon as a live goal is met, stars by the time left', () => {
    const run = new CampaignRun(lines, lines.timeLimitMs);
    expect(run.check(state({ lines: 9 }))).toBeNull();
    expect(run.progress(state({ lines: 12 }))).toEqual({ value: 10, target: 10 });
    expect(run.check(state({ lines: 10, durationMs: 60_000 }))).toEqual({
      levelId: '1-3',
      won: true,
      stars: 3,
    });
    expect(run.check(state({ lines: 10, durationMs: 120_000 }))?.stars).toBe(2);
    expect(run.check(state({ lines: 10, durationMs: 140_000 }))?.stars).toBe(1);
  });

  it('loses when the game ends before the goal', () => {
    const run = new CampaignRun(lines, lines.timeLimitMs);
    expect(run.end('timeUp', state({ lines: 4 }))).toEqual({
      levelId: '1-3',
      won: false,
      stars: 0,
    });
  });

  it('judges a duel by its outcome, and its stars by how fast it is won', () => {
    const duel = levelById('1-6')!;
    const run = new CampaignRun(duel, null);
    expect(run.check(state({ lines: 50 }))).toBeNull();
    expect(run.end('defeat', state()).won).toBe(false);
    expect(run.end('victory', state({ durationMs: 60_000 })).stars).toBe(3);
    expect(run.end('victory', state({ durationMs: 200_000 })).stars).toBe(1);
  });

  it('counts survival with the lines cleared on the way', () => {
    const tide = levelById('2-1')!;
    const run = new CampaignRun(tide, tide.timeLimitMs);
    expect(run.check(state({ durationMs: 89_000 }))).toBeNull();
    expect(run.check(state({ durationMs: 90_000, lines: 13 }))?.stars).toBe(3);
    expect(run.end('timeUp', state({ durationMs: 90_000, lines: 2 })).stars).toBe(1);
  });
});

describe('CampaignProgress', () => {
  it('opens the levels in order and keeps the best stars', () => {
    const progress = new CampaignProgress();
    expect(progress.isUnlocked(LEVELS[0]!)).toBe(true);
    expect(progress.isUnlocked(LEVELS[1]!)).toBe(false);
    expect(progress.record('1-1', 2)).toBe(2);
    expect(progress.isUnlocked(LEVELS[1]!)).toBe(true);
    expect(progress.record('1-1', 1)).toBe(0);
    expect(progress.record('1-1', 3)).toBe(1);
    expect(progress.totalStars).toBe(3);
    expect(progress.nextLevel.id).toBe('1-2');
  });

  it('buys upgrade ranks with stars, up to three, and refunds them', () => {
    const progress = new CampaignProgress({
      stars: { '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 1 },
      ranks: {},
    });
    expect(progress.availableStars).toBe(10);
    expect(progress.buy('phoenix')).toBe(true); // 2
    expect(progress.buy('phoenix')).toBe(true); // 3
    expect(progress.buy('phoenix')).toBe(true); // 5
    expect(progress.rankOf('phoenix')).toBe(3);
    expect(progress.buy('phoenix')).toBe(false); // top rank
    expect(progress.availableStars).toBe(0);
    expect(progress.buy('prism')).toBe(false); // too expensive
    progress.refund();
    expect(progress.availableStars).toBe(10);
  });

  it('reads saved data defensively', () => {
    const progress = CampaignProgress.parse({
      stars: { '1-1': 2, '9-9': 3, '1-2': 7 },
      ranks: { phoenix: 9, nope: 1, prism: 1 },
    });
    // 2 stars cannot pay for phoenix 3 + prism 1: the ranks are given back.
    expect(progress.snapshot.stars).toEqual({ '1-1': 2 });
    expect(progress.snapshot.ranks).toEqual({});
  });
});

describe('Upgrades', () => {
  it('are ten, three ranks each, costing 2, 3 then 5 stars', () => {
    expect(UPGRADES).toHaveLength(10);
    expect([0, 1, 2, 3].map(nextRankCost)).toEqual([2, 3, 5, null]);
  });

  it('turn ranks into the help each family reads', () => {
    expect(boostsFor({})).toEqual(NO_BOOSTS);
    const boosts = boostsFor({ feather: 3, spyglass: 2, phoenix: 1, rampart: 2, prism: 1 });
    expect(boosts.gravityScale).toBeCloseTo(0.7);
    expect(boosts.extraPreview).toBe(2);
    expect(boosts.rescueRows).toBe(4);
    expect(boosts.garbageDelayMs).toBe(2000);
    expect(boosts.scoreBonus).toBeCloseTo(0.1);
    expect(timeBonusMs({ hourglass: 2 })).toBe(30_000);
  });
});

describe('CampaignService', () => {
  it('saves won levels and upgrades on the device', () => {
    const storage = new MemoryStorage();
    const service = new CampaignService(storage);
    expect(service.record({ levelId: '1-1', won: true, stars: 3 })).toBe(3);
    expect(service.record({ levelId: '1-2', won: false, stars: 0 })).toBe(0);
    expect(service.buy('hourglass')).toBe(true);
    expect(storage.get(CAMPAIGN_KEY)).toContain('hourglass');
    const again = new CampaignService(storage);
    expect(again.model.totalStars).toBe(3);
    expect(again.model.rankOf('hourglass')).toBe(1);
  });
});
