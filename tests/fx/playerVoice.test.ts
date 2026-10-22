import { describe, expect, it, vi } from 'vitest';
import { createSoloSession } from '@/families/falling';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import {
  BEATS_PER_CHORD,
  CHORD_NOTES,
  degree,
  PROGRESSION,
  ROOT,
  SCALE,
  type Groove,
} from '@/fx/harmony';
import { PlayerVoice } from '@/fx/PlayerVoice';
import * as sounds from '@/fx/sounds';
import type { AudioEngine, SoundRecipe } from '@/services/audio/AudioEngine';
import type { Synth, ToneOptions } from '@/services/audio/Synth';
import { Haptics } from '@/services/Haptics';
import { ConstantRandom } from '../falling/helpers';

/** Records the tones a sound plays. */
function record(recipe: SoundRecipe, groove: Groove): ToneOptions[] {
  const tones: ToneOptions[] = [];
  const synth = { tone: (tone: ToneOptions) => tones.push(tone), noise: () => {} };
  recipe(synth as unknown as Synth, groove);
  return tones;
}

/** Half a beat into the chord `chord` (off the beat), or right on its first beat. */
const groove = (chord: number, onBeat = false): Groove => ({
  beat: chord * BEATS_PER_CHORD + (onBeat ? 0 : 0.5),
  beatS: 0.7,
});

/** The pitch class of a tempered note (semitones above D, 0–11), or null for a thump or a partial. */
function pitchClass(frequency: number): number | null {
  const steps = 12 * Math.log2(frequency / ROOT);
  if (Math.abs(steps - Math.round(steps)) > 0.01) return null;
  return ((Math.round(steps) % 12) + 12) % 12;
}

/** The notes allowed over a chord: its notes of the key, and its own tones (the bass). */
const allowed = (chord: number) =>
  new Set([
    ...CHORD_NOTES[chord]!.map((place) => SCALE[place]!),
    ...PROGRESSION[chord]!.map((step) => ((step % 12) + 12) % 12),
  ]);

describe('PlayerVoice', () => {
  it('climbs the chord with each rotation, then comes back down', () => {
    const voice = new PlayerVoice();
    const notes = Array.from({ length: 9 }, () => record(voice.rotate(), groove(0))[0]!.frequency);
    // Dm, from D5: D5 F5 A5 D6 F6, then back down D6 A5 F5 D5.
    expect(notes).toEqual([10, 11, 13, 15, 16, 15, 13, 11, 10].map(degree));
  });

  it('goes on from the nearest note of a new chord', () => {
    const voice = new PlayerVoice();
    record(voice.rotate(), groove(0)); // D5
    record(voice.rotate(), groove(0)); // F5
    // C: C G D — after F5, going up, G5.
    expect(record(voice.rotate(), groove(3))[0]!.frequency).toBeCloseTo(degree(12));
  });

  it('accents a rotation on the beat', () => {
    const off = record(new PlayerVoice().rotate(), groove(0))[0]!;
    const on = record(new PlayerVoice().rotate(), groove(0, true))[0]!;
    expect(on.gain).toBeGreaterThan(off.gain);
  });

  it('ticks the steps sideways on two notes of the chord, in turn', () => {
    const voice = new PlayerVoice();
    const ticks = [0, 1, 2].map(() => record(voice.move(), groove(2))[0]!.frequency);
    expect(ticks[0]).not.toBeCloseTo(ticks[1]!);
    expect(ticks[2]).toBeCloseTo(ticks[0]!);
  });
});

describe('gestures in the music', () => {
  const gestures: Record<string, () => SoundRecipe> = {
    tick: () => sounds.tick(1),
    rotate: () => new PlayerVoice().rotate(),
    hold: () => sounds.hold,
    land: () => sounds.land,
    hardDrop: () => sounds.hardDrop(12),
    settle: () => sounds.settle,
    tile: () => sounds.tile,
    pickUp: () => sounds.pickUp,
    snapHint: () => sounds.snapHint,
    putBack: () => sounds.putBack,
    deal: () => sounds.deal,
    shatter: () => sounds.shatter(4, 6),
    shatterOne: () => sounds.shatter(1, 0),
    pureLine: () => sounds.pureLine,
    sweep: () => sounds.sweep(3, 10),
    sweepCombo: () => sounds.sweep(1, 4),
    ceramicBreak: () => sounds.ceramicBreak(5, 7),
    surgeReady: () => sounds.surgeReady,
    surgeIn: () => sounds.surgeIn,
    surgeOut: () => sounds.surgeOut(2.5),
  };

  it('plays only notes of the chord playing, over each chord, on and off the beat', () => {
    for (const [name, make] of Object.entries(gestures)) {
      PROGRESSION.forEach((_, chord) => {
        for (const onBeat of [false, true]) {
          const notes = record(make(), groove(chord, onBeat)).flatMap((tone) =>
            [tone.frequency, tone.to].filter((f): f is number => f !== undefined),
          );
          for (const frequency of notes) {
            const pitch = pitchClass(frequency);
            if (pitch === null) continue;
            expect(allowed(chord).has(pitch), `${name} over chord ${chord}: ${frequency}`).toBe(
              true,
            );
          }
        }
      });
    }
  });

  it('sets a piece down on the bass: the root, with its fifth on the beat', () => {
    const off = record(sounds.land, groove(1)).map((tone) => pitchClass(tone.frequency));
    const on = record(sounds.land, groove(1, true)).map((tone) => pitchClass(tone.frequency));
    // B♭: its root (8 semitones above D) under the piece; F, its fifth (3), on the beat.
    expect(off).toContain(8);
    expect(off).not.toContain(3);
    expect(on).toContain(3);
  });

  it('climbs a note with each step of the Sand combo, never out of the chord', () => {
    const notes = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (multiplier) => record(sounds.sweep(1, multiplier), groove(0))[0]!.frequency,
    );
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]!);
  });
});

describe('the Rhythm mode leads the music', () => {
  it('hands each beat of its pulse to the music', () => {
    const pulse = vi.fn();
    const audio = { play: () => {}, pulse } as unknown as AudioEngine;
    const session = createSoloSession('rhythm', {
      random: new ConstantRandom(),
      timeLimitMs: null,
    });
    const detach = new FallingSoundscape(audio, new Haptics({}, () => false)).attach(session);
    session.start();
    for (let elapsed = 0; elapsed < 1300; elapsed += 16) session.update(16);
    // 100 beats a minute: two beats in 1.3 s.
    expect(pulse.mock.calls).toEqual([[1], [2]]);
    detach();
  });
});
