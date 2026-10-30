import { describe, expect, it } from 'vitest';
import {
  clearImpact,
  comboBreakHeard,
  comboLook,
  landingImpact,
  sandClearHoldMs,
} from '@/fx/Impact';

describe('the impact scale (1.41)', () => {
  it('keeps an ordinary landing tiny: a slight squash, no hold, no shake, no pulse', () => {
    for (const distance of [0, 5, 18]) {
      const impact = landingImpact(false, distance);
      expect(impact.squash).toBe(0.04);
      expect(impact.stack).toBe(0.03);
      expect([impact.holdMs, impact.trauma, impact.dip, impact.flash]).toEqual([0, 0, 0, 0]);
      expect(impact.vibrate).toBe(0);
    }
  });

  it('weighs a hard drop with its height', () => {
    const short = landingImpact(true, 2);
    const full = landingImpact(true, 18);
    expect(short.dip).toBe(0);
    expect(landingImpact(true, 3).dip).toBeCloseTo(0.04, 9);
    expect(full.dip).toBeCloseTo(0.12, 9);
    expect(full.squash).toBeCloseTo(0.1, 9);
    expect(full.stack).toBeCloseTo(0.08, 9);
    expect(short.vibrate).toBe(11);
    expect(full.vibrate).toBe(20);
    expect(landingImpact(true, 40)).toEqual(full);
    expect(full.holdMs).toBe(0);
  });

  it('holds a clear by its lines: none for one, 35, 60, 100 for a RIFT!', () => {
    expect([1, 2, 3, 4].map((lines) => clearImpact(lines, 0).holdMs)).toEqual([0, 35, 60, 100]);
  });

  it('adds 10 ms a step from ×3, 40 at most, never past 140 ms', () => {
    // The engine's combo is 0 at a chain's first clear: ×(combo + 1).
    expect([0, 1, 2, 3, 4, 5, 9].map((combo) => clearImpact(1, combo).holdMs)).toEqual([
      0, 0, 10, 20, 30, 40, 40,
    ]);
    expect(clearImpact(4, 9).holdMs).toBe(140);
  });

  it('shakes harder with the lines and the combo, a RIFT! tilting and flashing', () => {
    expect([1, 2, 3, 4].map((lines) => clearImpact(lines, 0).trauma)).toEqual([
      0.15, 0.25, 0.4, 0.65,
    ]);
    expect(clearImpact(1, 4).trauma).toBeCloseTo(0.35, 9);
    expect(clearImpact(4, 20).trauma).toBe(1);
    const rift = clearImpact(4, 0);
    expect([rift.tilt, rift.flash, rift.flashMs]).toEqual([true, 0.35, 220]);
    expect(rift.vibrate).toEqual([30, 40, 80]);
    expect([clearImpact(3, 0).flash, clearImpact(3, 0).flashMs]).toEqual([0.15, 120]);
    expect([clearImpact(2, 0).tilt, clearImpact(2, 0).flash]).toEqual([false, 0]);
  });

  it('pulses longer with each step of a combo, 60 ms at most', () => {
    expect(clearImpact(1, 0).vibrate).toBe(26);
    expect(clearImpact(1, 4).vibrate).toBe(44);
    expect(clearImpact(1, 9).vibrate).toBe(60);
  });

  it("holds Sand's clears by their regions", () => {
    expect([1, 2, 3, 5].map(sandClearHoldMs)).toEqual([0, 35, 60, 60]);
  });

  it('grows and heats a combo, a shout at its milestones', () => {
    expect(comboLook(2)).toEqual({ size: 1.05, heat: 'gold', shout: null });
    expect(comboLook(3)).toEqual({ size: 1.13, heat: 'orange', shout: 'hot' });
    expect(comboLook(5).heat).toBe('red');
    expect(comboLook(5).shout).toBe('blazing');
    expect(comboLook(8)).toMatchObject({ heat: 'white', shout: 'inferno' });
    expect(comboLook(10)).toEqual({ size: 1.6, heat: 'white', shout: 'riftbreaker' });
    expect(comboLook(20).size).toBe(1.6);
    expect(comboLook(4).shout).toBeNull();
  });

  it('lets a broken combo be heard from ×3', () => {
    expect([2, 3, 7].map(comboBreakHeard)).toEqual([false, true, true]);
  });
});
