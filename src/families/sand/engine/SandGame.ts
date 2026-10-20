import { Emitter } from '@/core/Emitter';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Bag } from '@/families/falling/pieces/Bag';
import type { PieceType, RotationDirection } from '@/families/falling/pieces/PieceType';
import { GravityCurve } from '@/families/falling/rules/GravityCurve';
import { GRAINS_PER_CELL, SAND_TONES, SandGrid } from './SandGrid';
import { SandPiece } from './SandPiece';

export type SandState = 'ready' | 'running' | 'paused' | 'over';
export type SandOverReason = 'blockOut' | 'timeUp';

/** Physics runs at a fixed step, whatever the frame rate. */
export const STEP_MS = 16;
export const LOCK_DELAY_MS = 300;
export const MAX_LOCK_RESETS = 10;
export const PREVIEW_COUNT = 3;
/** Elements start after a few ordinary pieces. */
export const ELEMENTS_AFTER = 5;
export const WATER_CHANCE = 0.1;
export const FIRE_CHANCE = 0.07;
/** At least this many sand pieces between two elements: never a streak of hazards. */
export const ELEMENT_GAP = 3;
/** Fire consumes this many grains at most (about 40 cells), nearest first. */
export const FIRE_MAX_GRAINS = 1500;
/** Wind holds off while the sand is this close to the top (in grains). */
export const WIND_SAFE_GRAINS = 3 * GRAINS_PER_CELL;
/** Wind: first gust after this long, then every this long (ms, ± a third), announced ahead. */
export const WIND_EVERY_MS = 30_000;
export const WIND_WARNING_MS = 3_000;
export const WIND_GUST_MS = 2_500;
export const CLEARS_PER_LEVEL = 5;
/** Grains reported per clear for the effects (a sample is enough to show it). */
const SAMPLE = 160;

export interface PieceSpec {
  readonly type: PieceType;
  readonly tone: Tone;
}

export interface GrainSample {
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
}

export interface SandEventMap {
  state: { readonly state: SandState };
  spawn: { readonly piece: SandPiece };
  move: { readonly piece: SandPiece };
  rotate: { readonly piece: SandPiece };
  hardDrop: { readonly piece: SandPiece; readonly distance: number };
  lock: { readonly piece: SandPiece };
  /** Regions of one colour linking the walls vanished; `regions` at once. */
  clear: {
    readonly regions: number;
    readonly grains: number;
    readonly points: number;
    readonly samples: readonly GrainSample[];
  };
  /** Fire burnt a region of sand. */
  burn: {
    readonly grains: number;
    readonly points: number;
    readonly samples: readonly GrainSample[];
  };
  /** Water put fire out: both vanish in steam. */
  quench: { readonly samples: readonly GrainSample[] };
  wind: { readonly phase: 'soon' | 'start' | 'end'; readonly direction: -1 | 1 };
  levelUp: { readonly level: number };
  notice: { readonly id: string; readonly value?: number };
  /** A second chance: the bottom of the sand vanished instead of the game ending. */
  rescue: { readonly rows: number };
  over: { readonly reason: SandOverReason };
}

export interface SandOptions {
  readonly random: RandomSource;
  readonly timeLimitMs?: number | null;
  readonly grid?: SandGrid;
  /** Campaign upgrades (none by default). */
  readonly boosts?: Boosts;
  /** Wind, water and fire shake the game up (true by default); false teaches Sand alone. */
  readonly hazards?: boolean;
}

/**
 * A game of Sand: pieces fall like in the falling family, then crumble into
 * grains on landing. A region of one colour reaching from wall to wall
 * vanishes. Water, fire and wind shake things up.
 */
export class SandGame {
  readonly grid: SandGrid;
  readonly events = new Emitter<SandEventMap>();
  readonly random: RandomSource;

