import { describe, expect, it } from 'vitest';
import { BEAT_CHARTS } from '@/campaign/BeatCharts';
import { judgeLevel, LEAST_WINS } from '@/campaign/curve/CurveBands';
import { curveBot } from '@/campaign/curve/CurveBot';
import { loadoutFor, STARS_BY_CHAPTER } from '@/campaign/curve/CurveLoadout';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import {
  CurveMeter,
  intensityOf,
  phasePressures,
  TRACE_MS,
  type CurveReport,
} from '@/campaign/curve/CurveReport';
import { alignedLines, rescueOf } from '@/campaign/curve/MosaicChoice';
import { aimSand } from '@/campaign/curve/SandAim';
import { GOAL_RULES } from '@/campaign/Goals';
import { LEVELS, levelById } from '@/campaign/Levels';
import { MAX_RANK, RANK_COSTS, UPGRADE_IDS, type UpgradeId } from '@/campaign/Upgrades';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { measure } from '@/families/falling/ai/BoardFeatures';
import { SilhouetteEvaluator } from '@/families/falling/ai/SilhouetteEvaluator';
import { Board } from '@/families/falling/board/Board';
import { createSoloSession } from '@/families/falling';
import type { MosaicView } from '@/families/placement';
import { Grid } from '@/families/placement/engine/Grid';
import { Shape } from '@/families/placement/engine/Shape';
import { createSandSession, type SandView } from '@/families/sand';
import { GRAINS_PER_CELL, SandGrid } from '@/families/sand/engine/SandGrid';
import { SandPiece } from '@/families/sand/engine/SandPiece';

const G = GRAINS_PER_CELL;

/** Frames of a pressure, as the bot measures them. */
function measured(steps: readonly [pressure: number, ms: number][], idle = false): CurveMeter {
  const meter = new CurveMeter();
  for (const [pressure, ms] of steps) {
    for (let t = 0; t < ms; t += 16) meter.frame(pressure, idle, 16);
  }
  return meter;
}

const game = { levelId: '1-3', skill: 'newcomer' as const, seed: 1 };

describe('The curve report (1.33)', () => {
  it('counts the time under pressure, the near misses, the peak and the first danger', () => {
    const report = measured([
      [0.4, 1000],
      [0.9, 1000],
      [0.5, 1000],
      [0.3, 1000],
    ]).report(game, { won: true, reason: 'goal', progress: 1 });
    expect(report.pressureMs).toBeGreaterThanOrEqual(2000);
    expect(report.pressureMs).toBeLessThan(2100);
    // Critical, then safe again: a danger survived.
    expect(report.nearMisses).toBe(1);
    expect(report.peak).toBe(0.9);
    expect(report.dangerAtMs).toBeGreaterThan(1000);
    expect(report.dangerAtMs).toBeLessThan(1100);
    expect(report.trace.length).toBe(Math.ceil(report.durationMs / TRACE_MS));
  });

  it('counts a level won in a critical danger as a near miss, a lost one not', () => {
    const critical = () => measured([[0.95, 500]]);
    expect(critical().report(game, { won: true, reason: 'goal', progress: 1 }).nearMisses).toBe(1);
    expect(
      critical().report(game, { won: false, reason: 'topOut', progress: 0.5 }).nearMisses,
    ).toBe(0);
  });

  it('counts the time with nothing to act on as dead time', () => {
    const report = measured([[0.2, 1000]], true).report(game, {
      won: false,
      reason: 'cap',
      progress: 0,
    });
    expect(report.deadMs).toBe(report.durationMs);
  });

  it('reads an intensity from 1 to 10 in each third of a game', () => {
    const trace = [0, 0, 0, 0.45, 0.45, 0.45, 0.9, 0.9, 0.9];
    expect(phasePressures({ trace })).toEqual([0, 0.45, 0.9]);
    expect(phasePressures({ trace }).map(intensityOf)).toEqual([1, 6, 10]);
  });
});

