import { AdaptiveQuality } from '@/fx/AdaptiveQuality';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import type { ClearedRow } from '../board/Board';
import type { FallingSession, FallingView } from '../FallingSession';
import type { LinesClearedEvent } from '../game/GameEvents';
import type { Piece } from '../pieces/Piece';
import { CHROMA_TONES, Tone } from '../pieces/PieceType';
import { shade, type TonePalette } from '../render/TonePalette';

/** How long a full row shows its crack before it shatters. */
export const CRACK_MS = 130;
const POOL_CAPACITY = 1600;
/** Gravity of debris and collapsing rows, in cells per second squared. */
const GRAVITY = 62;
const TRAIL_MS = 190;
const FLASH_MS = 110;
const POPUP_MS = 950;
const WAVE_MS = 650;
const SLOW_MOTION_MS = 120;
const SHARDS_PER_CELL = [6, 4, 3] as const;

export interface CrackingRow {
  /** Visible row index (0 = top of the visible well). */
  readonly row: number;
  readonly tones: Uint8Array;
  readonly pure: boolean;
  /** The crack, as x/y pairs in cells relative to the row's top-left corner. */
  readonly path: Float32Array;
  age: number;
}

export interface Trail {
  readonly x: number;
  readonly from: number;
  readonly to: number;
  readonly tone: Tone;
  age: number;
}

export interface CellFlash {
  readonly cells: readonly { readonly x: number; readonly y: number }[];
  age: number;
}

export interface Popup {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  age: number;
}

export interface Wave {
  readonly kind: 'level' | 'sweep';
  age: number;
}

interface PendingShatter {
  readonly lines: number;
  readonly combo: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * The visual director of the falling family. It listens to engine events and
 * simulates every effect in board units (cells), so a resize never distorts
 * them; `FallingRenderer` and `EffectsPainter` only draw its state.
 */
export class FallingEffects {
  readonly pool = new ParticlePool(POOL_CAPACITY);
  readonly shake = new ScreenShake();
  /** Visual offset of each board row, in cells (negative: drawn higher). */
  readonly rowOffset: Float32Array;
  readonly cracks: CrackingRow[] = [];
  readonly trails: Trail[] = [];
  readonly flashes: CellFlash[] = [];
  readonly popups: Popup[] = [];
  readonly waves: Wave[] = [];
  /** Colours of the particles; `pool.color` holds indexes into this table. */
  readonly colors: string[] = [];
  wellFlash = 0;
  stackHidden = false;

  private readonly rowVelocity: Float32Array;
  private readonly rowHold: Float32Array;
  private readonly colorIndex = new Map<string, number>();
  private readonly quality: AdaptiveQuality;
  private readonly flashLimiter = new FlashLimiter();
  private readonly pending = new Map<CrackingRow, PendingShatter>();
  private readonly world: ParticleWorld;
  private slowMotion = 0;
  private clock = 0;

  constructor(
    private readonly view: FallingView,
    private readonly profile: () => EffectsProfile,
    private readonly palette: () => TonePalette | null,
    private readonly formatPoints: (points: number) => string,
  ) {
    const { board } = view;
    this.rowOffset = new Float32Array(board.height);
    this.rowVelocity = new Float32Array(board.height);
    this.rowHold = new Float32Array(board.height);
    this.quality = new AdaptiveQuality((budget) => this.pool.setLimit(budget));
    this.pool.setLimit(this.quality.budget);
    this.world = {
      gravity: GRAVITY,
      width: board.width,
      floor: board.height - board.hiddenRows,
      solidTop: (x, y) => this.solidTop(x, y),
    };
  }

  /** Subscribes to the session's engine events; returns the unsubscribe function. */
  attach(session: FallingSession): () => void {
    const offs = [
      session.onGame('hardDrop', ({ piece, distance }) => this.onHardDrop(piece, distance)),
      session.onGame('lock', ({ piece }) => this.onLock(piece)),
      session.onGame('clear', (event) => this.onClear(event)),
      session.onGame('garbage', ({ rows }) => this.onGarbage(rows)),
      session.onGame('levelUp', () => this.addWave('level')),
      session.onGame('mirror', () => this.addWave('sweep')),
      session.onGame('flip', () => this.kick(0.3)),
      session.onGame('over', () => this.collapse()),
    ];
    return () => offs.forEach((off) => off());
  }

