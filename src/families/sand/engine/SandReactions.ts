import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import {
  ACID_BITE,
  ACID_BITE_COST,
  BLAZE_CATCH,
  BLAZE_FALLOFF,
  BLAZE_HEAT,
  BLAZE_MIN_HEAT,
  FREEZE_CHANCE,
  MELT_MAX_GRAINS,
  VINE_LENGTH,
  VINE_STEP_EVERY,
} from './Elements';
import { SAND_TONES, type SandGrid } from './SandGrid';

/** Fire consumes this many grains at most (about 40 cells), nearest first. */
export const FIRE_MAX_GRAINS = 1500;
/** Lightning breaks this many grains at most through water (about 80 cells). */
export const SHOCK_MAX_GRAINS = 3000;
/** Lightning bends towards water this many grains away from its column (two cells). */
export const WATER_PULL = 12;

export type ReactionKind =
  /** Fire met oil: the oil blazes. */
  | 'blaze'
  /** A blaze ate sand around it. */
  | 'scorch'
  /** Fire met water: both turn to steam. */
  | 'quench'
  /** Fire met ice: water and steam. */
  | 'melt'
  /** Water froze against ice. */
  | 'freeze'
  /** Fire ran up a vine. */
  | 'fuse'
  /** Water diluted acid. */
  | 'dilute'
  /** Acid ate sand. */
  | 'dissolve'
  /** A seed sprouted into a vine. */
  | 'sprout'
  /** Fire burnt a region of sand. */
  | 'burn';

export interface Reaction {
  readonly kind: ReactionKind;
  /** Where it happened (a grain index). */
  readonly at: number;
  /** Grains of sand it removed (they score). */
  readonly removed: readonly number[];
  /** Tone of the removed grains, read before they vanished (for the effects). */
  readonly tones: readonly Tone[];
}

export type StrikeKind = 'shock' | 'shatter' | 'spark' | 'thaw' | 'fuse' | 'ground';

export interface Strike {
  readonly kind: StrikeKind;
  readonly x: number;
  readonly fromY: number;
  readonly toY: number;
  /** Sand grains broken (they score), with their tones. */
  readonly removed: readonly number[];
  readonly tones: readonly Tone[];
}

const isSand = (tone: number) => tone >= Tone.ChromaA && tone <= Tone.ChromaD;

interface Vine {
  x: number;
  y: number;
  direction: -1 | 1;
  left: number;
  readonly colour: Tone;
}

/**
 * The chemistry of the sand well, run after each physics step: what happens
 * where two elements touch. Fire burns sand, sets oil ablaze, turns water to
 * steam and melts ice; a blaze spreads into sand as it cools; water freezes
 * against ice, dilutes acid and makes seeds sprout; acid eats sand; vines grow
 * in the colour they sprout on. Lightning is a strike, run when its piece lands.
 */
export class SandReactions {
  private readonly vines: Vine[] = [];
  private steps = 0;
  /** Grains of each reacting element, gathered in one sweep per step (reused, no allocation). */
  private readonly found: Record<'fire' | 'blaze' | 'water' | 'acid', Int32Array>;
  private readonly counts = { fire: 0, blaze: 0, water: 0, acid: 0 };

  constructor(
    private readonly grid: SandGrid,
    private readonly random: RandomSource,
  ) {
    const size = grid.tones.length;
    this.found = {
      fire: new Int32Array(size),
      blaze: new Int32Array(size),
      water: new Int32Array(size),
      acid: new Int32Array(size),
    };
  }

