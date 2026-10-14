/**
 * The key of Stackrift: D minor pentatonic (D F G A C). Every pitched sound
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
 * D3: a dark, open loop that never resolves.
 */
export const PROGRESSION: readonly (readonly number[])[] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];
