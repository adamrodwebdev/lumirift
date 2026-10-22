import type { SoundRecipe } from '@/services/audio/AudioEngine';
import { chordAt, chordStep } from './harmony';
import * as sounds from './sounds';

/** The rotations' melody climbs and comes back down between D5 and G6 (degrees of the key). */
const LINE_LOW = 10;
const LINE_HIGH = 17;

/**
 * The player's part in the music (1.21): each rotation plays the next note
 * of the chord playing, climbing then coming back down a line of an octave
 * and a half, so that turning pieces draws a melody over the music. On a new
 * chord, the line goes on from its nearest note. Steps sideways tick on the
 * chord, two notes taking turns. One voice per game.
 */
export class PlayerVoice {
  /** The line's last note, a degree of the key, and where it goes. */
  private note = LINE_LOW - 1;
  private rising = true;
  private steps = 0;

  move(): SoundRecipe {
    return sounds.tick(this.steps++);
  }

  rotate(): SoundRecipe {
    return (synth, groove) => {
      const chord = chordAt(groove.beat);
      let next = chordStep(chord, this.note, this.rising ? 1 : -1);
      if (next > LINE_HIGH || next < LINE_LOW) {
        this.rising = !this.rising;
        next = chordStep(chord, this.note, this.rising ? 1 : -1);
      }
      this.note = next;
      sounds.rotate(next)(synth, groove);
    };
  }
}
