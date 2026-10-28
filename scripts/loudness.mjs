// Loudness of a sound, as the apps measure it (ITU-R BS.1770: K-weighted,
// gated), and the gain that brings it to a target, under a peak ceiling. The
// clip factory (1.39) sets every clip near −14 LUFS, a common level for video
// online, so that one clip is never much louder than the next.

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
 * The channels at `target` LUFS, their peaks held under `ceiling` dBFS by a
 * soft limiter (a smooth curve near the top, never a hard clip).
 */
export function normalise(channels, { target = -14, ceiling = -1 } = {}) {
  const level = loudness(channels);
  const gain = Number.isFinite(level) ? 10 ** ((target - level) / 20) : 1;
  const limit = 10 ** (ceiling / 20);
  return channels.map((samples) =>
    samples.map((sample) => {
      const x = sample * gain;
      const size = Math.abs(x);
      if (size <= limit * 0.8) return x;
      // Above 80 % of the ceiling, a curve that never reaches past it.
      const over = (size - limit * 0.8) / (limit * 0.2);
      return Math.sign(x) * (limit * 0.8 + limit * 0.2 * Math.tanh(over));
    }),
  );
}
