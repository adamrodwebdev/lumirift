import { describe, expect, it } from 'vitest';
import { Emitter } from '@/core/Emitter';
import { dayKey, previousDay } from '@/core/Day';
import { COSMETICS, isUnlocked } from '@/progression/Cosmetics';
import { experienceFor, GUARDIAN_XP, levelProgress, MIN_GAME_MS } from '@/progression/Experience';
import { GameTracker, type GameReport } from '@/progression/GameReport';
import { objectivesOfDay } from '@/progression/Objectives';
import { newCosmetics, Profile } from '@/progression/Profile';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { PROFILE_KEY, ProfileService } from '@/services/ProfileService';
import type { GameSession, SessionEventMap } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';

const MODES: readonly ModeId[] = ['classic', 'sand', 'mosaic', 'tower'];

const report = (patch: Partial<GameReport> = {}): GameReport => ({
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

describe('Day', () => {
  it('names days and steps back across months and years', () => {
    expect(dayKey(new Date(2026, 9, 12))).toBe('20261012');
    expect(previousDay('20260301')).toBe('20260228');
    expect(previousDay('20270101')).toBe('20261231');
  });
});

describe('GameTracker', () => {
  it('counts clears, lines, the biggest clear, the longest combo and the time played', () => {
    const events = new Emitter<SessionEventMap>();
    const tracker = new GameTracker({ events } as unknown as GameSession);
    events.emit('clear', { lines: 1, points: 10, combo: 0 });
    events.emit('clear', { lines: 4, points: 800, combo: 1 });
    tracker.tick(1500);
    const result = tracker.report({ modeId: 'classic', daily: false, variant: null, reason: 'x' });
    expect(result).toMatchObject({
      clears: 2,
      lines: 5,
      bestAtOnce: 4,
      bestCombo: 2,
      durationMs: 1500,
    });
    tracker.dispose();
    events.emit('clear', { lines: 1, points: 10, combo: 0 });
    expect(
      tracker.report({ modeId: 'classic', daily: false, variant: null, reason: 'x' }).clears,
    ).toBe(2);
  });
});

describe('Experience', () => {
  it('rewards time, clears and victories, never a quick restart', () => {
    const sources = (r: GameReport) => experienceFor(r).map((line) => line.source);
    expect(sources(report())).toEqual(['game', 'time', 'clears']);
    expect(experienceFor(report({ durationMs: MIN_GAME_MS - 1, clears: 0, lines: 0 }))).toEqual([
      { source: 'time', amount: 3 },
    ]);
    const beaten = (variant: string) =>
      experienceFor(report({ reason: 'victory', variant })).find((l) => l.source === 'victory')!
        .amount;
    expect(beaten('expert')).toBeGreaterThan(beaten('rookie'));
  });

  it('climbs levels on a rising curve, up to 50', () => {
    expect(levelProgress(0)).toEqual({ level: 1, into: 0, needed: 100 });
    expect(levelProgress(100)).toEqual({ level: 2, into: 0, needed: 140 });
    expect(levelProgress(239).level).toBe(2);
    expect(levelProgress(240).level).toBe(3);
    expect(levelProgress(1e9)).toEqual({ level: 50, into: 0, needed: 0 });
  });
});

describe('Objectives', () => {
  it('gives three objectives a day, one per tier, of different kinds, the same for all', () => {
    const day = objectivesOfDay('20261012', MODES);
    expect(day.map((o) => o.tier)).toEqual(['easy', 'medium', 'hard']);
    expect(new Set(day.map((o) => o.kind)).size).toBe(3);
    expect(objectivesOfDay('20261012', MODES)).toEqual(day);
    const week = Array.from({ length: 30 }, (_, i) =>
      objectivesOfDay(`202611${String(i + 1).padStart(2, '0')}`, MODES),
    );
    expect(new Set(week.flat().map((o) => o.kind)).size).toBeGreaterThan(5);
  });
});

describe('Profile', () => {
  it('starts a new player with the training, once (1.29)', () => {
    const profile = new Profile();
    expect(profile.needsTraining).toBe(true);
    expect(profile.finishTraining()).toBe(true);
    expect(profile.finishTraining()).toBe(false);
    expect(profile.needsTraining).toBe(false);
    expect(Profile.parse(profile.snapshot).needsTraining).toBe(false);
    // Saved before the training existed, with games played: the menus, as before.
    const veteran = Profile.parse({ xp: 120, games: 4 });
    expect(veteran.snapshot.trained).toBe(false);
    expect(veteran.needsTraining).toBe(false);
  });

  it('earns experience and completes the objectives of the day', () => {
    const profile = new Profile();
    const day = '20261012';
    const objectives = profile.objectivesFor(day, MODES);
    expect(objectives).toHaveLength(3);
    const progress = profile.recordGame(report(), day, MODES);
    expect(progress.total).toBeGreaterThan(0);
    expect(profile.snapshot.games).toBe(1);
    expect(profile.snapshot.xp).toBe(progress.total);
    for (const done of progress.completed) {
      expect(profile.snapshot.objectives.find((o) => o.objective === done)?.done).toBe(true);
    }
  });

  it("doubles a game's experience once, for a watched rewarded ad", () => {
    const profile = new Profile();
    const progress = profile.recordGame(report(), '20261012', MODES);
    const doubled = profile.doubleExperience(progress);
    expect(doubled.total).toBe(progress.total * 2);
    expect(doubled.xp.at(-1)).toEqual({ source: 'bonus', amount: progress.total });
    expect(profile.snapshot.xp).toBe(progress.total * 2);
    expect(profile.doubleExperience(doubled)).toBe(doubled);
    expect(profile.snapshot.xp).toBe(progress.total * 2);
    const nothing = { ...progress, xp: [], total: 0 };
    expect(profile.doubleExperience(nothing)).toBe(nothing);
  });

  it('never completes an objective twice', () => {
    const profile = new Profile();
    const day = '20261012';
    let completed = 0;
    for (let i = 0; i < 20; i++) {
      completed += profile.recordGame(
        report({ daily: true, reason: 'victory', variant: 'expert' }),
        day,
        MODES,
      ).completed.length;
    }
    expect(completed).toBeLessThanOrEqual(3);
    expect(profile.snapshot.objectivesDone).toBe(completed);
  });

  it('pays the daily bonus once a day, and keeps the streak going day after day', () => {
    const profile = new Profile();
    const daily = report({ daily: true });
    const bonus = (day: string) =>
      profile.recordGame(daily, day, MODES).xp.some((line) => line.source === 'daily');
    expect(bonus('20261010')).toBe(true);
    expect(bonus('20261010')).toBe(false);
    expect(bonus('20261011')).toBe(true);
    expect(profile.snapshot.streak).toMatchObject({ count: 2, best: 2 });
    bonus('20261014'); // a day missed
    expect(profile.snapshot.streak).toMatchObject({ count: 1, best: 2 });
  });

  it('pays the Guardian challenge bonus on the first attempt of each day, and remembers it', () => {
    const profile = new Profile();
    const challenge = report({ guardian: true, modeId: 'sand' });
    const bonus = (day: string) =>
      profile.recordGame(challenge, day, MODES).xp.find((line) => line.source === 'guardian')
        ?.amount ?? 0;
    expect(bonus('20261019')).toBe(GUARDIAN_XP);
    expect(bonus('20261019')).toBe(0);
    expect(bonus('20261020')).toBe(GUARDIAN_XP);
    // An ordinary game never pays it.
    expect(
      profile.recordGame(report(), '20261021', MODES).xp.some((line) => line.source === 'guardian'),
    ).toBe(false);
    const saved = Profile.parse(JSON.parse(JSON.stringify(profile.snapshot)));
    expect(saved.snapshot.guardianDay).toBe('20261020');
    expect(Profile.parse({ guardianDay: 'yesterday' }).snapshot.guardianDay).toBeNull();
  });

  it('unlocks cosmetics with the level, and only lets the player wear unlocked ones', () => {
    const profile = new Profile();
    expect(profile.equip('material', 'neon')).toBe(false);
    expect(profile.equip('material', 'nothing')).toBe(false);
    let unlocked: string[] = [];
    for (let i = 0; i < 12; i++) {
      unlocked = unlocked.concat(
        profile
          .recordGame(
            report({ durationMs: 400_000, clears: 40, lines: 60 }),
            `202610${10 + i}`,
            MODES,
          )
          .unlocked.map((c) => c.id),
      );
    }
    expect(profile.level).toBeGreaterThanOrEqual(3);
    expect(unlocked).toContain('neon');
    expect(profile.equip('material', 'neon')).toBe(true);
    expect(profile.snapshot.equipment.material).toBe('neon');
  });

  it('marks the looks earned as new until the player has seen them', () => {
    const profile = new Profile();
    expect(newCosmetics(profile.snapshot)).toEqual([]);
    for (let i = 0; i < 6; i++)
      profile.recordGame(
        report({ durationMs: 400_000, clears: 40, lines: 60 }),
        `202610${10 + i}`,
        MODES,
      );
    const fresh = newCosmetics(profile.snapshot);
    expect(fresh.map((cosmetic) => cosmetic.id)).toContain('neon');
    const materials = fresh.filter((cosmetic) => cosmetic.kind === 'material');
    expect(profile.markSeen(materials)).toBe(true);
    expect(newCosmetics(profile.snapshot).some((c) => c.kind === 'material')).toBe(false);
    expect(profile.markSeen(materials)).toBe(false);
    // A look still locked is not seen: it will be new once earned.
    const gold = COSMETICS.find((c) => c.kind === 'material' && c.id === 'gold')!;
    expect(profile.markSeen([gold])).toBe(false);
  });

  it('counts what an old save had earned as seen, and keeps the seen list valid', () => {
    const old = Profile.parse({ xp: 2000 });
    expect(old.level).toBe(9);
    expect(newCosmetics(old.snapshot)).toEqual([]);
    const parsed = Profile.parse({ xp: 2000, seen: ['material.neon', 'nope', 3, 'material.neon'] });
    expect(parsed.snapshot.seen).toEqual(['material.neon']);
    const fresh = newCosmetics(parsed.snapshot).map((cosmetic) => cosmetic.id);
    expect(fresh).toContain('paper');
    expect(fresh).not.toContain('neon');
    // What every player starts with is never news.
    expect(fresh).not.toContain('crystal');
  });

  it('reads saved data defensively', () => {
    const profile = Profile.parse({
      xp: -5,
      games: 'many',
      streak: { count: 3, best: 4, lastDay: 'yesterday' },
      equipment: { material: 'diamond', ambiance: 'aurora' },
      objectives: [{ objective: { kind: 'nope' } }, 12],
    });
    expect(profile.snapshot).toMatchObject({
      xp: 0,
      games: 0,
      streak: { count: 3, best: 4, lastDay: null },
      equipment: { material: 'crystal', ambiance: 'aurora', shatter: 'shards' },
      objectives: [],
    });
  });
});

describe('Cosmetics', () => {
  it('has exactly one default per kind, the rest to be earned', () => {
    const none = { level: 1, bestStreak: 0, objectivesDone: 0, bosses: [] };
    const free = COSMETICS.filter((c) => isUnlocked(c, none));
    expect(free.map((c) => c.kind).sort()).toEqual(['ambiance', 'material', 'shatter']);
  });

  it('gives the Dune scales to the player who defeats the Dune Wyrm', () => {
    const dunes = COSMETICS.find((c) => c.id === 'dunes')!;
    const before = { level: 50, bestStreak: 99, objectivesDone: 999, bosses: [] };
    expect(isUnlocked(dunes, before)).toBe(false);
    expect(isUnlocked(dunes, { ...before, bosses: ['duneWorm' as const] })).toBe(true);
  });
});

describe('ProfileService', () => {
  it('saves every change on the device and reads it back', () => {
    const storage = new MemoryStorage();
    const service = new ProfileService(storage, () => MODES);
    service.recordGame(report(), '20261012');
    expect(storage.get(PROFILE_KEY)).toContain('"games":1');
    const again = new ProfileService(storage, () => MODES);
    expect(again.current.games).toBe(1);
    expect(again.current.xp).toBe(service.current.xp);
  });

  it('remembers the looks the player has seen', () => {
    const storage = new MemoryStorage();
    storage.set(PROFILE_KEY, JSON.stringify({ xp: 300, seen: ['material.crystal'] }));
    const service = new ProfileService(storage, () => MODES);
    const fresh = newCosmetics(service.current);
    expect(fresh.map((cosmetic) => cosmetic.id)).toEqual(
      expect.arrayContaining(['neon', 'aurora']),
    );
    service.markSeen(fresh);
    expect(newCosmetics(service.current)).toEqual([]);
    expect(newCosmetics(new ProfileService(storage, () => MODES).current)).toEqual([]);
  });
});
