import { AdaptiveQuality } from '@/fx/AdaptiveQuality';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import {
  clearImpact,
  comboBreakHeard,
  comboLook,
  landingImpact,
  type ComboHeat,
  type Impact,
  type TimeHolder,
} from '@/fx/Impact';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { Camera } from '@/fx/Camera';
import type { ClearedRow, RemovedCell } from '../board/Board';
import type { Cell } from '../pieces/Shapes';
import type { FallingSession, FallingView } from '../FallingSession';
import type { LinesClearedEvent, LockCause } from '../game/GameEvents';
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
/** A full trauma shifts the well this far (cells). */
const CAMERA_SHIFT = 0.35;
/** A landed piece squashes and the stack under it dips: deepest at 25 ms, gone by 140 ms (1.41). */
const LANDING_PEAK_MS = 25;
const LANDING_MS = 140;
/** A combo's heat on the well's edges holds 1.5 s after the last clear, then fades; a break drains it in 0.4 s. */
const HEAT_HOLD_MS = 1500;
const HEAT_FADE_MS = 600;
const HEAT_DRAIN_MS = 400;
/** A RIFT!'s word enters at × 1.5, settles in 200 ms and stays 1.1 s. */
const RIFT_WORD = { size: 1.6, punch: 0.5, punchMs: 200, life: 1100 } as const;

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
  /**
   * `label`: the big word of a moment (×2, RIFT!, COMBO); `shout`: a combo's
   * word of heat at a milestone (1.41); `points` otherwise.
   */
  readonly kind?: 'points' | 'label' | 'shout';
  /** Its size (cells; by default 1.05 for a label, 0.75 for points) and its combo's heat (1.41). */
  readonly size?: number;
  readonly heat?: ComboHeat;
  /** How far it enters bigger (× 1 + punch) and how fast it settles (ms); how long it stays (ms). */
  readonly punch?: number;
  readonly punchMs?: number;
  readonly life?: number;
  readonly x: number;
  readonly y: number;
  age: number;
}

/** The words the well writes, translated: a combo (« COMBO ×3 »), its shouts (1.41). */
export interface WellWords {
  combo(times: number): string;
  /** `hot`, `blazing`, `inferno` or `riftbreaker` (`COMBO_SHOUTS`). */
  shout(key: string): string;
}

/** A piece that just landed (1.41): its board cells (row × width + column), its squash, its age. */
export interface Landing {
  readonly cells: ReadonlySet<number>;
  readonly squash: number;
  age: number;
}

/** A landing's curve: up to 1 at `peakMs`, then back to 0 with no bounce. */
function settle(age: number, peakMs: number): number {
  const t = age / peakMs;
  return t * Math.exp(1 - t);
}

/**
 * Four lines are the rift itself: RIFT!, the game's own word in every
 * language. A chain of clears is a combo, in the player's language, counted
 * as the message over the well counts it: ×2 at the second clear in a row
 * (1.40; `combo` is 0 at a chain's first clear).
 */
