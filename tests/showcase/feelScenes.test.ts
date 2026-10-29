import { describe, expect, it } from 'vitest';
import { FEEL_SCENES } from '@/showcase/feelScenes';
import type { Scene } from '@/showcase/Scene';
import type { FallingSession } from '@/families/falling/FallingSession';

const FRAME_MS = 16;

/** Plays a scene for `ms` and lists its clears: when, how many lines, which combo. */
function clears(scene: Scene, ms: number) {
  const seen: { at: number; lines: number; combo: number }[] = [];
  let now = 0;
  (scene.session as FallingSession).onGame('clear', ({ lines, combo }) =>
    seen.push({ at: now, lines, combo }),
  );
  scene.session.start();
  for (; now < ms; now += FRAME_MS) {
    scene.drive(FRAME_MS);
    scene.session.update(FRAME_MS);
  }
  scene.dispose();
  return seen;
}

describe('the feel scenes (1.41)', () => {
  it('a hard drop into an empty well clears nothing and keeps playing', () => {
    const scene = FEEL_SCENES.feelDrop();
    expect(clears(scene, 2500)).toEqual([]);
    expect(scene.session.state).not.toBe('over');
  });

  it('one line, early', () => {
    const seen = clears(FEEL_SCENES.feelLine(), 2000);
    expect(seen.map(({ lines }) => lines)).toEqual([1]);
    expect(seen[0]!.at).toBeLessThan(900);
  });

  it('a RIFT!: four lines at once, early', () => {
    const seen = clears(FEEL_SCENES.feelRift(), 2000);
    expect(seen.map(({ lines }) => lines)).toEqual([4]);
    expect(seen[0]!.at).toBeLessThan(1000);
  });

  it('a combo of five or more, in a few seconds', () => {
    const seen = clears(FEEL_SCENES.feelCombo(), 9000);
    // The engine counts the first clear 0, the fifth in a row 4.
    expect(Math.max(...seen.map(({ combo }) => combo))).toBeGreaterThanOrEqual(4);
    expect(seen.find(({ combo }) => combo === 4)!.at).toBeLessThan(7000);
  });
});
