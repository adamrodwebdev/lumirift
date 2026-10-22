import { Emitter } from '@/core/Emitter';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import { ComboGauge, type ComboView } from '@/session/ComboGauge';
import { inDanger } from '@/session/Tension';
import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Bag } from '@/families/falling/pieces/Bag';
import type { PieceType, RotationDirection } from '@/families/falling/pieces/PieceType';
import { GravityCurve } from '@/families/falling/rules/GravityCurve';
import { elementsAt, isElement, NOTICE_OF, WEIGHT, type ElementTone } from './Elements';
import { DuneWorm, type WormEvent } from './DuneWorm';
import { GRAINS_PER_CELL, SAND_TONES, SandGrid } from './SandGrid';
import { SandPiece } from './SandPiece';
import {
  FIRE_MAX_GRAINS,
  SandReactions,
  type Reaction,
  type ReactionKind,
  type StrikeKind,
} from './SandReactions';

export type SandState = 'ready' | 'running' | 'paused' | 'over';
export type SandOverReason = 'blockOut' | 'timeUp' | 'victory';

/** Physics runs at a fixed step, whatever the frame rate. */
export const STEP_MS = 16;
export const LOCK_DELAY_MS = 300;
export const MAX_LOCK_RESETS = 10;
export const PREVIEW_COUNT = 3;
/** Elements start after a few ordinary pieces. */
export const ELEMENTS_AFTER = 5;
/** Chance that a piece is an element (once the gap below is respected). */
export const ELEMENT_CHANCE = 0.2;
/** At least this many sand pieces between two elements: never a streak of hazards. */
export const ELEMENT_GAP = 3;
/** A bolt landing this close to the Guardian's bare head (in grains) strikes it. */
export const BOLT_REACH = 8;
/** A landing flame sets alight oil this many grains away (a cell), below or aside. */
export const OIL_REACH = 6;
export { FIRE_MAX_GRAINS };
/** Wind holds off while the sand is this close to the top (in grains). */
export const WIND_SAFE_GRAINS = 3 * GRAINS_PER_CELL;
/** Wind: first gust after this long, then every this long (ms, ± a third), announced ahead. */
export const WIND_EVERY_MS = 30_000;
export const WIND_WARNING_MS = 3_000;
export const WIND_GUST_MS = 2_500;
export const CLEARS_PER_LEVEL = 5;
/**
 * The reactions that feed a running combo: the great moments of the elements.
 * A blaze's scorching, acid and steam come too often to count.
 */
const FEEDING: ReadonlySet<string> = new Set(['blaze', 'sprout', 'melt', 'freeze', 'fuse']);
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
    /** The combo's multiplier this clear scored with (1 without a chain). */
    readonly multiplier: number;
    readonly samples: readonly GrainSample[];
  };
  /** Cleared in danger: these points again, as a bonus (see `Tension`). */
  closeCall: { readonly points: number };
  /** A combo of ×2 or more ran dry: the chain is over. */
  comboEnd: { readonly multiplier: number };
  /** Fire burnt a region of sand. */
  burn: {
    readonly grains: number;
    readonly points: number;
    readonly samples: readonly GrainSample[];
  };
  /** Water put fire out: both vanish in steam. */
  quench: { readonly samples: readonly GrainSample[] };
  /** Two elements met (see `SandReactions`); `grains` of sand went with it. */
  react: {
    readonly kind: ReactionKind;
    readonly x: number;
    readonly y: number;
    readonly grains: number;
    readonly points: number;
    readonly samples: readonly GrainSample[];
  };
  /** A lightning piece landed and struck down its column. */
  strike: {
    readonly kind: StrikeKind;
    readonly x: number;
    readonly fromY: number;
    readonly toY: number;
    readonly grains: number;
    readonly points: number;
    readonly samples: readonly GrainSample[];
  };
  wind: { readonly phase: 'soon' | 'start' | 'end'; readonly direction: -1 | 1 };
  levelUp: { readonly level: number };
  notice: { readonly id: string; readonly value?: number };
  /** A second chance: the bottom of the sand vanished instead of the game ending. */
  rescue: { readonly rows: number };
  /** The Guardian of the level did something (see `DuneWorm`). */
  boss: { readonly event: WormEvent };
  /** The next chapter's Guardian passes under the sand (the campaign's teaser). */
  tease: Readonly<Record<string, never>>;
  over: { readonly reason: SandOverReason };
}

