import { describe, expect, it } from 'vitest';
import type { FallingSession } from '@/families/falling/FallingSession';
import type { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import type { PlacementSession } from '@/families/placement/PlacementSession';
import type { SandSession } from '@/families/sand/SandSession';
import type { TowerMode } from '@/families/volume/TowerMode';
import { FALLING_SCENES } from '@/showcase/fallingScenes';
import { MOSAIC_SCENES } from '@/showcase/mosaicScenes';
import { SAND_SCENES } from '@/showcase/sandScenes';
import { SCENE_FAMILIES, SCENE_IDS, SCENE_MS, type Scene } from '@/showcase/Scene';
import { TOWER_SCENES } from '@/showcase/towerScenes';

const FRAME_MS = 16;
/** A moment's peak must land this long before the scene gives way, to be seen (ms). */
const SEEN_MS = 700;

/** Plays a scene frame by frame, as the title screen's reel does; `clock.now` is its time. */
function play(scene: Scene, ms: number, clock: { now: number }): void {
  scene.session.start();
  for (clock.now = 0; clock.now < ms; clock.now += FRAME_MS) {
    scene.drive(FRAME_MS);
    scene.session.update(FRAME_MS);
  }
  scene.dispose();
}

/** The first time each named thing happened. */
function marks(clock: { now: number }) {
  const seen = new Map<string, number>();
  return {
    seen,
    mark: (name: string) => {
      if (!seen.has(name)) seen.set(name, clock.now);
    },
  };
}

describe('the showcase scenes', () => {
  it('have a scene of their family for every moment of the reel', () => {
    const families = {
      sand: SAND_SCENES,
      falling: FALLING_SCENES,
      tower: TOWER_SCENES,
      mosaic: MOSAIC_SCENES,
    } as Record<string, Record<string, unknown>>;
    for (const id of SCENE_IDS) expect(families[SCENE_FAMILIES[id]]?.[id]).toBeTypeOf('function');
  });

  it('elements: lightning shocks the water, fire sets the oil ablaze, a seed sprouts', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    const scene = SAND_SCENES.elements();
    const session = scene.session as SandSession;
    session.onGame('strike', ({ kind }) => mark(kind));
    session.onGame('react', ({ kind }) => mark(kind));
    play(scene, SCENE_MS.elements, clock);
    expect(seen.get('shock')).toBeLessThan(2000);
    expect(seen.get('blaze')).toBeLessThan(SCENE_MS.elements - SEEN_MS);
    expect(seen.get('sprout')).toBeLessThan(SCENE_MS.elements - SEEN_MS);
  });

  it('Dune Wyrm: it bursts out, and the bolt strikes its bare head', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    const scene = SAND_SCENES.duneWorm();
    (scene.session as SandSession).onGame('boss', ({ event }) =>
      mark(event.type === 'hurt' ? event.hit : event.type),
    );
    play(scene, SCENE_MS.duneWorm, clock);
    expect(seen.get('warn')).toBeLessThan(200);
    expect(seen.get('surge')).toBeLessThan(SCENE_MS.duneWorm - SEEN_MS);
    expect(seen.get('boltHead')).toBeLessThan(SCENE_MS.duneWorm - SEEN_MS);
  });

  it.each([
    ['flip', 4],
    ['tilt', 2],
  ] as const)('%s: the well turns and the rows it fills clear', (id, lines) => {
    const clock = { now: 0 };
    let turned: { at: number; lines: number } | null = null;
    const scene = FALLING_SCENES[id]();
    (scene.session as FallingSession).onGame(id, (event) => {
      turned ??= { at: clock.now, lines: event.lines };
    });
    play(scene, SCENE_MS[id], clock);
    expect(turned).toEqual({ at: expect.any(Number), lines });
    expect(turned!.at).toBeLessThan(1000);
  });

  it('mirror: the well is reflected, then the AI clears the well it opened', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    const scene = FALLING_SCENES.mirror();
    const session = scene.session as FallingSession;
    session.onGame('mirror', () => mark('mirror'));
    session.onGame('clear', () => mark('clear'));
    play(scene, SCENE_MS.mirror, clock);
    expect(seen.get('mirror')).toBeLessThan(1000);
    expect(seen.get('clear')).toBeGreaterThan(seen.get('mirror')!);
    expect(seen.get('clear')).toBeLessThan(SCENE_MS.mirror - SEEN_MS);
  });

  it('Ceramic Golem: it throws its stones while every placement clears', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    let clears = 0;
    const scene = MOSAIC_SCENES.ceramicGolem();
    const session = scene.session as PlacementSession;
    session.onGame('boss', ({ event }) => mark(event.type));
    session.onGame('clear', () => clears++);
    play(scene, SCENE_MS.ceramicGolem, clock);
    expect(seen.get('throw')).toBeLessThan(1200);
    expect(seen.get('hurt')).toBeLessThan(1200);
    expect(clears).toBe(3);
  });

  it('Eye of the Tower: the ring cleared all the way round sets off the bomb in its gaze', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    const scene = TOWER_SCENES.towerEye();
    const mode = (scene.session as FallingSession).view.mode as TowerMode;
    mode.eyeEvents.on('boss', ({ event }) => mark(event.type));
    play(scene, SCENE_MS.towerEye, clock);
    expect(seen.get('charge')).toBeLessThan(500);
    expect(seen.get('blinded')).toBeLessThan(SCENE_MS.towerEye - SEEN_MS);
    expect(seen.has('strike')).toBe(false);
  });

  it('Heart of the Rift: the I clears the rows of its shards and wounds it', () => {
    const clock = { now: 0 };
    const { seen, mark } = marks(clock);
    const scene = FALLING_SCENES.riftHeart();
    const mode = (scene.session as FallingSession).view.mode as RiftHeartMode;
    mode.heartEvents.on('boss', ({ event }) =>
      mark(event.type === 'hurt' ? event.hit : event.type),
    );
    play(scene, SCENE_MS.riftHeart, clock);
    expect(seen.get('swell')).toBeLessThan(200);
    expect(seen.get('shard')).toBeLessThan(SCENE_MS.riftHeart - SEEN_MS);
  });
});
