// Loudness of a sound, as the apps measure it (ITU-R BS.1770: K-weighted,
// gated), its true peak (BS.1770 annex 2: the level between the samples), and
// the gain that brings it to a target under a true-peak ceiling. The clip
// factory (1.39) sets every clip near −14 LUFS, a common level for video
// online, so that one clip is never much louder than the next, with its true
// peaks under −2 dBTP: the AAC encoder adds a little to them, and a decoder
// clips what goes past 0 dBFS.

/** A second-order filter (direct form I), its coefficients for 48 kHz. */
function biquad(samples, [b0, b1, b2, a1, a2]) {
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** BS.1770's K-weighting at 48 kHz: a high shelf (the head), then a high pass. */
const SHELF = [
  1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585,
];
const HIGH_PASS = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621];

/** Integrated loudness (LUFS) of 48 kHz channels: 400 ms blocks, 75 % overlap, absolute and relative gates. */
export function loudness(channels, sampleRate = 48_000) {
  if (sampleRate !== 48_000) throw new Error('The K-weighting here is for 48 kHz');
  const weighted = channels.map((samples) => biquad(biquad(samples, SHELF), HIGH_PASS));
  const block = Math.round(0.4 * sampleRate);
  const hop = Math.round(0.1 * sampleRate);
  const powers = [];
  for (let start = 0; start + block <= weighted[0].length; start += hop) {
    let sum = 0;
    for (const samples of weighted) {
      for (let i = start; i < start + block; i++) sum += samples[i] * samples[i];
    }
    powers.push(sum / block);
  }
  const lufs = (power) => -0.691 + 10 * Math.log10(power);
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const audible = powers.filter((power) => lufs(power) > -70);
  if (!audible.length) return -Infinity;
  const gate = lufs(mean(audible)) - 10;
  const kept = audible.filter((power) => lufs(power) > gate);
  return lufs(mean(kept));
}

/**
 * BS.1770 annex 2's interpolation, four times the samples at 48 kHz: four
 * phases of a 48-tap filter, the last two the first two reversed. Phase k
 * puts its point (2k + 1)/8 of a sample after sample n − 6.
 */
const PHASE_0 = [
  0.001708984375, 0.010986328125, -0.0196533203125, 0.033203125, -0.0594482421875, 0.1373291015625,
  0.97216796875, -0.102294921875, 0.047607421875, -0.026611328125, 0.014892578125, -0.00830078125,
];
const PHASE_1 = [
  -0.0291748046875, 0.029296875, -0.0517578125, 0.089111328125, -0.16650390625, 0.465087890625,
  0.77978515625, -0.2003173828125, 0.1015625, -0.0582275390625, 0.0330810546875, -0.0189208984375,
];
const PHASES = [PHASE_0, PHASE_1, [...PHASE_1].reverse(), [...PHASE_0].reverse()];
const TAPS = PHASE_0.length;
/** How far a point of the interpolation lies from the samples that make it (samples). */
const SPAN = TAPS / 2;

/**
 * The highest level at each sample and in the stretch that follows it, the
 * channels together: the samples, and the points between them that a
 * decoder's converter draws (BS.1770 annex 2).
 */
function peaksAround(channels) {
  const length = channels[0].length;
  const peaks = new Float32Array(length);
  // Silence on both sides: the filter reads past the ends without a test.
  const padded = new Float32Array(length + 2 * TAPS);
  for (const samples of channels) {
    padded.set(samples, TAPS);
    for (let n = 0; n < length; n++) peaks[n] = Math.max(peaks[n], Math.abs(samples[n]));
    for (let n = 0; n < length + SPAN; n++) {
      // Every phase of output n lies between samples n − 6 and n − 5.
      const before = n - SPAN;
      const last = n + TAPS;
      for (const phase of PHASES) {
        let sum = 0;
        for (let j = 0; j < TAPS; j++) sum += phase[j] * padded[last - j];
        const size = Math.abs(sum);
        if (before >= 0) peaks[before] = Math.max(peaks[before], size);
        if (before + 1 >= 0 && before + 1 < length) {
          peaks[before + 1] = Math.max(peaks[before + 1], size);
        }
      }
    }
  }
  return peaks;
}

