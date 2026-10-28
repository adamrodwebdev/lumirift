import { describe, expect, it } from 'vitest';
import { BEAT_CHARTS } from '@/campaign/BeatCharts';
import {
  chartOf,
  GENERATED_CHAPTERS,
  ROLE_BEATS,
  slotOf,
  slotsOf,
  type LevelKind,
} from '@/campaign/generator/ChapterPlan';
import { generateLevel, ideaOf } from '@/campaign/generator/LevelGenerators';
import {
  alike,
  MOST_TRIES,
  PackSearch,
  SELECTION_SEEDS,
  VALIDATION_SEEDS,
  type LevelJudge,
  type LevelVerdict,
} from '@/campaign/generator/PackSearch';
import { LEVELS } from '@/campaign/Levels';
import { LEVEL_PACKS } from '@/campaign/packs';
import { parseLevelPack } from '@/campaign/packs/LevelPack';
import type { GoalKind } from '@/campaign/Goals';
import type { ModeId } from '@/session/ModeId';

/** The modes each kind of level may draw. */
const KIND_MODES: Readonly<Record<LevelKind, readonly ModeId[]>> = {
  falling: [
    'classic',
    'mirror',
    'flip',
    'fusion',
    'chroma',
    'tilt',
    'rhythm',
    'tide',
    'silhouette',
  ],
  sand: ['sand'],
  mosaic: ['mosaic'],
  tower: ['tower'],
  duel: ['duel'],
};

const slots = GENERATED_CHAPTERS.flatMap((chapter) => slotsOf(chapter));

describe('The plan of the generated chapters (1.38)', () => {
  it('gives chapters 6 to 10 six levels each, the duel last, every family in each', () => {
    expect(GENERATED_CHAPTERS).toEqual([6, 7, 8, 9, 10]);
    for (const chapter of GENERATED_CHAPTERS) {
      const plan = slotsOf(chapter);
      expect(plan.map((slot) => slot.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `${chapter}-${n}`));
      expect(plan.at(-1)!.kind).toBe('duel');
      expect(new Set(plan.map((slot) => slot.kind))).toEqual(
        new Set(['falling', 'sand', 'mosaic', 'tower', 'duel']),
      );
      // Its two falling wells never draw the same mode.
      const falling = plan.flatMap((slot) => slot.modes ?? []);
      expect(new Set(falling).size).toBe(falling.length);
    }
    expect(slotOf('6-3')).toMatchObject({ role: 'spike', kind: 'falling' });
    expect(slotOf('5-3')).toBeUndefined();
  });

  it('brings every falling mode back over the five chapters', () => {
    const drawn = new Set(slots.flatMap((slot) => slot.modes ?? []));
    expect(drawn).toEqual(new Set(KIND_MODES.falling));
  });
});

describe('The level generators (1.38)', () => {
  it('draw the same level from the same seed, and others from others', () => {
    for (const slot of slots) {
      expect(generateLevel(slot, 7)).toEqual(generateLevel(slot, 7));
    }
    const sand = slotOf('6-1')!;
    const drawn = new Set(
      Array.from({ length: 12 }, (_, k) => JSON.stringify(generateLevel(sand, k + 1))),
    );
    expect(drawn.size).toBeGreaterThan(3);
  });

  it('keep each slot to its kind, its modes, its id and a playable goal', () => {
    for (const slot of slots) {
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(slot, seed);
        expect(level).toMatchObject({ id: slot.id, chapter: slot.chapter });
        expect(slot.modes ?? KIND_MODES[slot.kind]).toContain(level.modeId);
        expect(level.goal.target).toBeGreaterThan(0);
        if (level.timeLimitMs !== null) {
          expect(level.timeLimitMs).toBeGreaterThanOrEqual(90_000);
          expect(level.timeLimitMs).toBeLessThanOrEqual(5 * 60_000);
        } else {
          expect(['fill', 'win']).toContain(level.goal.kind);
        }
        if (slot.kind === 'duel') expect(['normal', 'hard', 'expert']).toContain(level.variant);
        // A goal outside a kind's usual ones comes only where a slot asks for it.
        if (slot.goals) expect(slot.goals).toContain(level.goal.kind);
        else expect(level.goal.kind).not.toBe('score');
      }
    }
  });

  it('chart a level from its role, with its idea in words', () => {
    const slot = slotOf('6-3')!;
    const level = generateLevel(slot, 1);
    expect(ideaOf(level)).toMatch(/^(mirror|tide): /);
    expect(chartOf(slot, ideaOf(level))).toEqual({
      ...ROLE_BEATS.spike,
      role: 'spike',
      idea: ideaOf(level),
    });
  });
});

