/**
 * The key of Lumirift: D minor pentatonic (D F G A C). Every pitched sound
 * and the music share it, so effects never clash with the music, whatever
 * plays at the same time.
 */

/** D3. */
export const ROOT = 146.83;

/** Minor pentatonic, in semitones above the root. */
export const SCALE = [0, 3, 5, 7, 10] as const;

export const semitone = (frequency: number, steps: number): number => frequency * 2 ** (steps / 12);

/**
 * The frequency of a degree of the scale, counted from D3: 0 is D3, 5 is D4,
 * 7 is G4, 10 is D5… Negative degrees go below.
 */
export function degree(index: number): number {
  const size = SCALE.length;
  const octave = Math.floor(index / size);
  const step = SCALE[index - octave * size]!;
  return semitone(ROOT, step + 12 * octave);
}

/**
 * The music's chords, i – VI – III – VII (Dm, B♭, F, C), as semitones above
 * D3: a dark, open loop that never resolves. The first note is the root, the
 * last the fifth.
 */
export const PROGRESSION: readonly (readonly number[])[] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];

/** Each chord lasts two bars of four beats. */
export const BEATS_PER_CHORD = 8;

/** Where the music is: the beat playing and the tempo. */
export interface Groove {
  /** Beats since the music started, with the share of the one playing (12.5: half-way through the 13th). */
  readonly beat: number;
  /** How long a beat lasts (s). */
  readonly beatS: number;
}

/** The chord playing at a beat, as its place in the progression. */
export const chordAt = (beat: number): number =>
  Math.floor(Math.max(0, beat) / BEATS_PER_CHORD) % PROGRESSION.length;

/**
 * The notes of the key that sound well over each chord, as places in SCALE
 * (0 D, 1 F, 2 G, 3 A, 4 C): the chord's own notes and, where one of them is
 * not in the key (B♭, E), its ninth. A gesture plays one of these, never a
 * note a semitone from the chord (A over B♭, F over the E of C).
 */
export const CHORD_NOTES: readonly (readonly number[])[] = [
  [0, 1, 3], // Dm: D F A
  [0, 1, 4], // B♭: D F, and C, its ninth
  [1, 3, 4], // F: F A C
  [0, 2, 4], // C: C G, and D, its ninth
];

/** True when this degree of the key belongs to the chord's notes. */
export const inChord = (chord: number, index: number): boolean =>
  CHORD_NOTES[chord]!.includes(index - Math.floor(index / SCALE.length) * SCALE.length);

/** The `n`-th note of the chord (from 0) at or above a degree of the key. */
export function chordDegree(chord: number, from: number, n = 0): number {
  let found = -1;
  for (let index = from; ; index++) {
    if (inChord(chord, index) && ++found === n) return index;
  }
}

/** The next note of the chord after a degree of the key, going up (1) or down (-1). */
export function chordStep(chord: number, index: number, direction: 1 | -1): number {
  for (let next = index + direction; ; next += direction) {
    if (inChord(chord, next)) return next;
  }
}

/** A chord's root, as a frequency in the octave of D3 (the bass plays B♭ and E too). */
export const chordRoot = (chord: number): number => semitone(ROOT, PROGRESSION[chord]![0]!);

/** A chord's fifth, in the octave of its root. */
export const chordFifth = (chord: number): number => semitone(ROOT, PROGRESSION[chord]!.at(-1)!);

/** How much a gesture is on the beat: 1 right on it, nothing from a quarter of a beat away. */
export function accent(beat: number): number {
  const share = beat - Math.floor(beat);
  return Math.max(0, 1 - Math.min(share, 1 - share) / 0.25);
}
