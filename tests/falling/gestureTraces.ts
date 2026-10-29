import type { RandomSource } from '@/core/Random';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { GESTURE_TUNING } from '@/families/falling/input/phone/GestureTuning';
import type { PhoneGestures } from '@/families/falling/input/phone/PhoneGestures';

/*
 * Human-like touches for the phone gestures' gate (lot 23): a seeded hand
 * draws them as a thumb does, smooth strokes that start and stop, flicks that
 * speed up to the lift, a tremor and a little noise in the timing; a phone
 * samples them at 60 or 120 Hz, and may freeze for a moment (an ad loading),
 * when a browser without coalesced samples loses them.
 */

/** A sample of a touch: where, and when (ms). */
export interface Sample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/** A touch: its samples, the first one down, the last one up. */
export type Trace = readonly Sample[];

/** How a phone delivers the samples. */
export interface Screen {
  readonly hz: 60 | 120;
  /**
   * The page loads an ad: long tasks of 50 to 150 ms, every 250 to 600 ms. A
   * browser without coalesced samples (Firefox on Android, Safari before iOS
   * 18.2) merges the moves of a task into its latest one.
   */
  readonly freeze: boolean;
}

/** The play surface of the tests: a phone in portrait, its cells 30 px wide. */
export const SURFACE = { left: 0, width: 390, bottom: 844 } as const;
export const CELL = 30;

/** A stroke's shape in time: from 0 to 1. */
type Profile = (tau: number) => number;
/** A smooth stroke that starts and stops (minimum jerk). */
const SMOOTH: Profile = (tau) => tau * tau * tau * (10 - 15 * tau + 6 * tau * tau);

/** A seeded hand: it starts a touch, strokes, rests, and lifts. */
export class Hand {
  private samples: Sample[] = [];
  private x = 0;
  private y = 0;
  private t = 0;
  /** The tremor: a slow wobble (8 to 12 Hz) and the screen's noise. */
  private wobble = { amplitude: 0.8, hz: 10, phase: 0 };

  constructor(
    private readonly random: RandomSource,
    private readonly hz: number,
  ) {}

  between(min: number, max: number): number {
    return min + this.random.next() * (max - min);
  }

  /** Plus or minus, as often. */
  sign(): 1 | -1 {
    return this.random.next() < 0.5 ? -1 : 1;
  }

  /** A touch begins at (x, y). */
  start(x: number, y: number, tremor = 0.8): this {
    this.samples = [];
    [this.x, this.y, this.t] = [x, y, 1000 + this.between(0, 50)];
    this.wobble = { amplitude: tremor, hz: this.between(8, 12), phase: this.between(0, 6.28) };
    this.samples.push({ x, y, t: this.t });
    return this;
  }

  /** A stroke of (dx, dy) in `ms`, along `profile`, bent sideways by `bow` px halfway along. */
  stroke(dx: number, dy: number, ms: number, profile: Profile = SMOOTH, bow = 0): this {
    const [x0, y0, t0] = [this.x, this.y, this.t];
    const length = Math.hypot(dx, dy) || 1;
    // The bow, square to the stroke.
    const [nx, ny] = [-dy / length, dx / length];
    const frame = 1000 / this.hz;
    for (let at = frame; at < ms + frame; at += frame) {
      const tau = Math.min(1, at / ms);
      const s = profile(tau);
      const bend = bow * 4 * s * (1 - s);
      this.x = x0 + dx * s + nx * bend;
      this.y = y0 + dy * s + ny * bend;
      this.t = t0 + Math.min(at, ms);
      this.sample();
      if (tau >= 1) break;
    }
    return this;
  }

  /** The finger rests for `ms`, trembling. */
  rest(ms: number): this {
    const frame = 1000 / this.hz;
    const t0 = this.t;
    for (let at = frame; at <= ms; at += frame) {
      this.t = t0 + at;
      this.sample();
    }
    return this;
  }

  /** The finger lifts where it last was, or `dx`, `dy` from there (a roll of the thumb). */
  lift(dx = 0, dy = 0): Trace {
    const last = this.samples.at(-1)!;
    this.samples.push({ x: last.x + dx, y: last.y + dy, t: last.t + this.between(2, 8) });
    return this.samples;
  }

