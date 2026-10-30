import { describe, expect, it, vi } from 'vitest';
import type { FallingSession } from '@/families/falling/FallingSession';
import { fallMs, FallingEffects, type Popup } from '@/families/falling/fx/FallingEffects';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import { effectsProfile, type EffectsLevel } from '@/fx/EffectsProfile';
import * as sounds from '@/fx/sounds';
import type { TonePalette } from '@/render/TonePalette';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';
import { FEEL_SCENES } from '@/showcase/feelScenes';
import type { Scene } from '@/showcase/Scene';

const FRAME_MS = 16;
const PALETTE = { color: () => ({ r: 200, g: 120, b: 80 }) } as unknown as TonePalette;

/** A feel scene with the well's effects on it, frame by frame; what it held, and when. */
function watch(scene: Scene, level: EffectsLevel = 'full') {
  const session = scene.session as FallingSession;
  const effects = new FallingEffects(
    session.view,
    () => effectsProfile(level, true),
    () => PALETTE,
    String,
    { combo: (n) => `COMBO ×${n}`, shout: (key) => key.toUpperCase() },
  );
  let now = 0;
  const holds: { ms: number; at: number }[] = [];
  effects.showDropsFalling();
  effects.holdTimeWith({ hold: (ms) => holds.push({ ms, at: now }) });
  effects.attach(session);
  const clears: number[] = [];
  session.onGame('clear', () => clears.push(now));
  session.start();
  const popups = new Set<Popup>();
  const play = (ms: number, each: () => void = () => {}) => {
    for (const end = now + ms; now < end; now += FRAME_MS) {
      scene.drive(FRAME_MS);
      session.update(FRAME_MS);
      effects.update(FRAME_MS);
      for (const popup of effects.popups) popups.add(popup);
      each();
    }
  };
  return { session, effects, holds, clears, popups, play };
}

describe('the weight of a block (1.41)', () => {
  it('a hard drop squashes the piece, dips the stack under it and the camera', () => {
    const { effects, play } = watch(FEEL_SCENES.feelDrop());
    let lowest = 1;
    let camera = 0;
    let stack = 0;
    play(2400, () => {
      for (const height of effects.squash?.values() ?? []) lowest = Math.min(lowest, height);
      camera = Math.max(camera, effects.camera.y);
      stack = Math.max(stack, ...effects.rowDip);
    });
    // The I falls the whole well: almost the full 10 % squash and 0.12 cell dip.
    expect(lowest).toBeLessThan(0.92);
    expect(camera).toBeGreaterThan(0.08);
    // The O lands on the I: the I's row dips under it.
    expect(stack).toBeGreaterThan(0.03);
    expect(effects.landings).toHaveLength(0);
    expect(effects.camera.active).toBe(false);
  });

  it('a piece brought down by the player barely squashes, and the camera stays still', () => {
    const scene = FEEL_SCENES.feelDrop();
    const { session, effects, play } = watch({ ...scene, drive: () => {} });
    session.execute({ type: 'softDrop', active: true });
    let lowest = 1;
    let camera = 0;
    play(4000, () => {
      for (const height of effects.squash?.values() ?? []) lowest = Math.min(lowest, height);
      camera = Math.max(camera, Math.abs(effects.camera.y));
    });
    expect(lowest).toBeGreaterThan(0.955);
    expect(lowest).toBeLessThan(0.97);
    expect(camera).toBe(0);
  });

  it('stays still at the calmer levels: no squash, no dip, no camera', () => {
    const { effects, holds, play } = watch(FEEL_SCENES.feelRift(), 'reduced');
    let moved = false;
    play(2000, () => {
      moved ||= effects.squash !== null || effects.camera.active || effects.rowDip.some(Boolean);
    });
    expect(moved).toBe(false);
    expect(holds).toEqual([]);
  });
});

