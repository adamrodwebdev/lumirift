import { describe, expect, it, vi } from 'vitest';
import { FrameClock } from '@/app/FrameClock';
import { SeededRandom } from '@/core/Random';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { SandGame, STEP_MS } from '@/families/sand/engine/SandGame';
import { SAND_TONES } from '@/families/sand/engine/SandGrid';
import { FinalSeconds } from '@/session/FinalSeconds';
import { RELIEF_AFTER_MS, Tension } from '@/session/Tension';
import { startedGame } from '../falling/helpers';

describe('Tension', () => {
  it('goes from calm to danger at 70 %, critical at 85 %, and back with some margin', () => {
    const tension = new Tension();
    const stages: string[] = [];
    tension.events.on('stage', ({ stage }) => stages.push(stage));
    for (const pressure of [0.5, 0.69, 0.7, 0.84, 0.86, 0.82, 0.79, 0.6, 0.54]) {
      tension.update(pressure, 16);
    }
    expect(stages).toEqual(['danger', 'critical', 'danger', 'calm']);
  });

  it('brings relief only after a real danger', () => {
    const tension = new Tension();
    const relief = vi.fn();
    tension.events.on('relief', relief);
    // A brush with the threshold: no relief.
    tension.update(0.72, 300);
    tension.update(0.4, 16);
    expect(relief).not.toHaveBeenCalled();
    // A danger held for a while, then escaped.
    for (let t = 0; t < RELIEF_AFTER_MS + 100; t += 100) tension.update(0.8, 100);
    tension.update(0.4, 16);
    expect(relief).toHaveBeenCalledOnce();
  });

  it('eases the amount it shows, and forgets it all on reset', () => {
    const tension = new Tension();
    tension.update(1, 16);
    const early = tension.amount;
    for (let t = 0; t < 2000; t += 16) tension.update(1, 16);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.1);
    expect(tension.amount).toBeGreaterThan(0.99);
    tension.reset();
    expect(tension.amount).toBe(0);
    expect(tension.stage).toBe('calm');
  });
});

describe('FinalSeconds', () => {
  it('calls the final ten seconds, then ticks each second shown', () => {
    const final = new FinalSeconds();
    const heard: string[] = [];
    final.events.on('hurry', () => heard.push('hurry'));
    final.events.on('tick', ({ second }) => heard.push(String(second)));
    for (let left = 12_000; left >= 0; left -= 250) final.update(left);
    expect(heard).toEqual(['hurry', '9', '8', '7', '6', '5', '4', '3', '2', '1']);
    expect(final.urgent).toBe(true);
    final.update(null);
    expect(final.urgent).toBe(false);
  });
});

describe('FrameClock slow motion', () => {
  it('slows the frames down, then brings them back to their pace', () => {
    let tick: ((time: number) => void) | null = null;
    const clock = new FrameClock(
      (callback) => {
        tick = callback;
        return 1;
      },
      () => undefined,
    );
    const deltas: number[] = [];
    clock.subscribe((delta) => deltas.push(Math.round(delta * 10) / 10));
    clock.start();
    let time = 0;
    const frame = () => tick?.((time += 20));
    frame();
    clock.slow(0.25, 200);
    for (let i = 0; i < 12; i++) frame();
    // Slowed for the first half, easing back, then the real pace.
    expect(deltas.slice(1, 6)).toEqual([5, 5, 5, 5, 5]);
    expect(deltas[7]).toBeGreaterThan(5);
    expect(deltas[7]).toBeLessThan(20);
    expect(deltas.at(-1)).toBe(20);
    expect(clock.slowed).toBe(false);
  });
});

describe('the close call', () => {
  it('doubles the points of lines cleared with the well 70 % full (falling)', () => {
    // A column up the left wall; the first piece, an I, fills the floor's gap.
    const tower = (height: number) => [
      ...Array<string>(height - 1).fill('#.........'),
      '###....###',
    ];
    const tense = startedGame({ rows: tower(14) });
    const calm = startedGame({ rows: tower(12) });
    const calls: number[] = [];
    const notices: string[] = [];
    tense.events.on('closeCall', ({ points }) => calls.push(points));
    tense.events.on('notice', ({ id }) => notices.push(id));
    calm.events.on('closeCall', ({ points }) => calls.push(-points));
    tense.hardDrop();
    calm.hardDrop();
    expect(calls).toEqual([100]);
    expect(notices).toContain('closeCall');
    expect(tense.score - calm.score).toBe(100);
  });

  it('doubles the points of regions cleared with the sand 70 % high', () => {
    const clearAt = (rows: number) => {
      const game = new SandGame({ random: new SeededRandom(2), hazards: false });
      const { grid } = game;
      // Upright stripes that link nothing, under one row of a single colour.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < grid.width; x++) {
          const tone = y === rows - 1 ? SAND_TONES[0]! : SAND_TONES[1 + (x % 3)]!;
          grid.put(x, grid.height - 1 - y, tone, 0);
        }
      }
      game.start();
      const calls: number[] = [];
      game.events.on('closeCall', ({ points }) => calls.push(points));
      game.update(STEP_MS);
      return calls;
    };
    expect(clearAt(Math.ceil(120 * 0.72))).toHaveLength(1);
    expect(clearAt(60)).toEqual([]);
  });

  it('doubles the points of lines cleared on a board 70 % full (Mosaic)', () => {
    const board = (full: number) => {
      const rows = [
        '#######.',
        '######.#',
        '#####.##',
        '####.###',
        '###.####',
        '##.#####',
        '#.######',
        '........',
      ].map((row, y) => (y < full ? row : '........'));
      const game = new MosaicGame({
        random: new SeededRandom(1),
        grid: Grid.fromRows(rows),
        opening: [{ shape: Shape.parse('#'), tone: 1 }],
      });
      game.start();
      const calls: number[] = [];
      game.events.on('closeCall', ({ points }) => calls.push(points));
      expect(game.place(0, 7, 0)).toBe(true);
      return calls;
    };
    expect(board(7)).toEqual([10]);
    expect(board(5)).toEqual([]);
  });
});
