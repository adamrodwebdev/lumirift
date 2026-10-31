import type { SoundRecipe } from '@/services/audio/AudioEngine';
import type { Synth } from '@/services/audio/Synth';
import {
  accent,
  chordAt,
  chordDegree,
  chordFifth,
  chordRoot,
  degree,
  type Groove,
} from './harmony';

/*
 * The sound palette of Lumirift, entirely synthesised. Glass is a burst of
 * high noise plus a few inharmonic "pings"; impacts are falling sine thumps.
 * Every pitch is a degree of the game's key (D minor pentatonic, see
 * harmony.ts): the effects always sound right over the music. The player's
 * gestures go further (1.21): they play along with it, on the notes of the
 * chord playing (`groove`): rotations as a melody (PlayerVoice), pieces set
 * down as its bass, clears as the chord rung out; on the beat, louder.
 */

/** The highest note of the glass pings (G8): above, they only whistle. */
const TOP_PING = 27;

/** A step sideways: a soft tick on a note of the chord, two of them taking turns. */
export const tick =
  (turn: number): SoundRecipe =>
  (s, groove) =>
    s.tone({
      type: 'square',
      frequency: degree(chordDegree(chordAt(groove.beat), 13, turn % 2)),
      duration: 0.03,
      gain: 0.022,
    });

/**
 * A rotation: a crystal note of the chord (`note`, a degree of the key that
 * PlayerVoice chooses), its octave shimmering, over a glassy flick.
 */
export const rotate =
  (note: number): SoundRecipe =>
  (s, groove) => {
    const strength = 0.75 + 0.45 * accent(groove.beat);
    s.tone({ type: 'triangle', frequency: degree(note), duration: 0.18, gain: 0.05 * strength });
    s.tone({ frequency: degree(note + 5), duration: 0.1, gain: 0.012 * strength });
    s.noise({ filter: 'bandpass', frequency: 3600, q: 3, duration: 0.025, gain: 0.018 });
  };

export const hold: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  s.tone({
    frequency: degree(chordDegree(chord, 12)),
    to: degree(chordDegree(chord, 7)),
    duration: 0.14,
    gain: 0.06,
  });
  s.noise({ filter: 'bandpass', frequency: 2200, q: 2, duration: 0.09, gain: 0.03 });
};

/**
 * A piece set down plays the bass: the root of the chord, round and low (an
 * octave up as well, for small speakers); on the beat, louder, with its fifth.
 */
function bass(s: Synth, groove: Groove, weight = 1, start = 0): void {
  const chord = chordAt(groove.beat);
  const onBeat = accent(groove.beat);
  const gain = weight * (0.7 + 0.5 * onBeat);
  const root = chordRoot(chord);
  s.tone({ frequency: root, duration: 0.32, gain: 0.07 * gain, start });
  s.tone({ type: 'triangle', frequency: root * 2, duration: 0.24, gain: 0.04 * gain, start });
  if (onBeat > 0.5) {
    s.tone({
      type: 'triangle',
      frequency: chordFifth(chord) * 2,
      duration: 0.22,
      gain: 0.025 * gain,
      start: start + 0.01,
    });
  }
}

/** Sand: a piece settling plays the bass too, under its own sound. */
export const settle: SoundRecipe = (s, groove) => bass(s, groove, 0.9);

export const land: SoundRecipe = (s, groove) => {
  s.tone({ frequency: 150, to: 60, duration: 0.12, gain: 0.22 });
  s.noise({ filter: 'lowpass', frequency: 900, duration: 0.05, gain: 0.08 });
  bass(s, groove);
};

export const hardDrop =
  (distance: number): SoundRecipe =>
  (s, groove) => {
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
    // The weight of it (1.41): a deep thump, 70 down to 50 Hz, longer for a longer fall.
    s.tone({
      frequency: 70,
      to: 50,
      duration: 0.12 + 0.18 * weight,
      gain: 0.08 + 0.2 * weight,
      start: 0.04,
    });
    s.noise({ filter: 'lowpass', frequency: 700, duration: 0.09, gain: 0.12, start: 0.04 });
    bass(s, groove, 1.1 + 0.3 * weight, 0.04);
  };

/**
 * The blow of a clear of two lines or more (1.41), under the crack: a deep
 * thump and a breath, longer and louder with the lines.
 */
