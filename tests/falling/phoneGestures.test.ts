import { describe, expect, it } from 'vitest';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { DRAG_SPEED, validDragSpeed } from '@/families/falling/input/phone/GestureTuning';
import {
  PhoneGestures,
  type PieceWatch,
  type TouchPrefs,
} from '@/families/falling/input/phone/PhoneGestures';
import { VelocityTracker } from '@/families/falling/input/phone/VelocityTracker';

const CELL = 30;
const RIGHT = { type: 'move', direction: 1 } as const;
const LEFT = { type: 'move', direction: -1 } as const;
const DROP = { type: 'hardDrop' } as const;
const SOFT_ON = { type: 'softDrop', active: true } as const;
const SOFT_OFF = { type: 'softDrop', active: false } as const;

/** A game screen 400 px wide and 800 px tall, one piece in play. */
function setup(prefs: Partial<TouchPrefs> = {}, secondFingerTurns = true) {
  const commands: FallingCommand[] = [];
  const pieces: { -readonly [K in keyof PieceWatch]: PieceWatch[K] } = { entered: 1, inPlay: true };
  const gestures = new PhoneGestures({
    execute: (command) => commands.push(command),
    cellSize: () => CELL,
    prefs: () => ({ dragSpeed: 1, tapSides: true, flicks: true, ...prefs }),
    bounds: () => ({ left: 0, width: 400, bottom: 800 }),
    pieces,
    secondFingerTurns,
  });
  /** A finger: down, moves, up; `glide` samples a straight line every `every` ms. */
  const finger = (id = 1) => {
    let time = 0;
    let x = 0;
    let y = 0;
    const self = {
      down(atX: number, atY: number, at = time) {
        [x, y, time] = [atX, atY, at];
        gestures.down({ id, x, y, time });
        return self;
      },
      move(toX: number, toY: number, at: number) {
        [x, y, time] = [toX, toY, at];
        gestures.move({ id, x, y, time });
        return self;
      },
      glide(toX: number, toY: number, ms: number, every = 16) {
        const [fromX, fromY, from] = [x, y, time];
        for (let t = every; t <= ms; t += every) {
          const k = t / ms;
          self.move(fromX + (toX - fromX) * k, fromY + (toY - fromY) * k, from + t);
        }
        return self;
      },
      up(after = 0) {
        gestures.up({ id, x, y, time: time + after });
        return self;
      },
    };
    return self;
  };
  return { gestures, commands, pieces, finger };
}

describe('VelocityTracker', () => {
  it('reads a steady motion over its last 100 ms', () => {
    const tracker = new VelocityTracker();
    for (let t = 0; t <= 200; t += 10) tracker.add(t * 0.5, 100 + t * 2, t);
    const motion = tracker.motion(200)!;
    expect(motion.vx).toBeCloseTo(0.5);
    expect(motion.vy).toBeCloseTo(2);
    // The window: 100 ms, so 200 px down.
    expect(motion.dy).toBeCloseTo(200);
  });

  it('reads a flick at its own speed, even after a slow drag', () => {
    const tracker = new VelocityTracker();
    for (let t = 0; t <= 100; t += 10) tracker.add(100 + t * 0.2, 300, t);
    for (let t = 110; t <= 150; t += 10) tracker.add(120, 300 + (t - 100) * 2, t);
    expect(tracker.motion(150)!.vy).toBeGreaterThan(1.8);
  });

  it('takes a finger still for 40 ms as stopped', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(0, 30, 10);
    tracker.add(0, 31, 20);
    tracker.add(0, 60, 30);
    expect(tracker.motion(30)).not.toBeNull();
    expect(tracker.motion(71)).toBeNull();
  });

  it('cuts the window where the finger stayed put for 40 ms', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(0, 50, 10);
    tracker.add(0, 100, 20);
    // Still for 50 ms, then a slow stroke: the flick before the pause is over.
    tracker.add(0, 100, 70);
    tracker.add(0, 101, 80);
    expect(tracker.motion(80)!.vy).toBeCloseTo(0.1);
  });

  it('reads the first stroke of a touch from its ends, faster as the finger lifts', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 300, 0);
    tracker.add(0, 360, 30);
    expect(tracker.motion(30)!.vy).toBeCloseTo(2);
    // From rest, it leaves the glass faster than it averaged.
    expect(tracker.motionAtLift(32)!.vy).toBeCloseTo(3);
  });

  it('reads a flick merged by a busy page from its jump, and a pause as slow', () => {
    const flick = new VelocityTracker();
    flick.add(0, 300, 0);
    flick.add(0, 300, 10);
    // The page froze for 120 ms while the finger flicked 120 px.
    flick.add(0, 420, 130);
    expect(flick.motion(130)!.vy).toBeCloseTo(1);
    expect(flick.motionAtLift(134)!.vy).toBeCloseTo(1.5);
    const pause = new VelocityTracker();
    pause.add(0, 300, 0);
    pause.add(0, 300, 10);
    pause.add(0, 330, 130);
    expect(pause.motion(130)!.vy).toBeCloseTo(0.25);
    pause.add(0, 330, 400);
    expect(pause.motion(400)).toBeNull();
  });
});

