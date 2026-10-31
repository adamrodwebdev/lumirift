import { describe, expect, it, vi } from 'vitest';
import { effectsProfile, type EffectsLevel } from '@/fx/EffectsProfile';
import { createSoloSession, type FallingSession } from '@/families/falling';
import { clearLabel, fallMs, FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import { RIFT } from '@/families/falling/fx/RiftOpening';
import { ParticleKind } from '@/fx/ParticlePool';
import * as sounds from '@/fx/sounds';
import type { TonePalette } from '@/render/TonePalette';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';
import { ConstantRandom } from './helpers';

const PALETTE = {
  color: () => ({ r: 200, g: 120, b: 80 }),
  effects: { rift: '#ff9a3c', riftCore: '#fff3d6', petals: ['#ffc0d8'] },
} as unknown as TonePalette;

/** The kinds of the particles alive. */
function kinds(effects: FallingEffects): Set<number> {
  const { pool } = effects;
  return new Set(Array.from({ length: pool.count }, (_, i) => pool.kind[i]!));
}

/** A started flip-mode session whose well is ready to clear four lines in cascade. */
function setup(level: EffectsLevel = 'full') {
  const session = createSoloSession('flip', { random: new ConstantRandom(), timeLimitMs: null });
  const effects = new FallingEffects(
    session.view,
    () => effectsProfile(level, true),
    () => PALETTE,
    (points) => String(points),
    { combo: (n) => `COMBO ×${n}`, shout: (key) => key.toUpperCase() },
  );
  const detach = effects.attach(session);
  session.start();
  fillForFlip(session);
  return { session, effects, detach };
}

/** Five rows full but for the last column, and four blocks waiting in that column. */
function fillForFlip(session: FallingSession): void {
  const { board } = session.view;
  const cells = (board as unknown as { cells: Uint8Array }).cells;
  const full = board.height - 5; // the first of the five bottom rows
  for (let y = full - 4; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const last = x === board.width - 1;
      if (y >= full && !last) cells[y * board.width + x] = 1;
      if (y < full && last) cells[y * board.width + x] = 2;
    }
  }
}

describe('FallingEffects', () => {
  it('opens the cleared rows: pieces the seam swallows, then a few embers, nothing flung', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    expect(effects.cracks).toHaveLength(4);
    // A RIFT!: the four cracks join at the origin and open into one light.
    expect(effects.joins).toHaveLength(1);
    expect(effects.joins[0]).toMatchObject({ rows: 4, rift: true });
    for (const crack of effects.cracks) {
      const upper = crack.chunks.filter((chunk) => chunk.upper);
      const columns = upper.flatMap((chunk) => [chunk.x0, chunk.x1 - 1]);
      expect(Math.min(...columns)).toBe(0);
      expect(Math.max(...columns)).toBe(crack.tones.length - 1);
      expect(crack.tints).toBeNull();
    }
    effects.update(RIFT.flareFrom - 1);
    expect(effects.pool.count).toBe(0);
    effects.update(1);
    expect(effects.pool.count).toBeGreaterThan(0);
    expect(effects.pool.count).toBeLessThanOrEqual(4 * 8 + 4 * 18);
    const seen = [...kinds(effects)];
    expect(seen.every((kind) => kind === ParticleKind.Ember || kind === ParticleKind.Spark)).toBe(
      true,
    );
    effects.update(RIFT.endMs - RIFT.flareFrom);
    expect(effects.cracks).toHaveLength(0);
    expect(effects.joins).toHaveLength(0);
    expect(effects.popups[0]?.text).toBe('+800');
  });

  it('tints the pieces in the shatter style of the player and lets its flakes rise from the seam', () => {
    const { session, effects } = setup();
    effects.setShatter('petals');
    session.execute({ type: 'ability' });
    const [crack] = effects.cracks;
    expect(crack?.tints).toHaveLength(crack!.chunks.length);
    expect(crack?.tints?.every((tint) => tint === '#ffc0d8')).toBe(true);
    effects.update(RIFT.flareFrom);
    expect(kinds(effects).has(ParticleKind.Flake)).toBe(true);
    expect(kinds(effects).has(ParticleKind.Ember)).toBe(false);
  });

  it('holds the rows above where they were until the seam closes, then lets them fall into place', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    const remaining = session.view.board.height - 1; // the fifth row, now at the bottom
    expect(effects.rowOffset[remaining]).toBe(-4);
    effects.update(RIFT.fallFrom - 1);
    expect(effects.rowOffset[remaining]).toBe(-4);
    // Embers and flakes live a little over a second.
    for (let t = 0; t < 2500; t += 16) effects.update(16);
    expect(effects.rowOffset[remaining]).toBe(0);
    expect(effects.busy).toBe(false);
  });

  it('shakes the screen on a four-line clear', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    effects.update(16);
    expect(effects.camera.active).toBe(true);
  });

  it('keeps destruction calm when effects are reduced, and skips it when off', () => {
    const reduced = setup('reduced');
    reduced.session.execute({ type: 'ability' });
    // The rift opens the rows, which fade where they are: nothing moves, nothing rises.
    expect(reduced.effects.cracks.every((crack) => crack.still)).toBe(true);
    reduced.effects.update(RIFT.flareFrom);
    expect(reduced.effects.camera.active).toBe(false);
    expect(reduced.effects.pool.count).toBe(0);
    const full = setup('full');
    full.session.execute({ type: 'ability' });
    full.effects.update(RIFT.flareFrom);
    expect(full.effects.cracks.some((crack) => crack.still)).toBe(false);
    expect(reduced.effects.pool.count).toBeLessThan(full.effects.pool.count);

    const off = setup('off');
    off.session.execute({ type: 'ability' });
    expect(off.effects.cracks).toHaveLength(0);
    expect(off.effects.rowOffset.every((offset) => offset === 0)).toBe(true);
  });

  it('draws a trail and raises dust on a hard drop', () => {
    const { session, effects } = setup();
    session.execute({ type: 'hardDrop' });
    expect(effects.trails.length).toBeGreaterThan(0);
    expect(effects.pool.count).toBeGreaterThan(0);
  });

  it('shows a hard drop falling, then landing: dust and trail wait for it', () => {
    const { session, effects } = setup();
    effects.showDropsFalling();
    const distance = session.view.dropDistance();
    session.execute({ type: 'hardDrop' });
    const wait = fallMs(distance);
    expect(effects.drops).toHaveLength(1);
    // The rules locked it at once; the picture keeps it out of the stack until it lands.
    expect(effects.coveredCells()?.size).toBe(4);
    expect(effects.trails.every((trail) => trail.age === -wait)).toBe(true);
    expect(effects.pool.count).toBe(0);
    effects.update(wait);
    expect(effects.drops).toHaveLength(0);
    expect(effects.coveredCells()).toBeNull();
    expect(effects.pool.count).toBeGreaterThan(0);
  });

  it('falls quickly over a short drop and never more than 230 ms; Rhythm and calm effects drop at once', () => {
    expect(fallMs(0)).toBe(0);
    expect(fallMs(1)).toBe(88);
    expect(fallMs(20)).toBe(230);
    const { effects } = setup('reduced');
    effects.showDropsFalling();
    expect(effects.dropWait(10)).toBe(0);
    const full = setup();
    expect(full.effects.dropWait(10)).toBe(0);
    full.effects.showDropsFalling();
    expect(full.effects.dropWait(10)).toBe(160);
  });

  it('shatters the whole stack at game over', () => {
    const { session, effects } = setup();
    (session as unknown as { game: { finish(reason: string): void } }).game.finish('topOut');
    expect(effects.stackHidden).toBe(true);
    expect(effects.pool.count).toBeGreaterThan(40);
  });

  it('stops listening once detached', () => {
    const { session, effects, detach } = setup();
    detach();
    session.execute({ type: 'ability' });
    expect(effects.cracks).toHaveLength(0);
  });
});