/** Six games of a player, won or not, at a pressure. */
const games = (skill: PlayerSkill, won: number, pressure = 0.4): CurveReport[] =>
  Array.from({ length: 6 }, (_, k) => ({
    levelId: '3-1',
    skill,
    seed: k + 1,
    won: k < won,
    reason: k < won ? 'goal' : 'timeUp',
    progress: k < won ? 1 : 0.5,
    durationMs: 9000,
    pressureMs: 0,
    deadMs: 0,
    nearMisses: 0,
    peak: pressure,
    dangerAtMs: null,
    trace: Array.from({ length: 9 }, () => pressure),
  }));

describe('The curve bands (1.33)', () => {
  it('charts every level of the campaign, and nothing else, from 1 to 10', () => {
    expect(Object.keys(BEAT_CHARTS).sort()).toEqual(LEVELS.map((level) => level.id).sort());
    for (const chart of Object.values(BEAT_CHARTS)) {
      for (const value of chart.intensity) expect(value >= 1 && value <= 10).toBe(true);
    }
  });

  it('asks more wins of each player in the lessons than in the peaks, and none of the finale’s regular', () => {
    expect(LEAST_WINS.teach.regular).toBeGreaterThan(LEAST_WINS.boss.regular!);
    expect(LEAST_WINS.finale.regular).toBeUndefined();
  });

  it('says how a level strays from its band, and nothing when it is in it', () => {
    const level = levelById('3-1')!;
    const chart = BEAT_CHARTS['3-1']!;
    const pressure = 0.35;
    expect(
      judgeLevel(level, chart, [
        ...games('newcomer', 0, pressure),
        ...games('regular', 6, pressure),
        ...games('expert', 6, pressure),
      ]),
    ).toEqual([]);
    const problems = judgeLevel(level, chart, [
      ...games('newcomer', 0, 0.9),
      ...games('regular', 4, 0.9),
      ...games('expert', 6, 0.9),
    ]);
    expect(problems).toContain('3-1: the regular wins 4 of 6, 5 asked');
    expect(problems).toContain('3-1: third 1 plays at 10 for the regular, 2 charted');
  });
});

describe('The upgrades of a regular player (1.33)', () => {
  it('grow chapter by chapter, never costing more stars than earned', () => {
    expect(loadoutFor(1)).toEqual({});
    let previous = {} as Partial<Record<UpgradeId, number>>;
    for (let chapter = 1; chapter <= 10; chapter++) {
      const ranks = loadoutFor(chapter);
      const spent = Object.values(ranks).reduce<number>(
        (sum, rank) => sum + RANK_COSTS.slice(0, rank).reduce((a, b) => a + b, 0),
        0,
      );
      expect(spent).toBeLessThanOrEqual(STARS_BY_CHAPTER[chapter - 1]!);
      for (const [id, rank] of Object.entries(previous)) {
        expect(ranks[id as UpgradeId]).toBeGreaterThanOrEqual(rank);
      }
      previous = ranks;
    }
  });

  it('owns every rank from chapter 9, a hundred stars in all (1.38)', () => {
    const full = Object.fromEntries(UPGRADE_IDS.map((id) => [id, MAX_RANK]));
    expect(loadoutFor(8)).not.toEqual(full);
    expect(loadoutFor(9)).toEqual(full);
    expect(loadoutFor(10)).toEqual(full);
  });
});

