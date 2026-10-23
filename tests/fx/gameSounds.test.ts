import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '@/core/Emitter';
import { HeartSounds } from '@/families/falling/fx/HeartSounds';
import type { HeartEventMap, RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import { BREAK_MS } from '@/families/placement/fx/MosaicEffects';
import { MosaicSoundscape } from '@/families/placement/fx/MosaicSoundscape';
import type { MosaicEventMap } from '@/families/placement/engine/MosaicGame';
import type { PlacementSession } from '@/families/placement/PlacementSession';
import { EyeSounds } from '@/families/volume/fx/EyeSounds';
import type { EyeEventMap, TowerMode } from '@/families/volume/TowerMode';
import * as sounds from '@/fx/sounds';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';

/** The sounds played, and the pulses felt. */
function listeners() {
  const play = vi.fn();
  const vibrate = vi.fn(() => true);
  return {
    play,
    vibrate,
    audio: { play } as unknown as AudioEngine,
    haptics: new Haptics({ vibrate }, () => true),
  };
}

describe('the Guardians, heard (1.28)', () => {
  it('plays the Heart of the rift: swells, beats, wounds, its fall', () => {
    const { play, vibrate, audio, haptics } = listeners();
    const heartEvents = new Emitter<HeartEventMap>();
    const off = new HeartSounds(audio, haptics).attach({ heartEvents } as unknown as RiftHeartMode);
    heartEvents.emit('boss', { event: { type: 'swell', rows: [] } });
    expect(play).toHaveBeenLastCalledWith(sounds.rumble);
    heartEvents.emit('boss', { event: { type: 'beat', rows: [], mirror: false } });
    expect(play).toHaveBeenLastCalledWith(sounds.stoneThud);
    expect(vibrate).toHaveBeenCalled();
    heartEvents.emit('boss', { event: { type: 'defeated' } });
    expect(play).toHaveBeenLastCalledWith(sounds.newRecord);
    off();
    heartEvents.emit('boss', { event: { type: 'swell', rows: [] } });
    expect(play).toHaveBeenCalledTimes(3);
  });

  it('plays the Eye of the Tower, and lets it open again in silence', () => {
    const { play, audio, haptics } = listeners();
    const eyeEvents = new Emitter<EyeEventMap>();
    new EyeSounds(audio, haptics).attach({ eyeEvents } as unknown as TowerMode);
    eyeEvents.emit('boss', { event: { type: 'charge', centre: 3, reach: 2 } });
    expect(play).toHaveBeenLastCalledWith(sounds.rumble);
    eyeEvents.emit('boss', { event: { type: 'open' } });
    expect(play).toHaveBeenCalledTimes(1);
    eyeEvents.emit('boss', { event: { type: 'blinded' } });
    expect(play).toHaveBeenLastCalledWith(sounds.roar);
  });
});

describe('MosaicSoundscape', () => {
  /** A Mosaic game told by hand. */
  const mosaic = () => {
    const events = new Emitter<MosaicEventMap>();
    const session = {
      onGame: <K extends keyof MosaicEventMap>(
        type: K,
        listener: (payload: MosaicEventMap[K]) => void,
      ) => events.on(type, listener),
    } as unknown as PlacementSession;
    return { events, session };
  };

  it('hears a break when the tiles break, in game time', () => {
    const { play, audio, haptics } = listeners();
    const { events, session } = mosaic();
    const soundscape = new MosaicSoundscape(audio, haptics);
    soundscape.attach(session);
    events.emit('clear', {
      lines: 1,
      rows: [0],
      columns: [],
      removed: [],
      cracked: [],
      points: 80,
      streak: 0,
    });
    expect(play).not.toHaveBeenCalled();
    // A pause (no game time) keeps it waiting.
    soundscape.update(0);
    soundscape.update(BREAK_MS - 1);
    expect(play).not.toHaveBeenCalled();
    soundscape.update(1);
    expect(play).toHaveBeenCalledOnce();
  });

  it('lets a joker that redeals play its own sound instead of the new hand’s', () => {
    const { play, audio, haptics } = listeners();
    const { events, session } = mosaic();
    const soundscape = new MosaicSoundscape(audio, haptics);
    soundscape.attach(session);
    events.emit('deal', { hand: [] });
    events.emit('jokerUsed', { joker: 'reroll' });
    soundscape.update(16);
    expect(play.mock.calls).toEqual([[sounds.shuffle]]);
    // A hand dealt alone is heard at the next frame.
    events.emit('deal', { hand: [] });
    soundscape.update(16);
    expect(play).toHaveBeenLastCalledWith(sounds.deal);
  });
});