export const clearBlow =
  (lines: number): SoundRecipe =>
  (s) => {
    const size = Math.min(4, lines) - 1;
    s.tone({ frequency: 90, to: 38, duration: 0.18 + 0.08 * size, gain: 0.12 + 0.06 * size });
    s.noise({
      filter: 'lowpass',
      frequency: 420,
      to: 120,
      duration: 0.25 + 0.1 * size,
      gain: 0.05 + 0.03 * size,
      start: 0.02,
    });
  };

/**
 * A step of a combo (1.41), ×`times`: a note of the chord playing, one higher
 * each step, over the glass (as Sand's sweep climbs); at ×5 and ×10, the
 * whole chord rings out.
 */
export const comboStep =
  (times: number): SoundRecipe =>
  (s, groove) => {
    const chord = chordAt(groove.beat);
    const strength = 0.75 + 0.45 * accent(groove.beat);
    s.tone({
      type: 'triangle',
      frequency: degree(chordDegree(chord, 12, Math.min(times, 10) - 2)),
      duration: 0.4,
      gain: 0.055 * strength,
    });
    if (times !== 5 && times !== 10) return;
    [0, 1, 2, 3].forEach((n, i) =>
      s.tone({
        frequency: degree(chordDegree(chord, 10, n)),
        duration: 0.9,
        gain: 0.04,
        start: 0.05 + i * 0.03,
      }),
    );
  };

export const crack: SoundRecipe = (s) => {
  s.noise({ filter: 'highpass', frequency: 2600, duration: 0.07, gain: 0.16 });
  s.tone({ type: 'square', frequency: 2400, to: 1500, duration: 0.03, gain: 0.025 });
};

/** The rift running along a cleared row to the walls (1.44): the crack, then its splinters, fainter and higher. */
export const riftRun: SoundRecipe = (s, groove) => {
  crack(s, groove);
  for (let i = 0; i < 4; i++)
    s.noise({
      filter: 'highpass',
      frequency: 3000 + 450 * i,
      duration: 0.018,
      gain: 0.08 - 0.014 * i,
      start: 0.022 + 0.019 * i + Math.random() * 0.006,
    });
};

/**
 * The rift swallowing the row's pieces (1.44): a breath drawn in, deeper and
 * longer for more lines; at a RIFT!, the chord's root deep under it.
 */
export const riftSwallow =
  (lines: number): SoundRecipe =>
  (s, groove) => {
    const size = Math.max(1, Math.min(4, lines)) - 1;
    s.noise({
      filter: 'lowpass',
      frequency: 1100 - 150 * size,
      to: 160,
      duration: 0.2 + 0.06 * size,
      gain: 0.06 + 0.02 * size,
      attack: 0.06,
    });
    s.tone({
      frequency: 92 - 8 * size,
      to: 44,
      duration: 0.18 + 0.05 * size,
      gain: 0.07 + 0.03 * size,
    });
    if (lines < 4) return;
    const root = chordRoot(chordAt(groove.beat));
    s.tone({ frequency: root / 2, to: 36, duration: 0.8, gain: 0.32 });
    s.tone({ type: 'triangle', frequency: root, duration: 1.1, gain: 0.08, start: 0.05 });
  };