describe('the blow of a clear (1.41)', () => {
  it('holds the game when the clear is seen: nothing for a line, 100 ms for a RIFT!', () => {
    const line = watch(FEEL_SCENES.feelLine());
    line.play(1500);
    expect(line.holds.map(({ ms }) => ms)).toEqual([0]);

    const rift = watch(FEEL_SCENES.feelRift());
    rift.play(1500);
    expect(rift.holds.map(({ ms }) => ms)).toEqual([100]);
    // The engine clears as the I is dropped; the blow waits for it to land.
    const wait = rift.holds[0]!.at - rift.clears[0]!;
    expect(wait).toBeGreaterThanOrEqual(fallMs(16) - FRAME_MS);
    expect(wait).toBeLessThanOrEqual(fallMs(19) + FRAME_MS);
  });

  it('shakes, tilts and lights the well for a RIFT!, its word bigger and longer', () => {
    const { effects, popups, play } = watch(FEEL_SCENES.feelRift());
    let tilt = 0;
    let light = 0;
    play(1500, () => {
      tilt = Math.max(tilt, Math.abs(effects.camera.angle));
      light = Math.max(light, effects.wellFlash);
    });
    expect(tilt).toBeGreaterThan(0);
    expect(light).toBeCloseTo(0.35, 2);
    const rift = [...popups].find(({ text }) => text === 'RIFT!');
    expect(rift).toMatchObject({ kind: 'label', size: 1.6, punch: 0.5, life: 1100 });
  });
});

describe('the climb of a combo (1.41)', () => {
  it('grows and heats its word at each step, and shouts at ×3 and ×5', () => {
    const { effects, popups, play } = watch(FEEL_SCENES.feelCombo());
    let heat = 0;
    play(5000, () => (heat = Math.max(heat, effects.heat)));
    const words = [...popups].filter(({ kind }) => kind === 'label');
    expect(words.map(({ text, size, heat: color }) => [text, size, color])).toEqual([
      ['COMBO ×2', 1.05, 'gold'],
      ['COMBO ×3', 1.13, 'orange'],
      ['COMBO ×4', 1.21, 'orange'],
      ['COMBO ×5', 1.29, 'red'],
    ]);
    const shouts = [...popups].filter(({ kind }) => kind === 'shout');
    expect(shouts.map(({ text, heat: color }) => [text, color])).toEqual([
      ['HOT', 'orange'],
      ['BLAZING', 'red'],
    ]);
    expect(heat).toBeCloseTo(4 / 8, 9);
  });

  it('drains its heat when it breaks, and is heard falling', () => {
    const scene = FEEL_SCENES.feelCombo();
    const played: unknown[] = [];
    const audio = { play: (recipe: unknown) => played.push(recipe) } as unknown as AudioEngine;
    const soundscape = new FallingSoundscape(audio, new Haptics({}, () => false));
    soundscape.attach(scene.session as FallingSession);
    const { session, effects, play } = watch(scene);
    play(4600, () => soundscape.update(FRAME_MS));
    expect(effects.heat).toBeGreaterThan(0);
    expect(played).not.toContain(sounds.comboLost);
    // The J, dropped where it appears, clears nothing: the ×5 combo breaks.
    session.execute({ type: 'hardDrop' });
    play(450, () => soundscape.update(FRAME_MS));
    expect(effects.heat).toBe(0);
    expect(played).toContain(sounds.comboLost);
  });
});

describe('the vibrations, kept for the weighty moments (1.41)', () => {
  it('feels a hard drop by its height and a clear, never an ordinary landing', () => {
    const vibrate = vi.fn(() => true);
    const scene = FEEL_SCENES.feelLine();
    const session = scene.session as FallingSession;
    const audio = { play: () => {} } as unknown as AudioEngine;
    const soundscape = new FallingSoundscape(audio, new Haptics({ vibrate }, () => true));
    soundscape.attach(session);
    session.start();
    for (let t = 0; t < 1500; t += FRAME_MS) {
      scene.drive(FRAME_MS);
      session.update(FRAME_MS);
      soundscape.update(FRAME_MS);
    }
    // The I's hard drop (17 rows in the 18-row well), then its line.
    expect(vibrate.mock.calls).toEqual([[19], [26]]);

    const calm = FEEL_SCENES.feelDrop();
    const quiet = vi.fn(() => true);
    const softly = new FallingSoundscape(audio, new Haptics({ vibrate: quiet }, () => true));
    softly.attach(calm.session as FallingSession);
    calm.session.start();
    (calm.session as FallingSession).execute({ type: 'softDrop', active: true });
    for (let t = 0; t < 4000; t += FRAME_MS) calm.session.update(FRAME_MS);
    expect(quiet).not.toHaveBeenCalled();
  });
});