  private readonly bag: Bag;
  private readonly gravity = new GravityCurve();
  private readonly upcoming: PieceSpec[] = [];
  private readonly timeLimitMs: number | null;
  private _state: SandState = 'ready';
  private _overReason: SandOverReason | null = null;
  private _active: SandPiece | null = null;
  private _score = 0;
  private _clears = 0;
  private _level = 1;
  private _elapsedMs = 0;
  private dealt = 0;
  private readonly boosts: Boosts;
  private readonly hazards: boolean;
  /** The second chance has not been used yet. */
  private rescueReady: boolean;
  /** Sand pieces dealt since the last element. */
  private sinceElement = 0;
  /** The region the falling fire would burn, cached for one grid step and one position. */
  private targetCache: { key: string; region: readonly number[] | null } = {
    key: '',
    region: null,
  };
  private softDropping = false;
  private fallAccumulator = 0;
  private stepAccumulator = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  private wind: { direction: -1 | 1; at: number; phase: 'waiting' | 'warned' | 'blowing' };

  constructor(options: SandOptions) {
    this.random = options.random;
    this.grid = options.grid ?? new SandGrid();
    this.bag = new Bag(this.random);
    this.timeLimitMs = options.timeLimitMs ?? null;
    this.boosts = options.boosts ?? NO_BOOSTS;
    this.hazards = options.hazards ?? true;
    this.rescueReady = this.boosts.rescueRows > 0;
    this.wind = {
      direction: this.random.next() < 0.5 ? -1 : 1,
      at: this.nextGustDelay(),
      phase: 'waiting',
    };
  }

  // --- Read model -----------------------------------------------------------

  get state(): SandState {
    return this._state;
  }
  get overReason(): SandOverReason | null {
    return this._overReason;
  }
  get active(): SandPiece | null {
    return this._active;
  }
  get score(): number {
    return this._score;
  }
  get clears(): number {
    return this._clears;
  }
  get level(): number {
    return this._level;
  }
  get elapsedMs(): number {
    return this._elapsedMs;
  }
  get timeLeftMs(): number | null {
    return this.timeLimitMs === null ? null : Math.max(0, this.timeLimitMs - this._elapsedMs);
  }
  /** Milliseconds before the next gust, 0 while it blows; null in a game without wind. */
  get windInMs(): number | null {
    if (!this.hazards) return null;
    return this.wind.phase === 'blowing' ? 0 : Math.max(0, this.wind.at - this._elapsedMs);
  }

  preview(count = PREVIEW_COUNT + this.boosts.extraPreview): readonly PieceSpec[] {
    this.fillQueue(count);
    return this.upcoming.slice(0, count);
  }

  fits(piece: SandPiece, dx = 0, dy = 0): boolean {
    const g = GRAINS_PER_CELL;
    for (const cell of piece.localCells) {
      const left = piece.x + dx + cell.x * g;
      const top = piece.y + dy + cell.y * g;
      for (let y = top; y < top + g; y++) {
        for (let x = left; x < left + g; x++) if (!this.grid.isFree(x, y)) return false;
      }
    }
    return true;
  }

  /**
   * Grains the falling fire would burn if it landed now (where its ghost
   * stands), or null: shown in advance, so that fire is aimed, never a lottery.
   */
  fireTarget(): readonly number[] | null {
    const piece = this._active;
    if (!piece || piece.tone !== Tone.Fire) return null;
    const landed = piece.moved(0, this.dropDistance());
    const key = `${this.grid.stepCount}:${landed.x}:${landed.y}:${landed.rotation}`;
    if (this.targetCache.key !== key) {
      this.targetCache = { key, region: this.targetOf(landed) };
    }
    return this.targetCache.region;
  }

  dropDistance(): number {
    const piece = this._active;
    if (!piece) return 0;
    let distance = 0;
    while (this.fits(piece, 0, distance + 1)) distance++;
    return distance;
  }

  // --- Lifecycle ------------------------------------------------------------

  start(): void {
    if (this._state !== 'ready') return;
    this.setState('running');
    this.spawnNext();
  }

  pause(): void {
    if (this._state !== 'running') return;
    this.softDropping = false;
    this.setState('paused');
  }

