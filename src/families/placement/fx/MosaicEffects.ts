import { Tone } from '@/core/Tone';
import { AdaptiveQuality } from '@/fx/AdaptiveQuality';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import { shade, type TonePalette } from '@/render/TonePalette';
import type { GolemEvent } from '../engine/CeramicGolem';
import type { RemovedTile } from '../engine/Grid';
import type { Cell } from '../engine/Shape';
import type { MosaicView, PlacementSession } from '../PlacementSession';

/** How long tiles jump and crack before they break. */
export const BREAK_MS = 120;
/** A placed tile lands: it comes down from a little above, overshoots, settles. */
const POP_MS = 300;
/** The tiles of one piece land one after the other, from its middle out. */
const POP_STAGGER_MS = 22;
const POPUP_MS = 900;
const FLASH_MS = 220;
const GRAVITY = 40;
const SHARDS_PER_TILE = [5, 4, 2] as const;
/** A stone of the Golem flies this long from its eyes to its cell; the stones leave one after the other. */
export const FLIGHT_MS = 420;
const FLIGHT_STAGGER_MS = 110;
/** A parried stone: a ring of light spreading from the cell. */
export const PARRY_MS = 450;
/** The Golem's eyes flash this long when it is hurt. */
const HURT_MS = 280;
/** Where the Golem's eyes are on the board, in cells (its face is the board). */
export const GOLEM_EYES: readonly Cell[] = [
  { x: 2.5, y: 2.4 },
  { x: 5.5, y: 2.4 },
];

/** A stone in the air, from an eye to its cell. */
export interface Flight extends Cell {
  readonly from: Cell;
  readonly delay: number;
  age: number;
  landed: boolean;
}

export interface Parry extends Cell {
  age: number;
}

export interface CrackingTile extends RemovedTile {
  age: number;
}

export interface Pop extends Cell {
  age: number;
  /** Waits this long before landing (ms). */
  readonly delay: number;
}

export interface Popup {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  age: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * The visual director of the Mosaic: tiles settle with a small bounce, cleared
 * tiles jump, crack and break into ceramic shards; the bomb blows a hole.
 * Everything is simulated in cells; `MosaicRenderer` only draws this state.
 */
export class MosaicEffects {
  readonly pool = new ParticlePool(1600);
  readonly shake = new ScreenShake();
  readonly cracking: CrackingTile[] = [];
  readonly pops: Pop[] = [];
  readonly popups: Popup[] = [];
  readonly colors: string[] = [];
  flash = 0;
  boardHidden = false;
  /** Stones of the Golem on their way. */
  readonly flights: Flight[] = [];
  readonly parries: Parry[] = [];
  /** Left of the Golem's flash of pain (ms). */
  golemHurt = 0;

  private readonly colorIndex = new Map<string, number>();
  private readonly quality = new AdaptiveQuality((budget) => this.pool.setLimit(budget));
  private readonly flashLimiter = new FlashLimiter();
  private readonly world: ParticleWorld;
  private clock = 0;

  constructor(
    private readonly view: MosaicView,
    private readonly profile: () => EffectsProfile,
    private readonly palette: () => TonePalette | null,
    private readonly formatPoints: (points: number) => string,
  ) {
    const size = view.grid.size;
    // Shards fly off the board and fall away: no floor inside the picture.
    this.world = { gravity: GRAVITY, width: size, floor: size + 8 };
    this.pool.setLimit(this.quality.budget);
  }

  attach(session: PlacementSession): () => void {
    const offs = [
      session.onGame('place', ({ cells }) => this.onPlace(cells)),
      session.onGame('clear', ({ removed, points, lines }) => this.onClear(removed, points, lines)),
      session.onGame('bomb', ({ removed }) => this.onBomb(removed)),
      session.onGame('perfect', () => this.flashBoard(0.25)),
      session.onGame('over', () => this.collapse()),
      session.onGame('revive', ({ removed }) => this.onRevive(removed)),
      session.onGame('boss', ({ event }) => this.onBoss(event)),
    ];
    return () => offs.forEach((off) => off());
  }

  /**
   * Scale of a tile that has just been placed (1 when settled): it arrives a
   * quarter larger, as if set down from above, dips under its size and settles.
   */
  popScale(x: number, y: number): number {
    const t = this.popProgress(x, y);
    if (t === null) return 1;
    return 1 + 0.25 * Math.exp(-5 * t) * Math.cos(9 * t);
  }

  /** The light of a tile just set down (0 when settled). */
  popGlow(x: number, y: number): number {
    const t = this.popProgress(x, y);
    if (t === null) return 0;
    return 0.5 * (1 - t) * (1 - t);
  }