const highest = (values) => values.reduce((top, value) => Math.max(top, value), 0);
const toDb = (level) => 20 * Math.log10(level);

/** The true peak (dBTP) of the channels. */
export function truePeakDb(channels) {
  return toDb(highest(peaksAround(channels)));
}

/** The peak (dBFS) of the channels' samples, as a decoder gives them. */
export function samplePeakDb(channels) {
  return toDb(highest(channels.map((samples) => highest(samples.map(Math.abs)))));
}

/** The lowest of `values` within `radius` of each one. */
function runningMin(values, radius) {
  const out = new Float32Array(values.length);
  // The candidates, their values rising from the front.
  const queue = new Int32Array(values.length);
  let head = 0;
  let tail = 0;
  for (let i = 0, next = 0; i < values.length; i++) {
    for (; next < values.length && next <= i + radius; next++) {
      while (tail > head && values[queue[tail - 1]] >= values[next]) tail--;
      queue[tail++] = next;
    }
    while (queue[head] < i - radius) head++;
    out[i] = values[queue[head]];
  }
  return out;
}

/** The mean of `values` within `radius` of each one. */
function movingAverage(values, radius) {
  const sums = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) sums[i + 1] = sums[i] + values[i];
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - radius);
    const to = Math.min(values.length, i + radius + 1);
    out[i] = (sums[to] - sums[from]) / (to - from);
  }
  return out;
}

/** The limiter looks 1.5 ms ahead of a peak and lets go over 80 ms (samples at 48 kHz). */
const LIMITER = { lookAhead: 72, release: 0.08 * 48_000 };

/**
 * A gain for each sample that keeps the peaks under `limit`: it comes down
 * smoothly before a peak (a moving average of a minimum held a little wider,
 * so it never rises above what any sample nearby needs) and climbs back slowly.
 */
function limiterGain(peaks, limit) {
  const need = peaks.map((peak) => (peak > limit ? limit / peak : 1));
  const smooth = movingAverage(runningMin(need, LIMITER.lookAhead + SPAN), LIMITER.lookAhead);
  const back = Math.exp(-1 / LIMITER.release);
  const gain = new Float32Array(need.length);
  let level = 1;
  for (let i = 0; i < gain.length; i++) {
    level = Math.min(smooth[i], 1 - (1 - level) * back);
    gain[i] = level;
  }
  return gain;
}

/** The channels with their true peaks under `ceiling` dBTP, turned down only around them. */
function limited(channels, ceiling) {
  const peaks = peaksAround(channels);
  const target = 10 ** (ceiling / 20);
  let limit = target;
  for (let pass = 1; ; pass++) {
    const gain = limiterGain(peaks, limit);
    const out = channels.map((samples) => samples.map((sample, i) => sample * gain[i]));
    // The gain moves within the interpolation's reach: measured again, tightened if need be.
    const top = highest(peaksAround(out));
    if (top <= target || pass === 4) return out;
    limit *= target / top;
  }
}

/**
 * The channels at `target` LUFS, their true peaks held under `ceiling` dBTP
 * by a limiter that turns the sound down around a peak, never clips it. The
 * limiter takes a little loudness: the gain is made up, then limited again.
 */
export function normalise(channels, { target = -14, ceiling = -2 } = {}) {
  const level = loudness(channels);
  if (!Number.isFinite(level)) return channels;
  let gain = 10 ** ((target - level) / 20);
  let out = channels;
  for (let pass = 0; pass < 3; pass++) {
    out = limited(
      channels.map((samples) => samples.map((sample) => sample * gain)),
      ceiling,
    );
    const reached = loudness(out);
    if (Math.abs(target - reached) < 0.1) break;
    gain *= 10 ** ((target - reached) / 20);
  }
  return out;
}
