import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { SandGrid } from '@/families/sand/engine/SandGrid';
import {
  SandWind,
  WIND_EVERY_MS,
  WIND_GUST_MS,
  WIND_WARNING_MS,
} from '@/families/sand/engine/SandWind';

describe('SandWind', () => {
  it('holds the gusts off while the sand nears the top', () => {
    const grid = new SandGrid();
    grid.put(0, 2, Tone.ChromaA, 0);
    const phases: string[] = [];
    const wind = new SandWind(grid, new SeededRandom(1), ({ phase }) => phases.push(phase));
    let now = 0;
    for (; now <= 2 * WIND_EVERY_MS; now += 100) wind.update(now);
    expect(phases).toEqual([]);
    // The well cleared, the gust comes at last: announced, blowing, then over.
    grid.remove([2 * grid.width]);
    for (const end = now + 2 * (WIND_WARNING_MS + WIND_GUST_MS); now <= end; now += 100) {
      wind.update(now);
      if (phases.at(-1) === 'start') expect(grid.wind).not.toBe(0);
    }
    expect(phases).toEqual(['soon', 'start', 'end']);
    expect(grid.wind).toBe(0);
  });
});
