import { describe, expect, it } from 'vitest';
import {
  BED,
  LOOP_LIMITS,
  barSamples,
  bassOffsets,
  bedMatch,
  clickRatio,
  foldTail,
  levelStepDb,
  median,
  mixed,
  turn,
  worstDropout,
} from '../../media/loopSound';

/** A low sample rate keeps the searches quick; every check takes the rate it is given. */
const RATE = 8000;

/** Seeded noise in [-1, 1): the same every run. */
function noise(length: number, seed: number, level = 1): Float32Array {
  let state = seed >>> 0;
  return Float32Array.from({ length }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 * level - level;
  });
}

const sine = (length: number, hz: number, rate = RATE, level = 0.5) =>
  Float32Array.from({ length }, (_, i) => level * Math.sin((2 * Math.PI * hz * i) / rate));

const stereo = (samples: Float32Array) => [samples, samples.slice()];

describe("the clips' music bed", () => {
  it('lasts four whole bars at 96 BPM: 10 s, 300 frames of 1 600 samples', () => {
    const samples = barSamples(BED.bars, BED.bpm, 48_000);
    expect(samples).toBe(480_000);
    expect(samples / 1600).toBe(300);
  });

  it('refuses a tempo whose bars are not a whole number of samples', () => {
    expect(() => barSamples(4, 84, 48_000)).toThrow(/not a whole number/);
  });

  it("folds what rings past the window's end onto its head, as the loop plays it", () => {
    // A note in the window's last tenth rings 30 samples past its end.
    const note = (k: number) => 0.9 ** k;
    const samples = new Float32Array(10 + 100 + 30);
    for (let k = 0; k < 40; k++) samples[100 + k] = note(k);
    const loop = foldTail(samples, 10, 100);
    // The window played again and again: the note at 90 of every period, its ring in the next.
    const steady = Float32Array.from({ length: 100 }, (_, i) =>
      i >= 90 ? note(i - 90) : i < 30 ? note(i + 10) : 0,
    );
    expect(loop.length).toBe(100);
    loop.forEach((value, i) => expect(value).toBeCloseTo(steady[i] ?? NaN, 6));
  });

  it('turns so that its first sample plays where it is put', () => {
    expect([...turn(Float32Array.of(1, 2, 3, 4, 5), 2)]).toEqual([4, 5, 1, 2, 3]);
    expect([...turn(Float32Array.of(1, 2, 3, 4, 5), 7)]).toEqual([4, 5, 1, 2, 3]);
    expect([...turn(Float32Array.of(1, 2, 3, 4, 5), 0)]).toEqual([1, 2, 3, 4, 5]);
  });

  it('is heard with the effects as the sum of their samples', () => {
    const [left] = mixed([[Float32Array.of(0.25, 0.5)], [Float32Array.of(0.25, -0.5)]]);
    expect([...(left ?? [])]).toEqual([0.5, 0]);
  });
});

describe("a loop's seam", () => {
  // 480 Hz at 8 kHz: a period of 50/3 samples; 1 000 samples are 60 whole periods.
  const whole = stereo(sine(1000, 480));

  it('keeps its level when the sound runs through it', () => {
    expect(Math.abs(levelStepDb(whole, 0, RATE))).toBeLessThan(0.5);
  });

  it('shows the silence the old AAC start put after it', () => {
    // 8 ms of digital silence at the start, as every clip of 4 November had.
    const muted = whole.map((samples) => samples.map((value, i) => (i < 64 ? 0 : value)));
    expect(levelStepDb(muted, 0, RATE)).toBeLessThan(-LOOP_LIMITS.seamStepDb);
    expect(worstDropout(muted, RATE)).toEqual({ atMs: 0, depthDb: Infinity });
  });

  it('finds no dropout in sound that runs on, nor before an onset', () => {
    expect(worstDropout(stereo(noise(4000, 1, 0.3)), RATE).depthDb).toBeLessThan(10);
    // Quiet sound, then a burst 30 dB louder: the window before the burst is no hole.
    const onset = noise(4000, 2, 0.01).map((value, i) => (i >= 2000 ? value * 31.6 : value));
    expect(worstDropout(stereo(onset), RATE).depthDb).toBeLessThan(LOOP_LIMITS.dropoutDb);
  });

  it('does not click where the wave runs on, and clicks where it jumps', () => {
    expect(clickRatio(whole, 0, RATE)).toBeLessThanOrEqual(1.01);
    // A quarter of a period too long: from the top of the wave straight back to zero.
    const cut = stereo(sine(1005, 480, RATE));
    expect(clickRatio(cut, 0, RATE)).toBeGreaterThan(LOOP_LIMITS.clickRatio);
  });
});

describe('the bass on the grid', () => {
  /** Bass notes (70 Hz, a 10 ms attack, 0.2 s long) over a pad's root (147 Hz). */
  function bassLine(times: readonly number[], length: number) {
    const out = sine(length, 147, RATE, 0.05);
    for (const time of times) {
      for (let i = 0; i < 0.2 * RATE && time + i < length; i++) {
        const attack = Math.min(1, i / (0.01 * RATE));
        const decay = Math.exp(-i / (0.05 * RATE));
        out[time + i] =
          (out[time + i] ?? 0) + 0.3 * attack * decay * Math.sin((2 * Math.PI * 70 * i) / RATE);
      }
    }
    return stereo(out);
  }
  const grid = [0, 2000, 4000, 6000];

  it('finds every note at one offset from its grid time', () => {
    const offsets = bassOffsets(bassLine(grid, 8000), grid, RATE);
    const middle = median(offsets);
    for (const offset of offsets) {
      expect(Math.abs(offset - middle)).toBeLessThanOrEqual(LOOP_LIMITS.bassSpreadMs);
    }
    expect(middle).toBeGreaterThanOrEqual(0);
    expect(middle).toBeLessThan(25);
  });

  it('sees a note played 12 ms late', () => {
    const offsets = bassOffsets(bassLine([0, 2096, 4000, 6000], 8000), grid, RATE);
    expect(Math.abs((offsets[1] ?? 0) - median(offsets))).toBeGreaterThan(LOOP_LIMITS.bassSpreadMs);
  });

  it('sees a note missing after the seam', () => {
    const offsets = bassOffsets(bassLine([2000, 4000, 6000], 8000), grid, RATE);
    expect(Math.abs((offsets[0] ?? 0) - median(offsets))).toBeGreaterThan(LOOP_LIMITS.bassSpreadMs);
  });
});

describe('the bed in a clip', () => {
  const bed = stereo(noise(16_000, 3, 0.2));

  it('is found in time, alone or under louder effects', () => {
    expect(bedMatch(bed, bed, 8000, RATE)).toEqual({ lagMs: 0, correlation: expect.closeTo(1, 6) });
    const effects = stereo(noise(16_000, 4, 0.6));
    const clip = mixed([bed, effects]);
    const match = bedMatch(clip, bed, 8000, RATE);
    expect(match.lagMs).toBe(0);
    expect(match.correlation).toBeGreaterThan(LOOP_LIMITS.bedCorrelation);
  });

  it('is found where it plays, 5 ms late', () => {
    const late = bed.map((samples) => turn(samples, 40));
    expect(bedMatch(late, bed, 8000, RATE).lagMs).toBe(5);
  });

  it('is not found in a clip without it', () => {
    const other = stereo(noise(16_000, 5, 0.2));
    expect(bedMatch(other, bed, 8000, RATE).correlation).toBeLessThan(LOOP_LIMITS.bedCorrelation);
  });
});