  /** True while something is still moving (the renderer can skip idle frames). */
  get busy(): boolean {
    return (
      this.pool.count > 0 ||
      this.cracks.length > 0 ||
      this.shake.active ||
      this.trails.length + this.flashes.length + this.popups.length + this.waves.length > 0 ||
      this.rowOffset.some((offset) => offset !== 0)
    );
  }

  update(deltaMs: number): void {
    this.clock += deltaMs;
    this.quality.sample(deltaMs);
    this.shake.update(deltaMs);
    this.wellFlash = Math.max(0, this.wellFlash - deltaMs / 260);

    for (const crack of [...this.cracks]) {
      crack.age += deltaMs;
      if (crack.age >= CRACK_MS) this.shatter(crack);
    }
    this.updateRows(deltaMs);

    const scale = this.slowMotion > 0 ? 0.35 : 1;
    this.slowMotion = Math.max(0, this.slowMotion - deltaMs);
    this.pool.update((deltaMs * scale) / 1000, this.world);

    age(this.trails, deltaMs, TRAIL_MS);
    age(this.flashes, deltaMs, FLASH_MS);
    age(this.popups, deltaMs, POPUP_MS);
    age(this.waves, deltaMs, WAVE_MS);
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

  // --- Event reactions ------------------------------------------------------

  private onHardDrop(piece: Piece, distance: number): void {
    const profile = this.profile();
    const hidden = this.view.board.hiddenRows;
    if (profile.motion && distance > 1) {
      for (const cell of piece.localCells) {
        const to = piece.y + cell.y - hidden;
        this.trails.push({
          x: piece.x + cell.x,
          from: Math.max(0, to - distance),
          to,
          tone: piece.tone,
          age: 0,
        });
      }
    }
    this.dust(piece, Math.round(4 * profile.particles));
    if (distance > 4) this.kick(0.07);
  }

  private onLock(piece: Piece): void {
    if (this.profile().particles === 0) return;
    const hidden = this.view.board.hiddenRows;
    this.flashes.push({
      cells: piece.localCells.map((cell) => ({
        x: piece.x + cell.x,
        y: piece.y + cell.y - hidden,
      })),
      age: 0,
    });
  }

  private onClear(event: LinesClearedEvent): void {
    const profile = this.profile();
    if (!profile.destruction || event.rows.length === 0) return;
    const { board } = this.view;
    const hidden = board.hiddenRows;

    // Rows above the cleared ones already moved down in the engine: draw them
    // where they were, hold them while the crack shows, then let them fall.
    const cleared = new Set(event.rows.map((row) => row.index));
    let shift = 0;
    for (let old = board.height - 1; old >= 0; old--) {
      if (cleared.has(old)) {
        shift++;
        continue;
      }
      if (shift === 0) continue;
      const now = old + shift;
      this.rowOffset[now] = this.rowOffset[old]! - shift;
      this.rowVelocity[now] = 0;
      this.rowHold[now] = CRACK_MS;
    }
    // The rows that appeared at the top are empty: nothing to animate there.
    for (let y = 0; y < shift; y++) {
      this.rowOffset[y] = 0;
      this.rowVelocity[y] = 0;
      this.rowHold[y] = 0;
    }

    for (const row of event.rows) {
      const crack = this.crackRow(row, hidden);
      this.cracks.push(crack);
      this.pending.set(crack, { lines: event.lines, combo: event.combo });
    }

    const rows = event.rows.map((row) => row.index - hidden);
    const middle = rows.reduce((sum, row) => sum + row, 0) / rows.length;
    this.popups.push({
      text: `+${this.formatPoints(event.points)}`,
      x: board.width / 2,
      y: middle,
      age: 0,
    });

    if (event.lines >= 4) {
      this.kick(0.3);
      if (profile.motion) this.slowMotion = SLOW_MOTION_MS;
      if (profile.motion && this.flashLimiter.tryFlash(this.clock)) this.wellFlash = 0.22;
    } else {
      this.kick(0.05 + 0.04 * event.lines + 0.03 * event.combo);
    }
  }

  private onGarbage(rows: number): void {
    if (!this.profile().motion) return;
    for (let y = 0; y < this.rowOffset.length; y++) this.rowOffset[y]! += rows;
    const floor = this.world.floor;
    for (let x = 0; x < this.view.board.width; x++) {
      this.spawnDust(x + 0.5, floor - 0.1, Tone.Garbage, 2);
    }
  }

  private addWave(kind: Wave['kind']): void {
    if (this.profile().motion) this.waves.push({ kind, age: 0 });
  }

  /** Game over: the whole stack shatters. */
  private collapse(): void {
    const profile = this.profile();
    if (!profile.destruction) return;
    const { board } = this.view;
    const hidden = board.hiddenRows;
    const perCell = Math.max(1, Math.round(3 * profile.particles));
    for (let y = hidden; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tone = board.get(x, y);
        if (tone === Tone.Empty) continue;
        this.shardsFor(x, y - hidden, tone, perCell, board.width / 2, 1.4);
      }
    }
    this.stackHidden = true;
    this.kick(0.4);
  }

