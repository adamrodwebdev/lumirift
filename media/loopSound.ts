/*
 * The clips' looping sound (1.46.3), pure: the music bed made a loop of whole
 * bars, turned onto the clip's downbeat, and the checks that a clip's sound
 * runs through its seam and its cuts. The set folds the bed
 * (media/MusicBed.ts); the clip factory turns it, lays the effects over it
 * and checks the clips it writes (scripts/clip-factory.mjs). Plain types
 * only: Node imports this file as it is (the factory is not built).
 */

/** A sound: one array of samples per channel. */
export type Channels = readonly Float32Array[];

/**
 * The clips' music (1.46.3, the user's choice B): the game's own score at one
 * tempo for every clip, four bars of it (Dm, then B♭), at the takes' level (pad,
 * bass and arpeggio: the beat starts at 0.72, the heartbeat with danger). Four
 * bars at 96 beats a minute last exactly 10 s: 300 frames, 480 000 samples.
 */
export const BED = { bpm: 96, bars: 4, intensity: 0.68 } as const;
/** Four beats a bar (BeatGrid). */
export const BEATS_PER_BAR = 4;
/** The bass plays the first and third beats of a bar (Music): a note every two beats. */
export const BASS_EVERY_BEATS = 2;

/** Thresholds of the checks (1.46.3), as the lot's spec sets them (CAHIER § 9 decies). */
export const LOOP_LIMITS = {
  /** A level step across the seam, in 20 ms either side (dB). */
  seamStepDb: 1.5,
  /** A dropout: a 2 ms window this far under the 20 ms on both sides of it (dB). */
  dropoutDb: 20,
  /** A click: the step at a seam or a cut, against the largest within 5 ms (ratio). */
  clickRatio: 2,
  /** Bass notes: each one this close to their median offset from the grid (ms). */
  bassSpreadMs: 5,
  /** The bed in the clip: the best match this close to where it should be (ms)… */
  bedLagMs: 10,
  /** …and at least this correlated, effects over it (the bed alone would be 1). */
  bedCorrelation: 0.25,
  /** What the bed's two renders may differ by outside its own notes, and the ring left at the end (dB under its peak). */
  ownNotesDb: -80,
} as const;

/** Samples in `bars` bars at `bpm`; throws when they are not whole (the loop would drift). */
export function barSamples(bars: number, bpm: number, sampleRate: number): number {
  const samples = (bars * BEATS_PER_BAR * 60 * sampleRate) / bpm;
  if (!Number.isInteger(samples)) {
    throw new Error(`${bars} bars at ${bpm} BPM are ${samples} samples: not a whole number`);
  }
  return samples;
}

/** Where `index` falls in a loop of `length`. */
const wrap = (index: number, length: number) => ((index % length) + length) % length;

/**
 * A window's own sound as a loop (the render-as-loop of a DAW): `length`
 * samples from `start`, and what rings on after the window's end (to the end of
 * `samples`) added onto its head, as the loop plays it after its end.
 */
export function foldTail(samples: Float32Array, start: number, length: number): Float32Array {
  const loop = samples.slice(start, start + length);
  for (let i = start + length; i < samples.length; i++) {
    const at = (i - start) % length;
    loop[at] = (loop[at] ?? 0) + (samples[i] ?? 0);
  }
  return loop;
}

/** The loop turned so that its first sample plays at `at`. */
export function turn(samples: Float32Array, at: number): Float32Array {
  const out = new Float32Array(samples.length);
  const shift = wrap(at, samples.length);
  out.set(samples.subarray(samples.length - shift), 0);
  out.set(samples.subarray(0, samples.length - shift), shift);
  return out;
}

/** Sounds heard together: the sum of their samples (each as long as the first). */
export function mixed(stems: readonly Channels[]): Float32Array[] {
  const [first] = stems;
  if (!first) return [];
  return first.map((samples, channel) => {
    const out = new Float32Array(samples.length);
    for (const stem of stems) {
      const part = stem[channel];
      if (!part) continue;
      for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + (part[i] ?? 0);
    }
    return out;
  });
}

/** The mean power of the channels over [from, to), round the loop. */
function power(channels: Channels, from: number, to: number): number {
  let sum = 0;
  let count = 0;
  for (const samples of channels) {
    for (let i = from; i < to; i++) {
      const value = samples[wrap(i, samples.length)] ?? 0;
      sum += value * value;
      count++;
    }
  }
  return count ? sum / count : 0;
}

const toDb = (ratio: number) => 10 * Math.log10(ratio);
const msToSamples = (ms: number, sampleRate: number) => Math.round((ms / 1000) * sampleRate);

/**
 * The level step across `at`, round the loop (dB): the `spanMs` after it
 * against the `spanMs` before it. At a seam that runs through, it is what the
 * sound does there anyway; a silence or a jump at the seam shows.
 */
export function levelStepDb(channels: Channels, at: number, sampleRate: number, spanMs = 20) {
  const span = msToSamples(spanMs, sampleRate);
  const before = power(channels, at - span, at);
  const after = power(channels, at, at + span);
  if (before === 0 && after === 0) return 0;
  if (before === 0 || after === 0) return after === 0 ? -Infinity : Infinity;
  return toDb(after / before);
}

/** A dropout found in a loop: where (ms) and how far under both sides (dB). */
export interface Dropout {
  readonly atMs: number;
  readonly depthDb: number;
}

/**
 * The deepest dropout of a loop: the 2 ms window furthest under the 20 ms on
 * each side of it, both sides (a window just before an onset is not a hole).
 * Sides quieter than −60 dBFS are silence, not sound with a hole in it.
 */
