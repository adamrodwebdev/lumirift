import { AdaptiveQuality } from '@/fx/AdaptiveQuality';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import type { ClearedRow, RemovedCell } from '../board/Board';
import type { Cell } from '../pieces/Shapes';
import type { FallingSession, FallingView } from '../FallingSession';
import type { LinesClearedEvent } from '../game/GameEvents';
import type { Piece } from '../pieces/Piece';
import { CHROMA_TONES, Tone } from '../pieces/PieceType';
import { shade, type TonePalette } from '@/render/TonePalette';
import type { ShatterId } from '@/progression/Cosmetics';
import { SHATTER_STYLES, type ShatterStyle } from './ShatterStyles';

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

/**
 * A hard drop falls instead of jumping: quick over a short distance, at most
 * 230 ms from the top. Only the picture waits; the rules lock at once.
 */
export function fallMs(distance: number): number {
  return distance > 0 ? Math.min(230, 80 + 8 * distance) : 0;
}

/** Corners and middles of a cell's edges, clockwise from the top left, in cells. */
export const CELL_RIM: readonly number[] = [0, 0, 0.5, 0, 1, 0, 1, 0.5, 1, 1, 0.5, 1, 0, 1, 0, 0.5];

export interface CrackingRow {
  /** Visible row index (0 = top of the visible well). */
  readonly row: number;
  readonly tones: Uint8Array;
  readonly pure: boolean;
  /** The crack, as x/y pairs in cells relative to the row's top-left corner. */
  readonly path: Float32Array;
  /** Where the rift starts, in cells: under the piece that completed the row. */
  readonly origin: number;
  /** Each brick's break point, x/y pairs in cells from its top-left corner. */
  readonly inner: Float32Array;
  /** Columns of a piece still falling into the row: drawn once it lands. */
  readonly covered: ReadonlySet<number>;
  /** Negative while the piece that completed the row is still falling. */
  age: number;
}

/** A hard-dropped piece on its way down (the rules already locked it). */
export interface FallingDrop {
  /** Where it lands, in visible rows. */
  readonly cells: readonly { readonly x: number; readonly y: number }[];
  readonly tone: Tone;
  readonly distance: number;
  readonly duration: number;
  /** Board cells (absolute rows) the piece now fills: drawn once it lands. */
  covered: { x: number; y: number }[];
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
  /** `label`: the big word of a moment (×2, RIFT!, COMBO); `points` otherwise. */
  readonly kind?: 'points' | 'label';
  readonly x: number;
  readonly y: number;
  age: number;
}

/**
 * Four lines are the rift itself: RIFT!, the game's own word in every
 * language. A chain of clears is a combo, in the player's language.
 */
