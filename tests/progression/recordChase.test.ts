import { describe, expect, it } from 'vitest';
import { RecordChase } from '@/progression/RecordChase';

describe('RecordChase', () => {
  it('celebrates once, at the moment the score goes past the record', () => {
    const chase = new RecordChase(1200);
    expect(chase.update(800)).toBe(false);
    expect(chase.update(1200)).toBe(false);
    expect(chase.update(1210)).toBe(true);
    expect(chase.beaten).toBe(true);
    expect(chase.update(2000)).toBe(false);
  });

  it('shows the record, then the score once it is beaten', () => {
    const chase = new RecordChase(1200);
    expect(chase.shown(300)).toBe(1200);
    expect(chase.shown(1500.4)).toBe(1500);
  });

  it('has nothing to beat on a first game', () => {
    const chase = new RecordChase(null);
    expect(chase.shown(500)).toBeNull();
    expect(chase.update(500)).toBe(false);
    expect(new RecordChase(0).update(10)).toBe(false);
  });
});
