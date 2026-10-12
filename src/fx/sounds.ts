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

/** Fusion: a crystalline chord, one step higher for each link of the chain. */
export const fusion =
  (chain: number): SoundRecipe =>
  (s) => {
    s.noise({ filter: 'highpass', frequency: 3600, duration: 0.18, gain: 0.12 });
    const base = semitone(659, Math.min(chain - 1, 7) * 2);
    [0, 4, 7, 12].forEach((step, i) =>
      s.tone({ frequency: semitone(base, step), duration: 0.5, gain: 0.05, start: i * 0.035 }),
    );
  };

/** Duel: rows sent to the opponent. */
export const attack: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 900, to: 4200, q: 1.2, duration: 0.22, gain: 0.1 });
  s.tone({ type: 'square', frequency: 330, to: 660, duration: 0.12, gain: 0.03 });
};

/** Rhythm: the downbeat. */
export const kick: SoundRecipe = (s) => {
  s.tone({ frequency: 130, to: 45, duration: 0.16, gain: 0.3 });
  s.noise({ filter: 'lowpass', frequency: 600, duration: 0.03, gain: 0.05 });
};

/** Rhythm: the other beats. */
export const hat: SoundRecipe = (s) =>
  s.noise({ filter: 'highpass', frequency: 7000, duration: 0.05, gain: 0.07 });

/** Rhythm: a piece landed on the beat. */
export const onBeat =
  (level: number): SoundRecipe =>
  (s) =>
    s.tone({
      type: 'triangle',
      frequency: semitone(1047, (level - 1) * 3),
      duration: 0.18,
      gain: 0.07,
    });

/** Mosaic: a glazed tile set down on the tray. */
export const tile: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: 520, to: 380, duration: 0.07, gain: 0.07 });
  s.noise({ filter: 'bandpass', frequency: 2400, q: 4, duration: 0.03, gain: 0.05 });
};

/** Mosaic: ceramic breaking, lower and duller than glass, richer with the streak. */
export const ceramicBreak =
  (lines: number, streak: number): SoundRecipe =>
  (s) => {
    s.noise({
      filter: 'bandpass',
      frequency: 1600,
      q: 1.5,
      duration: 0.22 + 0.05 * lines,
      gain: 0.2,
    });
    s.noise({ filter: 'highpass', frequency: 4500, duration: 0.12, gain: 0.07, start: 0.02 });
    const base = semitone(392, Math.min(streak - 1, 6) * 2);
    for (let i = 0; i < 2 + lines; i++) {
      const step = PENTATONIC[i % PENTATONIC.length]!;
      s.tone({
        type: 'triangle',
        frequency: semitone(base, step),
        duration: 0.22,
        gain: 0.05,
        start: i * 0.04,
      });
    }
  };

/** Mosaic: the bomb joker. */
export const bomb: SoundRecipe = (s) => {
  s.tone({ frequency: 90, to: 30, duration: 0.6, gain: 0.35 });
  s.noise({ filter: 'lowpass', frequency: 1800, to: 200, duration: 0.5, gain: 0.25 });
};

/** Mosaic: three new pieces shuffled in (reroll joker). */
export const shuffle: SoundRecipe = (s) => {
  for (let i = 0; i < 3; i++)
    s.noise({
      filter: 'bandpass',
      frequency: 2600,
      q: 2,
      duration: 0.05,
      gain: 0.06,
      start: i * 0.07,
    });
};

/** Mosaic: the last move taken back (undo joker). */
export const rewind: SoundRecipe = (s) =>
  s.tone({ type: 'triangle', frequency: 880, to: 330, duration: 0.25, gain: 0.07 });

/** Sand: a piece crumbling into grains. */
export const pour: SoundRecipe = (s) =>
  s.noise({
    filter: 'bandpass',
    frequency: 3000,
    to: 1200,
    q: 0.8,
    duration: 0.35,
    gain: 0.09,
    attack: 0.03,
  });

/** Sand: water poured in. */
export const splash: SoundRecipe = (s) => {
  s.noise({ filter: 'lowpass', frequency: 1400, to: 500, duration: 0.3, gain: 0.12 });
  for (let i = 0; i < 4; i++)
    s.tone({
      frequency: 700 + i * 180,
      to: 1100 + i * 200,
      duration: 0.06,
      gain: 0.03,
      start: i * 0.05,
    });
};

/** Sand: a region swept away, brighter with more regions at once. */
export const sweep =
  (regions: number): SoundRecipe =>
  (s) => {
    s.noise({
      filter: 'highpass',
      frequency: 2000,
      to: 7000,
      duration: 0.5,
      gain: 0.12,
      attack: 0.05,
    });
    [0, 4, 7, 12].slice(0, 1 + regions).forEach((step, i) =>
      s.tone({
        frequency: semitone(784, step),
        duration: 0.45,
        gain: 0.05,
        start: 0.05 + i * 0.06,
      }),
    );
  };

/** Sand: fire burning a region. */
export const crackle: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 900, q: 0.7, duration: 0.6, gain: 0.14 });
  for (let i = 0; i < 6; i++)
    s.noise({
      filter: 'highpass',
      frequency: 4000,
      duration: 0.02,
      gain: 0.09,
      start: Math.random() * 0.5,
    });
};

/** Sand: a gust of wind. */
export const gust: SoundRecipe = (s) =>
  s.noise({
    filter: 'bandpass',
    frequency: 400,
    to: 1600,
    q: 0.6,
    duration: 2.5,
    gain: 0.09,
    attack: 0.5,
  });

export const gameOver: SoundRecipe = (s) => {
  s.tone({ type: 'sawtooth', frequency: 330, to: 55, duration: 1.2, gain: 0.05 });
  s.noise({ filter: 'lowpass', frequency: 500, to: 120, duration: 1.1, gain: 0.16 });
  s.noise({ filter: 'highpass', frequency: 3000, duration: 0.6, gain: 0.12, start: 0.05 });
};