  private popProgress(x: number, y: number): number | null {
    const pop = this.pops.find((item) => item.x === x && item.y === y);
    if (!pop) return null;
    return Math.min(1, Math.max(0, (pop.age - pop.delay) / POP_MS));
  }

  /** True while a stone flies to this cell (it is drawn in the air, not on the board). */
  inFlight(x: number, y: number): boolean {
    return this.flights.some((flight) => !flight.landed && flight.x === x && flight.y === y);
  }

  color(css: string): number {
    let index = this.colorIndex.get(css);
    if (index === undefined) {
      index = this.colors.length;
      this.colors.push(css);
      this.colorIndex.set(css, index);
    }
    return index;
  }

  update(deltaMs: number): void {
    this.clock += deltaMs;
    this.quality.sample(deltaMs);
    this.shake.update(deltaMs);
    this.flash = Math.max(0, this.flash - deltaMs / FLASH_MS);
    for (const tile of [...this.cracking]) {
      tile.age += deltaMs;
      if (tile.age >= BREAK_MS) {
        this.cracking.splice(this.cracking.indexOf(tile), 1);
        this.shatter(tile, 1);
      }
    }
    this.pool.update(deltaMs / 1000, this.world);
    this.golemHurt = Math.max(0, this.golemHurt - deltaMs);
    for (const flight of this.flights) {
      flight.age += deltaMs;
      if (!flight.landed && flight.age >= flight.delay + FLIGHT_MS) {
        flight.landed = true;
        this.land(flight);
      }
    }
    ageOut(this.flights, 0, (flight) => (flight.landed ? 0 : Infinity));
    ageOut(this.parries, deltaMs, () => PARRY_MS);
    ageOut(this.pops, deltaMs, (pop) => pop.delay + POP_MS);
    ageOut(this.popups, deltaMs, () => POPUP_MS);
  }

  // --- Event reactions ------------------------------------------------------

  private onPlace(cells: readonly Cell[]): void {
    const profile = this.profile();
    if (!profile.motion || cells.length === 0) return;
    const cx = cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
    const cy = cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length;
    const order = [...cells].sort(
      (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy),
    );
    order.forEach(({ x, y }, i) => this.pops.push({ x, y, age: 0, delay: i * POP_STAGGER_MS }));
    this.settleDust(cells, cx + 0.5, cy + 0.5);
  }

  /** A puff of glaze dust around the piece as it settles, pushed outwards. */
  private settleDust(cells: readonly Cell[], cx: number, cy: number): void {
    const profile = this.profile();
    const palette = this.palette();
    if (profile.particles === 0 || !palette) return;
    const tone = this.view.grid.get(cells[0]!.x, cells[0]!.y);
    const color = this.color(shade(palette.color(tone), 0.45));
    const count = Math.round(3 * profile.particles);
    for (const cell of cells) {
      for (let i = 0; i < count; i++) {
        const px = cell.x + random(0, 1);
        const py = cell.y + random(0, 1);
        const dx = px - cx || random(-0.5, 0.5);
        const dy = py - cy || random(-0.5, 0.5);
        const length = Math.hypot(dx, dy) || 1;
        const speed = random(1.5, 3.5);
        this.pool.spawn(
          ParticleKind.Spark,
          px,
          py,
          (dx / length) * speed,
          (dy / length) * speed - 1,
          random(0.25, 0.45),
          random(0.05, 0.09),
          color,
        );
      }
    }
  }

  private onClear(removed: readonly RemovedTile[], points: number, lines: number): void {
    const profile = this.profile();
    if (removed.length > 0) {
      const x = removed.reduce((sum, tile) => sum + tile.x + 0.5, 0) / removed.length;
      const y = removed.reduce((sum, tile) => sum + tile.y + 0.5, 0) / removed.length;
      this.popups.push({ text: `+${this.formatPoints(points)}`, x, y, age: 0 });
    }
    if (!profile.destruction) return;
    for (const tile of removed) this.cracking.push({ ...tile, age: 0 });
    this.kick(0.04 + 0.05 * lines);
    if (lines >= 3) this.flashBoard(0.18);
  }

  private onBomb(removed: readonly RemovedTile[]): void {
    if (!this.profile().destruction) return;
    for (const tile of removed) this.shatter(tile, 1.6);
    this.kick(0.35);
    this.flashBoard(0.3);
  }

