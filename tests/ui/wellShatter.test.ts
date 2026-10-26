import { describe, expect, it } from 'vitest';
import { SHATTER_FALL_MS, wellShatter } from '@/ui/components/wellShatter';

const coordinates = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('wellShatter', () => {
  it('breaks the same glass for the same well, its cracks inside the well, running from the impact', () => {
    const shatter = wellShatter(312, 621);
    expect(wellShatter(312, 621)).toEqual(shatter);
    expect(shatter.impact.y).toBeLessThan(20);
    for (const crack of shatter.cracks) {
      expect(crack.length).toBeGreaterThan(0);
      expect(crack.runMs).toBeGreaterThan(0);
      expect(crack.delayMs).toBeGreaterThanOrEqual(0);
      coordinates(crack.d).forEach((value, i) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(i % 2 === 0 ? 312 : 621);
      });
    }
    // Every crack has run before the panes fall: the glass breaks, then gives way.
    const inner = shatter.cracks.filter((crack) => crack.inner);
    expect(inner.length).toBeGreaterThan(10);
    expect(Math.max(...inner.map((crack) => crack.delayMs + crack.runMs))).toBeLessThan(
      SHATTER_FALL_MS,
    );
    // Some glass stays, cracked down to the floor.
    expect(shatter.cracks.some((crack) => !crack.inner && crack.length > 200)).toBe(true);
  });

  it('lets a score of panes near the impact fall out of the well, after the cracks', () => {
    const { panes } = wellShatter(312, 621);
    expect(panes.length).toBeGreaterThanOrEqual(15);
    for (const pane of panes) {
      expect(pane.left).toBeGreaterThanOrEqual(0);
      expect(pane.left + pane.width).toBeLessThanOrEqual(312.5);
      expect(pane.width * pane.height).toBeGreaterThan(0);
      // It falls past the well's floor, wherever it starts.
      expect(pane.top + pane.fall).toBeGreaterThan(621);
      expect(pane.delayMs).toBeGreaterThanOrEqual(SHATTER_FALL_MS);
      expect(
        [pane.burstX, pane.burstY, pane.spin, pane.originX, pane.originY].every(Number.isFinite),
      ).toBe(true);
    }
  });

  it('breaks a wide well too (the Tower), its panes inside it', () => {
    const { panes, cracks } = wellShatter(640, 512);
    expect(panes.length).toBeGreaterThan(0);
    expect(cracks.length).toBeGreaterThan(0);
    for (const pane of panes) expect(pane.left + pane.width).toBeLessThanOrEqual(640.5);
  });
});
