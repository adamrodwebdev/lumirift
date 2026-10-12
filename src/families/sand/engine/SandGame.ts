import { Emitter } from '@/core/Emitter';
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
  wind: { readonly phase: 'soon' | 'start' | 'end'; readonly direction: -1 | 1 };
  levelUp: { readonly level: number };
  notice: { readonly id: string; readonly value?: number };
  over: { readonly reason: SandOverReason };
}

export interface SandOptions {
  readonly random: RandomSource;
  readonly timeLimitMs?: number | null;
  readonly grid?: SandGrid;
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
    this.wind = { direction: 1, at: this.nextGustDelay(), phase: 'waiting' };
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
  /** Milliseconds before the next gust, or 0 while it blows. */
  get windInMs(): number {
    return this.wind.phase === 'blowing' ? 0 : Math.max(0, this.wind.at - this._elapsedMs);
  }

  preview(count = PREVIEW_COUNT): readonly PieceSpec[] {
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
      : this.gravity.rowIntervalMs(this._level);
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
    if (this.lockTimer >= LOCK_DELAY_MS || this.lockResets >= MAX_LOCK_RESETS) this.lock();
  }

  /** The piece crumbles: each of its cells becomes GRAINS_PER_CELL² grains. */
  private lock(): void {
    const piece = this._active;
    if (!piece) return;
    const g = GRAINS_PER_CELL;
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

  /** Fire consumes the region of the colour it touches, and goes out. */
  private burn(): void {
    for (const { fire, seed } of this.grid.fireContacts()) {
      if (this.grid.tones[fire] !== Tone.Fire) continue;
      const region = this.grid.region(seed);
      if (region.length === 0) continue;
      const samples = this.sample(region);
      this.grid.remove(region);
      this.grid.remove([fire]);
      const points = region.length;
      this._score += points;
      this.events.emit('burn', { grains: region.length, points, samples });
    }
  }

  private clearSpanning(): void {
    const regions = this.grid.spanningRegions();
    if (regions.length === 0) return;
    const all = regions.flat();
    const samples = this.sample(all);
    this.grid.remove(all);
    const points = all.length * regions.length;
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
    const wind = this.wind;
    const now = this._elapsedMs;
    if (wind.phase === 'waiting' && now >= wind.at - WIND_WARNING_MS) {
      wind.direction = this.random.next() < 0.5 ? -1 : 1;
      wind.phase = 'warned';
      this.events.emit('wind', { phase: 'soon', direction: wind.direction });
      this.events.emit('notice', { id: wind.direction < 0 ? 'windSoonLeft' : 'windSoonRight' });
    } else if (wind.phase === 'warned' && now >= wind.at) {
      wind.phase = 'blowing';
      this.grid.wind = wind.direction;
      this.events.emit('wind', { phase: 'start', direction: wind.direction });
    } else if (wind.phase === 'blowing' && now >= wind.at + WIND_GUST_MS) {
      this.grid.wind = 0;
      this.events.emit('wind', { phase: 'end', direction: wind.direction });
      this.wind = { direction: 1, at: now + this.nextGustDelay(), phase: 'waiting' };
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
      if (this.dealt > ELEMENTS_AFTER) {
        const roll = this.random.next();
        if (roll < WATER_CHANCE) tone = Tone.Water;
        else if (roll < WATER_CHANCE + FIRE_CHANCE) tone = Tone.Fire;
      }
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
