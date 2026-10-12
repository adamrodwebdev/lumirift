import type { RandomSource } from '@/core/Random';
import { CHROMA_TONES, Tone } from '@/core/Tone';

/** Each cell of the well is made of this many grains, side by side. */
export const GRAINS_PER_CELL = 6;
/** The four colours of sand (water and fire are elements, not colours). */
export const SAND_TONES = CHROMA_TONES;
/** How long water flows before it sets, and fire burns before it dies out, in steps. */
export const WATER_LIFE_STEPS = 140;
export const FIRE_LIFE_STEPS = 220;
/** Chance per step that wind pushes a grain one step aside. */
const WIND_PUSH = 0.25;

const isSand = (tone: number) => tone >= Tone.ChromaA && tone <= Tone.ChromaD;

/**
 * The sand well: one cell per grain. Grains fall, slide down diagonally when
 * blocked, water also spreads sideways; wind pushes everything one way.
 * Typed arrays only: the physics allocates nothing while it runs.
 */
export class SandGrid {
  readonly tones: Uint8Array;
  /** A small random shade per grain (0–3): sand never looks flat. */
  readonly grain: Uint8Array;
  /** Steps left before water sets or fire dies out. */
  readonly life: Uint16Array;
  /** Direction of the wind blowing now (−1 left, 1 right) or 0. */
  wind: -1 | 0 | 1 = 0;

  private readonly movedAt: Uint32Array;
  private readonly visited: Uint8Array;
  private readonly queue: Int32Array;
  private steps = 0;

  constructor(
    readonly width = 10 * GRAINS_PER_CELL,
    readonly height = 20 * GRAINS_PER_CELL,
  ) {
    const size = width * height;
    this.tones = new Uint8Array(size);
    this.grain = new Uint8Array(size);
    this.life = new Uint16Array(size);
    this.movedAt = new Uint32Array(size);
    this.visited = new Uint8Array(size);
    this.queue = new Int32Array(size);
  }

  get(x: number, y: number): Tone {
    return this.tones[y * this.width + x] as Tone;
  }