export interface SandOptions {
  readonly random: RandomSource;
  readonly timeLimitMs?: number | null;
  readonly grid?: SandGrid;
  /** Campaign upgrades (none by default). */
  readonly boosts?: Boosts;
  /** Wind and the elements shake the game up (true by default); false teaches Sand alone. */
  readonly hazards?: boolean;
  /** Gusts of wind, when there are hazards (true by default); false keeps the elements alone. */
  readonly wind?: boolean;
  /** How soon and how often the elements come (by default after 5 pieces, one in five). */
  readonly elementPace?: ElementPace;
  /** The elements dealt, whatever the level (by default they come level after level). */
  readonly elements?: readonly ElementTone[];
  /** Pieces dealt at a given rank whatever happens (the first level's show, a tutorial). */
  readonly script?: readonly ScriptedPiece[];
  /** A Guardian of the rift lives in this well (a boss level). */
  readonly boss?: 'duneWorm';
  /** The Guardian's first move after this long (ms); by default the player sees the arena first. */
  readonly bossDelayMs?: number;
}

/** When the elements start coming, and the chance of each new piece being one. */
export interface ElementPace {
  /** Pieces dealt before the first element. */
  readonly after: number;
  readonly chance: number;
}

/** A piece the game deals at a given rank (1 = the first piece). */
export interface ScriptedPiece {
  readonly at: number;
  readonly tone: Tone;
  readonly type?: PieceType;
  /** Appears right above where the previous piece landed (so that the two meet). */
  readonly above?: boolean;
}

/**
 * A game of Sand: pieces fall like in the falling family, then crumble into
 * grains on landing. A region of one colour reaching from wall to wall
 * vanishes. Elements (water, fire, oil, ice, lightning, seeds, acid) and wind
 * shake things up, and react with each other (`SandReactions`).
 */
export class SandGame {
  readonly grid: SandGrid;
  readonly events = new Emitter<SandEventMap>();
  readonly random: RandomSource;
  /** The Dune Wyrm, on its boss level; null elsewhere. */
  private _worm: DuneWorm | null;
  /** The level is over and a Guardian passes under the sand: no piece, no clock. */
  private teasing = false;

  private readonly reactions: SandReactions;
  /** A sandstorm the Guardian raised: the wind blows until then (ms of play). */
  private stormUntil = 0;
  private readonly bag: Bag;
  private readonly gravity = new GravityCurve();
  private readonly upcoming: PieceSpec[] = [];
  private readonly timeLimitMs: number | null;
  private _state: SandState = 'ready';
  private _overReason: SandOverReason | null = null;
  private _active: SandPiece | null = null;
  private _score = 0;
  private _clears = 0;
  /** Clear again before it runs dry: the multiplier climbs to ×10. */
  private readonly combo = new ComboGauge();
  private _level = 1;
  private _elapsedMs = 0;
  private dealt = 0;
  private readonly boosts: Boosts;
  private readonly hazards: boolean;
  private readonly windy: boolean;
  private readonly elementPace: ElementPace;
  private readonly elements: readonly ElementTone[] | null;
  private readonly script: ReadonlyMap<number, ScriptedPiece>;
  /** Pieces dealt so far and the centre (in grains) of the last one that landed. */
  private spawned = 0;
  private landedAt: number | null = null;
  /** Reactions already announced in this game (each is named the first time). */
  private readonly announced = new Set<string>();
  /** The second chance has not been used yet. */
  private rescueReady: boolean;
  /** Sand pieces dealt since the last element. */
  private sinceElement = 0;
  /** What the falling element would hit, cached for one grid step and one position. */
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
    this.windy = this.hazards && (options.wind ?? true);
    this.elementPace = options.elementPace ?? { after: ELEMENTS_AFTER, chance: ELEMENT_CHANCE };
    this.elements = options.elements ?? null;
    this.script = new Map((options.script ?? []).map((piece) => [piece.at, piece]));
    this.reactions = new SandReactions(this.grid, this.random);
    this._worm =
      options.boss === 'duneWorm'
        ? new DuneWorm(this.grid, this.random, options.bossDelayMs)
        : null;
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
  /** The Guardian in this well: the boss of the level, or the one passing by in a teaser. */
  get worm(): DuneWorm | null {
    return this._worm;
  }
  get isTeasing(): boolean {
    return this.teasing;
  }
  /** The rank of the piece in play (1 for the first), as a script counts them. */
  get rank(): number {
    return this.spawned;
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
  /** The combo gauge, for the well's badge. */
  get comboGauge(): ComboView {
    return this.combo;
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
  /**
   * The next piece where it would appear, when the sand leaves it no room to
   * fall a cell: the last warning, drawn on the well. Null while there is room.
   */
  spawnWarning(): SandPiece | null {
    if (this._state !== 'running' || this.teasing) return null;
    this.fillQueue(1);
    const spec = this.upcoming[0]!;
    const piece = SandPiece.spawn(spec.type, spec.tone, this.grid.width);
    return this.fits(piece, 0, GRAINS_PER_CELL) ? null : piece;
  }

  /** How high the sand stands in the well (0 to 1). */
  pressure(): number {
    return Math.min(1, this.grid.sandHeight() / this.grid.height);
  }

  /** Milliseconds before the next gust, 0 while it blows; null in a game without wind. */
  get windInMs(): number | null {
    if (!this.windy) return null;
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
        for (let x = left; x < left + g; x++) if (!this.grid.isOpen(x, y)) return false;
      }
    }
    return true;
  }