export function worstDropout(channels: Channels, sampleRate: number): Dropout {
  const window = msToSamples(2, sampleRate);
  const side = 10;
  const length = channels[0]?.length ?? 0;
  const count = Math.floor(length / window);
  const powers = Float64Array.from({ length: count }, (_, k) =>
    power(channels, k * window, (k + 1) * window),
  );
  const floor = 10 ** (-60 / 10);
  let worst: Dropout = { atMs: 0, depthDb: 0 };
  for (let k = 0; k < count; k++) {
    let before = 0;
    let after = 0;
    for (let j = 1; j <= side; j++) {
      before += powers[wrap(k - j, count)] ?? 0;
      after += powers[wrap(k + j, count)] ?? 0;
    }
    const around = Math.min(before, after) / side;
    if (around < floor) continue;
    const here = powers[k] ?? 0;
    const depthDb = here === 0 ? Infinity : toDb(around / here);
    if (depthDb > worst.depthDb) worst = { atMs: (k * window * 1000) / sampleRate, depthDb };
  }
  return worst;
}

/**
 * A click at `at`: the step from the sample before (round the loop) against
 * the largest step within 5 ms of it, the channels together. Under 1, the
 * seam or the cut is as smooth as the sound around it.
 */
export function clickRatio(channels: Channels, at: number, sampleRate: number): number {
  const around = msToSamples(5, sampleRate);
  const step = (i: number) =>
    Math.max(
      ...channels.map((samples) =>
        Math.abs(
          (samples[wrap(i, samples.length)] ?? 0) - (samples[wrap(i - 1, samples.length)] ?? 0),
        ),
      ),
    );
  let largest = 0;
  for (let i = at - around; i <= at + around; i++)
    if (i !== at) largest = Math.max(largest, step(i));
  const here = step(at);
  if (here === 0) return 0;
  return largest === 0 ? Infinity : here / largest;
}

/** A second-order low pass (direct form I), run round the loop: a warm-up of its end first. */
function lowPass(samples: Float32Array, cutoff: number, sampleRate: number): Float32Array {
  const w = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const warm = Math.min(samples.length, sampleRate);
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let n = -warm; n < samples.length; n++) {
    const x = samples[wrap(n, samples.length)] ?? 0;
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    if (n >= 0) out[n] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** The bass band: under 80 Hz, where the bass (D2, B♭1) stands over the pads' roots (B♭2, D3). */
const BASS_HZ = 80;

/**
 * Each bass note's onset against its grid time (ms), in a loop of the bed:
 * where the bass band, twice low-passed, first rises to half of the note's
 * peak. The detector lags every note alike (the attack, the filter): what
 * matters is that the notes keep one offset through the seam.
 */
export function bassOffsets(
  channels: Channels,
  times: readonly number[],
  sampleRate: number,
): number[] {
  const mono = new Float32Array(channels[0]?.length ?? 0);
  for (const samples of channels) samples.forEach((value, i) => (mono[i] = (mono[i] ?? 0) + value));
  const band = lowPass(lowPass(mono, BASS_HZ, sampleRate), BASS_HZ, sampleRate);
  const hop = msToSamples(1, sampleRate);
  const level = (from: number) => {
    let sum = 0;
    for (let i = from; i < from + hop; i++) {
      const value = band[wrap(i, band.length)] ?? 0;
      sum += value * value;
    }
    return Math.sqrt(sum / hop);
  };
  return times.map((time) => {
    const early = time - msToSamples(30, sampleRate);
    const late = time + msToSamples(60, sampleRate);
    let peak = 0;
    for (let at = time; at < late; at += hop) peak = Math.max(peak, level(at));
    let onset = late;
    for (let at = early; at < late; at += hop) {
      if (level(at) >= peak / 2) {
        onset = at;
        break;
      }
    }
    return ((onset - time) * 1000) / sampleRate;
  });
}

/** The middle value. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? (sorted[middle] ?? NaN)
    : ((sorted[middle - 1] ?? NaN) + (sorted[middle] ?? NaN)) / 2;
}

/** How a clip carries its bed around a point: the lag of the best match (ms) and the correlation there. */
export interface BedMatch {
  readonly lagMs: number;
  readonly correlation: number;
}

/**
 * How well `sound` carries `bed` around `at` (both loops of one length): the
 * lag, within ±30 ms, where they match best over the second around `at`, and
 * their correlation there. The bed in time gives a lag of 0; effects over it
 * lower the correlation, a sound without it brings it near 0.
 */
export function bedMatch(sound: Channels, bed: Channels, at: number, sampleRate: number): BedMatch {
  const length = bed[0]?.length ?? 0;
  const half = msToSamples(500, sampleRate);
  const search = msToSamples(30, sampleRate);
  const monoOf = (channels: Channels, from: number, count: number) => {
    const out = new Float64Array(count);
    for (const samples of channels) {
      for (let i = 0; i < count; i++)
        out[i] = (out[i] ?? 0) + (samples[wrap(from + i, length)] ?? 0);
    }
    return out;
  };
  const reference = monoOf(bed, at - half, 2 * half);
  const heard = monoOf(sound, at - half - search, 2 * half + 2 * search);
  let referencePower = 0;
  for (const value of reference) referencePower += value * value;
  let best: BedMatch = { lagMs: 0, correlation: -Infinity };
  for (let lag = -search; lag <= search; lag++) {
    let dot = 0;
    let heardPower = 0;
    for (let i = 0; i < reference.length; i++) {
      const value = heard[i + search + lag] ?? 0;
      dot += value * (reference[i] ?? 0);
      heardPower += value * value;
    }
    const correlation = dot / Math.sqrt(heardPower * referencePower || 1);
    if (correlation > best.correlation) best = { lagMs: (lag * 1000) / sampleRate, correlation };
  }
  return best;
}
