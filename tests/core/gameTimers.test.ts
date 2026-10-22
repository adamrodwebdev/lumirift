import { describe, expect, it, vi } from 'vitest';
import { GameTimers } from '@/core/GameTimers';

describe('GameTimers', () => {
  it('runs a call at once, or once its game time has gone by', () => {
    const timers = new GameTimers();
    const seen: string[] = [];
    timers.after(0, () => seen.push('now'));
    timers.after(100, () => seen.push('later'));
    expect(seen).toEqual(['now']);
    timers.update(60);
    expect(seen).toEqual(['now']);
    timers.update(40);
    expect(seen).toEqual(['now', 'later']);
    timers.update(500);
    expect(seen).toEqual(['now', 'later']);
  });

  it('waits with the game: slowed down, a delay lasts longer on the wall clock', () => {
    const timers = new GameTimers();
    const run = vi.fn();
    timers.after(130, run);
    // The surge's pace: a third of each 16-ms frame.
    let frames = 0;
    while (run.mock.calls.length === 0 && frames < 100) {
      timers.update(16 / 3);
      frames++;
    }
    expect(frames).toBe(25);
  });

  it('runs the calls of a long frame in their order, and forgets them when cleared', () => {
    const timers = new GameTimers();
    const seen: number[] = [];
    timers.after(300, () => seen.push(300));
    timers.after(100, () => seen.push(100));
    timers.after(200, () => seen.push(200));
    timers.update(250);
    expect(seen).toEqual([100, 200]);
    timers.clear();
    timers.update(1000);
    expect(seen).toEqual([100, 200]);
  });
});
