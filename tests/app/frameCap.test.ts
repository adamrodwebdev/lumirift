import { describe, expect, it } from 'vitest';
import { FrameCap } from '@/app/FrameCap';

/** How many of a second's frames at `hz` a cap lets through. */
function drawn(cap: FrameCap, hz: number, jitter = 0): number {
  let count = 0;
  for (let i = 0; i < hz; i++) {
    const wobble = i % 2 === 0 ? jitter : -jitter;
    if (cap.admits((i * 1000) / hz + wobble)) count++;
  }
  return count;
}

describe('FrameCap', () => {
  it('draws 60 frames a second at most, evenly, whatever the screen', () => {
    expect(drawn(new FrameCap(60), 120)).toBe(60);
    expect(drawn(new FrameCap(60), 90)).toBe(60);
    expect(drawn(new FrameCap(60), 144)).toBeGreaterThanOrEqual(57);
    expect(drawn(new FrameCap(60), 144)).toBeLessThanOrEqual(61);
  });

  it('never drops a frame of a 60-Hz screen, even a wobbly one', () => {
    expect(drawn(new FrameCap(60), 60)).toBe(60);
    expect(drawn(new FrameCap(60), 60, 0.4)).toBe(60);
  });

  it('lets every frame through without a cap, and starts again at once', () => {
    expect(drawn(new FrameCap(), 120)).toBe(120);
    const cap = new FrameCap(60);
    expect(cap.admits(0)).toBe(true);
    expect(cap.admits(5)).toBe(false);
    cap.reset();
    expect(cap.admits(6)).toBe(true);
  });
});