  /**
   * Grains the falling fire would burn, or the falling lightning would
   * strike, if it landed now (where its ghost stands), or null: shown in
   * advance, so that elements are aimed, never a lottery.
   */
  elementTarget(): readonly number[] | null {
    const piece = this._active;
    if (!piece || (piece.tone !== Tone.Fire && piece.tone !== Tone.Lightning)) return null;
    const landed = piece.moved(0, this.dropDistance());
    const key = `${this.grid.stepCount}:${landed.x}:${landed.y}:${landed.rotation}:${piece.tone}`;
    if (this.targetCache.key !== key) {
      const region =
        piece.tone === Tone.Fire
          ? (this.targetOf(landed)?.region ?? null)
          : this.reactions.strikeTarget(...this.boltOf(landed));
      this.targetCache = { key, region: region && region.length > 0 ? region : null };
    }
    return this.targetCache.region;
  }

  /** Horizontal centre of a piece, in grains. */
  private centreOf(piece: SandPiece): number {
    const cells = piece.localCells;
    return (
      piece.x +
      (cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length) * GRAINS_PER_CELL
    );
  }

  /** The column a lightning piece strikes down, and the row the bolt leaves it from. */
  boltOf(piece: SandPiece): [number, number] {
    const g = GRAINS_PER_CELL;
    const cells = piece.localCells;
    const centre = cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length;
    const column = Math.floor(centre);
    const own = cells.filter((cell) => cell.x === column);
    const bottom = Math.max(...(own.length > 0 ? own : cells).map((cell) => cell.y)) + 1;
    return [piece.x + Math.floor(centre * g), piece.y + bottom * g];
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

  /**
   * The Dune Wyrm passes under the sand as the level ends (the campaign's
   * teaser): no more pieces, no clock, no wind; the sand keeps settling and
   * the worm swims, never bursting out. Only in a running game without a boss.
   */
  tease(): boolean {
    if (this._state !== 'running' || this._worm || this.teasing) return false;
    this.teasing = true;
    this._active = null;
    this.grid.wind = 0;
    const worm = new DuneWorm(this.grid, this.random, Number.POSITIVE_INFINITY);
    // Across the well, inside the sand (its shadow shows only where there is sand).
    const { height, width } = this.grid;
    const depth = height - Math.max(5, Math.min(18, Math.round(this.grid.sandHeight() * 0.45)));
    worm.passTo(2, depth, width - 2, depth);
    this._worm = worm;
    this.events.emit('tease', {});
    return true;
  }

  update(deltaMs: number): void {
    if (this._state !== 'running') return;
    if (this.teasing) {
      this.stepAccumulator += deltaMs;
      while (this.stepAccumulator >= STEP_MS) {
        this.stepAccumulator -= STEP_MS;
        this.physicsStep();
      }
      return;
    }
    this._elapsedMs += deltaMs;
    if (this.timeLimitMs !== null && this._elapsedMs >= this.timeLimitMs) {
      this.finish('timeUp');
      return;
    }
    const reached = this.combo.update(deltaMs);
    if (reached >= 2) this.events.emit('comboEnd', { multiplier: reached });
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
   * fire piece resting on sand burns at once the region it touches most; a
   * lightning piece strikes down its column and leaves nothing behind.
   */
  private lock(): void {
    const piece = this._active;
    if (!piece) return;
    const g = GRAINS_PER_CELL;
    if (piece.tone === Tone.Lightning) {
      this._active = null;
      this.events.emit('lock', { piece });
      this.onStrike(piece);
      this.spawnNext();
      return;
    }
    const aimed = piece.tone === Tone.Fire ? this.targetOf(piece) : null;
    if (aimed?.kind === 'oil') {
      // Near oil, the flame sets the whole slick ablaze.
      this._active = null;
      this.events.emit('lock', { piece });
      this.reactions.blaze(aimed.region);
      this.onReaction({ kind: 'blaze', at: aimed.region[0]!, removed: [], tones: [] });
      this.spawnNext();
      return;
    }
    const target = aimed?.region ?? null;
    if (target) {
      this._active = null;
      this.events.emit('lock', { piece });
      this.burnRegion(target);
      this.spawnNext();
      return;
    }
    this.landedAt = this.centreOf(piece);
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
    for (const reaction of this.reactions.step()) this.onReaction(reaction);
    this.clearSpanning();
    if (this._worm) this.bossStep(this._worm);
  }

  /** The Guardian moves and acts; flames and blazes against it hurt it. */
  private bossStep(worm: DuneWorm): void {
    for (const event of worm.update(STEP_MS)) this.onBoss(event);
    if (this.stormUntil > 0 && this._elapsedMs >= this.stormUntil) {
      this.stormUntil = 0;
      this.grid.wind = 0;
      this.events.emit('wind', { phase: 'end', direction: 1 });
    }
    if (!worm.out || !this.isRunning()) return;
    // Only the grains around its body matter: a box around it, not the whole well.
    const { grid } = this;
    const W = grid.width;
    const flames: number[] = [];
    let blazing = false;
    for (
      let y = Math.max(0, Math.floor(worm.headY) - 8);
      y < Math.min(grid.height, worm.headY + 12);
      y++
    ) {
      for (let x = Math.max(0, Math.floor(worm.headX) - 8); x < Math.min(W, worm.headX + 9); x++) {
        const tone = grid.tones[y * W + x];
        if (tone !== Tone.Fire && tone !== Tone.Blaze) continue;
        if (!worm.touches(x, y, 1)) continue;
        if (tone === Tone.Fire) flames.push(y * W + x);
        else blazing = true;
      }
    }
    if (flames.length > 0) {
      grid.remove(flames);
      this.hurtBoss(worm, 'fire');
    }
    if (blazing && this.grid.stepCount % 12 === 0) this.hurtBoss(worm, 'blaze');
  }

  private hurtBoss(worm: DuneWorm, hit: Parameters<DuneWorm['hit']>[0]): void {
    if (worm.hit(hit) > 0) this.flushBoss(worm);
  }

  /** Events the worm queued outside its own update (a hit). */
  private flushBoss(worm: DuneWorm): void {
    for (const event of worm.drain()) this.onBoss(event);
  }

  private onBoss(event: WormEvent): void {
    this.events.emit('boss', { event });
    switch (event.type) {
      case 'storm':
        // The sandstorm of the last phase: a gust, as the wind blows.
        this.grid.resetDrift();
        this.grid.wind = event.direction;
        this.stormUntil = this._elapsedMs + WIND_GUST_MS;
        this.events.emit('wind', { phase: 'start', direction: event.direction });
        break;
      case 'defeated':
        this.finish('victory');
        break;
      default:
        break;
    }
  }

  /** Destroying sand with an element scores half a clear: elements help, linking wins. */
  private elementPoints(grains: number, rate = 0.5): number {
    return Math.round(grains * rate * (1 + this.boosts.scoreBonus));
  }

  private onReaction(reaction: Reaction): void {
    const { kind, at, removed, tones } = reaction;
    const samples = this.sampleOf(removed, tones);
    if (kind === 'quench') {
      this.events.emit('quench', { samples: this.sampleAround(at) });
      return;
    }
    if (kind === 'burn') {
      const points = this.elementPoints(removed.length);
      this._score += points;
      this.combo.feed();
      this.events.emit('burn', { grains: removed.length, points, samples });
      return;
    }
    if (FEEDING.has(kind) && removed.length > 0) this.combo.feed();
    // Acid is a tool to dig: it scores nothing.
    const points =
      removed.length > 0 && kind !== 'dissolve' ? this.elementPoints(removed.length) : 0;
    this._score += points;
    const W = this.grid.width;
    this.events.emit('react', {
      kind,
      x: at % W,
      y: Math.floor(at / W),
      grains: removed.length,
      points,
      samples,
    });
    // Each reaction is named the first time it happens in a game.
    if (kind !== 'scorch' && kind !== 'dissolve' && !this.announced.has(kind)) {
      this.announced.add(kind);
      this.events.emit('notice', { id: `react.${kind}` });
    }
  }

  private onStrike(piece: SandPiece): void {
    const [boltX, boltY] = this.boltOf(piece);
    const worm = this._worm;
    if (worm?.exposed && Math.abs(worm.headX - boltX) < BOLT_REACH) {
      // On the Guardian's bare head: its weak point takes the whole bolt.
      this.events.emit('strike', {
        kind: 'boss',
        x: Math.round(worm.headX),
        fromY: boltY,
        toY: Math.max(boltY, Math.round(worm.headY)),
        grains: 0,
        points: 0,
        samples: [],
      });
      this.hurtBoss(worm, 'boltHead');
      return;
    }
    const strike = this.reactions.strike(boltX, boltY);
    if (worm && strike.kind === 'shock' && strike.water && worm.touchesAny(strike.water, 1.5)) {
      this.hurtBoss(worm, 'shock');
    } else if (worm && strike.kind === 'shatter' && worm.touchesAny(strike.removed, 3)) {
      this.hurtBoss(worm, 'boltNear');
    }
    if (strike.removed.length > 0) this.combo.feed();
    // Through water, the shock is the great combo of the elements: full points.
    const points = this.elementPoints(strike.removed.length, strike.kind === 'shock' ? 1 : 0.5);
    this._score += points;
    this.events.emit('strike', {
      kind: strike.kind,
      x: strike.x,
      fromY: strike.fromY,
      toY: strike.toY,
      grains: strike.removed.length,
      points,
      samples: this.sampleOf(strike.removed, strike.tones),
    });
    if (strike.kind !== 'ground') {
      this.events.emit('notice', { id: `strike.${strike.kind}`, value: strike.removed.length });
    }
  }

  /** Burning scores half a clear: fire helps, it never beats linking the walls. */
  private burnRegion(region: readonly number[]): void {
    if (region.length === 0) return;
    const samples = this.sample(region);
    this.grid.remove(region);
    const points = Math.round((region.length / 2) * (1 + this.boosts.scoreBonus));
    this._score += points;
    this.combo.feed();
    this.events.emit('burn', { grains: region.length, points, samples });
  }

  /**
   * The region a fire piece at this position would burn: among the sand
   * regions it touches (below or on a side), the one it touches most.
   */
  private targetOf(piece: SandPiece): { kind: 'oil' | 'sand'; region: number[] } | null {
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
    // Oil first: a flame landing near oil (its heat carries a few grains) sets the slick ablaze.
    for (const i of own) {
      const x = i % W;
      const y = (i / W) | 0;
      for (let dy = 0; dy <= OIL_REACH; dy++) {
        for (let dx = -OIL_REACH; dx <= OIL_REACH; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny >= grid.height) continue;
          const n = ny * W + nx;
          if (!own.has(n) && grid.tones[n] === Tone.Oil) {
            return { kind: 'oil', region: grid.connected(n) };
          }
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
    return best ? { kind: 'sand', region: best.slice(0, FIRE_MAX_GRAINS) } : null;
  }

  /** Regions cleared at the edge of defeat count double: the rescue is a feat. */
  private closeCall(points: number): void {
    this._score += points;
    this.events.emit('closeCall', { points });
    this.events.emit('notice', { id: 'closeCall', value: points });
  }

  private clearSpanning(): void {
    const regions = this.grid.spanningRegions();
    if (regions.length === 0) return;
    const all = regions.flat();
    const samples = this.sample(all);
    if (this._worm?.touchesAny(all, 1)) this.hurtBoss(this._worm, 'link');
    // Measured before the clear: regions cleared with the sand this high are a close call.
    const tense = inDanger(this.pressure()) && !this.teasing;
    this.grid.remove(all);
    const multiplier = this.combo.clear();
    const points = Math.round(
      all.length * regions.length * multiplier * (1 + this.boosts.scoreBonus),
    );
    this._score += points;
    this._clears += regions.length;
    this.events.emit('clear', {
      regions: regions.length,
      grains: all.length,
      points,
      multiplier,
      samples,
    });
    if (tense) this.closeCall(points);
    const level = 1 + Math.floor(this._clears / CLEARS_PER_LEVEL);
    if (level > this._level) {
      this._level = level;
      this.events.emit('levelUp', { level });
    }
  }

  /** A sample of grains already removed, with the tones they had. */
  private sampleOf(indices: readonly number[], tones: readonly Tone[]): GrainSample[] {
    const step = Math.max(1, Math.floor(indices.length / SAMPLE));
    const samples: GrainSample[] = [];
    for (let k = 0; k < indices.length; k += step) {
      const i = indices[k]!;
      samples.push({ x: i % this.grid.width, y: Math.floor(i / this.grid.width), tone: tones[k]! });
    }
    return samples;
  }

  /** Grains around a place, for a puff of effects where something happened. */
  private sampleAround(at: number): GrainSample[] {
    const W = this.grid.width;
    const samples: GrainSample[] = [];
    for (let k = 0; k < 24; k++) {
      samples.push({
        x: (at % W) + this.random.nextInt(9) - 4,
        y: Math.floor(at / W) + this.random.nextInt(9) - 4,
        tone: Tone.Steam,
      });
    }
    return samples;
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
    if (!this.windy) return;
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
    this.spawned++;
    let piece = SandPiece.spawn(spec.type, spec.tone, this.grid.width);
    if (this.script.get(this.spawned)?.above && this.landedAt !== null) {
      // Lined up over the previous element: a player who just drops it sees them meet.
      const g = GRAINS_PER_CELL;
      const shift = Math.round((this.landedAt - this.centreOf(piece)) / g) * g;
      const lined = piece.moved(shift, 0);
      if (this.fits(lined)) piece = lined;
    }
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
    if (isElement(spec.tone)) this.events.emit('notice', { id: NOTICE_OF[spec.tone] });
  }

  /** Colour of each new piece: sand, now and then an element, or what the script says. */
  private fillQueue(count: number): void {
    while (this.upcoming.length < count) {
      let type = this.bag.next();
      this.dealt++;
      let tone: Tone = SAND_TONES[this.random.nextInt(SAND_TONES.length)]!;
      const scripted = this.script.get(this.dealt);
      if (scripted) {
        tone = scripted.tone;
        type = scripted.type ?? type;
      } else if (
        this.hazards &&
        this.dealt > this.elementPace.after &&
        this.sinceElement >= ELEMENT_GAP
      ) {
        const element = this.drawElement();
        if (element !== null) tone = element;
      }
      this.sinceElement = isElement(tone) ? 0 : this.sinceElement + 1;
      this.upcoming.push({ type, tone });
    }
  }

  /** An element now and then, weighted, among those of this level; fire boosted by upgrades. */
  private drawElement(): ElementTone | null {
    const roster = this.elements ?? elementsAt(this._level);
    if (
      roster.length === 0 ||
      this.random.next() >= this.elementPace.chance + this.boosts.fireBonus
    ) {
      return null;
    }
    const weight = (tone: ElementTone) =>
      WEIGHT[tone] * (tone === Tone.Fire ? 1 + this.boosts.fireBonus * 10 : 1);
    let roll = this.random.next() * roster.reduce((sum, tone) => sum + weight(tone), 0);
    for (const tone of roster) {
      roll -= weight(tone);
      if (roll < 0) return tone;
    }
    return roster[roster.length - 1]!;
  }

  private isRunning(): boolean {
    return this._state === 'running';
  }

  private setState(state: SandState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
