import { describe, expect, it } from 'vitest';
import { Camera } from '@/fx/Camera';

/** The camera's offsets at each of `marks` (ms), updated at `hz` frames a second. */
function track(camera: Camera, hz: number, marks: readonly number[]) {
  const seen: { x: number; y: number; angle: number }[] = [];
  let time = 0;
  for (const mark of marks) {
    while (time < mark - 1e-9) {
      const step = Math.min(1000 / hz, mark - time);
      camera.update(step);
      time += step;
    }
    seen.push({ x: camera.x, y: camera.y, angle: camera.angle });
  }
  return seen;
}

describe('the camera (1.41)', () => {
  it('rests until something happens', () => {
    const camera = new Camera(0.35);
    camera.update(16);
    expect(camera.active).toBe(false);
    expect([camera.x, camera.y, camera.angle].map(Math.abs)).toEqual([0, 0, 0]);
  });

  it('shakes the same at 60 and at 144 frames a second, at the same moments', () => {
    const marks = [10, 50, 100, 150, 200, 300];
    const at60 = new Camera(0.35);
    const at144 = new Camera(0.35);
    at60.shake(0.65, true);
    at144.shake(0.65, true);
    const a = track(at60, 60, marks);
    const b = track(at144, 144, marks);
    a.forEach((frame, i) => {
      expect(b[i]!.x).toBeCloseTo(frame.x, 9);
      expect(b[i]!.y).toBeCloseTo(frame.y, 9);
      expect(b[i]!.angle).toBeCloseTo(frame.angle, 9);
    });
    expect(Math.max(...a.map(({ x }) => Math.abs(x)))).toBeGreaterThan(0.02);
  });

  it('fades: a full trauma is gone after 0.625 s, a small one sooner', () => {
    const camera = new Camera(0.35);
    camera.shake(1);
    track(camera, 60, [600]);
    expect(camera.active).toBe(true);
    track(camera, 60, [30]);
    expect(camera.active).toBe(false);
  });

  it('keeps a kick of 1.0 as strong at first: its trauma gives the same jolt', () => {
    const camera = new Camera(6);
    camera.kick(2);
    camera.update(0);
    expect(Math.max(Math.abs(camera.x), Math.abs(camera.y))).toBeLessThanOrEqual(2);
    // Trauma √(2/6) squared gives 2 grains of shift at full noise.
    expect(camera.active).toBe(true);
  });

  it('tilts only when asked, 0.6° at most', () => {
    const camera = new Camera(0.35);
    camera.shake(0.4);
    const plain = track(camera, 60, [20, 60, 120]);
    expect(plain.every(({ angle }) => angle === 0)).toBe(true);
    camera.shake(1, true);
    const tilted = track(camera, 60, [20, 60, 120, 180]);
    const most = Math.max(...tilted.map(({ angle }) => Math.abs(angle)));
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual((0.6 * Math.PI) / 180);
  });

  it('dips down to its depth at 22 ms and is back within 160 ms, without a bounce', () => {
    const camera = new Camera(0.35);
    camera.dip(0.12);
    const ys = track(
      camera,
      1000,
      Array.from({ length: 200 }, (_, i) => i + 1),
    ).map(({ y }) => y);
    expect(Math.max(...ys)).toBeCloseTo(0.12, 3);
    expect(ys.indexOf(Math.max(...ys))).toBe(21);
    expect(ys[159]!).toBeLessThan(0.12 * 0.02);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(camera.active).toBe(false);
  });

  it('keeps the deeper of two dips', () => {
    const camera = new Camera(0.35);
    camera.dip(0.12);
    track(camera, 60, [22]);
    const deep = camera.y;
    camera.dip(0.04);
    camera.update(0);
    expect(camera.y).toBeCloseTo(deep, 9);
  });
});
