import { SeededRandom } from '@/core/Random';

/** A crack of the broken glass: an SVG path that runs out from the impact. */
export interface ShatterCrack {
  readonly d: string;
  readonly length: number;
  /** When it starts to run after the break, and how long it runs (ms). */
  readonly delayMs: number;
  readonly runMs: number;
  /** In the glass that falls away (it goes with it), or in the glass that stays. */
  readonly inner: boolean;
}

/** A pane of glass between the cracks, near the impact: it bursts out and falls. */
export interface ShatterPane {
  /** Its box in the well (CSS px). */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Its outline in its box, as SVG points ("x,y x,y …"). */
  readonly points: string;
  /** Its centre in its box: it spins around it. */
  readonly originX: number;
  readonly originY: number;
  /** The burst out of the impact, the drift and the fall (px), the spin (deg). */
  readonly burstX: number;
  readonly burstY: number;
  readonly driftX: number;
  readonly fall: number;
  readonly spin: number;
  readonly delayMs: number;
  readonly fallMs: number;
}

export interface WellShatter {
  /** Where the last piece hit the rim (CSS px in the well). */
  readonly impact: { readonly x: number; readonly y: number };
  readonly cracks: readonly ShatterCrack[];
  readonly panes: readonly ShatterPane[];
}

type Point = readonly [number, number];

/** How far each crack runs between its knots, as a share of the well's height. */
const KNOTS = [
  0, 0.039, 0.08, 0.129, 0.18, 0.238, 0.303, 0.374, 0.451, 0.548, 0.66, 0.789, 0.918, 1.06,
];
/** Inside this knot the glass falls away; outside it stays, cracked. */
const HOLE = 7;
/** The knots the rings join the cracks at: two inside the hole, its edge, two outside. */
const RINGS = [2, 4, HOLE, 9, 11];
/** The rows of panes that fall: small near the impact, larger out to the hole's edge. */
const PANE_ROWS: readonly (readonly [number, number])[] = [
  [0, 2],
  [2, 4],
  [4, HOLE],
];
/** The cracks fanning down from the rim (radians, 0 to the right), and two short ones up. */
const FAN = [0.06, 0.36, 0.68, 0.98, 1.28, 1.57, 1.86, 2.17, 2.5, 2.9];
const UP = [-0.55, -2.65];
/** How fast a crack runs: the height of a phone's well in about 300 ms. */
const SPEED_PER_HEIGHT = 2.2 / 621;
/** The cracks start this long after the impact; the panes fall from this moment. */
const CRACK_START_MS = 40;
const RING_START_MS = 70;
export const SHATTER_FALL_MS = 430;

const pathOf = (points: readonly Point[]) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const lengthOf = (points: readonly Point[]) =>
  points.reduce(
    (sum, [x, y], i) =>
      i === 0 ? 0 : sum + Math.hypot(x - points[i - 1]![0], y - points[i - 1]![1]),
    0,
  );

const pointsOf = (points: readonly Point[]) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/**
 * The well's glass breaking (1.31): from the impact on the rim, cracks fan
 * out to the walls and the floor, joined by rings; the panes between them
 * near the impact burst out and fall, the rest stays cracked. Always the
 * same for the same size; transform and opacity are all a view animates.
 */