describe('FallingSoundscape', () => {
  it('plays the rift running, the row breaking and its swallow in step with the visuals, and vibrates', () => {
    const played: unknown[] = [];
    const audio = { play: (recipe: unknown) => played.push(recipe) } as unknown as AudioEngine;
    const vibrate = vi.fn(() => true);
    const haptics = new Haptics({ vibrate }, () => true);
    const session = createSoloSession('flip', {
      random: new ConstantRandom(),
      timeLimitMs: null,
    });
    const soundscape = new FallingSoundscape(audio, haptics);
    const detach = soundscape.attach(session);
    session.start();
    fillForFlip(session);

    session.execute({ type: 'ability' });
    expect(played).toContain(sounds.riftRun);
    const immediate = played.length;
    // The break waits for the game's time, not the wall clock's: slowed down, it waits longer.
    soundscape.update(RIFT.runMs / 3);
    expect(played.length).toBe(immediate);
    soundscape.update(RIFT.runMs);
    const broken = played.length;
    expect(broken).toBeGreaterThan(immediate);
    // The swallow, once the seam draws the pieces in.
    soundscape.update(RIFT.swallowFrom);
    expect(played.length).toBe(broken + 1);
    expect(vibrate).toHaveBeenCalled();

    detach();
  });

  it('respects the vibration setting', () => {
    const vibrate = vi.fn(() => true);
    new Haptics({ vibrate }, () => false).pulse(20);
    expect(vibrate).not.toHaveBeenCalled();
    expect(new Haptics({}, () => true).supported).toBe(false);
  });

  it('waits for the player’s first gesture, which the browser requires', () => {
    const vibrate = vi.fn(() => true);
    const activation = { hasBeenActive: false };
    const haptics = new Haptics({ vibrate, userActivation: activation }, () => true);
    haptics.pulse(20);
    expect(vibrate).not.toHaveBeenCalled();
    activation.hasBeenActive = true;
    haptics.pulse(20);
    expect(vibrate).toHaveBeenCalledWith(20);
  });
});

describe('clearLabel', () => {
  const russian = (combo: number) => `КОМБО ×${combo}`;

  it('names the moment: the combo in the player’s language, RIFT! in every language', () => {
    expect(clearLabel(1, 0, russian)).toBeNull();
    expect(clearLabel(2, 0, russian)).toBe('×2');
    expect(clearLabel(4, 5, russian)).toBe('RIFT!');
  });

  it('counts a combo as the message over the well does: ×2 at the second clear in a row (1.40)', () => {
    // `combo` is 0 at a chain's first clear, 1 at its second.
    expect(clearLabel(1, 1, russian)).toBe('КОМБО ×2');
    expect(clearLabel(3, 1, russian)).toBe('КОМБО ×2');
    expect(clearLabel(1, 3, russian)).toBe('КОМБО ×4');
  });
});