  isFree(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.tones[y * this.width + x] === 0
    );
  }

  /** Puts a grain (a piece turning into sand). */
  put(x: number, y: number, tone: Tone, shade: number): void {
    const i = y * this.width + x;
    this.tones[i] = tone;
    this.grain[i] = shade & 3;
    this.life[i] =
      tone === Tone.Water ? WATER_LIFE_STEPS : tone === Tone.Fire ? FIRE_LIFE_STEPS : 0;
  }

  /** One step of physics; returns how many grains moved. */
  simulate(random: RandomSource): number {
    this.steps++;
    const { width: W, height: H, tones } = this;
    let moved = 0;
    for (let y = H - 1; y >= 0; y--) {
      // Alternate the sweep: sand must not lean to one side.
      const forward = ((y + this.steps) & 1) === 0;
      for (let k = 0; k < W; k++) {
        const x = forward ? k : W - 1 - k;
        const i = y * W + x;
        const tone = tones[i]!;
        if (tone === 0 || this.movedAt[i] === this.steps) continue;
        if (y < H - 1) {
          if (tones[i + W] === 0) {
            this.move(i, i + W);
            moved++;
            continue;
          }
          const side = random.next() < 0.5 ? -1 : 1;
          if (this.slide(i, x, y, side) || this.slide(i, x, y, -side)) {
            moved++;
            continue;
          }
        }
        if (tone === Tone.Water) {
          const side = random.next() < 0.5 ? -1 : 1;
          if (this.isFree(x + side, y)) {
            this.move(i, i + side);
            moved++;
            continue;
          }
        }
        if (this.wind !== 0 && random.next() < WIND_PUSH && this.isFree(x + this.wind, y)) {
          this.move(i, i + this.wind);
          moved++;
        }
      }
    }
    this.age(random);
    return moved;
  }

  /** Fire grains touching sand: the grain of sand they touch, once per touched colour. */
  fireContacts(): { fire: number; seed: number }[] {
    const contacts: { fire: number; seed: number }[] = [];
    const { width: W, tones } = this;
    for (let i = 0; i < tones.length; i++) {
      if (tones[i] !== Tone.Fire) continue;
      const x = i % W;
      for (const n of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (n >= 0 && n < tones.length && isSand(tones[n]!)) {
          contacts.push({ fire: i, seed: n });
          break;
        }
      }
    }
    return contacts;
  }

  /** Every grain of the same colour connected to `seed` (by a side). */
  region(seed: number): number[] {
    const tone = this.tones[seed]!;
    if (!isSand(tone)) return [];
    this.visited.fill(0);
    return this.flood(seed, tone);
  }

  /** Regions of one colour that link the left wall to the right wall. */
  spanningRegions(): number[][] {
    const { width: W, height: H, tones } = this;
    this.visited.fill(0);
    const spanning: number[][] = [];
    for (let y = 0; y < H; y++) {
      const start = y * W;
      const tone = tones[start]!;
      if (!isSand(tone) || this.visited[start]) continue;
      const cells = this.flood(start, tone);
      if (cells.some((i) => i % W === W - 1)) spanning.push(cells);
    }
    return spanning;
  }

  /** Empties the given grains. */
  remove(indices: readonly number[]): void {
    for (const i of indices) {
      this.tones[i] = 0;
      this.life[i] = 0;
    }
  }

  /** Height of the sand, in grains from the floor. */
  sandHeight(): number {
    const { width: W, height: H, tones } = this;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (tones[y * W + x] !== 0) return H - y;
    }
    return 0;
  }

  grainCount(): number {
    let count = 0;
    for (const tone of this.tones) if (tone !== 0) count++;
    return count;
  }

  /** Breadth-first search over one colour, on preallocated arrays (no allocation per grain). */
  private flood(start: number, tone: number): number[] {
    const { width: W, tones, visited, queue } = this;
    const size = tones.length;
    const cells: number[] = [];
    let head = 0;
    let tail = 0;
    const visit = (n: number) => {
      if (visited[n] || tones[n] !== tone) return;
      visited[n] = 1;
      queue[tail++] = n;
    };
    visit(start);
    while (head < tail) {
      const i = queue[head++]!;
      cells.push(i);
      const x = i % W;
      if (i >= W) visit(i - W);
      if (i + W < size) visit(i + W);
      if (x > 0) visit(i - 1);
      if (x < W - 1) visit(i + 1);
    }
    return cells;
  }

  private slide(i: number, x: number, y: number, side: number): boolean {
    if (!this.isFree(x + side, y + 1)) return false;
    this.move(i, i + this.width + side);
    return true;
  }

  private move(from: number, to: number): void {
    this.tones[to] = this.tones[from]!;
    this.grain[to] = this.grain[from]!;
    this.life[to] = this.life[from]!;
    this.movedAt[to] = this.steps;
    this.tones[from] = 0;
    this.life[from] = 0;
  }

  /** Water sets in the colour around it; fire dies out. */
  private age(random: RandomSource): void {
    const { width: W, tones, life } = this;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i]!;
      if (tone !== Tone.Water && tone !== Tone.Fire) continue;
      if (--life[i]! > 0) continue;
      if (tone === Tone.Fire) {
        tones[i] = 0;
        continue;
      }
      const x = i % W;
      let set = 0;
      for (const n of [i + W, i - 1, i + 1, i - W]) {
        if (n < 0 || n >= tones.length || (n === i - 1 && x === 0) || (n === i + 1 && x === W - 1))
          continue;
        if (isSand(tones[n]!)) {
          set = tones[n]!;
          break;
        }
      }
      tones[i] = set || SAND_TONES[random.nextInt(SAND_TONES.length)]!;
    }
  }
}