export function wellShatter(width: number, height: number): WellShatter {
  const random = new SeededRandom(Math.round(width) * 31 + Math.round(height) * 7);
  const between = (a: number, b: number) => a + (b - a) * random.next();
  const impact: Point = [width * 0.56, height * 0.022];
  const speed = height * SPEED_PER_HEIGHT;

  /** A crack from the impact through its knots, stopped at the well's border. */
  const ray = (angle: number): Point[] => {
    const points: Point[] = [impact];
    const phase = random.next() * 6;
    for (let k = 1; k < KNOTS.length; k++) {
      const heading = angle + 0.09 * Math.sin(phase + k * 1.3) + (random.next() - 0.5) * 0.08;
      const [fx, fy] = points[k - 1]!;
      const step = (KNOTS[k]! - KNOTS[k - 1]!) * height;
      const x = fx + Math.cos(heading) * step;
      const y = fy + Math.sin(heading) * step;
      let t = 1;
      if (x < 0) t = Math.min(t, -fx / (x - fx));
      if (x > width) t = Math.min(t, (width - fx) / (x - fx));
      if (y < 0) t = Math.min(t, -fy / (y - fy));
      if (y > height) t = Math.min(t, (height - fy) / (y - fy));
      points.push([fx + (x - fx) * t, fy + (y - fy) * t]);
      if (t < 1) break;
    }
    return points;
  };

  const fan = FAN.map(ray);
  const cracks: ShatterCrack[] = [];
  const crack = (points: readonly Point[], delayMs: number, inner: boolean) => {
    const length = lengthOf(points);
    if (length < 0.5) return;
    cracks.push({ d: pathOf(points), length, delayMs, runMs: length / speed, inner });
  };
  // Each crack in two: inside the hole it falls with the panes, outside it stays.
  for (const points of [...fan, ...UP.map(ray)]) {
    const inside = points.slice(0, HOLE + 1);
    crack(inside, CRACK_START_MS, true);
    if (points.length > HOLE + 1) {
      crack(points.slice(HOLE), CRACK_START_MS + lengthOf(inside) / speed, false);
    }
  }

  // The rings between two neighbouring cracks, bowed towards the impact.
  const mids = new Map<string, Point>();
  for (const k of RINGS) {
    for (let i = 0; i < fan.length - 1; i++) {
      const a = fan[i]![k];
      const b = fan[i + 1]![k];
      if (!a || !b || (k > HOLE && random.next() < 0.35)) continue;
      const m: Point = [
        (a[0] + b[0]) / 2 + (impact[0] - (a[0] + b[0]) / 2) * 0.06 + between(-3, 3),
        (a[1] + b[1]) / 2 + (impact[1] - (a[1] + b[1]) / 2) * 0.06 + between(-3, 3),
      ];
      mids.set(`${k}:${i}`, m);
      crack([a, m, b], RING_START_MS + (KNOTS[k]! * height) / speed, k < HOLE);
    }
  }

  // The panes between two cracks and two rings, out to the hole's edge.
  const panes: ShatterPane[] = [];
  PANE_ROWS.forEach(([k0, k1], rank) => {
    for (let i = 0; i < fan.length - 1; i++) {
      const a = fan[i]!;
      const b = fan[i + 1]!;
      const outer = mids.get(`${k1}:${i}`);
      const inner = mids.get(`${k0}:${i}`);
      if (a.length <= k1 || b.length <= k1 || !outer || (k0 > 0 && !inner)) continue;
      const outline: Point[] = [...a.slice(k0, k1 + 1), outer];
      for (let j = k1; j >= Math.max(1, k0); j--) outline.push(b[j]!);
      if (inner) outline.push(inner);
      panes.push(pane(outline, rank));
    }
  });

  function pane(outline: readonly Point[], rank: number): ShatterPane {
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const local = outline.map(([x, y]): Point => [x - left, y - top]);
    const originX = local.reduce((sum, [x]) => sum + x, 0) / local.length;
    const originY = local.reduce((sum, [, y]) => sum + y, 0) / local.length;
    const outX = left + originX - impact[0];
    const outY = top + originY - impact[1];
    const norm = Math.hypot(outX, outY) || 1;
    const push = between(12, 28) * [1.3, 1, 0.8][rank]!;
    return {
      left,
      top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
      points: pointsOf(local),
      originX,
      originY,
      burstX: (outX / norm) * push,
      burstY: (outY / norm) * push,
      driftX: between(-40, 40),
      fall: height * between(1.22, 1.58),
      spin: (random.next() < 0.5 ? -1 : 1) * between(70, 240),
      delayMs: SHATTER_FALL_MS + rank * 50 + between(0, 70),
      fallMs: between(1050, 1380),
    };
  }

  return { impact: { x: impact[0], y: impact[1] }, cracks, panes };
}
