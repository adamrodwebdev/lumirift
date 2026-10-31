import type { RandomSource } from '@/core/Random';
import { CHROMA_TONES, Tone } from '@/core/Tone';
import { WELL } from '@/core/Well';
import {
  DENSITY,
  LIFE_STEPS,
  matterOf,
  RAIN_CHANCE,
  RAIN_ZONE,
  STEAM_FADE,
  type Matter,
} from './Elements';

/** Each cell of the well is made of this many grains, side by side. */
export const GRAINS_PER_CELL = 6;
/** The four colours of sand (elements are not colours). */
export const SAND_TONES = CHROMA_TONES;
/** How long water flows before it sets, and fire burns before it dies out, in steps. */
export const WATER_LIFE_STEPS = LIFE_STEPS[Tone.Water]!;
export const FIRE_LIFE_STEPS = LIFE_STEPS[Tone.Fire]!;
/** Chance per step that wind pushes a loose grain one step aside. */
const WIND_PUSH = 0.25;
/** Chance per step that oil, which is thick, spreads sideways when it cannot fall. */
const OIL_FLOW = 0.25;
/** A gust moves a grain one cell at most: it reshapes the surface, it never sweeps the well. */
export const WIND_MAX_DRIFT = GRAINS_PER_CELL;

const isSand = (tone: number) => tone >= Tone.ChromaA && tone <= Tone.ChromaD;

/** Matter of every tone, looked up once (the physics reads it for every grain). */
const MATTER_OF: readonly Matter[] = Array.from({ length: 32 }, (_, tone) => matterOf(tone));
const DENSITY_OF: readonly number[] = Array.from(
  { length: 32 },
  (_, tone) => DENSITY[tone as Tone] ?? 0,
);

/**
 * The sand well: one cell per grain. Powders fall and slide, liquids spread
 * and settle by density, steam rises, solids hold still; wind pushes the loose
 * surface. Grains that wear out change (water sets, fire dies, ice melts,
 * steam rains). Rain still in the air is no obstacle: pieces fall through it,
 * the pile's height ignores it; it is water once it lands (1.28.1). Typed
 * arrays only: the physics allocates nothing while it runs.
 */
export class SandGrid {
  readonly tones: Uint8Array;
  /** A small random shade per grain (0–3): sand never looks flat. */
  readonly grain: Uint8Array;
  /** Steps left before the grain changes (see `LIFE_STEPS`); also the heat of a blaze. */
  readonly life: Uint16Array;
  /** 1 for a grain of sand that holds still (a vine). */
  readonly fixed: Uint8Array;
  /** 1 for a drop of rain still falling (see `rainDrop`). */
  private readonly rain: Uint8Array;
  /** Direction of the wind blowing now (−1 left, 1 right) or 0: it changes by `blow` and `calm`. */
  private blowing: -1 | 0 | 1 = 0;
  /** Seeds that wore out this step without water: they sprout anyway (read by the game). */
  readonly sprouts: number[] = [];
  /** Grains each grain has been blown during the current gust. */
  private readonly drift: Uint8Array;

  private readonly movedAt: Uint32Array;
  private readonly visited: Uint8Array;
  private readonly queue: Int32Array;
  private steps = 0;

  /** Lumirift's well by default, 10 × 18 cells (see `WELL`, 1.43); the Dunes take their own. */
  constructor(
    readonly width = WELL.columns * GRAINS_PER_CELL,
    readonly height = WELL.rows * GRAINS_PER_CELL,
  ) {
    const size = width * height;
    this.tones = new Uint8Array(size);
    this.grain = new Uint8Array(size);
    this.life = new Uint16Array(size);
    this.fixed = new Uint8Array(size);
    this.rain = new Uint8Array(size);
    this.drift = new Uint8Array(size);
    this.movedAt = new Uint32Array(size);
    this.visited = new Uint8Array(size);
    this.queue = new Int32Array(size);
  }

  /** The wind blowing now (−1 left, 1 right), or 0. */
  get wind(): -1 | 0 | 1 {
    return this.blowing;
  }

  /** A gust starts, toward one side: loose grains may be pushed that way. */
  blow(direction: -1 | 1): void {
    this.blowing = direction;
  }

  /** The gust dies down. */
  calm(): void {
    this.blowing = 0;
  }

