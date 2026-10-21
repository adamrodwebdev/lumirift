import type { SoundRecipe } from '@/services/audio/AudioEngine';
import { degree } from './harmony';

/*
 * The sound palette of Lumirift, entirely synthesised. Glass is a burst of
 * high noise plus a few inharmonic "pings"; impacts are falling sine thumps.
 * Every pitch is a degree of the game's key (D minor pentatonic, see
 * harmony.ts): the effects always sound right over the music.
 */

let tickTurn = 0;
export const tick: SoundRecipe = (s) =>
  s.tone({
    type: 'square',
    frequency: degree(13 + (tickTurn++ % 2)),
    duration: 0.03,
    gain: 0.022,
  });

export const rotate: SoundRecipe = (s) =>
  s.tone({ type: 'triangle', frequency: degree(11), to: degree(13), duration: 0.07, gain: 0.05 });

export const hold: SoundRecipe = (s) => {
  s.tone({ frequency: degree(12), to: degree(7), duration: 0.14, gain: 0.06 });
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
    // Each combo starts the run one degree higher.
    const base = 11 + Math.min(combo, 6);
    const pings = 2 + lines * 2;
    for (let i = 0; i < pings; i++) {
      const frequency = degree(base + i + (Math.random() < 0.5 ? 0 : 5));
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
    // Four lines: the rift opens, a deep D under the glass.
    if (lines >= 4) {
      s.tone({ frequency: degree(-5), to: 36, duration: 0.8, gain: 0.32 });
      s.tone({ type: 'triangle', frequency: degree(0), duration: 1.1, gain: 0.08, start: 0.05 });
    }
  };

export const pureLine: SoundRecipe = (s) => {
  [15, 18, 20, 21].forEach((step, i) =>
    s.tone({ frequency: degree(step), duration: 0.8, gain: 0.045, start: i * 0.04 }),
  );
};

export const levelUp: SoundRecipe = (s) => {
  [10, 11, 13, 15].forEach((step, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(step),
      duration: 0.28,
      gain: 0.08,
      start: i * 0.07,
    }),
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
  [15, 18, 20, 23].forEach((step, i) =>
    s.tone({ frequency: degree(step), duration: 0.55, gain: 0.03, start: i * 0.05 }),
  );
  s.noise({ filter: 'highpass', frequency: 5000, duration: 0.4, gain: 0.03 });
};

export const warning: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: degree(13), duration: 0.09, gain: 0.06 });
  s.tone({ type: 'triangle', frequency: degree(13), duration: 0.09, gain: 0.06, start: 0.16 });
};

export const bonus: SoundRecipe = (s) => {
  s.tone({ frequency: degree(17), duration: 0.3, gain: 0.07 });
  s.tone({ frequency: degree(20), duration: 0.35, gain: 0.05, start: 0.06 });
};

/** Fusion: a crystalline chord, one step higher for each link of the chain. */
export const fusion =
  (chain: number): SoundRecipe =>
  (s) => {
    s.noise({ filter: 'highpass', frequency: 3600, duration: 0.18, gain: 0.12 });
    const base = 10 + Math.min(chain - 1, 7);
    [0, 2, 4, 5].forEach((step, i) =>
      s.tone({ frequency: degree(base + step), duration: 0.5, gain: 0.05, start: i * 0.035 }),
    );
  };

/** Duel: rows sent to the opponent. */
export const attack: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 900, to: 4200, q: 1.2, duration: 0.22, gain: 0.1 });
  s.tone({ type: 'square', frequency: degree(7), to: degree(12), duration: 0.12, gain: 0.03 });
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
      frequency: degree(15 + level - 1),
      duration: 0.18,
      gain: 0.07,
    });

/** Mosaic: a glazed tile set down on the tray. */
export const tile: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: degree(9), to: degree(7), duration: 0.07, gain: 0.07 });
  s.noise({ filter: 'bandpass', frequency: 2400, q: 4, duration: 0.03, gain: 0.05 });
  // The weight of the piece settling into the tray.
  s.tone({ frequency: 150, to: 70, duration: 0.12, gain: 0.08 });
};

/** Mosaic: a piece lifted from the hand, a light glazed clink rising. */
export const pickUp: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: degree(12), to: degree(14), duration: 0.07, gain: 0.05 });
  s.noise({ filter: 'bandpass', frequency: 3400, q: 6, duration: 0.025, gain: 0.03 });
};

/** Mosaic: the dragged piece finds a new place where it fits (very soft, it repeats). */
export const snapHint: SoundRecipe = (s) =>
  s.tone({ type: 'sine', frequency: degree(16), duration: 0.04, gain: 0.018 });

/** Mosaic: a piece let go away from a place: it slides back into the hand. */
export const putBack: SoundRecipe = (s) => {
  s.noise({ filter: 'lowpass', frequency: 1400, to: 500, duration: 0.14, gain: 0.04 });
  s.tone({ type: 'triangle', frequency: degree(9), to: degree(5), duration: 0.12, gain: 0.05 });
};

/** Mosaic: a new hand dealt, three pieces landing one after the other. */
export const deal: SoundRecipe = (s) => {
  [11, 13, 15].forEach((step, i) => {
    s.tone({
      type: 'triangle',
      frequency: degree(step),
      duration: 0.06,
      gain: 0.04,
      start: i * 0.07,
    });
    s.noise({
      filter: 'bandpass',
      frequency: 2800,
      q: 5,
      duration: 0.02,
      gain: 0.025,
      start: i * 0.07,
    });
  });
};

/** The player's record beaten during the game: a bright rising fanfare with a shimmer. */
export const newRecord: SoundRecipe = (s) => {
  [10, 13, 15, 17, 20].forEach((step, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(step),
      duration: i === 4 ? 0.7 : 0.16,
      gain: 0.08,
      start: i * 0.075,
    }),
  );
  s.tone({ frequency: degree(25), duration: 0.9, gain: 0.03, start: 0.3 });
  s.noise({
    filter: 'highpass',
    frequency: 6000,
    duration: 0.6,
    gain: 0.03,
    start: 0.3,
    attack: 0.05,
  });
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
    const base = 7 + Math.min(streak - 1, 6);
    for (let i = 0; i < 2 + lines; i++) {
      s.tone({
        type: 'triangle',
        frequency: degree(base + i),
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
  s.tone({ type: 'triangle', frequency: degree(13), to: degree(6), duration: 0.25, gain: 0.07 });

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
      frequency: degree(11 + i),
      to: degree(13 + i),
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
    [0, 2, 4, 5].slice(0, 1 + regions).forEach((step, i) =>
      s.tone({
        frequency: degree(12 + step),
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
  s.tone({ type: 'sawtooth', frequency: degree(8), to: degree(-5), duration: 1.2, gain: 0.05 });
  s.noise({ filter: 'lowpass', frequency: 500, to: 120, duration: 1.1, gain: 0.16 });
  s.noise({ filter: 'highpass', frequency: 3000, duration: 0.6, gain: 0.12, start: 0.05 });
};