  /** One sweep of the well: where the reacting elements are. */
  private gather(): void {
    const { tones } = this.grid;
    const { found, counts } = this;
    counts.fire = counts.blaze = counts.water = counts.acid = 0;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i]!;
      if (tone < Tone.Water) continue;
      if (tone === Tone.Fire) found.fire[counts.fire++] = i;
      else if (tone === Tone.Blaze) found.blaze[counts.blaze++] = i;
      else if (tone === Tone.Water) found.water[counts.water++] = i;
      else if (tone === Tone.Acid) found.acid[counts.acid++] = i;
    }
  }

  /** Vines still growing (a test reads it). */
  get growing(): number {
    return this.vines.length;
  }

  /** One step of chemistry; returns what happened. */
  step(): Reaction[] {
    this.steps++;
    const reactions: Reaction[] = [];
    this.gather();
    this.fires(reactions);
    this.blazes(reactions);
    this.waters(reactions);
    this.acids(reactions);
    for (const seed of this.grid.sprouts) {
      if (this.grid.tones[seed] === Tone.Seed) this.sprout(seed, VINE_LENGTH / 2, reactions);
    }
    if (this.steps % VINE_STEP_EVERY === 0) this.grow();
    return reactions;
  }

  /**
   * What a lightning bolt striking down column `x` from row `fromY` would
   * hit: the grains to highlight before it lands (nothing is changed).
   */
  strikeTarget(x: number, fromY: number): readonly number[] {
    const hit = this.firstBelow(x, fromY);
    if (hit < 0) return [];
    const tone = this.grid.tones[hit]!;
    if (tone === Tone.Water) {
      const water = this.grid.connected(hit);
      return [...water, ...this.shockRegions(water)];
    }
    if (isSand(tone)) return this.grid.region(hit).slice(0, FIRE_MAX_GRAINS);
    return this.grid.connected(hit);
  }

  /** The bolt lands: it strikes the first grain below, whatever it is. */
  strike(x: number, fromY: number): Strike {
    const { grid } = this;
    const hit = this.firstBelow(x, fromY);
    const toY = hit < 0 ? grid.height - 1 : (hit / grid.width) | 0;
    const toX = hit < 0 ? x : hit % grid.width;
    const result = (kind: StrikeKind, removed: number[] = []): Strike => {
      const tones = removed.map((i) => grid.tones[i] as Tone);
      grid.remove(removed);
      return { kind, x: toX, fromY, toY, removed, tones };
    };
    if (hit < 0) return result('ground');
    const tone = grid.tones[hit]!;
    if (tone === Tone.Water) {
      // The shock runs through the whole body of water: every region of sand it touches breaks.
      return result('shock', this.shockRegions(grid.connected(hit)));
    }
    if (isSand(tone) && grid.fixed[hit]) {
      this.ignite(grid.connected(hit), BLAZE_HEAT);
      return result('fuse');
    }
    if (isSand(tone)) return result('shatter', grid.region(hit).slice(0, FIRE_MAX_GRAINS));
    if (tone === Tone.Oil) {
      this.ignite(grid.connected(hit), BLAZE_HEAT);
      return result('spark');
    }
    if (tone === Tone.Ice) {
      for (const i of grid.connected(hit)) grid.set(i, Tone.Water, grid.grain[i]);
      return result('thaw');
    }
    if (tone === Tone.Seed) {
      this.ignite(grid.connected(hit), BLAZE_HEAT);
      return result('fuse');
    }
    return result('ground');
  }

  // --- Fire --------------------------------------------------------------------

  /** Loose fire touching something reacts with the first thing it touches, by priority. */
  private fires(reactions: Reaction[]): void {
    const { grid } = this;
    const { tones } = grid;
    const list = this.found.fire;
    for (let k = 0; k < this.counts.fire; k++) {
      const i = list[k]!;
      if (tones[i] !== Tone.Fire) continue;
      const touched = this.pick(i, [Tone.Oil, Tone.Water, Tone.Ice, Tone.Seed], true);
      if (touched < 0) continue;
      const other = tones[touched]!;
      const flames = grid.connected(i);
      if (other === Tone.Oil) {
        grid.remove(flames);
        this.ignite(grid.connected(touched), BLAZE_HEAT);
        reactions.push({ kind: 'blaze', at: touched, removed: [], tones: [] });
      } else if (other === Tone.Water) {
        // Fire and the water it met turn into a cloud of steam where they were.
        this.puff([...flames, ...grid.connected(touched)]);
        reactions.push({ kind: 'quench', at: touched, removed: [], tones: [] });
      } else if (other === Tone.Ice) {
        const ice = grid.connected(touched).slice(0, MELT_MAX_GRAINS);
        for (const j of ice) grid.set(j, Tone.Water, grid.grain[j]);
        this.puff(flames);
        reactions.push({ kind: 'melt', at: touched, removed: [], tones: [] });
      } else if (other === Tone.Seed || grid.fixed[touched]) {
        grid.remove(flames);
        this.ignite(grid.connected(touched), BLAZE_HEAT);
        reactions.push({ kind: 'fuse', at: touched, removed: [], tones: [] });
      } else {
        grid.remove(flames);
        const region = grid.region(touched).slice(0, FIRE_MAX_GRAINS);
        const regionTones = region.map((j) => tones[j] as Tone);
        grid.remove(region);
        reactions.push({ kind: 'burn', at: touched, removed: region, tones: regionTones });
      }
    }
  }

  /**
   * A blaze burns in place; each step it may catch the sand beside it, which
   * blazes a little cooler: the fire runs on, then dies out.
   */
  private blazes(reactions: Reaction[]): void {
    const { grid, random } = this;
    const { tones, life } = grid;
    const scorched: number[] = [];
    const scorchedTones: Tone[] = [];
    const list = this.found.blaze;
    for (let k = 0; k < this.counts.blaze; k++) {
      const i = list[k]!;
      if (tones[i] !== Tone.Blaze) continue;
      const heat = life[i]!;
      for (const n of grid.neighbours(i)) {
        if (n < 0) continue;
        const other = tones[n]!;
        if (other === Tone.Oil) grid.set(n, Tone.Blaze, grid.grain[n], heat);
        else if (other === Tone.Seed) grid.set(n, Tone.Blaze, grid.grain[n], BLAZE_HEAT);
        else if (other === Tone.Water) {
          grid.set(n, Tone.Steam);
          grid.set(i, Tone.Steam);
          break;
        } else if (other === Tone.Ice) grid.set(n, Tone.Water, grid.grain[n]);
        else if (isSand(other)) {
          const passed = Math.floor(heat * BLAZE_FALLOFF);
          if (grid.fixed[n]) grid.set(n, Tone.Blaze, grid.grain[n], BLAZE_HEAT);
          else if (passed >= BLAZE_MIN_HEAT && random.next() < BLAZE_CATCH) {
            scorched.push(n);
            scorchedTones.push(other as Tone);
            grid.set(n, Tone.Blaze, grid.grain[n], passed);
          }
        }
      }
    }
    if (scorched.length > 0) {
      reactions.push({ kind: 'scorch', at: scorched[0]!, removed: scorched, tones: scorchedTones });
    }
  }

  /** Sets a slick of oil ablaze (a flame landing near it). */
  blaze(oil: readonly number[]): void {
    this.ignite(oil, BLAZE_HEAT);
  }

  /** A cloud of steam where these grains were: thinner than they were, so that it billows. */
  private puff(grains: readonly number[]): void {
    for (const i of grains) {
      if (this.random.next() < 0.55) this.grid.set(i, Tone.Steam, this.grid.grain[i]);
      else this.grid.clear(i);
    }
  }

  private ignite(grains: readonly number[], heat: number): void {
    for (const i of grains) this.grid.set(i, Tone.Blaze, this.grid.grain[i], heat);
  }

  // --- Water and acid -------------------------------------------------------------

  private waters(reactions: Reaction[]): void {
    const { grid, random } = this;
    const { tones } = grid;
    const list = this.found.water;
    for (let k = 0; k < this.counts.water; k++) {
      const i = list[k]!;
      if (tones[i] !== Tone.Water) continue;
      for (const n of grid.neighbours(i)) {
        if (n < 0) continue;
        const other = tones[n]!;
        if (other === Tone.Ice && random.next() < FREEZE_CHANCE) {
          grid.set(i, Tone.Ice, grid.grain[i]);
          reactions.push({ kind: 'freeze', at: i, removed: [], tones: [] });
          break;
        }
        if (other === Tone.Acid) {
          grid.set(n, Tone.Water, grid.grain[n]);
          reactions.push({ kind: 'dilute', at: n, removed: [], tones: [] });
        } else if (other === Tone.Seed) {
          this.sprout(n, VINE_LENGTH, reactions);
        }
      }
    }
  }

  /** Acid bites the sand and ice beside and under it; each bite wears it out. */
  private acids(reactions: Reaction[]): void {
    const { grid, random } = this;
    const { tones, life } = grid;
    const eaten: number[] = [];
    const eatenTones: Tone[] = [];
    const list = this.found.acid;
    for (let k = 0; k < this.counts.acid; k++) {
      const i = list[k]!;
      if (tones[i] !== Tone.Acid) continue;
      const [below, left, right] = grid.neighbours(i);
      for (const n of [below, left, right]) {
        if (n < 0 || random.next() >= ACID_BITE) continue;
        const other = tones[n]!;
        if (!isSand(other) && other !== Tone.Ice && other !== Tone.Seed) continue;
        if (isSand(other)) {
          eaten.push(n);
          eatenTones.push(other as Tone);
        }
        grid.clear(n);
        life[i] = Math.max(1, life[i]! - ACID_BITE_COST);
        break;
      }
    }
    if (eaten.length > 0) {
      reactions.push({ kind: 'dissolve', at: eaten[0]!, removed: eaten, tones: eatenTones });
    }
  }

  // --- Seeds and vines ----------------------------------------------------------------

  /**
   * A seed sprouts: its grains become sand of the colour around it, held
   * still, and two vines of that colour grow out sideways, one each way.
   */
  private sprout(seed: number, length: number, reactions: Reaction[]): void {
    const { grid } = this;
    const cluster = grid.connected(seed);
    if (cluster.length === 0) return;
    const colour = this.colourAround(cluster);
    for (const i of cluster) {
      grid.set(i, colour, grid.grain[i]);
      grid.fix(i);
    }
    const W = grid.width;
    const top = cluster.reduce((best, i) => Math.min(best, i));
    const x = top % W;
    const y = (top / W) | 0;
    for (const direction of [-1, 1] as const) {
      this.vines.push({ x, y, direction, left: Math.round(length / 2), colour });
    }
    reactions.push({ kind: 'sprout', at: top, removed: [], tones: [] });
  }

  /** Each vine reaches one grain further: sideways first, climbing over what blocks it. */
  private grow(): void {
    const { grid } = this;
    const W = grid.width;
    for (const vine of [...this.vines]) {
      let placed = false;
      for (const [dx, dy] of [
        [vine.direction, 0],
        [vine.direction, -1],
        [0, -1],
      ] as const) {
        const nx = vine.x + dx;
        const ny = vine.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= grid.height) continue;
        const j = ny * W + nx;
        const tone = grid.tones[j]!;
        // It passes through its own colour, and grows into air, water or steam.
        if (tone === vine.colour) {
          vine.x = nx;
          vine.y = ny;
          placed = true;
          break;
        }
        if (tone === 0 || tone === Tone.Water || tone === Tone.Steam) {
          grid.set(j, vine.colour, (nx + ny) & 3);
          grid.fix(j);
          // Two grains thick: a vine you can see, and a bridge that holds.
          const under = j + W;
          const below = under < grid.tones.length ? grid.tones[under]! : -1;
          if (below === 0 || below === Tone.Water || below === Tone.Steam) {
            grid.set(under, vine.colour, (nx + ny + 1) & 3);
            grid.fix(under);
          }
          vine.x = nx;
          vine.y = ny;
          placed = true;
          break;
        }
      }
      if (!placed || --vine.left <= 0) this.vines.splice(this.vines.indexOf(vine), 1);
    }
  }

  /** The sand colour most present around a group of grains (a random one when none). */
  private colourAround(cluster: readonly number[]): Tone {
    const counts = [0, 0, 0, 0];
    for (const i of cluster) {
      for (const n of this.grid.neighbours(i)) {
        const tone = n < 0 ? 0 : this.grid.tones[n]!;
        if (isSand(tone)) counts[tone - Tone.ChromaA]!++;
      }
    }
    const most = Math.max(...counts);
    if (most === 0) return SAND_TONES[this.random.nextInt(SAND_TONES.length)]!;
    return (Tone.ChromaA + counts.indexOf(most)) as Tone;
  }

  // --- Helpers --------------------------------------------------------------------------

  /** The first neighbour of `i` with one of these tones (in their order), or sand; −1 for none. */
  private pick(i: number, order: readonly Tone[], orSand: boolean): number {
    const neighbours = this.grid.neighbours(i);
    for (const tone of order) {
      for (const n of neighbours) {
        if (n >= 0 && this.grid.tones[n] === tone) return n;
      }
    }
    for (const n of neighbours) {
      if (n >= 0 && this.grid.fixed[n]) return n;
    }
    if (orSand) {
      for (const n of neighbours) if (n >= 0 && this.grid.isSand(n)) return n;
    }
    return -1;
  }

  /**
   * Where the bolt strikes: the first grain down its column (steam lets it
   * through), unless water lies within reach of its path, which it seeks
   * like real lightning; −1 when it reaches the floor.
   */
  private firstBelow(x: number, fromY: number): number {
    const { grid } = this;
    const W = grid.width;
    const down = (column: number) => {
      if (column < 0 || column >= W) return -1;
      for (let y = Math.max(0, fromY); y < grid.height; y++) {
        const tone = grid.tones[y * W + column]!;
        if (tone !== 0 && tone !== Tone.Steam) return y * W + column;
      }
      return -1;
    };
    const straight = down(x);
    if (straight >= 0 && grid.tones[straight] === Tone.Water) return straight;
    for (let d = 1; d <= WATER_PULL; d++) {
      for (const column of [x - d, x + d]) {
        const hit = down(column);
        if (hit >= 0 && grid.tones[hit] === Tone.Water) return hit;
      }
    }
    return straight;
  }

  /** Every grain of the sand regions touching this water, up to the cap. */
  private shockRegions(water: readonly number[]): number[] {
    const { grid } = this;
    const taken = new Set<number>();
    const out: number[] = [];
    for (const w of water) {
      for (const n of grid.neighbours(w)) {
        if (n < 0 || taken.has(n) || !grid.isSand(n)) continue;
        for (const g of grid.region(n)) {
          if (taken.has(g)) continue;
          taken.add(g);
          out.push(g);
          if (out.length >= SHOCK_MAX_GRAINS) return out;
        }
      }
    }
    return out;
  }
}