/** Breaking crystal: the chord rung out, more pings for more lines; each combo starts it a note higher. */
export const shatter =
  (lines: number, combo: number): SoundRecipe =>
  (s, groove) => {
    const chord = chordAt(groove.beat);
    s.noise({ filter: 'highpass', frequency: 3200, duration: 0.3 + 0.08 * lines, gain: 0.2 });
    s.noise({ filter: 'bandpass', frequency: 6000, q: 3, duration: 0.18, gain: 0.08, start: 0.02 });
    const first = Math.min(combo, 6);
    const pings = 2 + lines * 2;
    for (let i = 0; i < pings; i++) {
      let note = chordDegree(chord, 11, first + (i % 4)) + (Math.random() < 0.5 ? 0 : 5);
      while (note > TOP_PING) note -= 5;
      const frequency = degree(note);
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
  };

export const pureLine: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  [0, 1, 2, 3].forEach((n, i) =>
    s.tone({
      frequency: degree(chordDegree(chord, 15, n)),
      duration: 0.8,
      gain: 0.045,
      start: i * 0.04,
    }),
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

// --- The tension of a game (1.19) -------------------------------------------------

/** The final ten seconds of a timed game: a hurried call, twice, a step higher. */
export const hurry: SoundRecipe = (s) => {
  [13, 15, 17, 15, 17, 20].forEach((step, i) =>
    s.tone({
      type: 'square',
      frequency: degree(step),
      duration: 0.07,
      gain: 0.035,
      start: i * 0.075 + (i >= 3 ? 0.06 : 0),
    }),
  );
};

/** One of the last seconds going by: a wood block, higher for the last three. */
export const countdown =
  (last: boolean): SoundRecipe =>
  (s) => {
    s.tone({
      frequency: degree(last ? 20 : 17),
      to: degree(last ? 18 : 15),
      duration: 0.07,
      gain: 0.07,
    });
    s.noise({ filter: 'highpass', frequency: 4000, duration: 0.02, gain: 0.03 });
  };

/** A line cleared at the edge of defeat: a golden rush up the scale, time slowing down. */
export const closeCall: SoundRecipe = (s) => {
  [10, 12, 14, 15, 17, 20].forEach((step, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(step),
      duration: 0.14,
      gain: 0.05,
      start: i * 0.035,
    }),
  );
  s.noise({ filter: 'highpass', frequency: 5000, duration: 0.5, gain: 0.035, start: 0.1 });
  s.noise({ filter: 'lowpass', frequency: 1200, to: 200, duration: 0.45, gain: 0.07 });
};

/** The rift breaks the well: a pane of glass shattering over a deep blow. */
export const wellBreak: SoundRecipe = (s) => {
  s.tone({ frequency: 90, to: 38, duration: 0.55, gain: 0.2 });
  s.noise({ filter: 'highpass', frequency: 2500, duration: 0.9, gain: 0.13 });
  [18, 21, 23].forEach((step, i) =>
    s.tone({ frequency: degree(step) * 1.013, duration: 0.5, gain: 0.025, start: 0.03 + i * 0.05 }),
  );
};

/** The Rift Race's wipe (1.34): the rift tears across the board, a rush of air over a deep pull. */
export const riftTear: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 220, to: 3200, q: 0.9, duration: 0.7, gain: 0.12 });
  s.tone({ frequency: 82, to: 41, duration: 0.6, gain: 0.16 });
  s.noise({ filter: 'highpass', frequency: 4000, duration: 0.3, gain: 0.04, start: 0.45 });
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

/** Mosaic: a glazed tile set down on the tray, a clink on the chord, the bass under it. */
export const tile: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  s.tone({
    type: 'triangle',
    frequency: degree(chordDegree(chord, 7, 1)),
    to: degree(chordDegree(chord, 7)),
    duration: 0.07,
    gain: 0.07,
  });
  s.noise({ filter: 'bandpass', frequency: 2400, q: 4, duration: 0.03, gain: 0.05 });
  // The weight of the piece settling into the tray.
  s.tone({ frequency: 150, to: 70, duration: 0.12, gain: 0.08 });
  bass(s, groove, 0.8);
};

/** Mosaic: a piece lifted from the hand, a light glazed clink rising. */
export const pickUp: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  s.tone({
    type: 'triangle',
    frequency: degree(chordDegree(chord, 12)),
    to: degree(chordDegree(chord, 12, 1)),
    duration: 0.07,
    gain: 0.05,
  });
  s.noise({ filter: 'bandpass', frequency: 3400, q: 6, duration: 0.025, gain: 0.03 });
};

/** Mosaic: the dragged piece finds a new place where it fits (very soft, it repeats). */
export const snapHint: SoundRecipe = (s, groove) =>
  s.tone({
    type: 'sine',
    frequency: degree(chordDegree(chordAt(groove.beat), 16)),
    duration: 0.04,
    gain: 0.018,
  });

/** Mosaic: a piece let go away from a place: it slides back into the hand. */
export const putBack: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  s.noise({ filter: 'lowpass', frequency: 1400, to: 500, duration: 0.14, gain: 0.04 });
  s.tone({
    type: 'triangle',
    frequency: degree(chordDegree(chord, 9)),
    to: degree(chordDegree(chord, 5)),
    duration: 0.12,
    gain: 0.05,
  });
};

