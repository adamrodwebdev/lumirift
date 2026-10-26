import { SeededRandom } from '@/core/Random';

/** A crack in the well's glass: an SVG path, its length, and the danger it waits for. */
export interface Crack {
  readonly d: string;
  readonly length: number;
  /** It starts to show from this danger (0 to 1) and is fully drawn `REVEAL` later. */
  readonly from: number;
}

/** A crack grows over this much danger. */
export const REVEAL = 0.3;
const COUNT = 7;
/** The last crack starts at this danger: all of them are drawn before the top. */
const LAST_FROM = 0.66;

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/** A jagged line from (x, y), heading `angle`, `segments` steps long; returns its points. */
function jag(
  random: SeededRandom,
  start: readonly [number, number],
  angle: number,
  segments: number,
  step: number,
  width: number,
  height: number,
): [number, number][] {
  let [x, y] = start;
  let heading = angle;
  const points: [number, number][] = [[x, y]];
  for (let s = 0; s < segments; s++) {
    heading += (random.next() - 0.5) * 0.9;
    const length = step * (0.7 + random.next() * 0.6);
    x = clamp(x + Math.cos(heading) * length, width);
    y = clamp(y + Math.sin(heading) * length, height);
    points.push([x, y]);
  }
  return points;
}

const pathOf = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const lengthOf = (points: readonly (readonly [number, number])[]) =>
  points.reduce(
    (sum, [x, y], i) =>
      i === 0 ? 0 : sum + Math.hypot(x - points[i - 1]![0], y - points[i - 1]![1]),
    0,
  );

/**
 * The cracks of a well of this size (CSS pixels): from its rim inwards, the
 * top first (where the stack comes from), then the upper sides, jagged, the
 * longer ones with a branch. Always the same for the same size.
 */
export function wellCracks(width: number, height: number): Crack[] {
  const random = new SeededRandom(Math.round(width) * 7919 + Math.round(height));
  const span = Math.min(width, height);
  const cracks: Crack[] = [];
  for (let i = 0; i < COUNT; i++) {
    const side = i % 3;
    const along = random.next();
    const start: [number, number] =
      side === 0
        ? [width * (0.15 + 0.7 * along), 0]
        : [side === 1 ? 0 : width, height * (0.04 + 0.4 * along)];
    const inward = side === 0 ? Math.PI / 2 : side === 1 ? 0.3 : Math.PI - 0.3;
    const angle = inward + (random.next() - 0.5) * 0.9;
    const main = jag(
      random,
      start,
      angle,
      5 + Math.floor(random.next() * 4),
      span * 0.08,
      width,
      height,
    );
    let d = pathOf(main);
    let length = lengthOf(main);
    if (main.length > 4 && random.next() < 0.7) {
      const fork = main[2]!;
      const branch = jag(
        random,
        fork,
        angle + (random.next() < 0.5 ? -0.9 : 0.9),
        2,
        span * 0.06,
        width,
        height,
      );
      d += ` ${pathOf(branch)}`;
      length += lengthOf(branch);
    }
    cracks.push({ d, length, from: (i / (COUNT - 1)) * LAST_FROM });
  }
  return cracks;
}
