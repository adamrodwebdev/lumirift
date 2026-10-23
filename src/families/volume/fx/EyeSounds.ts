import * as sounds from '@/fx/sounds';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { EyeEvent } from '../TowerEye';
import type { TowerMode } from '../TowerMode';

type EyeEventOf<K extends EyeEvent['type']> = Extract<EyeEvent, { type: K }>;
type Cue = (event: EyeEvent) => void;

/**
 * The Eye of the Tower, heard (1.28): its charge, its strike, its blinding,
 * its wounds and its fall, each with its sound (and a pulse in the hand). Its
 * light and its beams are EyeEffects'.
 */
export class EyeSounds {
  private readonly cues: { readonly [K in EyeEvent['type']]: (event: EyeEventOf<K>) => void };

  constructor(audio: AudioEngine, haptics: Haptics) {
    this.cues = {
      charge: () => audio.play(sounds.rumble),
      strike: () => {
        audio.play(sounds.stoneThud);
        haptics.pulse([30, 20, 50]);
      },
      blinded: () => {
        audio.play(sounds.roar);
        haptics.pulse([40, 30, 90]);
      },
      // The Eye opens again in silence: its light says it.
      open: () => {},
      hurt: (event) => audio.play(sounds.bossHit(event.hit === 'blind')),
      phase: () => audio.play(sounds.roar),
      defeated: () => {
        audio.play(sounds.newRecord);
        haptics.pulse([40, 30, 40, 30, 160]);
      },
    };
  }

  attach(mode: TowerMode): () => void {
    return mode.eyeEvents.on('boss', ({ event }) => (this.cues[event.type] as Cue)(event));
  }
}