/** Mosaic: a new hand dealt, three pieces landing one after the other. */
export const deal: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  [0, 1, 2].forEach((n, i) => {
    s.tone({
      type: 'triangle',
      frequency: degree(chordDegree(chord, 11, n)),
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

/** Mosaic: ceramic breaking, lower and duller than glass, on the chord, higher with the streak. */
export const ceramicBreak =
  (lines: number, streak: number): SoundRecipe =>
  (s, groove) => {
    const chord = chordAt(groove.beat);
    s.noise({
      filter: 'bandpass',
      frequency: 1600,
      q: 1.5,
      duration: 0.22 + 0.05 * lines,
      gain: 0.2,
    });
    s.noise({ filter: 'highpass', frequency: 4500, duration: 0.12, gain: 0.07, start: 0.02 });
    const from = 7 + Math.min(streak - 1, 4);
    for (let i = 0; i < Math.min(2 + lines, 6); i++) {
      s.tone({
        type: 'triangle',
        frequency: degree(chordDegree(chord, from, i)),
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

/** Sand: a region swept away, the chord brighter with more regions at once, a note higher at each step of a combo. */
export const sweep =
  (regions: number, multiplier = 1): SoundRecipe =>
  (s, groove) => {
    const chord = chordAt(groove.beat);
    if (multiplier >= 2) {
      s.tone({
        type: 'triangle',
        frequency: degree(chordDegree(chord, 7, Math.min(multiplier, 10) - 2)),
        duration: 0.35,
        gain: 0.05,
        start: 0.12,
      });
    }
    s.noise({
      filter: 'highpass',
      frequency: 2000,
      to: 7000,
      duration: 0.5,
      gain: 0.12,
      attack: 0.05,
    });
    [0, 1, 2, 3].slice(0, 1 + regions).forEach((n, i) =>
      s.tone({
        frequency: degree(chordDegree(chord, 12, n)),
        duration: 0.45,
        gain: 0.05,
        start: 0.05 + i * 0.06,
      }),
    );
  };

// --- The rift surge (1.25) -------------------------------------------------------

/** The gauge is full: a bright call on the chord, rising. */
export const surgeReady: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  [0, 1, 2].forEach((n, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(chordDegree(chord, 13, n)),
      duration: 0.3,
      gain: 0.05,
      start: i * 0.06,
    }),
  );
};

/** Time thickens: a long breath sinking, the chord's root falling an octave, a glassy halo. */
export const surgeIn: SoundRecipe = (s, groove) => {
  const chord = chordAt(groove.beat);
  const root = chordRoot(chord);
  s.noise({ filter: 'lowpass', frequency: 4000, to: 260, duration: 1.1, gain: 0.16, attack: 0.04 });
  s.tone({ frequency: root * 2, to: root, duration: 1.2, gain: 0.16 });
  [0, 1, 2].forEach((n, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(chordDegree(chord, 15, n)),
      duration: 1.6,
      gain: 0.025,
      start: 0.08 + i * 0.05,
      attack: 0.12,
    }),
  );
};

/** Time snaps back: a shock wave, then the chord thrown upward, the higher the factor. */
export const surgeOut =
  (factor: number): SoundRecipe =>
  (s, groove) => {
    const chord = chordAt(groove.beat);
    s.tone({ frequency: chordRoot(chord), to: 40, duration: 0.6, gain: 0.3 });
    s.noise({ filter: 'highpass', frequency: 2500, duration: 0.5, gain: 0.14 });
    s.noise({ filter: 'bandpass', frequency: 300, to: 3000, q: 0.8, duration: 0.4, gain: 0.1 });
    const notes = 3 + Math.round((Math.min(factor, 3) - 1) * 2);
    for (let i = 0; i < notes; i++) {
      s.tone({
        type: 'triangle',
        frequency: degree(chordDegree(chord, 10, i)),
        duration: 0.35,
        gain: 0.05,
        start: 0.05 + i * 0.045,
      });
    }
  };

/** A combo ran dry: two notes falling, softly. */
export const comboLost: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: degree(12), to: degree(7), duration: 0.35, gain: 0.04 });
  s.tone({ frequency: degree(9), to: degree(5), duration: 0.4, gain: 0.03, start: 0.08 });
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

// --- Sand elements (1.12) -----------------------------------------------------

/** Lightning: a sharp crack and a falling rumble; through water, a long electric buzz. */
export const zap =
  (shock: boolean): SoundRecipe =>
  (s) => {
    s.noise({ filter: 'highpass', frequency: 3500, duration: 0.08, gain: 0.22 });
    s.noise({ filter: 'bandpass', frequency: 1800, to: 300, q: 1.2, duration: 0.45, gain: 0.14 });
    s.tone({ frequency: 110, to: 40, duration: 0.5, gain: 0.2, start: 0.03 });
    if (shock) {
      s.tone({ type: 'sawtooth', frequency: 220, to: 180, duration: 0.6, gain: 0.05, start: 0.05 });
      s.tone({ type: 'sawtooth', frequency: 331, to: 270, duration: 0.6, gain: 0.04, start: 0.05 });
    }
  };

/** Oil catching fire: a deep whoosh that swells. */
export const blaze: SoundRecipe = (s) => {
  s.noise({
    filter: 'lowpass',
    frequency: 400,
    to: 2400,
    duration: 0.7,
    gain: 0.18,
    attack: 0.12,
  });
  s.tone({ frequency: 70, to: 55, duration: 0.6, gain: 0.12 });
};

/** Steam: a hiss. */
export const hiss: SoundRecipe = (s) =>
  s.noise({
    filter: 'highpass',
    frequency: 5000,
    to: 3000,
    duration: 0.45,
    gain: 0.07,
    attack: 0.03,
  });

/** Ice: a crystal chime when water freezes, a crack when it breaks. */
export const freeze: SoundRecipe = (s) => {
  [18, 22].forEach((step, i) =>
    s.tone({ frequency: degree(step), duration: 0.18, gain: 0.025, start: i * 0.03 }),
  );
};

/** A seed sprouting: a soft rising pluck. */
export const sprout: SoundRecipe = (s) => {
  [9, 11, 13].forEach((step, i) =>
    s.tone({
      type: 'triangle',
      frequency: degree(step),
      duration: 0.14,
      gain: 0.05,
      start: i * 0.06,
    }),
  );
};

/** Acid eating sand: a short fizz. */
export const fizz: SoundRecipe = (s) =>
  s.noise({ filter: 'bandpass', frequency: 6000, q: 3, duration: 0.12, gain: 0.03 });

// --- The Guardians (1.14) ---------------------------------------------------------

/** A boss about to burst out: a deep rumble under the sand. */
export const rumble: SoundRecipe = (s) => {
  s.noise({ filter: 'lowpass', frequency: 160, to: 260, duration: 1.4, gain: 0.22, attack: 0.4 });
  s.tone({ frequency: 46, to: 52, duration: 1.4, gain: 0.12, attack: 0.4 });
};

/** A boss bursting out: a roar. */
export const roar: SoundRecipe = (s) => {
  s.noise({ filter: 'bandpass', frequency: 420, to: 160, q: 0.9, duration: 0.9, gain: 0.22 });
  s.tone({ type: 'sawtooth', frequency: 92, to: 58, duration: 0.8, gain: 0.08 });
  s.tone({ type: 'sawtooth', frequency: 138, to: 86, duration: 0.8, gain: 0.05 });
};

/** A stone of the Golem landing on the board: a dull, heavy thud. */
export const stoneThud: SoundRecipe = (s) => {
  s.noise({ filter: 'lowpass', frequency: 700, to: 200, duration: 0.25, gain: 0.26 });
  s.tone({ frequency: 82, to: 48, duration: 0.22, gain: 0.18 });
};

/** A stone parried: a bright ring of ceramic. */
export const parry: SoundRecipe = (s) => {
  s.tone({ type: 'triangle', frequency: 1318, duration: 0.35, gain: 0.08 });
  s.tone({ type: 'triangle', frequency: 1976, duration: 0.3, gain: 0.05, start: 0.03 });
  s.noise({ filter: 'highpass', frequency: 4000, duration: 0.05, gain: 0.08 });
};

/** A boss taking a hit: a hard crack, higher on its weak point. */
export const bossHit =
  (critical: boolean): SoundRecipe =>
  (s) => {
    s.noise({ filter: 'highpass', frequency: critical ? 3000 : 1800, duration: 0.09, gain: 0.16 });
    s.tone({
      type: 'square',
      frequency: critical ? 330 : 196,
      to: 110,
      duration: 0.18,
      gain: 0.06,
    });
  };