export function clearLabel(
  lines: number,
  combo: number,
  comboWord: (combo: number) => string,
): string | null {
  if (lines >= 4) return 'RIFT!';
  if (combo >= 2) return comboWord(combo);
  if (lines >= 2) return `×${lines}`;
  return null;
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
  readonly drops: FallingDrop[] = [];
  /** Colours of the particles; `pool.color` holds indexes into this table. */
  readonly colors: string[] = [];
  wellFlash = 0;
  /** Pulse of the well frame on a beat (Rhythm), from 1 down to 0. */
  beatGlow = 0;
  stackHidden = false;
  /**
   * Hard drops are shown falling. The renderer that can draw them turns this
   * on; Rhythm keeps them instant, since its landings must sound on the beat.
   */
  animateDrops = false;

  private readonly rowVelocity: Float32Array;
  private readonly rowHold: Float32Array;
  private readonly colorIndex = new Map<string, number>();
  private readonly quality: AdaptiveQuality;
  private readonly flashLimiter = new FlashLimiter();
  private readonly pending = new Map<CrackingRow, PendingShatter>();
  private readonly world: ParticleWorld;
  private shatterStyle: ShatterStyle = SHATTER_STYLES.shards;
  private slowMotion = 0;
  private clock = 0;
  /** During the events of one hard drop: how long their effects wait for the landing. */
  private waiting = 0;
  /** Centre column of the last piece locked: where a crack starts. */
  private lockOrigin: number | null = null;
  private readonly delayed: { at: number; run: () => void }[] = [];

  constructor(
    private readonly view: FallingView,
    private readonly profile: () => EffectsProfile,
    private readonly palette: () => TonePalette | null,
    private readonly formatPoints: (points: number) => string,
    /** The combo's word, translated ("COMBO ×3"). */
    private readonly comboWord: (combo: number) => string,
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
      wraps: board.wraps,
      solidTop: (x, y) => this.solidTop(x, y),
    };
  }

  /** The player's shatter signature. */
  setShatter(id: ShatterId): void {
    this.shatterStyle = SHATTER_STYLES[id];
  }

  /** Subscribes to the session's engine events; returns the unsubscribe function. */
  /** Things may move on their own (pulses, glows): the player's effect level allows it. */
  get motion(): boolean {
    return this.profile().motion;
  }

  attach(session: FallingSession): () => void {
    const offs = [
      session.onGame('hardDrop', ({ piece, distance }) => this.onHardDrop(piece, distance)),
      session.onGame('lock', ({ piece }) => this.onLock(piece)),
      session.onGame('clear', (event) => this.onClear(event)),
      session.onGame('garbage', ({ rows }) => this.onGarbage(rows)),
      session.onGame('stones', ({ cells }) => this.onStones(cells)),
      session.onGame('levelUp', () => this.addWave('level')),
      session.onGame('mirror', () => this.addWave('sweep')),
      session.onGame('flip', () => this.kick(0.3)),
      session.onGame('tilt', () => this.kick(0.3)),
      session.onGame('fusion', ({ cells, points }) => this.onFusion(cells, points)),
      session.onGame('blast', ({ cells, points, bombs }) => this.onBlast(cells, points, bombs)),
      session.onGame('beat', ({ count }) => this.onBeat(count)),
      session.onGame('groove', ({ level, onBeat }) => this.onGroove(level, onBeat)),
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
      this.drops.length + this.delayed.length > 0 ||
      this.beatGlow > 0 ||
      this.rowOffset.some((offset) => offset !== 0)
    );
  }

  /** How long the picture of a hard drop of this distance takes to land (0: at once). */
  dropWait(distance: number): number {
    return this.animateDrops && this.profile().motion ? fallMs(distance) : 0;
  }

  /** Board cells (row × width + column) of pieces still falling: not drawn yet. */
  coveredCells(): ReadonlySet<number> | null {
    if (this.drops.length === 0) return null;
    const width = this.view.board.width;
    const cells = new Set<number>();
    for (const drop of this.drops) for (const { x, y } of drop.covered) cells.add(y * width + x);
    return cells;
  }

  update(deltaMs: number): void {
    // The events of a hard drop all come at once, between two frames.
    this.waiting = 0;
    this.clock += deltaMs;
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const task = this.delayed[i]!;
      if (task.at > this.clock) continue;
      this.delayed.splice(i, 1);
      task.run();
    }
    let write = 0;
    for (const drop of this.drops) {
      drop.age += deltaMs;
      if (drop.age < drop.duration) this.drops[write++] = drop;
    }
    this.drops.length = write;
    this.quality.sample(deltaMs);
    this.shake.update(deltaMs);
    this.wellFlash = Math.max(0, this.wellFlash - deltaMs / 260);
    this.beatGlow = Math.max(0, this.beatGlow - deltaMs / 240);

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

  /**
   * A hard drop: the piece is shown falling, faster and faster, then landing
   * softly (dust, a glow). No shake: a drop is the player's own gesture.
   */
  private onHardDrop(piece: Piece, distance: number): void {
    const profile = this.profile();
    const hidden = this.view.board.hiddenRows;
    const wait = this.dropWait(distance);
    if (wait > 0) {
      const cells = piece.localCells.map((cell) => ({ x: piece.x + cell.x, y: piece.y + cell.y }));
      this.drops.push({
        cells: cells.map(({ x, y }) => ({ x, y: y - hidden })),
        tone: piece.tone,
        distance,
        duration: wait,
        covered: cells.filter(({ y }) => y >= hidden),
        age: 0,
      });
      this.waiting = wait;
    }
    if (profile.motion && distance > 1) {
      for (const cell of piece.localCells) {
        const to = piece.y + cell.y - hidden;
        this.trails.push({
          x: piece.x + cell.x,
          from: Math.max(0, to - distance),
          to,
          tone: piece.tone,
          age: -wait,
        });
      }
    }
    this.later(wait, () => this.dust(piece, Math.round(4 * profile.particles)));
  }

  private onLock(piece: Piece): void {
    const cells = piece.localCells;
    this.lockOrigin = piece.x + cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5;
    if (this.profile().particles === 0) return;
    const hidden = this.view.board.hiddenRows;
    this.flashes.push({
      cells: piece.localCells.map((cell) => ({
        x: piece.x + cell.x,
        y: piece.y + cell.y - hidden,
      })),
      age: -this.waiting,
    });
  }

  private onClear(event: LinesClearedEvent): void {
    const profile = this.profile();
    if (!profile.destruction || event.rows.length === 0) return;
    const { board } = this.view;
    const hidden = board.hiddenRows;
    // A hard drop still falling: the crack starts when it lands.
    const wait = this.waiting;
    const drop = wait > 0 ? this.drops.at(-1) : undefined;

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
      this.rowHold[now] = CRACK_MS + wait;
    }
    // The falling piece: its cells in a cleared row wait in the crack, the
    // others moved down with the stack.
    const covered = new Map<number, Set<number>>();
    if (drop) {
      const rows = [...cleared];
      for (const cell of drop.covered)
        if (cleared.has(cell.y))
          covered.set(cell.y, (covered.get(cell.y) ?? new Set()).add(cell.x));
      drop.covered = drop.covered
        .filter((cell) => !cleared.has(cell.y))
        .map(({ x, y }) => ({ x, y: y + rows.filter((row) => row > y).length }));
    }
    // The rows that appeared at the top are empty: nothing to animate there.
    for (let y = 0; y < shift; y++) {
      this.rowOffset[y] = 0;
      this.rowVelocity[y] = 0;
      this.rowHold[y] = 0;
    }

    for (const row of event.rows) {
      const crack = this.crackRow(row, hidden, wait, covered.get(row.index) ?? new Set());
      this.cracks.push(crack);
      this.pending.set(crack, { lines: event.lines, combo: event.combo });
    }

    const rows = event.rows.map((row) => row.index - hidden);
    const middle = rows.reduce((sum, row) => sum + row, 0) / rows.length;
    this.popups.push({
      text: `+${this.formatPoints(event.points)}`,
      x: board.width / 2,
      y: middle,
      age: -wait,
    });
    // The word of the moment, above the points.
    const label = clearLabel(event.lines, event.combo, this.comboWord);
    if (label) {
      this.popups.push({
        text: label,
        kind: 'label',
        x: board.width / 2,
        y: middle - 1.4,
        age: -wait,
      });
    }

    this.later(wait, () => {
      if (event.lines >= 4) {
        this.kick(0.3);
        if (profile.motion) this.slowMotion = SLOW_MOTION_MS;
        if (profile.motion && this.flashLimiter.tryFlash(this.clock)) this.wellFlash = 0.22;
      } else {
        this.kick(0.05 + 0.04 * event.lines + 0.03 * event.combo);
      }
    });
  }

  /** Runs now, or once a falling piece has landed. */
  private later(delayMs: number, run: () => void): void {
    if (delayMs <= 0) run();
    else this.delayed.push({ at: this.clock + delayMs, run });
  }

  /** Fused blocks shatter where they were; their points fly up. */
  private onFusion(cells: readonly RemovedCell[], points: number): void {
    const profile = this.profile();
    if (!profile.destruction || cells.length === 0) return;
    const hidden = this.view.board.hiddenRows;
    const perCell = Math.max(
      1,
      Math.round(SHARDS_PER_CELL[this.quality.detail]! * profile.particles),
    );
    let sumX = 0;
    let sumY = 0;
    for (const cell of cells) {
      this.shardsFor(cell.x, cell.y - hidden, cell.tone, perCell, cell.x + 0.5, 0.8);
      sumX += cell.x + 0.5;
      sumY += cell.y - hidden;
    }
    this.popups.push({
      text: `+${this.formatPoints(points)}`,
      x: sumX / cells.length,
      y: sumY / cells.length,
      age: 0,
    });
    this.kick(0.06);
  }

  /** A bomb: its sector shatters at once, the well flashes and shakes, harder for a chain. */
  private onBlast(cells: readonly RemovedCell[], points: number, bombs: number): void {
    this.onFusion(cells, points);
    this.kick(0.25 + 0.12 * bombs);
    if (this.profile().motion && this.flashLimiter.tryFlash(this.clock)) {
      this.wellFlash = Math.min(0.5, 0.25 + 0.08 * bombs);
    }
    this.addWave('sweep');
  }

  private onBeat(count: number): void {
    // The first beat of each bar is stronger.
    this.beatGlow = count % 4 === 1 ? 1 : 0.6;
  }

  private onGroove(level: number, onBeat: boolean): void {
    if (!onBeat || level < 2) return;
    this.popups.push({ text: `× ${level}`, x: this.view.board.width / 2, y: 2, age: 0 });
  }

  private onGarbage(rows: number): void {
    if (!this.profile().motion) return;
    for (let y = 0; y < this.rowOffset.length; y++) this.rowOffset[y]! += rows;
    const floor = this.world.floor;
    for (let x = 0; x < this.view.board.width; x++) {
      this.spawnDust(x + 0.5, floor - 0.1, Tone.Garbage, 2);
    }
  }

  /** Stones dropped on the stack (the Eye of the Tower): a thud and grit. */
  private onStones(cells: readonly Cell[]): void {
    this.kick(0.18);
    const hidden = this.view.board.hiddenRows;
    for (const { x, y } of cells) this.spawnDust(x + 0.5, y - hidden + 0.9, Tone.Stone, 3);
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
    // Each brick breaks along the cracks it showed, away from where the rift started.
    for (let x = 0; x < width; x++) {
      this.shardsFor(
        x,
        crack.row,
        crack.tones[x] as Tone,
        perCell,
        crack.origin,
        big ? 1.35 : 1,
        crack.inner[x * 2],
        crack.inner[x * 2 + 1],
      );
    }
    const sparks = Math.round((crack.pure ? 18 : 0) + meta.combo * 4 * profile.particles);
    for (let i = 0; i < sparks; i++) {
      const tone = crack.pure ? CHROMA_TONES[i % CHROMA_TONES.length]! : Tone.O;
      this.spark(random(0, width), crack.row + 0.5, tone);
    }
  }

  /**
   * Cuts a brick into fans around its break point (`innerX`, `innerY`, in
   * cells from its corner) and throws the pieces away from `centre`. With a
   * textured style, each piece keeps its part of the brick's picture.
   */
  private shardsFor(
    x: number,
    y: number,
    tone: Tone,
    count: number,
    centre: number,
    power: number,
    innerX = random(0.3, 0.7),
    innerY = random(0.3, 0.7),
  ): void {
    const palette = this.palette();
    if (!palette) return;
    const style = this.shatterStyle;
    const px = x + innerX;
    const py = y + innerY;
    const half = this.view.board.width / 2;
    const step = Math.max(1, Math.floor(8 / count));
    for (let i = 0; i < 8; i += step) {
      const ax = x + CELL_RIM[i * 2]!;
      const ay = y + CELL_RIM[i * 2 + 1]!;
      const j = ((i + step) % 8) * 2;
      const bx = x + CELL_RIM[j]!;
      const by = y + CELL_RIM[j + 1]!;
      const cx = (px + ax + bx) / 3;
      const cy = (py + ay + by) / 3;
      const color = this.color(style.colour(tone, palette));
      const vx = ((cx - centre) / half) * random(4, 9) * power + random(-1.5, 1.5);
      const vy = -random(5, 11) * power * style.lift;
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
      this.pool.spin[index] = random(-11, 11) * style.spin;
      this.pool.setTriangle(index, px - cx, py - cy, ax - cx, ay - cy, bx - cx, by - cy);
      if (style.textured) this.pool.setTexture(index, tone, cx - x, cy - y);
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

  private crackRow(
    row: ClearedRow,
    hidden: number,
    wait: number,
    covered: ReadonlySet<number>,
  ): CrackingRow {
    const width = row.tones.length;
    const points = width * 2 + 1;
    const path = new Float32Array(points * 2);
    for (let i = 0; i < points; i++) {
      path[i * 2] = (i / (points - 1)) * width;
      path[i * 2 + 1] = 0.5 + random(-0.32, 0.32);
    }
    const inner = new Float32Array(width * 2);
    for (let x = 0; x < width; x++) {
      inner[x * 2] = random(0.3, 0.7);
      inner[x * 2 + 1] = random(0.3, 0.7);
    }
    return {
      row: row.index - hidden,
      tones: row.tones,
      pure: row.pure,
      path,
      origin: this.lockOrigin ?? width / 2,
      inner,
      covered,
      age: -wait,
    };
  }

  private kick(cells: number): void {
    if (this.profile().shake) this.shake.kick(cells);
  }

  /** Lets debris land on the stack (rows that are still moving are ignored). */
  private solidTop(x: number, y: number): number | null {
    const { board } = this.view;
    const column = board.column(Math.floor(x));
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
