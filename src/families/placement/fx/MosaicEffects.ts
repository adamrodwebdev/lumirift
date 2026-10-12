import { Tone } from '@/core/Tone';
import { AdaptiveQuality } from '@/fx/AdaptiveQuality';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import { shade, type TonePalette } from '@/render/TonePalette';
import type { RemovedTile } from '../engine/Grid';
import type { Cell } from '../engine/Shape';
import type { MosaicView, PlacementSession } from '../PlacementSession';

/** How long tiles jump and crack before they break. */
export const BREAK_MS = 120;
const POP_MS = 160;
const POPUP_MS = 900;
const FLASH_MS = 220;
const GRAVITY = 40;
const SHARDS_PER_TILE = [5, 4, 2] as const;

export interface CrackingTile extends RemovedTile {
  age: number;
}

export interface Pop extends Cell {
  age: number;
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
    ];
    return () => offs.forEach((off) => off());
  }

  /** Scale of a tile that has just been placed (1 when settled). */
  popScale(x: number, y: number): number {
    const pop = this.pops.find((item) => item.x === x && item.y === y);
    if (!pop) return 1;
    const t = pop.age / POP_MS;
    return 1 + 0.18 * Math.sin(Math.PI * t) * (1 - t);
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
    ageOut(this.pops, deltaMs, POP_MS);
    ageOut(this.popups, deltaMs, POPUP_MS);
  }

  // --- Event reactions ------------------------------------------------------

  private onPlace(cells: readonly Cell[]): void {
    if (!this.profile().motion) return;
    for (const { x, y } of cells) this.pops.push({ x, y, age: 0 });
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
    const chip = this.color('rgb(245 238 225)');
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

function ageOut(items: { age: number }[], deltaMs: number, lifetime: number): void {
  let write = 0;
  for (const item of items) {
    item.age += deltaMs;
    if (item.age < lifetime) items[write++] = item;
  }
  items.length = write;
}

export const MOSAIC_TIMINGS = { POP_MS, POPUP_MS } as const;