export function clearLabel(
  lines: number,
  combo: number,
  comboWord: (combo: number) => string,
): string | null {
  if (lines >= 4) return 'RIFT!';
  if (combo >= 1) return comboWord(combo + 1);
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
  /** The camera on the well: its shake, its dips, its tilt (1.41). */
  readonly camera = new Camera(CAMERA_SHIFT);
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
  /** A combo's heat on the well's edges (1.41), 0 to 1, and its colour. */
  heat = 0;
  heatColor: ComboHeat = 'gold';
  /** Pieces squashing as they land (1.41). */
  readonly landings: Landing[] = [];
  /** Each board row's dip under a landing, in cells (down), added to `rowOffset` when drawn. */
  readonly rowDip: Float32Array;
  /** The landed cells' height this frame (1: none): the painter squashes them; null when none does. */
  squash: ReadonlyMap<number, number> | null = null;
  stackHidden = false;
  /**
   * Hard drops are shown falling, when the stage's renderer can draw them
   * (`showDropsFalling`); Rhythm keeps them instant, its landings on the beat.
   */
  private dropsFalling = false;

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
  private readonly dipDepth: Float32Array;
  private readonly dipAge: Float32Array;
  /** How fast the well's light fades (per ms): each flash sets its own. */
  private wellFlashFade = 1 / 260;
  /** Time since the last clear of a combo, and how fast its heat drains once it broke (per ms). */
  private heatAge = 0;
  private heatDrain = 0;
  private holder: TimeHolder | null = null;

  constructor(
    private readonly view: FallingView,
    private readonly profile: () => EffectsProfile,
    private readonly palette: () => TonePalette | null,
    private readonly formatPoints: (points: number) => string,
    /** The well's words, translated. */
    private readonly words: WellWords,
  ) {
    const { board } = view;
    this.rowOffset = new Float32Array(board.height);
    this.rowDip = new Float32Array(board.height);
    this.dipDepth = new Float32Array(board.height);
    this.dipAge = new Float32Array(board.height).fill(LANDING_MS);
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

  /** The well's width, in cells (a word wider than it shrinks). */
  get width(): number {
    return this.view.board.width;
  }

  attach(session: FallingSession): () => void {
    const offs = [
      session.onGame('hardDrop', ({ piece, distance }) => this.onHardDrop(piece, distance)),
      session.onGame('lock', ({ piece, cause, distance }) => this.onLock(piece, cause, distance)),
      session.onGame('clear', (event) => this.onClear(event)),
      session.onGame('comboEnd', ({ combo }) => this.onComboEnd(combo)),
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
      session.onGame('revive', ({ cells }) => this.onRevive(cells)),
      // A race's overflow: the same top blown away, the game never lost.
      session.onGame('overflow', ({ cells }) => this.onRevive(cells)),
    ];
    return () => offs.forEach((off) => off());
  }

  /** True while something is still moving (the renderer can skip idle frames). */
  get busy(): boolean {
    return (
      this.pool.count > 0 ||
      this.cracks.length > 0 ||
      this.camera.active ||
      this.trails.length + this.flashes.length + this.popups.length + this.waves.length > 0 ||
      this.drops.length + this.delayed.length > 0 ||
      this.beatGlow > 0 ||
      this.heat > 0 ||
      this.landings.length > 0 ||
      this.rowOffset.some((offset) => offset !== 0) ||
      this.rowDip.some((dip) => dip !== 0)
    );
  }

  /** How long the picture of a hard drop of this distance takes to land (0: at once). */
  dropWait(distance: number): number {
    return this.dropsFalling && this.profile().motion ? fallMs(distance) : 0;
  }

  /** Board cells (row × width + column) of pieces still falling: not drawn yet. */
  coveredCells(): ReadonlySet<number> | null {
    if (this.drops.length === 0) return null;
    const width = this.view.board.width;
    const cells = new Set<number>();
    for (const drop of this.drops) for (const { x, y } of drop.covered) cells.add(y * width + x);
    return cells;
  }

  /** A frame: `deltaMs` of the game's time, `realMs` of the wall clock's (the camera runs on it). */
  update(deltaMs: number, realMs = deltaMs): void {
    // The events of a hard drop all come at once, between two frames.
    this.waiting = 0;
    this.clock += deltaMs;
    // The game's time: a flash holds through a hit-stop, then fades; one lit this frame shows whole.
    this.wellFlash = Math.max(0, this.wellFlash - deltaMs * this.wellFlashFade);
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
    this.camera.update(realMs);
    this.beatGlow = Math.max(0, this.beatGlow - deltaMs / 240);
    this.updateHeat(deltaMs);
    this.updateLandings(deltaMs);

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

  /** The stage draws hard drops falling (its renderer can). */
  showDropsFalling(): void {
    this.dropsFalling = true;
  }

  /** Clears hold the game's time still a moment (1.41), where the stage allows it: never in Rhythm. */
  holdTimeWith(holder: TimeHolder): void {
    this.holder = holder;
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

  private onLock(piece: Piece, cause: LockCause, distance: number): void {
    const cells = piece.localCells;
    this.lockOrigin = piece.x + cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5;
    // The weight of the landing, when the piece is seen to land (a hard drop falls first).
    const impact = landingImpact(cause === 'hard', distance);
    this.later(this.waiting, () => this.land(piece, impact));
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

  /**
   * A piece lands (1.41): it squashes on its base, the two rows under it dip
   * (the higher one more), a hard drop dips the camera. The whole well's
   * motion: never at the calmer levels.
   */
  private land(piece: Piece, impact: Impact): void {
    if (!this.profile().motion) return;
    const { width, height } = this.view.board;
    const cells = new Set<number>();
    let bottom = 0;
    for (const cell of piece.localCells) {
      const y = piece.y + cell.y;
      bottom = Math.max(bottom, y);
      cells.add(y * width + piece.x + cell.x);
    }
    this.landings.push({ cells, squash: impact.squash, age: 0 });
    const under = [
      [bottom + 1, 1],
      [bottom + 2, 0.5],
    ] as const;
    for (const [row, share] of under) {
      if (row >= height) continue;
      this.dipDepth[row] = impact.stack * share;
      this.dipAge[row] = 0;
    }
    if (impact.dip > 0) this.camera.dip(impact.dip);
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
      // Bigger points for bigger moments: 0.75 cell at 100, a full cell from 10 000.
      size: 0.75 + 0.25 * Math.min(1, Math.max(0, (Math.log10(event.points) - 2) / 2)),
      x: board.width / 2,
      y: middle,
      age: -wait,
    });
    this.addWords(event, middle - 1.4, -wait);
    const impact = clearImpact(event.lines, event.combo);
    this.later(wait, () => this.hit(impact, event.lines));
  }

  /**
   * The word of the moment, above the points: RIFT! bigger and longer; a
   * combo's word grows and heats with each step, and shouts at its milestones.
   */
  private addWords(event: LinesClearedEvent, y: number, age: number): void {
    const x = this.view.board.width / 2;
    const label = clearLabel(event.lines, event.combo, (times) => this.words.combo(times));
    if (!label) return;
    if (event.lines >= 4) {
      this.popups.push({ text: label, kind: 'label', ...RIFT_WORD, x, y, age });
      return;
    }
    if (event.combo < 1) {
      this.popups.push({ text: label, kind: 'label', x, y, age });
      return;
    }
    const look = comboLook(event.combo + 1);
    // The word grows only where things may move; its heat shows at every level.
    const size = this.motion ? look.size : 1.05;
    this.popups.push({ text: label, kind: 'label', size, heat: look.heat, x, y, age });
    if (look.shout) {
      const shout = this.words.shout(look.shout);
      this.popups.push({ text: shout, kind: 'shout', heat: look.heat, x, y: y - 1.2 * size, age });
    }
    if (this.motion) {
      this.heat = Math.min(1, event.combo / 8);
      this.heatColor = look.heat;
      this.heatAge = 0;
      this.heatDrain = 0;
    }
  }

  /**
   * The blow of a clear, when it is seen (1.41): the game holds still a moment,
   * the camera shakes and dips, a RIFT! tilts it and lights the well, the
   * light holding through the hold. The whole well's motion: full level only.
   */
  private hit(impact: Impact, lines: number): void {
    const profile = this.profile();
    if (!profile.motion) return;
    this.holder?.hold(impact.holdMs);
    if (profile.shake) this.camera.shake(impact.trauma, impact.tilt);
    this.camera.dip(impact.dip);
    if (lines >= 4) this.slowMotion = SLOW_MOTION_MS;
    if (impact.flash > 0 && this.flashLimiter.tryFlash(this.clock)) {
      this.wellFlash = impact.flash;
      this.wellFlashFade = impact.flash / impact.flashMs;
    }
  }

  /** A combo broke: from ×3, its heat drains from the edges in 0.4 s (its sound is the soundscape's). */
  private onComboEnd(combo: number): void {
    if (this.heat > 0 && comboBreakHeard(combo + 1)) this.heatDrain = this.heat / HEAT_DRAIN_MS;
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
      this.wellFlashFade = 1 / 260;
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

  /** A lost game continues (1.31): the stack comes back, its top blown away in shards. */
  private onRevive(cells: readonly RemovedCell[]): void {
    this.stackHidden = false;
    const profile = this.profile();
    if (!profile.destruction) return;
    const { board } = this.view;
    const perCell = Math.max(1, Math.round(3 * profile.particles));
    for (const { x, y, tone } of cells) {
      if (y >= board.hiddenRows)
        this.shardsFor(x, y - board.hiddenRows, tone, perCell, board.width / 2, 1.4);
    }
    this.kick(0.3);
  }

  // --- Simulation -----------------------------------------------------------

  /** The combo's heat holds, then fades; a broken combo's drains. */
  private updateHeat(deltaMs: number): void {
    if (this.heat <= 0) return;
    this.heatAge += deltaMs;
    const fade =
      this.heatDrain > 0 ? this.heatDrain : this.heatAge > HEAT_HOLD_MS ? 1 / HEAT_FADE_MS : 0;
    this.heat = Math.max(0, this.heat - fade * deltaMs);
  }

  /** The landed pieces' squash and the stack's dip, back in 140 ms. */
  private updateLandings(deltaMs: number): void {
    let write = 0;
    for (const landing of this.landings) {
      landing.age += deltaMs;
      if (landing.age < LANDING_MS) this.landings[write++] = landing;
    }
    this.landings.length = write;
    if (this.landings.length === 0) {
      this.squash = null;
    } else {
      const squash = new Map<number, number>();
      for (const landing of this.landings) {
        const height = 1 - landing.squash * settle(landing.age, LANDING_PEAK_MS);
        for (const cell of landing.cells) squash.set(cell, height);
      }
      this.squash = squash;
    }
    for (let y = 0; y < this.rowDip.length; y++) {
      if (this.dipAge[y]! >= LANDING_MS) {
        this.rowDip[y] = 0;
        continue;
      }
      this.dipAge[y]! += deltaMs;
      this.rowDip[y] =
        this.dipAge[y]! >= LANDING_MS
          ? 0
          : this.dipDepth[y]! * settle(this.dipAge[y]!, LANDING_PEAK_MS);
    }
  }

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
    if (this.profile().shake) this.camera.kick(cells);
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
