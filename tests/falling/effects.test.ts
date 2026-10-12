import { describe, expect, it, vi } from 'vitest';
import { effectsProfile, type EffectsLevel } from '@/fx/EffectsProfile';
import { createFallingSession, type FallingSession } from '@/families/falling';
import { CRACK_MS, FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import type { TonePalette } from '@/families/falling/render/TonePalette';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';
import { ConstantRandom } from './helpers';

const PALETTE = {
  color: () => ({ r: 200, g: 120, b: 80 }),
} as unknown as TonePalette;

/** A started flip-mode session whose well is ready to clear four lines in cascade. */
function setup(level: EffectsLevel = 'full') {
  const session = createFallingSession('flip', { random: new ConstantRandom(), timeLimitMs: null });
  const effects = new FallingEffects(
    session.view,
    () => effectsProfile(level, true),
    () => PALETTE,
    (points) => String(points),
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
  for (let y = 12; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const last = x === board.width - 1;
      if (y >= 17 && !last) cells[y * board.width + x] = 1;
      if (y >= 13 && y < 17 && last) cells[y * board.width + x] = 2;
    }
  }
}

describe('FallingEffects', () => {
  it('cracks the cleared rows first, then shatters them into shards', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    expect(effects.cracks).toHaveLength(4);
    expect(effects.pool.count).toBe(0);
    effects.update(CRACK_MS);
    expect(effects.cracks).toHaveLength(0);
    expect(effects.pool.count).toBeGreaterThan(40);
    expect(effects.popups[0]?.text).toBe('+800');
  });

  it('holds the rows above where they were, then lets them fall into place', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    const remaining = session.view.board.height - 1; // the fifth row, now at the bottom
    expect(effects.rowOffset[remaining]).toBe(-4);
    effects.update(CRACK_MS - 1);
    expect(effects.rowOffset[remaining]).toBe(-4);
    // Shards live up to 1.8 s.
    for (let t = 0; t < 2500; t += 16) effects.update(16);
    expect(effects.rowOffset[remaining]).toBe(0);
    expect(effects.busy).toBe(false);
  });

  it('shakes the screen on a four-line clear', () => {
    const { session, effects } = setup();
    session.execute({ type: 'ability' });
    effects.update(16);
    expect(effects.shake.active).toBe(true);
  });

  it('keeps destruction calm when effects are reduced, and skips it when off', () => {
    const reduced = setup('reduced');
    reduced.session.execute({ type: 'ability' });
    reduced.effects.update(CRACK_MS);
    expect(reduced.effects.shake.active).toBe(false);
    const full = setup('full');
    full.session.execute({ type: 'ability' });
    full.effects.update(CRACK_MS);
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
  it('plays a crack, then the shatter in step with the visuals, and vibrates', () => {
    vi.useFakeTimers();
    const played: unknown[] = [];
    const audio = { play: (recipe: unknown) => played.push(recipe) } as unknown as AudioEngine;
    const vibrate = vi.fn(() => true);
    const haptics = new Haptics({ vibrate }, () => true);
    const session = createFallingSession('flip', {
      random: new ConstantRandom(),
      timeLimitMs: null,
    });
    const detach = new FallingSoundscape(audio, haptics).attach(session);
    session.start();
    fillForFlip(session);

    session.execute({ type: 'ability' });
    const immediate = played.length;
    vi.advanceTimersByTime(CRACK_MS);
    expect(played.length).toBeGreaterThan(immediate);
    expect(vibrate).toHaveBeenCalled();

    detach();
    vi.useRealTimers();
  });

  it('respects the vibration setting', () => {
    const vibrate = vi.fn(() => true);
    new Haptics({ vibrate }, () => false).pulse(20);
    expect(vibrate).not.toHaveBeenCalled();
    expect(new Haptics({}, () => true).supported).toBe(false);
  });
});