  /** Game over: every tile breaks. */
  private collapse(): void {
    if (!this.profile().destruction) return;
    const { grid } = this.view;
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        const tone = grid.get(x, y);
        if (tone !== Tone.Empty) this.shatter({ x, y, tone }, 1.2);
      }
    }
    this.boardHidden = true;
    this.kick(0.4);
  }

  /** A lost game continues (1.31): the board comes back, its fullest rows breaking away. */
  private onRevive(removed: readonly RemovedTile[]): void {
    this.boardHidden = false;
    if (!this.profile().destruction) return;
    for (const tile of removed) this.shatter(tile, 1.6);
    this.kick(0.3);
  }

  /** The Guardian: stones fly from its eyes, parries ring, wounds flash in its eyes. */
  private onBoss(event: GolemEvent): void {
    const motion = this.profile().motion;
    switch (event.type) {
      case 'throw':
        event.stones.forEach((stone, i) => {
          const from = GOLEM_EYES[stone.x < 4 ? 0 : 1]!;
          const flight = { ...stone, from, delay: i * FLIGHT_STAGGER_MS, age: 0, landed: false };
          if (motion) this.flights.push(flight);
          else this.land(flight);
        });
        break;
      case 'parry':
        for (const cell of event.cells) this.parries.push({ ...cell, age: 0 });
        break;
      case 'hurt': {
        this.golemHurt = HURT_MS;
        const eyes = { x: 4, y: GOLEM_EYES[0]!.y - 0.8 };
        this.popups.push({ text: `−${this.formatPoints(event.damage)}`, ...eyes, age: 0 });
        break;
      }
      case 'phase':
        this.kick(0.3);
        this.flashBoard(0.22);
        break;
      default:
        break;
    }
  }

  /** A stone lands: a thud and a puff of grit. */
  private land(cell: Cell): void {
    this.pops.push({ x: cell.x, y: cell.y, age: 0, delay: 0 });
    this.kick(0.08);
    const profile = this.profile();
    const palette = this.palette();
    if (profile.particles === 0 || !palette) return;
    const grit = this.color(shade(palette.color(Tone.Stone), 0.2));
    for (let i = 0; i < Math.round(6 * profile.particles); i++) {
      this.pool.spawn(
        ParticleKind.Dust,
        cell.x + random(0.1, 0.9),
        cell.y + 0.9,
        random(-3, 3),
        -random(1, 4),
        random(0.3, 0.6),
        random(0.06, 0.1),
        grit,
      );
    }
  }

  // --- Simulation -----------------------------------------------------------

  private shatter(tile: RemovedTile, power: number): void {
    const profile = this.profile();
    const palette = this.palette();
    if (profile.particles === 0 || !palette) return;
    const rgb = palette.color(tile.tone);
    const count = Math.max(
      1,
      Math.round(SHARDS_PER_TILE[this.quality.detail]! * profile.particles),
    );
    const centre = this.view.grid.size / 2;
    for (let i = 0; i < count; i++) {
      // Ceramic breaks into angular sherds: random triangles inside the tile.
      const cx = tile.x + random(0.2, 0.8);
      const cy = tile.y + random(0.2, 0.8);
      const r = random(0.12, 0.26);
      const a = random(0, Math.PI * 2);
      const index = this.pool.spawn(
        ParticleKind.Shard,
        cx,
        cy,
        ((cx - centre) / centre) * random(2, 6) * power + random(-2, 2),
        -random(4, 10) * power,
        random(0.9, 1.5),
        0.3,
        this.color(shade(rgb, random(-0.25, 0.3))),
      );
      if (index < 0) return;
      this.pool.spin[index] = random(-10, 10);
      this.pool.setTriangle(
        index,
        Math.cos(a) * r,
        Math.sin(a) * r,
        Math.cos(a + 2.2) * r,
        Math.sin(a + 2.2) * r,
        Math.cos(a + 4.1) * r * 0.8,
        Math.sin(a + 4.1) * r * 0.8,
      );
    }
    // A few white chips of the clay body.
    const chips = Math.round(3 * profile.particles);
    const chip = this.color(palette.effects.clay);
    for (let i = 0; i < chips; i++) {
      this.pool.spawn(
        ParticleKind.Dust,
        tile.x + 0.5,
        tile.y + 0.5,
        random(-4, 4),
        -random(2, 7),
        random(0.4, 0.8),
        random(0.06, 0.11),
        chip,
      );
    }
  }

  private kick(amount: number): void {
    if (this.profile().shake) this.shake.kick(amount);
  }

  private flashBoard(alpha: number): void {
    if (this.profile().motion && this.flashLimiter.tryFlash(this.clock)) this.flash = alpha;
  }
}

function ageOut<T extends { age: number }>(
  items: T[],
  deltaMs: number,
  lifetime: (item: T) => number,
): void {
  let write = 0;
  for (const item of items) {
    item.age += deltaMs;
    if (item.age < lifetime(item)) items[write++] = item;
  }
  items.length = write;
}

export const MOSAIC_TIMINGS = { POP_MS, POPUP_MS } as const;