describe('The shipped packs (1.38)', () => {
  it('hold six levels a chapter, each drawn again from its seed as it was kept', () => {
    expect(LEVEL_PACKS.map((pack) => pack.chapter)).toEqual(GENERATED_CHAPTERS);
    for (const pack of LEVEL_PACKS) {
      expect(pack.levels).toHaveLength(6);
      for (const { seed, level } of pack.levels) {
        // A change to a generator shows here: the packs are written again (`npm run generate:levels`).
        expect(level).toEqual(generateLevel(slotOf(level.id)!, seed));
      }
    }
  });

  it('end each generated chapter on its Guardian’s rematch, and chart every level', () => {
    for (const chapter of GENERATED_CHAPTERS) {
      const levels = LEVELS.filter((level) => level.chapter === chapter);
      expect(levels).toHaveLength(7);
      expect(levels.at(-1)!.boss).toBeDefined();
      for (const level of levels) expect(BEAT_CHARTS[level.id]).toBeDefined();
    }
  });
});

describe('A level pack (1.38)', () => {
  const level = {
    id: '6-1',
    modeId: 'sand',
    timeLimitMs: 150_000,
    goal: { kind: 'lines', target: 6 },
    stars: { kind: 'timeLeft' },
  };
  const pack = (entry: object) => ({ chapter: 6, levels: [{ seed: 3, level: entry }] });

  it('reads the levels the generator wrote', () => {
    expect(parseLevelPack(pack(level))).toEqual({
      chapter: 6,
      levels: [{ seed: 3, level: { ...level, chapter: 6 } }],
    });
    const duel = { ...level, id: '6-6', modeId: 'duel', variant: 'hard', timeLimitMs: null };
    expect(parseLevelPack(pack(duel)).levels[0]!.level.variant).toBe('hard');
  });

  it('turns down a broken pack, saying where', () => {
    expect(() => parseLevelPack(null)).toThrow(/root/);
    expect(() => parseLevelPack({ chapter: 6 })).toThrow(/no levels/);
    expect(() => parseLevelPack(pack({ ...level, id: '7-1' }))).toThrow(/not of the chapter/);
    expect(() => parseLevelPack(pack({ ...level, modeId: 'tetris' }))).toThrow(/no mode/);
    expect(() => parseLevelPack(pack({ ...level, goal: { kind: 'gold' } }))).toThrow(/no goal/);
    expect(() => parseLevelPack(pack({ ...level, goal: { kind: 'lines', target: -1 } }))).toThrow(
      /target/,
    );
    expect(() => parseLevelPack(pack({ ...level, stars: { kind: 'luck' } }))).toThrow(/star/);
    expect(() => parseLevelPack(pack({ ...level, stars: { kind: 'lines', two: 4 } }))).toThrow(
      /three/,
    );
    expect(() => parseLevelPack(pack({ ...level, variant: 'godlike' }))).toThrow(/no AI/);
    expect(() => parseLevelPack(pack({ ...level, timeLimitMs: '2 min' }))).toThrow(/clock/);
  });
});

