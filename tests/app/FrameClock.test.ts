import { describe, expect, it } from 'vitest';
import { FrameCap } from '@/app/FrameCap';
import { FrameClock, MAX_FRAME_MS } from '@/app/FrameClock';

/** A requestAnimationFrame driven by hand. */
class ManualFrames {
  private callback: ((time: number) => void) | null = null;
  cancelled = 0;
  readonly request = (callback: (time: number) => void) => {
    this.callback = callback;
    return 1;
  };
  readonly cancel = () => {
    this.cancelled++;
    this.callback = null;
  };
  frame(time: number) {
    const callback = this.callback;
    this.callback = null;
    callback?.(time);
  }
}

describe('FrameClock', () => {
  it('calls listeners in subscription order with the elapsed time', () => {
    const frames = new ManualFrames();
    const clock = new FrameClock(frames.request, frames.cancel);
    const calls: string[] = [];
    clock.subscribe((delta) => calls.push(`a${delta}`));
    clock.subscribe((delta) => calls.push(`b${delta}`));
    clock.start();
    frames.frame(1000);
    frames.frame(1016);
    expect(calls).toEqual(['a0', 'b0', 'a16', 'b16']);
  });

  it('caps a long stall', () => {
    const frames = new ManualFrames();
    const clock = new FrameClock(frames.request, frames.cancel);
    const deltas: number[] = [];
    clock.subscribe((delta) => deltas.push(delta));
    clock.start();
    frames.frame(0);
    frames.frame(5000);
    expect(deltas).toEqual([0, MAX_FRAME_MS]);
  });

  it('holds a touch screen to 60 frames a second, each with the time it covers', () => {
    const frames = new ManualFrames();
    const clock = new FrameClock(frames.request, frames.cancel, new FrameCap(60));
    const deltas: number[] = [];
    clock.subscribe((delta) => deltas.push(Math.round(delta)));
    clock.start();
    // A 120-Hz screen: one frame in two drawn, with the time of two.
    for (let i = 0; i <= 8; i++) frames.frame(i * (1000 / 120));
    expect(deltas).toEqual([0, 17, 17, 17, 17]);
  });

  it('stops, and lets listeners unsubscribe', () => {
    const frames = new ManualFrames();
    const clock = new FrameClock(frames.request, frames.cancel);
    const deltas: number[] = [];
    const off = clock.subscribe((delta) => deltas.push(delta));
    clock.start();
    frames.frame(0);
    off();
    frames.frame(16);
    clock.stop();
    frames.frame(32);
    expect(deltas).toEqual([0]);
    expect(frames.cancelled).toBe(1);
  });
});
