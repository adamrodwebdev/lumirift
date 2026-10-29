import { describe, expect, it, vi } from 'vitest';
import { AdaptiveQuality, QUALITY_BUDGETS } from '@/fx/AdaptiveQuality';
import { effectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';

const WORLD: ParticleWorld = { gravity: 60, width: 10, floor: 20 };

describe('ParticlePool', () => {
  it('spawns up to its budget, then refuses', () => {
    const pool = new ParticlePool(4);
    pool.setLimit(2);
    expect(pool.spawn(ParticleKind.Dust, 1, 1, 0, 0, 1, 0.1, 0)).toBe(0);
    expect(pool.spawn(ParticleKind.Dust, 1, 1, 0, 0, 1, 0.1, 0)).toBe(1);
    expect(pool.spawn(ParticleKind.Dust, 1, 1, 0, 0, 1, 0.1, 0)).toBe(-1);
    expect(pool.count).toBe(2);
  });

  it('removes dead particles and keeps the live ones packed', () => {
    const pool = new ParticlePool(8);
    pool.spawn(ParticleKind.Dust, 1, 1, 0, 0, 0.1, 0.1, 1);
    pool.spawn(ParticleKind.Dust, 2, 1, 0, 0, 5, 0.1, 2);
    pool.spawn(ParticleKind.Dust, 3, 1, 0, 0, 0.1, 0.1, 3);
    pool.update(0.2, WORLD);
    expect(pool.count).toBe(1);
    expect(pool.color[0]).toBe(2);
  });

  it('applies gravity and bounces on the floor', () => {
    const pool = new ParticlePool(1);
    pool.spawn(ParticleKind.Shard, 5, 19.8, 0, 5, 10, 0.2, 0);
    pool.update(0.05, WORLD);
    expect(pool.y[0]).toBeLessThanOrEqual(19.9);
    expect(pool.vy[0]).toBeLessThan(0);
  });

  it('lands debris on solid cells', () => {
    const pool = new ParticlePool(1);
    const world = { ...WORLD, solidTop: (_x: number, y: number) => (y >= 10 ? 10 : null) };
    pool.spawn(ParticleKind.Dust, 5, 9.9, 0, 4, 10, 0.2, 0);
    pool.update(0.05, world);
    expect(pool.y[0]).toBeCloseTo(9.9, 5);
  });

  it('lets sparks fly through without colliding', () => {
    const pool = new ParticlePool(1);
    pool.spawn(ParticleKind.Spark, 5, 19.9, 0, 20, 10, 0.1, 0);
    pool.update(0.1, WORLD);
    expect(pool.y[0]).toBeGreaterThan(20);
  });

  it('fades particles over the end of their life', () => {
    const pool = new ParticlePool(1);
    pool.spawn(ParticleKind.Dust, 1, 1, 0, 0, 1, 0.1, 0);
    expect(pool.alpha(0)).toBe(1);
    pool.update(0.9, { ...WORLD, gravity: 0 });
    expect(pool.alpha(0)).toBeLessThan(0.5);
  });
});

describe('AdaptiveQuality', () => {
  const run = (quality: AdaptiveQuality, frameMs: number, totalMs: number) => {
    for (let t = 0; t < totalMs; t += frameMs) quality.sample(frameMs);
  };

  it('keeps the richest budget at 60 frames per second', () => {
    const quality = new AdaptiveQuality();
    run(quality, 16.7, 10_000);
    expect(quality.budget).toBe(QUALITY_BUDGETS[0]);
  });

  it('lowers the budget after two slow windows in a row', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(onChange);
    run(quality, 25, 2_100);
    expect(quality.detail).toBe(0);
    run(quality, 25, 2_100);
    expect(quality.detail).toBe(1);
    expect(onChange).toHaveBeenCalledWith(QUALITY_BUDGETS[1]);
  });

  it('ignores stalls such as a tab switch', () => {
    const quality = new AdaptiveQuality();
    for (let i = 0; i < 100; i++) quality.sample(400);
    run(quality, 16.7, 5_000);
    expect(quality.detail).toBe(0);
  });

  it('never goes below the most frugal level', () => {
    const quality = new AdaptiveQuality();
    run(quality, 40, 60_000);
    expect(quality.budget).toBe(QUALITY_BUDGETS.at(-1));
  });
});

describe('FlashLimiter', () => {
  it('allows at most three flashes per second', () => {
    const limiter = new FlashLimiter();
    expect([0, 100, 200, 300].map((t) => limiter.tryFlash(t))).toEqual([true, true, true, false]);
    expect(limiter.tryFlash(1001)).toBe(true);
  });
});

describe('effectsProfile', () => {
  it('is spectacular by default, calmer when reduced, silent when off', () => {
    expect(effectsProfile('full', true)).toMatchObject({ particles: 1, shake: true, motion: true });
    expect(effectsProfile('full', false).shake).toBe(false);
    expect(effectsProfile('reduced', true)).toMatchObject({
      shake: false,
      motion: false,
      destruction: true,
    });
    expect(effectsProfile('off', true)).toMatchObject({
      particles: 0,
      destruction: false,
      gameOverDelayMs: 0,
    });
  });
});