  get(x: number, y: number): Tone {
    return this.tones[y * this.width + x] as Tone;
  }

  /** No grain at all there. */
  isFree(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.tones[y * this.width + x] === 0
    );
  }

  /** A falling piece may pass: nothing, steam or rain (a cloud, a shower never block a piece). */
  isOpen(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.passable(y * this.width + x);
  }

  /** Physics steps run so far (a grain moved since a given step is not where it was). */
  get stepCount(): number {
    return this.steps;
  }

  /** A new gust: every grain may drift again. */
  resetDrift(): void {
    this.drift.fill(0);
  }

  /** Puts a grain (a piece turning into sand, a reaction leaving something behind). */
  put(x: number, y: number, tone: Tone, shade: number): void {
    this.set(y * this.width + x, tone, shade);
  }

  /** Puts a grain at an index, with the life its tone starts with. */
  set(i: number, tone: Tone, shade = (i * 7) & 3, life = LIFE_STEPS[tone] ?? 0): void {
    this.tones[i] = tone;
    this.grain[i] = shade & 3;
    this.life[i] = life;
    this.fixed[i] = 0;
    this.drift[i] = 0;
    this.rain[i] = 0;
  }

  /** Makes a grain of sand hold still (a vine). */
  fix(i: number): void {
    this.fixed[i] = 1;
  }

  /**
   * A drop of rain (steam cooled at the top of the well): water falling
   * through the air, which a piece passes through and the pile's height
   * ignores, until it lands and is water like any other.
   */
  rainDrop(i: number): void {
    this.set(i, Tone.Water, this.grain[i]);
    this.rain[i] = 1;
  }

  simulate(random: RandomSource): number {
    this.steps++;
    this.sprouts.length = 0;
    const { width: W, height: H, tones } = this;
    let moved = 0;
    for (let y = H - 1; y >= 0; y--) {
      // Alternate the sweep: nothing may lean to one side.
      const forward = ((y + this.steps) & 1) === 0;
      for (let k = 0; k < W; k++) {
        const x = forward ? k : W - 1 - k;
        const i = y * W + x;
        const tone = tones[i]!;
        if (tone === 0 || this.movedAt[i] === this.steps || this.fixed[i]) continue;
        const matter = MATTER_OF[tone]!;
        if (matter === 'solid') continue;
        if (matter === 'gas') {
          if (this.rise(i, x, y, random)) moved++;
          continue;
        }
        if (this.fall(i, x, y, matter, random)) {
          moved++;
          continue;
        }
        // A drop of rain that can fall no further has landed: it is water now.
        this.rain[i] = 0;
        if (matter === 'liquid' && this.spread(i, x, random)) {
          moved++;
          continue;
        }
        // Wind only lifts loose grains: those with nothing on top, not yet blown a cell away.
        if (
          this.blowing !== 0 &&
          (y === 0 || this.passable(i - W)) &&
          this.drift[i]! < WIND_MAX_DRIFT &&
          random.next() < WIND_PUSH &&
          this.isOpen(x + this.blowing, y)
        ) {
          this.swap(i, i + this.blowing);
          this.drift[i + this.blowing]!++;
          moved++;
        }
      }
    }
    this.age(random);
    return moved;
  }

  /** Grains of `tone` touching a grain matching `touches`, each with one grain it touches. */
  contacts(tone: Tone, touches: (other: number) => boolean): { at: number; other: number }[] {
    const found: { at: number; other: number }[] = [];
    const { width: W, tones } = this;
    const size = tones.length;
    for (let i = 0; i < size; i++) {
      if (tones[i] !== tone) continue;
      const x = i % W;
      if (i + W < size && touches(tones[i + W]!)) found.push({ at: i, other: i + W });
      else if (x > 0 && touches(tones[i - 1]!)) found.push({ at: i, other: i - 1 });
      else if (x < W - 1 && touches(tones[i + 1]!)) found.push({ at: i, other: i + 1 });
      else if (i >= W && touches(tones[i - W]!)) found.push({ at: i, other: i - W });
    }
    return found;
  }

  /** Fire grains touching sand or water, with the grain they touch. */
  fireContacts(): { fire: number; seed: number }[] {
    return this.contacts(Tone.Fire, (n) => isSand(n) || n === Tone.Water).map(({ at, other }) => ({
      fire: at,
      seed: other,
    }));
  }

  /** The four neighbours of a grain (−1 off the well). */
  neighbours(i: number): readonly [number, number, number, number] {
    const W = this.width;
    const x = i % W;
    return [
      i + W < this.tones.length ? i + W : -1,
      x > 0 ? i - 1 : -1,
      x < W - 1 ? i + 1 : -1,
      i >= W ? i - W : -1,
    ];
  }

  /** Every grain of the same colour connected to `seed` (by a side), nearest first. */
  region(seed: number): number[] {
    const tone = this.tones[seed]!;
    if (!isSand(tone)) return [];
    return this.connected(seed);
  }

  /** Every grain of the same tone connected to `seed`, element or sand, nearest first. */
  connected(seed: number): number[] {
    const tone = this.tones[seed]!;
    if (tone === 0) return [];
    this.visited.fill(0);
    return this.flood(seed, tone);
  }

  isSand(index: number): boolean {
    return isSand(this.tones[index]!);
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

  /** Removes the bottom `count` rows of grains; everything above drops by as much. */
  dropBottomRows(count: number): void {
    const n = Math.min(count, this.height) * this.width;
    const keep = this.tones.length - n;
    for (const array of [this.tones, this.grain, this.life, this.drift, this.fixed, this.rain]) {
      array.copyWithin(n, 0, keep);
      array.fill(0, 0, n);
    }
  }

  /**
   * Empties the top `count` rows of the pile, from its highest grain down:
   * what a lost game's continue blows away (1.31). Returns the grains emptied.
   */
  clearTopRows(count: number): number[] {
    const top = this.height - this.sandHeight();
    const end = Math.min(this.height, top + count) * this.width;
    const emptied: number[] = [];
    for (let i = top * this.width; i < end; i++) {
      if (this.tones[i] === 0) continue;
      emptied.push(i);
      this.clear(i);
    }
    return emptied;
  }

  /** Empties the given grains. */
  remove(indices: readonly number[]): void {
    for (const i of indices) this.clear(i);
  }

  clear(i: number): void {
    this.tones[i] = 0;
    this.life[i] = 0;
    this.drift[i] = 0;
    this.fixed[i] = 0;
    this.rain[i] = 0;
  }

  /**
   * Height of the pile, in grains from the floor: steam floating above it and
   * rain still falling do not count (the danger of a game is read from it).
   */
  sandHeight(): number {
    const { width: W, height: H } = this;
    for (let i = 0; i < W * H; i++) if (!this.passable(i)) return H - Math.floor(i / W);
    return 0;
  }

  grainCount(): number {
    let count = 0;
    for (const tone of this.tones) if (tone !== 0) count++;
    return count;
  }

  /** Breadth-first search over one tone, on preallocated arrays (no allocation per grain). */
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

  /** Can a grain of this matter (and density) move into grain `j`? */
  private yields(j: number, matter: Matter, density: number, tone: number): boolean {
    const other = this.tones[j]!;
    if (other === 0) return true;
    if (this.fixed[j]) return false;
    const otherMatter = MATTER_OF[other]!;
    if (otherMatter === 'gas') return true;
    // Powders sink through liquids (fire stays on top: it burns at the surface);
    // a denser liquid goes under a lighter one.
    if (otherMatter === 'liquid') {
      if (matter === 'powder') return tone !== Tone.Fire;
      return matter === 'liquid' && density > DENSITY_OF[other]!;
    }
    return false;
  }

  /** Falls straight down, or slides down a side. */
  private fall(i: number, x: number, y: number, matter: Matter, random: RandomSource): boolean {
    if (y >= this.height - 1) return false;
    const W = this.width;
    const tone = this.tones[i]!;
    const density = DENSITY_OF[tone]!;
    if (this.yields(i + W, matter, density, tone)) {
      this.swap(i, i + W);
      return true;
    }
    const side = random.next() < 0.5 ? -1 : 1;
    for (const s of [side, -side]) {
      const nx = x + s;
      if (nx >= 0 && nx < W && this.yields(i + W + s, matter, density, tone)) {
        this.swap(i, i + W + s);
        return true;
      }
    }
    return false;
  }

  /** A liquid that cannot fall spreads sideways (oil is thick: it pools rather than runs). */
  private spread(i: number, x: number, random: RandomSource): boolean {
    if (this.tones[i] === Tone.Oil && random.next() > OIL_FLOW) return false;
    const side = random.next() < 0.5 ? -1 : 1;
    for (const s of [side, -side]) {
      const nx = x + s;
      if (nx < 0 || nx >= this.width) continue;
      const other = this.tones[i + s]!;
      if (other === 0 || other === Tone.Steam) {
        this.swap(i, i + s);
        return true;
      }
    }
    return false;
  }

  /** Steam rises (bubbling up through liquids), drifts sideways, follows the wind. */
  private rise(i: number, x: number, y: number, random: RandomSource): boolean {
    const W = this.width;
    if (y > 0) {
      const above = this.tones[i - W]!;
      if (above === 0 || (MATTER_OF[above] === 'liquid' && random.next() < 0.5)) {
        this.swap(i, i - W);
        return true;
      }
    }
    const side = this.blowing || (random.next() < 0.5 ? -1 : 1);
    const nx = x + side;
    if (nx >= 0 && nx < W && this.tones[i + side] === 0 && random.next() < 0.7) {
      this.swap(i, i + side);
      return true;
    }
    return false;
  }

  /** Nothing a piece or the pile's height would meet: no grain, steam, or rain still falling. */
  private passable(i: number): boolean {
    const tone = this.tones[i]!;
    return tone === 0 || tone === Tone.Steam || this.rain[i] === 1;
  }

  private swap(from: number, to: number): void {
    const { tones, grain, life, drift, fixed, rain } = this;
    const tone = tones[to]!;
    const shade = grain[to]!;
    const left = life[to]!;
    const blown = drift[to]!;
    const still = fixed[to]!;
    const drop = rain[to]!;
    tones[to] = tones[from]!;
    grain[to] = grain[from]!;
    life[to] = life[from]!;
    drift[to] = drift[from]!;
    fixed[to] = fixed[from]!;
    rain[to] = rain[from]!;
    tones[from] = tone;
    grain[from] = shade;
    life[from] = left;
    drift[from] = blown;
    fixed[from] = still;
    rain[from] = drop;
    this.movedAt[to] = this.steps;
    if (tone !== 0) this.movedAt[from] = this.steps;
  }

  /** Grains wear out: water sets, fire dies, ice melts, steam rains, oil and acid fade. */
  private age(random: RandomSource): void {
    const { tones, life, width: W, height: H } = this;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i]!;
      if (tone === 0 || isSand(tone) || tone === Tone.Lightning) continue;
      if (--life[i]! > 0) continue;
      switch (tone) {
        case Tone.Water:
          this.set(i, this.settingColour(i, random) as Tone, this.grain[i]);
          break;
        case Tone.Ice:
          this.set(i, Tone.Water, this.grain[i]);
          break;
        case Tone.Steam:
          // A cloud thins out grain by grain, never all at once.
          if (random.next() >= STEAM_FADE) {
            life[i] = 1;
            break;
          }
          // Cooled at the top of the well, steam falls back as rain.
          if (((i / W) | 0) < H * RAIN_ZONE && random.next() < RAIN_CHANCE) {
            this.rainDrop(i);
          } else this.clear(i);
          break;
        case Tone.Seed:
          this.sprouts.push(i);
          life[i] = 1;
          break;
        default:
          this.clear(i);
      }
    }
  }

  /**
   * The colour water sets in: the most common sand colour among its 8
   * neighbours, the one below it on a tie (a random colour when none).
   */
  private settingColour(i: number, random: RandomSource): number {
    const { width: W, height: H, tones } = this;
    const x = i % W;
    const y = (i / W) | 0;
    const counts = [0, 0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const tone = tones[ny * W + nx]!;
        if (isSand(tone)) counts[tone - Tone.ChromaA]!++;
      }
    }
    const most = Math.max(...counts);
    if (most === 0) return SAND_TONES[random.nextInt(SAND_TONES.length)]!;
    const below = y < H - 1 ? tones[i + W]! : 0;
    if (isSand(below) && counts[below - Tone.ChromaA] === most) return below;
    return Tone.ChromaA + counts.indexOf(most);
  }
}