describe('the drag speed setting', () => {
  it('keeps within its range, on its steps', () => {
    expect(validDragSpeed(1.23)).toBe(1.2);
    expect(validDragSpeed(3)).toBe(DRAG_SPEED.max);
    expect(validDragSpeed(0.1)).toBe(DRAG_SPEED.min);
    expect(validDragSpeed(Number.NaN)).toBe(DRAG_SPEED.standard);
  });
});

describe('PhoneGestures', () => {
  it('turns on a tap, the way of its side', () => {
    const { finger, commands } = setup();
    finger().down(300, 400).move(302, 401, 60).up(40);
    finger().down(100, 400, 1000).up(120);
    expect(commands).toEqual([
      { type: 'rotate', direction: 1 },
      { type: 'rotate', direction: -1 },
    ]);
  });

  it('turns right on every tap when the sides are off', () => {
    const { finger, commands } = setup({ tapSides: false });
    finger().down(100, 400).up(100);
    expect(commands).toEqual([{ type: 'rotate', direction: 1 }]);
  });

  it('takes neither a long press nor a short drag for a tap', () => {
    const { finger, commands } = setup();
    finger().down(300, 400).up(400);
    finger().down(300, 400, 1000).glide(320, 400, 100).up();
    expect(commands).toEqual([]);
  });

  it('moves a notch a cell, after a dead zone of a third of a cell', () => {
    const { finger, commands } = setup();
    const one = finger().down(100, 400).glide(139, 400, 200, 50);
    expect(commands).toEqual([]);
    one.glide(200, 400, 300, 10).up();
    // 40 px for the first cell, then every 30: 140, 170, 200.
    expect(commands).toEqual([RIGHT, RIGHT, RIGHT]);
  });

  it('moves further for the same finger at a quicker drag speed', () => {
    const { finger, commands } = setup({ dragSpeed: 1.6 });
    finger().down(100, 400).glide(200, 400, 500, 50).up();
    expect(commands).toEqual([RIGHT, RIGHT, RIGHT, RIGHT, RIGHT]);
  });

  it('lets a finger rest on a notch without a twitch, and asks the dead zone again on a turn back', () => {
    const { finger, commands } = setup();
    const one = finger().down(100, 400).glide(145, 400, 300, 50);
    expect(commands).toEqual([RIGHT]);
    // Jitter, then the finger rolls back a little as it settles.
    one.move(140, 401, 320).move(146, 400, 340).move(137, 399, 360).move(134, 400, 380);
    expect(commands).toEqual([RIGHT]);
    // Back 40 px from the turning point (146): one cell back.
    one.glide(106, 400, 400, 50);
    expect(commands).toEqual([RIGHT, LEFT]);
    one.up();
    expect(commands).toEqual([RIGHT, LEFT]);
  });

  it('soft drops on a mostly vertical drag, a cell and a half down, until the lift', () => {
    const { finger, commands } = setup();
    const one = finger().down(200, 300).glide(202, 344, 400, 50);
    expect(commands).toEqual([]);
    one.glide(204, 380, 300, 50);
    expect(commands).toEqual([SOFT_ON]);
    one.up(200);
    expect(commands).toEqual([SOFT_ON, SOFT_OFF]);
  });

  it('ends a soft drop when the finger goes back up a cell', () => {
    const { finger, commands } = setup();
    const one = finger().down(200, 300).glide(200, 400, 1000, 50);
    one.glide(200, 368, 400, 50);
    expect(commands).toEqual([SOFT_ON, SOFT_OFF]);
  });

  it('takes no soft drop from a thumb arc', () => {
    const { finger, commands } = setup();
    const one = finger().down(100, 400);
    for (let step = 1; step <= 12; step++)
      one.move(100 + step * 10, 400 + 30 * Math.sin((step / 12) * (Math.PI / 2)), step * 50);
    one.up();
    expect(commands).toEqual([RIGHT, RIGHT, RIGHT]);
  });

  it('drops at once on a flick down, then ignores the rest of the touch', () => {
    const { finger, commands } = setup();
    const one = finger().down(200, 300).move(200, 320, 10).move(201, 345, 20);
    expect(commands).toEqual([DROP]);
    one.glide(320, 345, 300).up();
    expect(commands).toEqual([DROP]);
  });

  it('drops right after a move, without lifting the finger', () => {
    const { finger, commands } = setup();
    finger().down(100, 300).glide(172, 302, 360).glide(178, 420, 40, 8);
    // A soft drop may begin as the flick gathers speed: the piece lands in the same place.
    expect(commands.filter(({ type }) => type !== 'softDrop')).toEqual([RIGHT, RIGHT, DROP]);
    expect(commands.at(-1)).toEqual(DROP);
  });

  it('drops on a gentle flick as the finger leaves the glass', () => {
    const { finger, commands } = setup();
    const one = finger().down(200, 300).glide(200, 330, 30, 10).glide(200, 370, 30, 10);
    expect(commands).not.toContainEqual(DROP);
    one.up(2);
    expect(commands.at(-1)).toEqual(DROP);
  });

  it('moves nothing sideways with the arc of a flick', () => {
    const { finger, commands } = setup();
    // A flick 25° off the vertical: 50 px sideways on its way down.
    finger().down(200, 300).glide(250, 410, 64, 8).up();
    expect(commands).toEqual([DROP]);
  });

  it('drops only the piece in play as the touch began', () => {
    const { finger, commands, pieces } = setup();
    const one = finger().down(200, 300).glide(200, 330, 400, 50);
    // The piece locks; the next one enters under the finger.
    pieces.entered = 2;
    one.glide(200, 450, 60, 10).up();
    expect(commands).not.toContainEqual(DROP);
  });

  it('gives a touch begun while the next piece waits to that piece', () => {
    const { finger, commands, pieces } = setup();
    pieces.inPlay = false;
    const one = finger().down(200, 300);
    Object.assign(pieces, { entered: 2, inPlay: true });
    one.glide(200, 420, 60, 10).up();
    expect(commands).toEqual([DROP]);
  });

  it('holds on a flick up, unless it starts on the bottom edge', () => {
    const { finger, commands } = setup();
    finger().down(200, 500).glide(202, 400, 50, 10).up();
    finger().down(200, 790, 1000).glide(200, 690, 50, 10).up();
    expect(commands).toEqual([{ type: 'hold' }]);
  });

  it('neither drops nor holds on a flick when the buttons do it', () => {
    const { finger, commands } = setup({ flicks: false });
    finger().down(200, 300).glide(200, 420, 60, 10).up();
    finger().down(200, 500, 1000).glide(200, 400, 50, 10).up();
    expect(commands).not.toContainEqual(DROP);
    expect(commands).not.toContainEqual({ type: 'hold' });
  });

  it('takes no flick from a finger that stopped before lifting', () => {
    const { gestures, finger, commands } = setup();
    // Quick, but short of a flick; then still for 60 ms, and lifted a little lower.
    finger().down(200, 300).glide(200, 322, 20, 5);
    gestures.up({ id: 1, x: 200, y: 330, time: 80 });
    expect(commands).toEqual([]);
  });

  it('turns on a second finger tapped during a drag, and the drag goes on', () => {
    const { gestures, finger, commands } = setup();
    const one = finger().down(200, 400).glide(245, 400, 200, 50);
    expect(commands).toEqual([RIGHT]);
    gestures.down({ id: 2, x: 80, y: 500, time: 210 });
    gestures.up({ id: 2, x: 81, y: 500, time: 300 });
    one.glide(275, 400, 200, 50).up();
    expect(commands).toEqual([RIGHT, { type: 'rotate', direction: -1 }, RIGHT]);
  });

  it('turns the other way on a two-finger tap, and nothing on a two-finger drag', () => {
    const { gestures, commands } = setup();
    gestures.down({ id: 1, x: 100, y: 400, time: 0 });
    gestures.down({ id: 2, x: 300, y: 400, time: 30 });
    gestures.up({ id: 1, x: 101, y: 400, time: 140 });
    expect(commands).toEqual([]);
    gestures.up({ id: 2, x: 301, y: 401, time: 160 });
    expect(commands).toEqual([{ type: 'rotate', direction: -1 }]);
    gestures.down({ id: 1, x: 100, y: 400, time: 1000 });
    gestures.down({ id: 2, x: 300, y: 400, time: 1020 });
    gestures.move({ id: 1, x: 160, y: 400, time: 1100 });
    gestures.move({ id: 2, x: 360, y: 400, time: 1100 });
    gestures.up({ id: 1, x: 160, y: 400, time: 1200 });
    gestures.up({ id: 2, x: 360, y: 400, time: 1210 });
    expect(commands).toEqual([{ type: 'rotate', direction: -1 }]);
  });

  it('leaves a second finger to the Tower, which turns with two: the drag ends', () => {
    const { gestures, finger, commands } = setup({}, false);
    finger().down(200, 300).glide(200, 400, 1000, 50);
    expect(commands).toEqual([SOFT_ON]);
    gestures.down({ id: 2, x: 300, y: 400, time: 1100 });
    expect(commands).toEqual([SOFT_ON, SOFT_OFF]);
  });

  it('lets go of everything on a cancel', () => {
    const { gestures, finger, commands } = setup();
    finger().down(200, 300).glide(200, 400, 1000, 50);
    gestures.cancel();
    gestures.up({ id: 1, x: 200, y: 400, time: 1100 });
    expect(commands).toEqual([SOFT_ON, SOFT_OFF]);
  });
});
