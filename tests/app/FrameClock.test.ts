import { describe, expect, it, vi } from 'vitest';
import { FrameCap } from '@/app/FrameCap';
import { FrameClock, HOLD, MAX_FRAME_MS } from '@/app/FrameClock';

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

  it('keeps going when a part fails: the others play the frame, the next one comes', () => {
    const frames = new ManualFrames();
    const clock = new FrameClock(frames.request, frames.cancel);
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deltas: number[] = [];
    clock.subscribe(() => {
      throw new Error('a renderer failed');
    });
    clock.subscribe((delta) => deltas.push(delta));
    clock.start();
    frames.frame(0);
    frames.frame(16);
    expect(deltas).toEqual([0, 16]);
    expect(said).toHaveBeenCalledTimes(2);
    said.mockRestore();
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

  describe('a hit-stop (1.41)', () => {
    /** A clock at 60 frames a second, its game and real times summed. */
    function sixty() {
      const frames = new ManualFrames();
      const clock = new FrameClock(frames.request, frames.cancel);
      const total = { game: 0, real: 0 };
      clock.subscribe((delta, real) => {
        total.game += delta;
        total.real += real;
      });
      clock.start();
      let time = 0;
      frames.frame(time);
      return {
        clock,
        total,
        play: (ms: number) => {
          for (const end = time + ms; time < end - 1e-9;) frames.frame((time += 1000 / 60));
        },
      };
    }

    it("stops the game's time for its length while the real time runs on", () => {
      const { clock, total, play } = sixty();
      clock.hold(100);
      expect(clock.held).toBe(true);
      play(100);
      expect(total.game).toBeCloseTo(0, 6);
      expect(total.real).toBeCloseTo(100, 6);
      expect(clock.held).toBe(false);
      play(50);
      expect(total.game).toBeCloseTo(50, 6);
    });

    it('lets the rest of a frame play when it ends within it', () => {
      const { clock, total, play } = sixty();
      clock.hold(25);
      play(1000 / 30);
      expect(total.game).toBeCloseTo(1000 / 30 - 25, 6);
    });

    it('lasts 140 ms at most, and a hold during another lasts the longer one', () => {
      const { clock, total, play } = sixty();
      clock.hold(500);
      play(50);
      clock.hold(60);
      play(200);
      expect(total.game).toBeCloseTo(250 - HOLD.maxMs, 6);
    });

    it('takes 250 ms of a second at most: a chain of holds lets play through', () => {
      const { clock, total, play } = sixty();
      for (let i = 0; i < 10; i++) {
        clock.hold(140);
        play(100);
      }
      // A second of real time: 750 ms of play at least.
      expect(total.game).toBeGreaterThanOrEqual(1000 - HOLD.perSecondMs - 1e-6);
    });
  });
});
