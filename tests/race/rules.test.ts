import { describe, expect, it } from 'vitest';
import { clearGainMs, RaceClock } from '@/families/race/rules/RaceClock';
import { CLOCK } from '@/families/race/rules/RaceTuning';
import { guardianJoins, ShiftSchedule } from '@/families/race/rules/ShiftSchedule';

describe('The race’s clock (1.34)', () => {
  it('pays 2 s a line, N more in a combo ×N, 13 s for four lines at once', () => {
    expect(clearGainMs(1, 0)).toBe(2000);
    expect(clearGainMs(2, 0)).toBe(4000);
    expect(clearGainMs(1, 2)).toBe(5000);
    expect(clearGainMs(4, 0)).toBe(13_000);
    expect(clearGainMs(0, 3)).toBe(0);
  });

  it('starts at 1:30, holds 99 s at most and says what would spill over', () => {
    const clock = new RaceClock();
    expect(clock.leftMs).toBe(90_000);
    expect(clock.spill(13_000)).toBe(4000);
    clock.gain(13_000);
    expect(clock.leftMs).toBe(CLOCK.capMs);
    expect(clock.spill(2000)).toBe(2000);
  });

  it('costs 10 s an overflow, never leaving less than 5 s', () => {
    const clock = new RaceClock();
    clock.overflow();
    expect(clock.leftMs).toBe(80_000);
    clock.tick(72_000);
    clock.overflow();
    expect(clock.leftMs).toBe(5000);
    clock.tick(2000);
    clock.overflow();
    expect(clock.leftMs).toBe(3000);
    clock.tick(3000);
    expect(clock.expired).toBe(true);
  });
});

describe('The turn of the worlds (1.34)', () => {
  it('goes well, Sand, Tower, then again, a cycle raising the multiplier', () => {
    const schedule = new ShiftSchedule();
    const seen: string[] = [];
    for (let k = 0; k < 7; k++) {
      seen.push(`${schedule.world}:${schedule.cycle}`);
      schedule.advance(false);
    }
    expect(seen).toEqual(['well:1', 'sand:1', 'tower:1', 'well:2', 'sand:2', 'tower:2', 'well:3']);
  });

  it('raises the gravity on the fresh board of each cycle, announced in the warning', () => {
    const schedule = new ShiftSchedule();
    const levels: number[] = [];
    const announced: boolean[] = [];
    for (let k = 0; k < 6; k++) {
      levels.push(schedule.level);
      announced.push(schedule.speedsUp(false));
      schedule.advance(false);
    }
    expect(levels).toEqual([1, 1, 1, 2, 2, 2]);
    expect(announced).toEqual([false, false, true, false, false, true]);
  });

  it('waits for the next world when a Guardian has just fallen', () => {
    const schedule = new ShiftSchedule();
    schedule.advance(false);
    schedule.advance(false);
    // The Tower's Guardian beaten: the well of the second cycle keeps the gravity.
    expect(schedule.speedsUp(true)).toBe(false);
    schedule.advance(true);
    expect(schedule.level).toBe(1);
    expect(schedule.speedsUp(false)).toBe(true);
    schedule.advance(false);
    expect(schedule.level).toBe(2);
  });

  it('sends no Guardian at the first shift, one surely at the second, then more and more likely', () => {
    expect(guardianJoins(1, 0, 0)).toBe(false);
    expect(guardianJoins(2, 0, 0.99)).toBe(true);
    expect(guardianJoins(3, 0, 0.3)).toBe(false);
    expect(guardianJoins(3, 1, 0.3)).toBe(true);
    expect(guardianJoins(6, 3, 0.99)).toBe(true);
  });
});
