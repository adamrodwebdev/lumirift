import { describe, expect, it } from 'vitest';
import { FrameClock } from '@/app/FrameClock';
import type { FallingSession } from '@/families/falling/FallingSession';
import { FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingInput } from '@/families/falling/input/FallingInput';
import type { Piece } from '@/families/falling/pieces/Piece';
import { effectsProfile } from '@/fx/EffectsProfile';
import type { TonePalette } from '@/render/TonePalette';
import { FEEL_SCENES } from '@/showcase/feelScenes';

const FRAME_MS = 16;
const PALETTE = {
  color: () => ({ r: 200, g: 120, b: 80 }),
  effects: { rift: '#ff9a3c', riftCore: '#fff3d6' },
} as unknown as TonePalette;

/**
 * A RIFT! played as on the game's screen (FallingStage): one clock for the
 * rules, the input and the effects, which hold the clock as the clear is
 * seen. `during` plays on the first frame of the hold.
 */
function rift(during: (input: FallingInput) => void = () => {}) {
  const scene = FEEL_SCENES.feelRift();
  const session = scene.session as FallingSession;
  const callbacks: ((time: number) => void)[] = [];
  const clock = new FrameClock(
    (callback) => callbacks.push(callback),
    () => {},
  );
  const input = new FallingInput(
    (command) => session.execute(command),
    () => {},
  );
  const effects = new FallingEffects(
    session.view,
    () => effectsProfile('full', true),
    () => PALETTE,
    String,
    { combo: (n) => `COMBO ×${n}`, shout: (key) => key.toUpperCase() },
  );
  effects.showDropsFalling();
  effects.holdTimeWith(clock);
  effects.attach(session);
  let clears = 0;
  session.onGame('clear', () => clears++);
  // The simulation first, then the input and the effects, as on the screen.
  clock.subscribe((delta) => {
    scene.drive(delta);
    session.update(delta);
  });
  clock.subscribe((delta, real) => {
    input.update(real);
    effects.update(delta, real);
  });
  session.start();
  clock.start();
  let time = 0;
  let heldFrames = 0;
  let entered: Piece | null = null;
  for (let frame = 0; frame < 300 && !entered; frame++) {
    time += FRAME_MS;
    callbacks.shift()!(time);
    if (clock.held) {
      if (heldFrames++ === 0) during(input);
    }
    if (clears > 0 && session.view.active) entered = session.view.active;
  }
  return { heldFrames, entered: entered! };
}

describe('the hit-stop keeps every gesture (1.41)', () => {
  it('a step pressed during a RIFT!’s hold moves the next piece as it enters', () => {
    const still = rift();
    // The RIFT! held the game for 100 ms, some six frames.
    expect(still.heldFrames).toBeGreaterThanOrEqual(5);
    const moved = rift((input) => {
      input.press('left');
      input.release('left');
    });
    expect(moved.entered.type).toBe(still.entered.type);
    expect(moved.entered.x).toBe(still.entered.x - 1);
  });

  it('a turn pressed during the hold is played as it enters', () => {
    const still = rift();
    const turned = rift((input) => input.press('rotateCw'));
    expect(turned.entered.rotation).toBe((still.entered.rotation + 1) % 4);
  });
});
