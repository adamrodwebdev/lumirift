import { describe, expect, it, vi } from 'vitest';
import { FrameClock } from '@/app/FrameClock';
import { createSoloSession } from '@/families/falling';
import {
  MAX_SURGE_FACTOR,
  RiftSurge,
  SURGE_MS,
  SURGE_TUNING,
  surgeTuningFor,
} from '@/session/RiftSurge';
import { ConstantRandom } from '../falling/helpers';

const lines = () => new RiftSurge(SURGE_TUNING.falling!);

describe('RiftSurge', () => {
  it('fills with the clears, and calls once when full', () => {
    const surge = lines();
    const ready = vi.fn();
    surge.events.on('ready', ready);
    surge.cleared(4);
    expect(surge.fill).toBeCloseTo(1 / 3);
    expect(surge.ready).toBe(false);
    expect(surge.trigger()).toBe(false);
    surge.cleared(8);
    surge.cleared(3);
    expect(surge.ready).toBe(true);
    expect(ready).toHaveBeenCalledOnce();
    // The Sand's regions are rarer: four fill it.
    const sand = new RiftSurge(SURGE_TUNING.sand!);
    sand.cleared(4);
    expect(sand.ready).toBe(true);
  });

  it('runs eight seconds of real time, then pays the clears made meanwhile', () => {
    const surge = lines();
    const end = vi.fn();
    surge.events.on('end', end);
    surge.cleared(12);
    expect(surge.trigger()).toBe(true);
    expect(surge.active).toBe(true);
    expect(surge.fill).toBe(1);
    // Clears during a surge count for its factor, not for the next gauge.
    surge.cleared(2);
    surge.cleared(4);
    surge.update(SURGE_MS / 2);
    expect(surge.fill).toBeCloseTo(0.5);
    expect(surge.factor).toBe(2.5);
    surge.update(SURGE_MS / 2);
    expect(surge.active).toBe(false);
    expect(end).toHaveBeenCalledWith({ clears: 6, factor: 2.5 });
    expect(surge.fill).toBe(0);
    expect(surge.trigger()).toBe(false);
  });

  it('caps its factor, and forgets everything on a new game', () => {
    const surge = lines();
    surge.cleared(12);
    surge.trigger();
    surge.cleared(40);
    expect(surge.factor).toBe(MAX_SURGE_FACTOR);
    surge.reset();
    expect([surge.active, surge.ready, surge.fill]).toEqual([false, false, 0]);
  });

  it('is in every mode with a fall but the Rhythm and the Duel', () => {
    expect(surgeTuningFor('falling', 'classic')).not.toBeNull();
    expect(surgeTuningFor('sand', 'sand')).not.toBeNull();
    expect(surgeTuningFor('volume', 'tower')).not.toBeNull();
    expect(surgeTuningFor('falling', 'rhythm')).toBeNull();
    expect(surgeTuningFor('falling', 'duel')).toBeNull();
    expect(surgeTuningFor('placement', 'mosaic')).toBeNull();
  });
});

describe('FrameClock pace', () => {
  it('eases into a lasting pace and back, and tells the real time too', () => {
    let callback: ((time: number) => void) | null = null;
    const clock = new FrameClock(
      (next) => {
        callback = next;
        return 1;
      },
      () => {},
    );
    const seen: [number, number][] = [];
    clock.subscribe((delta, real) => seen.push([delta, real]));
    clock.start();
    let time = 0;
    const frame = () => {
      time += 16;
      const next = callback;
      callback = null;
      next?.(time);
    };
    frame();
    clock.setPace(1 / 3);
    for (let i = 0; i < 120; i++) frame();
    const [delta, real] = seen.at(-1)!;
    expect(real).toBe(16);
    expect(delta).toBeCloseTo(16 / 3, 1);
    clock.setPace(1);
    for (let i = 0; i < 120; i++) frame();
    expect(seen.at(-1)![0]).toBeCloseTo(16, 1);
  });
});

describe('the surge bonus', () => {
  it('adds points outside the rules, with its notice', () => {
    const session = createSoloSession('classic', {
      random: new ConstantRandom(),
      timeLimitMs: null,
    });
    const notice = vi.fn();
    session.events.on('notice', notice);
    session.start();
    const before = session.result().value;
    session.awardBonus(250.4, 'surge');
    expect(session.result().value).toBe(before + 250);
    expect(notice).toHaveBeenCalledWith({ id: 'surge', value: 250 });
  });
});
