import * as sounds from '@/fx/sounds';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { HeartEvent } from '../modes/RiftHeart';
import type { RiftHeartMode } from '../modes/RiftHeartMode';

type HeartEventOf<K extends HeartEvent['type']> = Extract<HeartEvent, { type: K }>;
type Cue = (event: HeartEvent) => void;

/**
 * The Heart of the rift, heard (1.28): its swells, its beats, its wounds and
 * its fall, each with its sound (and a pulse in the hand). Its scenery is
 * RiftHeartDecor's; the other Guardians' sounds live in their soundscapes.
 */
export class HeartSounds {
  private readonly cues: { readonly [K in HeartEvent['type']]: (event: HeartEventOf<K>) => void };

  constructor(audio: AudioEngine, haptics: Haptics) {
    this.cues = {
      swell: () => audio.play(sounds.rumble),
      beat: () => {
        audio.play(sounds.stoneThud);
        haptics.pulse([50, 30, 50]);
      },
      hurt: (event) => audio.play(sounds.bossHit(event.hit === 'shard')),
      phase: () => audio.play(sounds.roar),
      defeated: () => {
        audio.play(sounds.newRecord);
        haptics.pulse([40, 30, 40, 30, 160]);
      },
    };
  }

  attach(mode: RiftHeartMode): () => void {
    return mode.heartEvents.on('boss', ({ event }) => (this.cues[event.type] as Cue)(event));
  }
}