  // --- Simulation -----------------------------------------------------------

  private updateRows(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (let y = 0; y < this.rowOffset.length; y++) {
      if (this.rowHold[y]! > 0) {
        this.rowHold[y]! -= deltaMs;
        continue;
      }
      const offset = this.rowOffset[y]!;
      const velocity = this.rowVelocity[y]!;
      if (offset < 0 || velocity < 0) {
        // Falling into place, with a small bounce.
        let v = velocity + GRAVITY * dt;
        let o = offset + v * dt;
        if (o >= 0) {
          o = 0;
          v = Math.abs(v) > 3 ? -v * 0.22 : 0;
        }
        this.rowOffset[y] = o;
        this.rowVelocity[y] = v;
      } else if (offset > 0) {
        // Rising garbage glides up.
        const o = offset * 0.0006 ** dt;
        this.rowOffset[y] = o < 0.01 ? 0 : o;
      }
    }
  }

  private shatter(crack: CrackingRow): void {
    this.cracks.splice(this.cracks.indexOf(crack), 1);
    const meta = this.pending.get(crack) ?? { lines: 1, combo: 0 };
    this.pending.delete(crack);
    const profile = this.profile();
    if (profile.particles === 0) return;

    const big = meta.lines >= 4;
    const perCell = Math.max(
      1,
      Math.round(SHARDS_PER_CELL[this.quality.detail]! * profile.particles),
    );
    const width = crack.tones.length;
    for (let x = 0; x < width; x++) {
      this.shardsFor(x, crack.row, crack.tones[x] as Tone, perCell, width / 2, big ? 1.35 : 1);
    }
    const sparks = Math.round((crack.pure ? 18 : 0) + meta.combo * 4 * profile.particles);
    for (let i = 0; i < sparks; i++) {
      const tone = crack.pure ? CHROMA_TONES[i % CHROMA_TONES.length]! : Tone.O;
      this.spark(random(0, width), crack.row + 0.5, tone);
    }
  }