describe('The curve players (1.33)', () => {
  it('see the rows side by side that one piece could clear at once', () => {
    const grid = Grid.fromRows([
      '........',
      '........',
      '###..###',
      '###..###',
      '###..###',
      '........',
      '........',
      '........',
    ]);
    expect(alignedLines(grid)).toBe(3);
    expect(alignedLines(new Grid())).toBe(0);
  });

  it('press a joker when no piece of the hand fits: a new hand first, else a bomb on the crowd', () => {
    const grid = Grid.fromRows(
      Array.from({ length: 8 }, (_, y) => (y < 2 ? '#.#.#.#.' : '########')),
    );
    const view = (jokers: MosaicView['jokers']) =>
      ({
        grid,
        jokers,
        canUndo: false,
        golem: null,
        pieceAt: () => null,
        pieces: () => [{ slot: 0, piece: { id: 1, shape: Shape.parse('##'), tone: Tone.I } }],
        canPlace: () => false,
        linesIfPlaced: () => ({ rows: [], columns: [] }),
      }) satisfies MosaicView;
    expect(rescueOf(view(['undo', 'reroll']))).toEqual({ type: 'joker', index: 1 });
    // The first 3 × 3 square full of tiles.
    expect(rescueOf(view(['bomb']))).toEqual({ type: 'joker', index: 0, x: 1, y: 3 });
    expect(rescueOf(view([]))).toBeNull();
  });

  it('lay a colour where it stretches its colour toward the walls, and lightning on water', () => {
    const grid = new SandGrid();
    const floor = grid.height - 1;
    for (let x = 0; x < grid.width; x++) {
      for (let y = floor - G + 1; y <= floor; y++)
        grid.put(x, y, x < 30 ? Tone.ChromaA : Tone.ChromaB, 0);
    }
    const view = { grid, worm: null } as unknown as SandView;
    const piece = (tone: Tone) => SandPiece.spawn('O', tone, grid.width);
    const colour = aimSand(view, piece(Tone.ChromaA));
    // Beside its colour's region, stretching it to the right.
    expect(colour.x).toBeGreaterThanOrEqual(3 * G);
    expect(colour.x).toBeLessThanOrEqual(6 * G);
    for (let x = 48; x < 54; x++) grid.put(x, floor - G, Tone.Water, 0);
    const bolt = aimSand(view, piece(Tone.Lightning));
    expect(bolt.x).toBeGreaterThanOrEqual(7 * G);
  });

  it('fill a silhouette rather than clear lines', () => {
    const target = new Set([10 * 21, 10 * 21 + 1, 10 * 21 + 2, 10 * 21 + 3]);
    const placement = (rows: string[]) => {
      const after = Board.fromRows([
        ...Array.from({ length: 20 - rows.length }, () => '..........'),
        ...rows,
      ]);
      return { rotation: 0 as const, x: 0, lines: 0, features: measure(after), after };
    };
    const evaluator = new SilhouetteEvaluator(target);
    expect(evaluator.score(placement(['####......']))).toBeGreaterThan(
      evaluator.score(placement(['......####'])),
    );
  });

  it('play a level to its end and report it', () => {
    const report = curveBot(new Date(2026, 9, 26)).play({
      level: levelById('1-3')!,
      skill: 'expert',
      seed: 1,
    });
    expect(report).toMatchObject({ levelId: '1-3', skill: 'expert', won: true, reason: 'goal' });
    expect(report.progress).toBe(1);
    expect(report.durationMs).toBeGreaterThan(5000);
  });
});

describe('The levels the curve retuned (1.33)', () => {
  it('asks for most of a silhouette, and counts it as it fills', () => {
    expect(levelById('3-4')!.goal).toEqual({ kind: 'fill', target: 85 });
    const state = {
      lines: 0,
      clears: 0,
      bestAtOnce: 0,
      score: 0,
      durationMs: 1,
      bossDamage: 0,
      fill: 86,
    };
    expect(GOAL_RULES.fill.live).toBe(true);
    expect(GOAL_RULES.fill.progress(state, { kind: 'fill', target: 85 })).toBe(86);
    const silhouette = createSoloSession('silhouette', {
      random: new SeededRandom(1),
      timeLimitMs: null,
      today: new Date(2026, 9, 26),
    });
    silhouette.start();
    expect(silhouette.filled()).toBe(0);
  });

  it('opens the elements’ practice on a bed of sand', () => {
    const level = levelById('1-2')!;
    const practice = createSandSession('sand', {
      random: new SeededRandom(1),
      timeLimitMs: null,
      practice: true,
    }) as unknown as { view: SandView };
    expect(level.practice).toBe(true);
    expect(practice.view.grid.sandHeight()).toBeGreaterThan(0.15 * practice.view.grid.height);
  });
});
