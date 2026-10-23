import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import type { SandGrid } from './SandGrid';

/** Grains reported per event for the effects (a sample is enough to show it). */
const SAMPLE = 160;

/** A grain where something happened, for the effects. */
export interface GrainSample {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
}

/**
 * Samples of grains for the effects of a game of Sand (1.28): a clear, a
 * burn, a reaction is shown by a few grains of it, never all of them.
 */
export class GrainSampler {
  constructor(
    private readonly grid: SandGrid,
    private readonly random: RandomSource,
  ) {}

  /** A sample of grains already removed, with the tones they had. */
  removed(indices: readonly number[], tones: readonly Tone[]): GrainSample[] {
    const step = Math.max(1, Math.floor(indices.length / SAMPLE));
    const samples: GrainSample[] = [];
    for (let k = 0; k < indices.length; k += step) {
      const i = indices[k]!;
      samples.push({ x: i % this.grid.width, y: Math.floor(i / this.grid.width), tone: tones[k]! });
    }
    return samples;
  }

  /** Grains around a place, for a puff of effects where something happened. */
  around(at: number): GrainSample[] {
    const W = this.grid.width;
    const samples: GrainSample[] = [];
    for (let k = 0; k < 24; k++) {
      samples.push({
        x: (at % W) + this.random.nextInt(9) - 4,
        y: Math.floor(at / W) + this.random.nextInt(9) - 4,
        tone: Tone.Steam,
      });
    }
    return samples;
  }

  /** A sample of grains in place, with their tones now. */
  standing(indices: readonly number[]): GrainSample[] {
    const step = Math.max(1, Math.floor(indices.length / SAMPLE));
    const samples: GrainSample[] = [];
    for (let k = 0; k < indices.length; k += step) {
      const i = indices[k]!;
      samples.push({
        x: i % this.grid.width,
        y: Math.floor(i / this.grid.width),
        tone: this.grid.tones[i] as Tone,
      });
    }
    return samples;
  }
}