  private sample(): void {
    const { amplitude, hz, phase } = this.wobble;
    const swing = amplitude * Math.sin((2 * Math.PI * hz * this.t) / 1000 + phase);
    const noise = () => (this.random.next() - 0.5) * 1.2;
    const jitter = (this.random.next() - 0.5) * 1.6;
    this.samples.push({
      x: this.x + swing + noise(),
      y: this.y + swing * 0.6 + noise(),
      t: this.t + jitter,
    });
  }
}

/** A flick's shape: it speeds up to the lift. */
export const speedingUp =
  (power: number): Profile =>
  (tau) =>
    tau ** power;

/** Whether the page is busy at `t` (inside a long task), for a schedule of tasks. */
type Busy = (t: number) => boolean;

/** A page loading an ad: long tasks of 50 to 150 ms every 250 to 600 ms, at a random phase. */
function adLoading(hand: Hand, from: number): Busy {
  const period = hand.between(250, 600);
  const length = hand.between(50, 150);
  const phase = from - hand.between(0, period);
  return (t) => (t - phase) % period < length;
}

/**
 * Plays a touch. On a busy page, the browser merges the moves of a long
 * task: only the latest one comes, as the task ends (or before the lift); the
 * down and the up always come.
 */
export function replay(trace: Trace, gestures: PhoneGestures, screen: Screen, hand: Hand): void {
  const first = trace[0]!;
  const last = trace.at(-1)!;
  const busy: Busy = screen.freeze ? adLoading(hand, first.t) : () => false;
  const point = ({ x, y, t }: Sample) => ({ id: 1, x, y, time: t });
  gestures.down(point(first));
  let merged: Sample | null = null;
  for (const sample of trace.slice(1, -1)) {
    if (busy(sample.t)) {
      merged = sample;
      continue;
    }
    if (merged) gestures.move(point(merged));
    merged = null;
    gestures.move(point(sample));
  }
  if (merged) gestures.move(point(merged));
  gestures.up(point(last));
}

/** A touch and what the player meant by it. */
export interface Intent {
  readonly trace: Trace;
  /** The commands meant (soft drops aside where `softDropsAside`). */
  readonly meant: readonly FallingCommand[];
  /** A drop that soft drops first (or steps a row down, 1.40) lands in the same place: those do not count. */
  readonly softDropsAside?: boolean;
}

const move = (direction: -1 | 1): FallingCommand => ({ type: 'move', direction });
const moves = (count: number, direction: -1 | 1) =>
  Array.from({ length: count }, () => move(direction));

/** Where a touch may begin: anywhere on the game screen, away from its edges and its middle. */
function startPoint(hand: Hand, side: 1 | -1 = hand.sign()): [number, number] {
  const middle = SURFACE.left + SURFACE.width / 2;
  return [middle + side * hand.between(30, 160), hand.between(160, 640)];
}

/**
 * A sideways drag aimed at `cells` cells: the thumb stops soon after the
 * piece reaches its column (a tenth to six tenths of a cell past its notch,
 * half a cell before the column, 1.40).
 */
function sidewaysTravel(hand: Hand, cells: number): number {
  return (cells - 1 + GESTURE_TUNING.notch.first + hand.between(0.1, 0.6)) * CELL;
}

/** Quick taps, on either half: the piece turns that way. */
export function quickTap(hand: Hand): Intent {
  const side = hand.sign();
  const trace = hand
    .start(...startPoint(hand, side), hand.between(0.4, 1.5))
    .rest(hand.between(40, 170))
    .lift(hand.between(-3, 3), hand.between(-3, 3));
  return { trace, meant: [{ type: 'rotate', direction: side }] };
}

/** A sideways drag of one to four cells, then a flick down without lifting. */
export function moveThenFlick(hand: Hand): Intent {
  const cells = 1 + Math.floor(hand.between(0, 4));
  const direction = hand.sign();
  const travel = sidewaysTravel(hand, cells);
  const angle = (hand.between(-20, 20) * Math.PI) / 180;
  const length = hand.between(70, 170);
  const trace = hand
    .start(...startPoint(hand))
    .stroke(direction * travel, hand.between(-6, 6), travel / hand.between(0.15, 0.6))
    .rest(hand.between(0, 100))
    .stroke(
      Math.sin(angle) * length,
      Math.cos(angle) * length,
      hand.between(35, 90),
      speedingUp(hand.between(1.6, 2.4)),
    )
    .lift();
  return { trace, meant: [...moves(cells, direction), { type: 'hardDrop' }], softDropsAside: true };
}