describe('The pack search (1.38)', () => {
  const verdict = (intensity: readonly number[], problems: readonly string[] = []) => ({
    problems,
    wins: { newcomer: 2, regular: 6, expert: 6 },
    intensity,
  });
  /** A judge that answers in turn, then passes every level at the chart's own intensity. */
  const judge = (answers: readonly LevelVerdict[]) => {
    const calls: (readonly number[])[] = [];
    const run: LevelJudge = (_level, chart, seeds) => {
      const answer = answers[calls.length] ?? verdict(chart.intensity);
      calls.push(seeds);
      return answer;
    };
    return { run, calls };
  };
  const refused = verdict([3, 3, 4], ['too hard']);
  const slot = slotOf('6-1')!;

  /** The first seeds that draw different levels: the search judges each level once. */
  const distinctSeeds = (count: number): number[] => {
    const seen = new Set<string>();
    const seeds: number[] = [];
    for (let seed = 1; seeds.length < count; seed++) {
      const key = JSON.stringify(generateLevel(slot, seed));
      if (seen.has(key)) continue;
      seen.add(key);
      seeds.push(seed);
    }
    return seeds;
  };

  it('keeps, of the first three in band on both sets of games, the one closest to its chart', () => {
    // A breather is charted [3, 3, 4]. The first level fails the first games,
    // the second the other set; the next three hold, the fourth closest.
    const { run, calls } = judge([
      refused,
      verdict([3, 3, 4]),
      refused,
      verdict([2, 3, 5]),
      verdict([2, 3, 5]),
      verdict([3, 3, 4]),
      verdict([3, 4, 4]),
      verdict([5, 5, 5]),
      verdict([5, 5, 5]),
    ]);
    const [first, second, third, fourth, fifth] = distinctSeeds(5);
    const kept = new PackSearch(run).level(slot);
    expect(kept.seed).toBe(fourth);
    expect(kept.level).toEqual(generateLevel(slot, fourth!));
    expect(kept.distance).toBeCloseTo(0.25);
    expect(kept.alternatives.map((each) => each.seed)).toEqual([third, fifth]);
    expect(kept.rejected.map((each) => [each.seed, each.problems])).toEqual([
      [first, ['too hard']],
      [second, ['again: too hard']],
    ]);
    expect(calls).toEqual([
      SELECTION_SEEDS,
      SELECTION_SEEDS,
      VALIDATION_SEEDS,
      ...[3, 4, 5].flatMap(() => [SELECTION_SEEDS, VALIDATION_SEEDS]),
    ]);
    expect(SELECTION_SEEDS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(VALIDATION_SEEDS).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('judges a level drawn twice only once', () => {
    // A duel draws one of two AIs: two candidates at most, whatever the seeds.
    const { run, calls } = judge([]);
    const kept = new PackSearch(run).level(slotOf('6-6')!);
    expect(kept.alternatives).toHaveLength(1);
    expect(calls).toHaveLength(4);
  });

  it('turns down, unplayed, a level like one kept before; a duel may repeat', () => {
    const { run } = judge([]);
    const first = generateLevel(slot, 1);
    const kept = new PackSearch(run).level(slot, [first]);
    expect(alike(kept.level, first)).toBe(false);
    expect(kept.rejected[0]).toEqual({ seed: 1, idea: ideaOf(first), problems: ['like 6-1'] });
    const duel = slotOf('6-6')!;
    const fight = new PackSearch(run).level(duel, [generateLevel(duel, 1)]);
    expect(fight.seed).toBe(1);
  });

  it('takes two levels for the same one by their mode, their goal, a target within a quarter and a clock within 30 s', () => {
    const level = (modeId: ModeId, kind: GoalKind, target: number, minutes = 3) => ({
      ...generateLevel(slot, 1),
      modeId,
      timeLimitMs: minutes * 60_000,
      goal: { kind, target },
    });
    expect(alike(level('tower', 'lines', 4, 2), level('tower', 'lines', 4, 2.5))).toBe(true);
    expect(alike(level('tower', 'lines', 4), level('tower', 'lines', 5))).toBe(true);
    // The same goal on a clock a minute longer is another level.
    expect(alike(level('tower', 'lines', 4, 2), level('tower', 'lines', 4, 3))).toBe(false);
    expect(alike(level('tilt', 'lines', 20), level('tilt', 'lines', 21))).toBe(true);
    expect(alike(level('sand', 'lines', 5), level('sand', 'lines', 8))).toBe(false);
    expect(alike(level('tilt', 'lines', 20), level('mirror', 'lines', 20))).toBe(false);
    expect(alike(level('mosaic', 'lines', 3), level('mosaic', 'bigClear', 3))).toBe(false);
    // A tide's target is its clock: two tides half a minute apart are alike.
    expect(
      alike(level('tide', 'survive', 150_000, 2.5), level('tide', 'survive', 180_000, 3)),
    ).toBe(true);
  });

  it('gives up after its tries, with every rejection', () => {
    const { run } = judge(Array.from({ length: 2 * MOST_TRIES }, () => refused));
    expect(() => new PackSearch(run).level(slot)).toThrow(
      new RegExp(`6-1: no level in its band after ${MOST_TRIES} seeds`),
    );
  });
});