  resume(): void {
    if (this._state === 'paused') this.setState('running');
  }

  update(deltaMs: number): void {
    if (this._state !== 'running') return;
    this._elapsedMs += deltaMs;
    if (this.timeLimitMs !== null && this._elapsedMs >= this.timeLimitMs) {
      this.finish('timeUp');
      return;
    }
    this.updateWind();
    this.stepAccumulator += deltaMs;
    // Burning or a block out may end the game during a step.
    while (this.stepAccumulator >= STEP_MS && this.isRunning()) {
      this.stepAccumulator -= STEP_MS;
      this.physicsStep();
    }
    if (this.isRunning() && this._active && !this.applyGravity(deltaMs)) {
      this.applyLockDelay(deltaMs);
    }
  }

  finish(reason: SandOverReason): void {
    if (this._state === 'over') return;
    this._overReason = reason;
    this._active = null;
    this.grid.wind = 0;
    this.setState('over');
    this.events.emit('over', { reason });
  }

  // --- Player intentions ----------------------------------------------------

  moveLeft(): boolean {
    return this.shift(-GRAINS_PER_CELL);
  }

  moveRight(): boolean {
    return this.shift(GRAINS_PER_CELL);
  }

  setSoftDrop(active: boolean): void {
    this.softDropping = active;
  }

  rotate(direction: RotationDirection): boolean {
    const piece = this._active;
    if (this._state !== 'running' || !piece) return false;
    const turned = piece.rotated(direction);
    const g = GRAINS_PER_CELL;
    for (const [dx, dy] of [
      [0, 0],
      [-g, 0],
      [g, 0],
      [0, -g],
      [-2 * g, 0],
      [2 * g, 0],
    ] as const) {
      if (this.fits(turned, dx, dy)) {
        this.place(turned.moved(dx, dy));
        this.events.emit('rotate', { piece: this._active! });
        return true;
      }
    }
    return false;
  }

  hardDrop(): void {
    const piece = this._active;
    if (this._state !== 'running' || !piece) return;
    const distance = this.dropDistance();
    this._active = piece.moved(0, distance);
    this.events.emit('hardDrop', { piece: this._active, distance });
    this.lock();
  }

  // --- Internals ------------------------------------------------------------

  private shift(dx: number): boolean {
    const piece = this._active;
    if (this._state !== 'running' || !piece || !this.fits(piece, dx, 0)) return false;
    this.place(piece.moved(dx, 0));
    this.events.emit('move', { piece: this._active! });
    return true;
  }

  private place(piece: SandPiece): void {
    this._active = piece;
    if (piece.y > this.lowestY) {
      this.lowestY = piece.y;
      this.lockResets = 0;
      this.lockTimer = 0;
    } else if (this.lockResets < MAX_LOCK_RESETS) {
      this.lockResets++;
      this.lockTimer = 0;
    }
  }

  /** The piece falls grain by grain; returns true when it moved this frame. */
  private applyGravity(deltaMs: number): boolean {
    const row = this.softDropping
      ? this.gravity.softDropIntervalMs(this._level)
      : this.gravity.rowIntervalMs(this._level) / this.boosts.gravityScale;
    const interval = row / GRAINS_PER_CELL;
    let fell = false;
    this.fallAccumulator += deltaMs;
    while (this.fallAccumulator >= interval && this._active) {
      this.fallAccumulator -= interval;
      if (!this.fits(this._active, 0, 1)) {
        this.fallAccumulator = 0;
        break;
      }
      this.place(this._active.moved(0, 1));
      fell = true;
    }
    return fell;
  }

  private applyLockDelay(deltaMs: number): void {
    const piece = this._active;
    if (!piece) return;
    if (this.fits(piece, 0, 1)) {
      this.lockTimer = 0;
      return;
    }
    this.lockTimer += deltaMs;
    const delay = LOCK_DELAY_MS + this.boosts.extraLockDelayMs;
    if (this.lockTimer >= delay || this.lockResets >= MAX_LOCK_RESETS) this.lock();
  }

