import { describe, expect, it } from 'vitest';
import { BeatGrid } from '@/services/audio/BeatGrid';

interface Played {
  readonly beat: number;
  readonly time: number;
  readonly beatS: number;
}

/** Runs the grid like the music's scheduler: every 0.12 s, 0.4 s ahead. */
function run(grid: BeatGrid, from: number, to: number, played: Played[] = []): Played[] {
  for (let now = from; now <= to + 1e-9; now += 0.12) {
    grid.advance(now, now + 0.4, (beat, time, beatS) => played.push({ beat, time, beatS }));
  }
  return played;
}

describe('BeatGrid', () => {
  it('plays the beats at the tempo, each once, ahead of time', () => {
    const grid = new BeatGrid(60);
    grid.start(0);
    const played = run(grid, 0, 3);
    expect(played.map((p) => p.beat)).toEqual([0, 1, 2, 3]);
    played.forEach((p, i) => expect(p.time).toBeCloseTo(0.1 + i));
  });

  it('changes the tempo at the next bar', () => {
    const grid = new BeatGrid(60);
    grid.start(0);
    run(grid, 0, 0.5);
    grid.setTempo(120);
    const played = run(grid, 0.6, 5);
    expect(played.find((p) => p.beat === 3)!.beatS).toBe(1);
    expect(played.find((p) => p.beat === 4)!.beatS).toBe(0.5);
  });

  it('knows where the music is between two beats', () => {
    const grid = new BeatGrid(60);
    grid.start(0);
    run(grid, 0, 2);
    expect(grid.at(1.6).beat).toBeCloseTo(1.5);
    expect(grid.at(1.6).beatS).toBe(1);
  });

  it('leaves a pulse already in time alone', () => {
    const grid = new BeatGrid(60);
    grid.start(0);
    run(grid, 0, 2);
    // Beat 2 (the game's 3rd, same place in the bar) falls at 2.1 s.
    expect(grid.follow(2.11, 3)).toBe(false);
  });

  it('moves the beats onto a game pulse out of time, at its tempo, bars aligned', () => {
    const grid = new BeatGrid(60);
    grid.start(0);
    const before = run(grid, 0, 2);
    const scheduled = before.at(-1)!;
    grid.setTempo(100);
    // The game's first beat of a bar (count 5) falls at 2.4 s, between the music's beats.
    expect(grid.follow(2.4, 5)).toBe(true);
    const after = run(grid, 2.4, 6).filter((p) => p.time > scheduled.time);
    const first = after[0]!;
    // No beat played twice, none squeezed against the last one scheduled.
    expect(first.beat).toBeGreaterThan(scheduled.beat);
    expect(first.time - scheduled.time).toBeGreaterThanOrEqual(0.3 - 1e-9);
    for (const p of after) {
      // On the game's grid: a whole number of its beats (0.6 s) after 2.4 s.
      const beats = (p.time - 2.4) / 0.6;
      expect(beats).toBeCloseTo(Math.round(beats));
      // The game's bars: its count 5 (a first beat) is a music beat 0 of 4.
      expect((((p.beat - Math.round(beats)) % 4) + 4) % 4).toBe(0);
      expect(p.beatS).toBeCloseTo(0.6);
    }
    // Then it stays in time.
    expect(grid.follow(2.4 + 0.6 * 6, 11)).toBe(false);
  });
});
