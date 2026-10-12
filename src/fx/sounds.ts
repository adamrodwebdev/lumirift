import type { SoundRecipe } from '@/services/audio/AudioEngine';

/*
 * The sound palette of Stackrift, entirely synthesised. Glass is a burst of
 * high noise plus a few inharmonic "pings"; impacts are falling sine thumps.
 */

/** Major pentatonic, in semitones: any combination of pings sounds consonant. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
const semitone = (frequency: number, steps: number) => frequency * 2 ** (steps / 12);

export const tick: SoundRecipe = (s) =>
  s.tone({ type: 'square', frequency: 880, duration: 0.03, gain: 0.025 });

export const rotate: SoundRecipe = (s) =>
  s.tone({ type: 'triangle', frequency: 620, to: 930, duration: 0.06, gain: 0.05 });

export const hold: SoundRecipe = (s) => {
  s.tone({ frequency: 560, to: 280, duration: 0.14, gain: 0.06 });
  s.noise({ filter: 'bandpass', frequency: 2200, q: 2, duration: 0.09, gain: 0.03 });
};

export const land: SoundRecipe = (s) => {
  s.tone({ frequency: 150, to: 60, duration: 0.12, gain: 0.22 });
  s.noise({ filter: 'lowpass', frequency: 900, duration: 0.05, gain: 0.08 });
};

export const hardDrop =
  (distance: number): SoundRecipe =>
  (s) => {
    const weight = Math.min(1, distance / 18);
    s.noise({
      filter: 'bandpass',
      frequency: 500,
      to: 2400,
      q: 0.8,
      duration: 0.08,
      gain: 0.06 + 0.06 * weight,
    });
    s.tone({ frequency: 120, to: 42, duration: 0.2, gain: 0.25 + 0.15 * weight, start: 0.04 });
    s.noise({ filter: 'lowpass', frequency: 700, duration: 0.09, gain: 0.12, start: 0.04 });
  };

export const crack: SoundRecipe = (s) => {
  s.noise({ filter: 'highpass', frequency: 2600, duration: 0.07, gain: 0.16 });
  s.tone({ type: 'square', frequency: 2400, to: 1500, duration: 0.03, gain: 0.025 });
};

/** Breaking crystal: more lines, more pings; each combo raises the pitch. */
export const shatter =
  (lines: number, combo: number): SoundRecipe =>
  (s) => {
    s.noise({ filter: 'highpass', frequency: 3200, duration: 0.3 + 0.08 * lines, gain: 0.2 });
    s.noise({ filter: 'bandpass', frequency: 6000, q: 3, duration: 0.18, gain: 0.08, start: 0.02 });
    const base = semitone(880, Math.min(combo, 6) * 2);
    const pings = 2 + lines * 2;
    for (let i = 0; i < pings; i++) {
      const step = PENTATONIC[i % PENTATONIC.length]! + 12 * Math.floor(i / PENTATONIC.length);
      const frequency = semitone(base, step + (Math.random() < 0.5 ? 0 : 12));
      const start = i * 0.028 + Math.random() * 0.02;
      const duration = 0.35 + Math.random() * 0.4;
      s.tone({ frequency, duration, gain: 0.05, start });
      // Glass rings with inharmonic partials.
      s.tone({
        type: 'triangle',
        frequency: frequency * 2.76,
        duration: duration * 0.6,
        gain: 0.018,
        start,
      });
    }
    if (lines >= 4) s.tone({ frequency: 82, to: 34, duration: 0.7, gain: 0.32 });
  };

export const pureLine: SoundRecipe = (s) => {
  [1047, 1319, 1568, 2093].forEach((frequency, i) =>
    s.tone({ frequency, duration: 0.8, gain: 0.045, start: i * 0.04 }),
  );
};

export const levelUp: SoundRecipe = (s) => {
  [523, 659, 784, 1047].forEach((frequency, i) =>
    s.tone({ type: 'triangle', frequency, duration: 0.28, gain: 0.08, start: i * 0.07 }),
  );
};

export const garbageRise: SoundRecipe = (s) => {
  s.tone({ frequency: 95, to: 70, duration: 0.3, gain: 0.14 });
  s.noise({ filter: 'lowpass', frequency: 320, duration: 0.3, gain: 0.08 });
};

export const flip: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 180, to: 2400, q: 0.9, duration: 0.45, gain: 0.14 });
  s.tone({ frequency: 70, to: 38, duration: 0.55, gain: 0.3, start: 0.32 });
};

export const mirror: SoundRecipe = (s) => {
  [1320, 1760, 2640, 3520].forEach((frequency, i) =>
    s.tone({ frequency, duration: 0.55, gain: 0.03, start: i * 0.05 }),
  );
  s.noise({ filter: 'highpass', frequency: 5000, duration: 0.4, gain: 0.03 });
};

export const warning: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: 880, duration: 0.09, gain: 0.06 });
  s.tone({ type: 'triangle', frequency: 880, duration: 0.09, gain: 0.06, start: 0.16 });
};

export const bonus: SoundRecipe = (s) => {
  s.tone({ frequency: 1568, duration: 0.3, gain: 0.07 });
  s.tone({ frequency: 2093, duration: 0.35, gain: 0.05, start: 0.06 });
};

export const gameOver: SoundRecipe = (s) => {
  s.tone({ type: 'sawtooth', frequency: 330, to: 55, duration: 1.2, gain: 0.05 });
  s.noise({ filter: 'lowpass', frequency: 500, to: 120, duration: 1.1, gain: 0.16 });
  s.noise({ filter: 'highpass', frequency: 3000, duration: 0.6, gain: 0.12, start: 0.05 });
};
