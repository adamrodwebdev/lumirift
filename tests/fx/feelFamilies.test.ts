import { describe, expect, it } from 'vitest';
import { Emitter } from '@/core/Emitter';
import { effectsProfile, type EffectsLevel } from '@/fx/EffectsProfile';
import * as sounds from '@/fx/sounds';
import type { PlacementSession } from '@/families/placement/PlacementSession';
import { MosaicEffects } from '@/families/placement/fx/MosaicEffects';
import { MosaicSoundscape } from '@/families/placement/fx/MosaicSoundscape';
import type { SandEventMap, SandEventSource } from '@/families/sand/engine/SandGame';
import type { SandView } from '@/families/sand/SandSession';
import { BADGE_BREAK_MS, SandEffects } from '@/families/sand/fx/SandEffects';
import { SandSoundscape } from '@/families/sand/fx/SandSoundscape';
import { MOSAIC_SCENES } from '@/showcase/mosaicScenes';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';

/** Sand's events, sent by hand. */
function sandEvents() {
  const events = new Emitter<SandEventMap>();
  const source: SandEventSource = { onGame: (type, listener) => events.on(type, listener) };
  return { events, source };
}

function sandEffects(level: EffectsLevel = 'full') {
  const view = { grid: { width: 60, height: 120 } } as unknown as SandView;
  const effects = new SandEffects(
    view,
    () => effectsProfile(level, true),
    () => null,
    String,
  );
  const holds: number[] = [];
  effects.holdTimeWith({ hold: (ms) => holds.push(ms) });
  const { events, source } = sandEvents();
  effects.attach(source);
  return { effects, events, holds };
}

const clear = (regions: number, multiplier: number) => ({
  samples: [],
  points: 100,
  grains: 0,
  regions,
  multiplier,
});

describe('Sand, weight and climb (1.41)', () => {
  it('holds the game for two regions and more, at the full level only', () => {
    const full = sandEffects();
    for (const regions of [1, 2, 3]) full.events.emit('clear', clear(regions, 1));
    expect(full.holds).toEqual([0, 35, 60]);
    const calm = sandEffects('reduced');
    calm.events.emit('clear', clear(3, 1));
    expect(calm.holds).toEqual([]);
  });

  it('cracks the badge of a combo of ×3 or more that breaks, then lets it fade', () => {
    const { effects, events } = sandEffects();
    events.emit('comboEnd', { multiplier: 2 });
    expect(effects.badgeBreak).toBeNull();
    events.emit('comboEnd', { multiplier: 4 });
    expect(effects.badgeBreak).toEqual({ multiplier: 4, age: 0 });
    effects.update(BADGE_BREAK_MS);
    expect(effects.badgeBreak).toBeNull();
  });

  it('is heard falling from ×3 only', () => {
    const played: unknown[] = [];
    const audio = { play: (recipe: unknown) => played.push(recipe) } as unknown as AudioEngine;
    const { events, source } = sandEvents();
    new SandSoundscape(audio, new Haptics({}, () => false)).attach(source);
    events.emit('comboEnd', { multiplier: 2 });
    expect(played).not.toContain(sounds.comboLost);
    events.emit('comboEnd', { multiplier: 3 });
    expect(played).toContain(sounds.comboLost);
  });
});

describe('the Mosaic, its streak on the board (1.41)', () => {
  it('writes ×N over the cleared lines from the second clear, heating, and shouts at ×3', () => {
    const scene = MOSAIC_SCENES.ceramicGolem();
    const session = scene.session as PlacementSession;
    const effects = new MosaicEffects(
      session.view,
      () => effectsProfile('full', true),
      () => null,
      String,
    );
    effects.writeShouts((key) => key.toUpperCase());
    effects.attach(session);
    const seen = new Set<(typeof effects.popups)[number]>();
    session.start();
    for (let t = 0; t < 3000; t += 16) {
      scene.drive(16);
      session.update(16);
      effects.update(16);
      for (const popup of effects.popups) seen.add(popup);
    }
    const words = [...seen].filter(({ kind }) => kind !== undefined && kind !== 'points');
    expect(words.map(({ text, kind, heat }) => [text, kind, heat])).toEqual([
      ['×2', 'label', 'gold'],
      ['×3', 'label', 'orange'],
      ['HOT', 'shout', 'orange'],
    ]);
  });

  it('is heard falling when a streak of ×3 or more ends', () => {
    const played: unknown[] = [];
    const audio = { play: (recipe: unknown) => played.push(recipe) } as unknown as AudioEngine;
    const listeners = new Map<string, (event: unknown) => void>();
    const session = {
      onGame: (type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
        return () => listeners.delete(type);
      },
    } as unknown as PlacementSession;
    new MosaicSoundscape(audio, new Haptics({}, () => false)).attach(session);
    listeners.get('streakEnd')!({ streak: 2 });
    expect(played).not.toContain(sounds.comboLost);
    listeners.get('streakEnd')!({ streak: 3 });
    expect(played).toContain(sounds.comboLost);
  });
});