  private shardsFor(
    x: number,
    y: number,
    tone: Tone,
    count: number,
    centre: number,
    power: number,
  ): void {
    const palette = this.palette();
    if (!palette) return;
    const rgb = palette.color(tone);
    // Perimeter of the cell, cut into fans around a random inner point.
    const px = x + random(0.3, 0.7);
    const py = y + random(0.3, 0.7);
    const rim = [
      x,
      y,
      x + 0.5,
      y,
      x + 1,
      y,
      x + 1,
      y + 0.5,
      x + 1,
      y + 1,
      x + 0.5,
      y + 1,
      x,
      y + 1,
      x,
      y + 0.5,
    ];
    const step = Math.max(1, Math.floor(8 / count));
    for (let i = 0; i < 8; i += step) {
      const ax = rim[i * 2]!;
      const ay = rim[i * 2 + 1]!;
      const j = ((i + step) % 8) * 2;
      const bx = rim[j]!;
      const by = rim[j + 1]!;
      const cx = (px + ax + bx) / 3;
      const cy = (py + ay + by) / 3;
      const color = this.color(shade(rgb, random(-0.28, 0.32)));
      const vx = ((cx - centre) / centre) * random(4, 9) * power + random(-1.5, 1.5);
      const vy = -random(5, 11) * power;
      const index = this.pool.spawn(
        ParticleKind.Shard,
        cx,
        cy,
        vx,
        vy,
        random(1.1, 1.8),
        0.3,
        color,
      );
      if (index < 0) return;
      this.pool.spin[index] = random(-11, 11);
      this.pool.setTriangle(index, px - cx, py - cy, ax - cx, ay - cy, bx - cx, by - cy);
    }
  }

  private spark(x: number, y: number, tone: Tone): void {
    const palette = this.palette();
    if (!palette) return;
    const angle = random(0, Math.PI * 2);
    const speed = random(7, 17);
    const color = this.color(shade(palette.color(tone), 0.35));
    this.pool.spawn(
      ParticleKind.Spark,
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 4,
      random(0.45, 0.9),
      0.08,
      color,
    );
  }

  private dust(piece: Piece, perCell: number): void {
    if (perCell <= 0) return;
    const hidden = this.view.board.hiddenRows;
    for (const cell of piece.localCells) {
      const below = piece.localCells.some((other) => other.x === cell.x && other.y === cell.y + 1);
      if (!below)
        this.spawnDust(piece.x + cell.x + 0.5, piece.y + cell.y - hidden + 1, piece.tone, perCell);
    }
  }

  private spawnDust(x: number, y: number, tone: Tone, count: number): void {
    const palette = this.palette();
    if (!palette) return;
    const color = this.color(shade(palette.color(tone), 0.45));
    for (let i = 0; i < count; i++) {
      this.pool.spawn(
        ParticleKind.Dust,
        x + random(-0.45, 0.45),
        y - 0.05,
        random(-3, 3),
        -random(1, 4),
        random(0.3, 0.6),
        random(0.07, 0.13),
        color,
      );
    }
  }

  private crackRow(row: ClearedRow, hidden: number): CrackingRow {
    const width = row.tones.length;
    const points = width * 2 + 1;
    const path = new Float32Array(points * 2);
    for (let i = 0; i < points; i++) {
      path[i * 2] = (i / (points - 1)) * width;
      path[i * 2 + 1] = 0.5 + random(-0.32, 0.32);
    }
    return { row: row.index - hidden, tones: row.tones, pure: row.pure, path, age: 0 };
  }

  private kick(cells: number): void {
    if (this.profile().shake) this.shake.kick(cells);
  }

  /** Lets debris land on the stack (rows that are still moving are ignored). */
  private solidTop(x: number, y: number): number | null {
    const { board } = this.view;
    const column = Math.floor(x);
    const row = Math.floor(y);
    const boardRow = row + board.hiddenRows;
    if (column < 0 || column >= board.width || boardRow < 0 || boardRow >= board.height)
      return null;
    if (this.stackHidden || this.rowOffset[boardRow] !== 0) return null;
    return board.get(column, boardRow) === Tone.Empty ? null : row;
  }
}

/** Ages timed effects and drops the expired ones, in place. */
function age(items: { age: number }[], deltaMs: number, lifetime: number): void {
  let write = 0;
  for (const item of items) {
    item.age += deltaMs;
    if (item.age < lifetime) items[write++] = item;
  }
  items.length = write;
}

export const EFFECT_TIMINGS = { TRAIL_MS, FLASH_MS, POPUP_MS, WAVE_MS } as const;