  /**
   * The piece crumbles: each of its cells becomes GRAINS_PER_CELL² grains. A
   * fire piece resting on sand burns at once the region it touches most.
   */
  private lock(): void {
    const piece = this._active;
    if (!piece) return;
    const g = GRAINS_PER_CELL;
    const target = piece.tone === Tone.Fire ? this.targetOf(piece) : null;
    if (target) {
      this._active = null;
      this.events.emit('lock', { piece });
      this.burnRegion(target);
      this.spawnNext();
      return;
    }
    for (const cell of piece.localCells) {
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          this.grid.put(
            piece.x + cell.x * g + x,
            piece.y + cell.y * g + y,
            piece.tone,
            this.random.nextInt(4),
          );
        }
      }
    }
    this._active = null;
    this.events.emit('lock', { piece });
    this.spawnNext();
  }

  private physicsStep(): void {
    this.grid.simulate(this.random);
    this.burn();
    this.clearSpanning();
  }

  /**
   * Loose fire (it fell where there was no sand): the first sand it touches
   * burns, then all its flames go out; water puts it out in a puff of steam.
   */
  private burn(): void {
    for (const { fire, seed } of this.grid.fireContacts()) {
      if (this.grid.tones[fire] !== Tone.Fire) continue;
      const flames = this.grid.connected(fire);
      if (this.grid.tones[seed] === Tone.Water) {
        const steam = [...flames, ...this.grid.connected(seed)];
        const samples = this.sample(steam);
        this.grid.remove(steam);
        this.events.emit('quench', { samples });
        continue;
      }
      this.grid.remove(flames);
      this.burnRegion(this.grid.region(seed).slice(0, FIRE_MAX_GRAINS));
    }
  }

  /** Burning scores half a clear: fire helps, it never beats linking the walls. */
  private burnRegion(region: readonly number[]): void {
    if (region.length === 0) return;
    const samples = this.sample(region);
    this.grid.remove(region);
    const points = Math.round((region.length / 2) * (1 + this.boosts.scoreBonus));
    this._score += points;
    this.events.emit('burn', { grains: region.length, points, samples });
  }

  /**
   * The region a fire piece at this position would burn: among the sand
   * regions it touches (below or on a side), the one it touches most.
   */
  private targetOf(piece: SandPiece): number[] | null {
    const { grid } = this;
    const g = GRAINS_PER_CELL;
    const W = grid.width;
    const own = new Set<number>();
    for (const cell of piece.localCells) {
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const gx = piece.x + cell.x * g + x;
          const gy = piece.y + cell.y * g + y;
          if (gx >= 0 && gy >= 0 && gx < W && gy < grid.height) own.add(gy * W + gx);
        }
      }
    }
    const contacts: number[] = [];
    for (const i of own) {
      const x = i % W;
      for (const n of [i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (n >= 0 && n < grid.tones.length && !own.has(n) && grid.isSand(n)) contacts.push(n);
      }
    }
    let best: number[] | null = null;
    let bestTouches = 0;
    const seen = new Set<number>();
    for (const seed of contacts) {
      if (seen.has(seed)) continue;
      const region = grid.region(seed);
      const members = new Set(region);
      let touches = 0;
      for (const c of contacts) {
        if (members.has(c)) {
          touches++;
          seen.add(c);
        }
      }
      if (touches > bestTouches) {
        best = region;
        bestTouches = touches;
      }
    }
    return best ? best.slice(0, FIRE_MAX_GRAINS) : null;
  }

  private clearSpanning(): void {
    const regions = this.grid.spanningRegions();
    if (regions.length === 0) return;
    const all = regions.flat();
    const samples = this.sample(all);
    this.grid.remove(all);
    const points = Math.round(all.length * regions.length * (1 + this.boosts.scoreBonus));
    this._score += points;
    this._clears += regions.length;
    this.events.emit('clear', { regions: regions.length, grains: all.length, points, samples });
    const level = 1 + Math.floor(this._clears / CLEARS_PER_LEVEL);
    if (level > this._level) {
      this._level = level;
      this.events.emit('levelUp', { level });
    }
  }

  private sample(indices: readonly number[]): GrainSample[] {
    const step = Math.max(1, Math.floor(indices.length / SAMPLE));
    const samples: GrainSample[] = [];
    for (let k = 0; k < indices.length; k += step) {
      const i = indices[k]!;
      samples.push({
        x: i % this.grid.width,
        y: Math.floor(i / this.grid.width),
        tone: this.grid.tones[i] as Tone,
      });
    }
    return samples;
  }

  private updateWind(): void {
    if (!this.hazards) return;
    const wind = this.wind;
    const now = this._elapsedMs;
    if (wind.phase === 'waiting' && now >= wind.at - WIND_WARNING_MS) {
      // Never a gust when the sand nears the top: the wind must not decide a game.
      if (this.grid.sandHeight() > this.grid.height - WIND_SAFE_GRAINS) {
        wind.at = now + WIND_WARNING_MS + WIND_GUST_MS;
        return;
      }
      wind.phase = 'warned';
      this.events.emit('wind', { phase: 'soon', direction: wind.direction });
      this.events.emit('notice', { id: wind.direction < 0 ? 'windSoonLeft' : 'windSoonRight' });
    } else if (wind.phase === 'warned' && now >= wind.at) {
      wind.phase = 'blowing';
      this.grid.resetDrift();
      this.grid.wind = wind.direction;
      this.events.emit('wind', { phase: 'start', direction: wind.direction });
    } else if (wind.phase === 'blowing' && now >= wind.at + WIND_GUST_MS) {
      this.grid.wind = 0;
      this.events.emit('wind', { phase: 'end', direction: wind.direction });
      // Gusts alternate: the sand is never pushed the same way twice in a row.
      this.wind = {
        direction: wind.direction === 1 ? -1 : 1,
        at: now + this.nextGustDelay(),
        phase: 'waiting',
      };
    }
  }

  private nextGustDelay(): number {
    return WIND_EVERY_MS * (2 / 3 + this.random.next() * (2 / 3));
  }

  private spawnNext(): void {
    this.fillQueue(1);
    const spec = this.upcoming.shift()!;
    const piece = SandPiece.spawn(spec.type, spec.tone, this.grid.width);
    if (!this.fits(piece)) {
      if (this.rescueReady) {
        // The second chance: the bottom of the sand vanishes, the piece comes back.
        this.rescueReady = false;
        this.grid.dropBottomRows(this.boosts.rescueRows * GRAINS_PER_CELL);
        this.events.emit('rescue', { rows: this.boosts.rescueRows });
        this.upcoming.unshift(spec);
        this.spawnNext();
        return;
      }
      this.finish('blockOut');
      return;
    }
    this._active = piece;
    this.lowestY = piece.y;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.fallAccumulator = 0;
    this.events.emit('spawn', { piece });
    if (spec.tone === Tone.Water) this.events.emit('notice', { id: 'elementWater' });
    if (spec.tone === Tone.Fire) this.events.emit('notice', { id: 'elementFire' });
  }

  /** Colour of each new piece: sand, or now and then an element. */
  private fillQueue(count: number): void {
    while (this.upcoming.length < count) {
      const type = this.bag.next();
      this.dealt++;
      let tone = SAND_TONES[this.random.nextInt(SAND_TONES.length)]!;
      if (this.hazards && this.dealt > ELEMENTS_AFTER && this.sinceElement >= ELEMENT_GAP) {
        const roll = this.random.next();
        if (roll < WATER_CHANCE) tone = Tone.Water;
        else if (roll < WATER_CHANCE + FIRE_CHANCE + this.boosts.fireBonus) tone = Tone.Fire;
      }
      this.sinceElement = tone === Tone.Water || tone === Tone.Fire ? 0 : this.sinceElement + 1;
      this.upcoming.push({ type, tone });
    }
  }

  private isRunning(): boolean {
    return this._state === 'running';
  }

  private setState(state: SandState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
