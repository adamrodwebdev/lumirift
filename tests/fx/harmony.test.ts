import { describe, expect, it } from 'vitest';
import {
  accent,
  CHORD_NOTES,
  chordAt,
  chordDegree,
  chordFifth,
  chordRoot,
  chordStep,
  degree,
  PROGRESSION,
  ROOT,
  SCALE,
  semitone,
} from '@/fx/harmony';

const pitchClass = (step: number) => ((step % 12) + 12) % 12;

describe('harmony', () => {
  it('counts the degrees of D minor pentatonic from D3', () => {
    expect(degree(0)).toBeCloseTo(ROOT);
    expect(degree(1)).toBeCloseTo(semitone(ROOT, 3)); // F3
    expect(degree(5)).toBeCloseTo(ROOT * 2); // D4
    expect(degree(13)).toBeCloseTo(880, 0); // A5
    expect(degree(-5)).toBeCloseTo(ROOT / 2); // D2
  });

  it('keeps every chord tone inside the key or a step from it', () => {
    const inKey = (step: number) => SCALE.includes(pitchClass(step) as never);
    for (const chord of PROGRESSION) {
      expect(chord.filter(inKey).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('changes chord every two bars, round the progression', () => {
    expect(chordAt(0)).toBe(0);
    expect(chordAt(7.9)).toBe(0);
    expect(chordAt(8)).toBe(1);
    expect(chordAt(31.5)).toBe(3);
    expect(chordAt(32)).toBe(0);
  });

  it('gives each chord its notes of the key, never one a semitone from it', () => {
    CHORD_NOTES.forEach((notes, chord) => {
      const tones = PROGRESSION[chord]!.map(pitchClass);
      // Every note of the chord that is in the key is there.
      for (const tone of tones) {
        const place = SCALE.indexOf(tone as never);
        if (place >= 0) expect(notes).toContain(place);
      }
      for (const place of notes) {
        const note = SCALE[place]!;
        for (const tone of tones) {
          const distance = Math.abs(note - tone) % 12;
          expect(Math.min(distance, 12 - distance)).not.toBe(1);
        }
      }
    });
  });

  it('walks the notes of a chord up and down the key', () => {
    // Dm: D F A; C: C G and D.
    expect([0, 1, 2, 3].map((n) => chordDegree(0, 10, n))).toEqual([10, 11, 13, 15]);
    expect([0, 1, 2].map((n) => chordDegree(3, 10, n))).toEqual([10, 12, 14]);
    expect(chordDegree(0, 12)).toBe(13);
    expect(chordStep(0, 11, 1)).toBe(13);
    expect(chordStep(0, 11, -1)).toBe(10);
    expect(chordStep(3, 10, -1)).toBe(9);
  });

  it('knows the root and the fifth of every chord, the bass included', () => {
    expect(chordRoot(0)).toBeCloseTo(ROOT);
    expect(chordRoot(1)).toBeCloseTo(semitone(ROOT, -4)); // B♭2
    PROGRESSION.forEach((_, chord) =>
      expect(chordFifth(chord)).toBeCloseTo(semitone(chordRoot(chord), 7)),
    );
  });

  it('accents a gesture on the beat, not between beats', () => {
    expect(accent(3)).toBe(1);
    expect(accent(3.125)).toBeCloseTo(0.5);
    expect(accent(3.25)).toBe(0);
    expect(accent(3.5)).toBe(0);
    expect(accent(3.875)).toBeCloseTo(0.5);
    expect(accent(4)).toBe(1);
  });
});
