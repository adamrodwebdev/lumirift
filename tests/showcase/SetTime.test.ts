import { describe, expect, it } from 'vitest';
import { SetTime } from '../../media/SetTime';

/** A page as the set's clock sees it: timers, frames, performance and the document's animations. */
function fakePage(animations: Animation[] = []) {
  const page = {
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout: () => undefined,
    clearInterval: () => undefined,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    performance: { now: () => 0 },
    document: { getAnimations: () => animations },
  };
  const time = new SetTime(page as unknown as Window & typeof globalThis);
  time.install();
  return { page: page as unknown as Window & typeof globalThis, time };
}

/** An animation that remembers what the clock did to it. */
function fakeAnimation() {
  const animation = {
    currentTime: 0 as number | null,
    paused: false,
    pause: () => {
      animation.paused = true;
    },
  };
  return animation as unknown as Animation & { paused: boolean };
}

describe('SetTime: the clip set runs on its own clock (1.39)', () => {
  it('starts far from zero and moves only when told', () => {
    const { page, time } = fakePage();
    const start = page.performance.now();
    expect(start).toBeGreaterThan(10_000);
    time.advance(1000 / 30);
    expect(page.performance.now()).toBeCloseTo(start + 1000 / 30);
  });

  it('runs the timers due in their order, each at its own time', () => {
    const { page, time } = fakePage();
    const start = page.performance.now();
    const seen: string[] = [];
    page.setTimeout(() => seen.push(`b@${page.performance.now() - start}`), 20);
    page.setTimeout(() => seen.push(`a@${page.performance.now() - start}`), 10);
    page.setTimeout(() => seen.push(`late@${page.performance.now() - start}`), 50);
    time.advance(30);
    expect(seen).toEqual(['a@10', 'b@20']);
    time.advance(30);
    expect(seen).toEqual(['a@10', 'b@20', 'late@50']);
  });

  it('repeats an interval until it is cleared, and a cleared timer never runs', () => {
    const { page, time } = fakePage();
    let ticks = 0;
    const id = page.setInterval(() => ticks++, 10);
    const never = page.setTimeout(() => (ticks += 100), 5);
    page.clearTimeout(never);
    time.advance(35);
    expect(ticks).toBe(3);
    page.clearInterval(id);
    time.advance(100);
    expect(ticks).toBe(3);
  });

  it('runs each frame callback once, at the frame; one asked for meanwhile waits for the next', () => {
    const { page, time } = fakePage();
    const frames: number[] = [];
    page.requestAnimationFrame((at) => {
      frames.push(at);
      page.requestAnimationFrame((next) => frames.push(next));
    });
    time.advance(16);
    expect(frames).toHaveLength(1);
    time.advance(16);
    expect(frames).toHaveLength(2);
    expect(frames[1]! - frames[0]!).toBe(16);
    time.advance(16);
    expect(frames).toHaveLength(2);
  });

  it('holds the CSS animations and moves them with the frames: a new one starts at 0', () => {
    const first = fakeAnimation();
    const animations: Animation[] = [first];
    const { time } = fakePage(animations);
    time.stepAnimations(33);
    expect(first.currentTime).toBe(0);
    expect(first.paused).toBe(true);
    const second = fakeAnimation();
    animations.push(second);
    time.stepAnimations(33);
    expect(first.currentTime).toBe(33);
    expect(second.currentTime).toBe(0);
  });
});