/** A flick up: the piece goes into the reserve. */
export function flickUp(hand: Hand): Intent {
  const angle = (hand.between(-20, 20) * Math.PI) / 180;
  const length = hand.between(70, 170);
  const trace = hand
    .start(startPoint(hand)[0], hand.between(420, 700))
    .stroke(
      Math.sin(angle) * length,
      -Math.cos(angle) * length,
      hand.between(35, 90),
      speedingUp(hand.between(1.6, 2.4)),
    )
    .lift();
  return { trace, meant: [{ type: 'hold' }] };
}

/** A thumb's arc sideways (bent up or down), sometimes quick: moves only, never a drop. */
export function thumbArc(hand: Hand): Intent {
  const cells = 1 + Math.floor(hand.between(0, 4));
  const direction = hand.sign();
  const travel = sidewaysTravel(hand, cells);
  const trace = hand
    .start(...startPoint(hand))
    .stroke(
      direction * travel,
      hand.between(-12, 12),
      travel / hand.between(0.2, 0.9),
      undefined,
      // A thumb's arc: bent by a twentieth to a quarter of its length.
      hand.sign() * travel * hand.between(0.05, 0.25),
    )
    .rest(hand.between(0, 150))
    .lift(-direction * hand.between(0, 8), hand.between(-4, 4));
  return { trace, meant: moves(cells, direction) };
}

/** A finger that rests on its column, trembling, then rolls back a little as it lifts. */
export function edgeJitter(hand: Hand): Intent {
  const cells = 1 + Math.floor(hand.between(0, 3));
  const direction = hand.sign();
  const travel = sidewaysTravel(hand, cells);
  const trace = hand
    .start(...startPoint(hand), hand.between(1.5, 4))
    .stroke(direction * travel, hand.between(-4, 4), travel / hand.between(0.15, 0.5))
    .rest(hand.between(300, 900))
    .lift(-direction * hand.between(2, 10), hand.between(-3, 3));
  return { trace, meant: moves(cells, direction) };
}

/** A soft drop dragged on a slant (up to 45° off the vertical): never a hard drop. */
export function slantedSoftDrag(hand: Hand): Intent {
  const angle = (hand.sign() * hand.between(0, 45) * Math.PI) / 180;
  const length = hand.between(60, 250);
  const trace = hand
    .start(startPoint(hand)[0], hand.between(160, 420))
    .stroke(Math.sin(angle) * length, Math.cos(angle) * length, length / hand.between(0.15, 0.6))
    .rest(hand.between(0, 200))
    .lift(0, hand.between(-6, 6));
  return { trace, meant: [] };
}

/** A shaky tap: a finger trembling hard, a little too long or too far for some. */
export function shakyTap(hand: Hand): Intent {
  const trace = hand
    .start(...startPoint(hand), hand.between(2, 4))
    .rest(hand.between(60, 260))
    .lift(hand.between(-6, 6), hand.between(-6, 6));
  return { trace, meant: [] };
}

/**
 * A hurried swipe under pressure (1.40): quick (0.6 to 1.5 px/ms), aimed at
 * two to five cells and landing within four tenths of a cell of the aim.
 */
export function hurriedSwipe(hand: Hand): Intent {
  const cells = 2 + Math.floor(hand.between(0, 4));
  const direction = hand.sign();
  const travel = (cells + hand.between(-0.4, 0.4)) * CELL;
  const trace = hand
    .start(...startPoint(hand))
    .stroke(direction * travel, hand.between(-8, 8), travel / hand.between(0.6, 1.5))
    .rest(hand.between(0, 60))
    .lift(-direction * hand.between(0, 4), hand.between(-3, 3));
  return { trace, meant: moves(cells, direction) };
}

/**
 * A quick soft descent (1.40): one to four rows down at a steady 0.5 to
 * 1.4 px/ms (the recorded quick soft drags peak near 1.45), lifted still
 * moving. The piece goes down those rows; never a hard drop.
 */
export function quickSoftDescent(hand: Hand): Intent {
  const rows = 1 + Math.floor(hand.between(0, 4));
  const travel = (rows + hand.between(-0.4, 0.4)) * CELL;
  const trace = hand
    .start(startPoint(hand)[0], hand.between(160, 520))
    .stroke(hand.between(-6, 6), travel, travel / hand.between(0.5, 1.4), speedingUp(1))
    .lift(0, hand.between(0, 4));
  return { trace, meant: Array.from({ length: rows }, () => ({ type: 'softStep' }) as const) };
}
