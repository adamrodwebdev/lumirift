import { Emitter, type Listener } from '@/core/Emitter';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import { ComboGauge, type ComboView } from '@/session/ComboGauge';
import { Mercy } from '@/session/Mercy';
import { inDanger } from '@/session/Tension';
import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import type { RotationDirection } from '@/families/falling/pieces/PieceType';
import { GravityCurve } from '@/families/falling/rules/GravityCurve';
import { isElement, NOTICE_OF, type ElementTone } from './Elements';
import { DuneWorm, TEASER_MS, TEASER_PACE, type WormEvent } from './DuneWorm';
import { layBed, type SandBed } from './SandBed';
import { GrainSampler, type GrainSample } from './GrainSampler';
import {
  ELEMENT_GAP,
  SandDealer,
  type ElementPace,
  type PieceSpec,
  type ScriptedPiece,
} from './SandDealer';
import { GRAINS_PER_CELL, SandGrid } from './SandGrid';
import { SandPiece, type LandedPiece } from './SandPiece';
import {
  FIRE_MAX_GRAINS,
  SandReactions,
  type Reaction,
  type ReactionKind,
  type StrikeKind,
} from './SandReactions';
import { SandWind, WIND_EVERY_MS, WIND_GUST_MS, type WindChange } from './SandWind';

export type SandState = 'ready' | 'running' | 'paused' | 'over';
export type SandOverReason = 'blockOut' | 'timeUp' | 'victory';

/** Physics runs at a fixed step, whatever the frame rate. */
export const STEP_MS = 16;
export const LOCK_DELAY_MS = 300;
export const MAX_LOCK_RESETS = 10;
export const PREVIEW_COUNT = 3;
/** Elements start after a few ordinary pieces. */
export const ELEMENTS_AFTER = 5;
/** Chance that a piece is an element (once `ELEMENT_GAP` is respected). */
export const ELEMENT_CHANCE = 0.2;
/** A bolt landing this close to the Guardian's bare head (in grains) strikes it. */
export const BOLT_REACH = 8;
/** A landing flame sets alight oil this many grains away (a cell), below or aside. */
export const OIL_REACH = 6;
export { ELEMENT_GAP, FIRE_MAX_GRAINS, WIND_EVERY_MS, WIND_GUST_MS };
export type { ElementPace, GrainSample, PieceSpec, ScriptedPiece };
export const CLEARS_PER_LEVEL = 5;
/** A game that cannot be lost (the training) empties this many cells of sand each time (rows). */
export const FORGIVING_ROWS = 6;
/**
 * The reactions that feed a running combo: the great moments of the elements.
 * A blaze's scorching, acid and steam come too often to count.
 */
const FEEDING: ReadonlySet<string> = new Set(['blaze', 'sprout', 'melt', 'freeze', 'fuse']);

export interface SandEventMap {
  state: { readonly state: SandState };
  spawn: { readonly piece: SandPiece };
  move: { readonly piece: SandPiece };
  rotate: { readonly piece: SandPiece };
  hardDrop: { readonly piece: SandPiece; readonly distance: number };
  lock: { readonly piece: LandedPiece };
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
  wind: WindChange;
  levelUp: { readonly level: number };
  notice: { readonly id: string; readonly value?: number };
  /** A second chance: the bottom of the sand vanished instead of the game ending. */
  rescue: { readonly rows: number };
  /** A lost game continues (1.31): the top of the pile blew away, these grains with it. */
  revive: { readonly grains: readonly number[] };
  /** The pile overflowed and play goes on (the Rift Race, 1.34): its top blew away, these grains with it. */
  overflow: { readonly grains: readonly number[] };
  /** The Guardian of the level did something (see `DuneWorm`). */
  boss: { readonly event: WormEvent };
  /** The next chapter's Guardian passes under the sand (the campaign's teaser). */
  tease: Readonly<Record<string, never>>;
  over: { readonly reason: SandOverReason };
}

/**
 * Anything that publishes the events of a game of grains: what the Sand's
 * effects and sounds listen to (a game of Sand, or of Dunes, 1.37).
 */
export interface SandEventSource {
  onGame<K extends keyof SandEventMap>(type: K, listener: Listener<SandEventMap[K]>): () => void;
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
  /** The week's element (a free game, 1.36): dealt from the start, and more often. */
  readonly featured?: ElementTone;
  /** Pieces dealt at a given rank whatever happens (the first level's show, a tutorial). */
  readonly script?: readonly ScriptedPiece[];
  /** A Guardian of the rift lives in this well (a boss level). */
  readonly boss?: 'duneWorm';
  /** The Guardian's first move after this long (ms); by default the player sees the arena first. */
  readonly bossDelayMs?: number;
  /** The Guardian cannot be hurt before it has come out once: the player sees it first (the training). */
  readonly bossSeenFirst?: boolean;
  /** The Guardian comes with this much health (a race's, a third); full by default. */
  readonly bossHealth?: number;
  /** The level the game starts at (the Rift Race's climb); 1 by default. */
  readonly startLevel?: number;
  /** The early campaign's mercy: the fall and the Wyrm slow near the top (none by default). */
  readonly mercy?: Mercy;
  /** A prepared well: bands of sand to work on (the home's reel, the portals' training). */
  readonly bed?: SandBed;
  /** Never lost (the portals' training): each time a piece cannot come in, the bottom empties. */
  readonly forgiving?: boolean;
  /**
   * An overflow does not end the game (the Rift Race, 1.34): the top this
   * many rows (in cells) blow away and play goes on. 0, the default: it ends the game.
   */
  readonly overflowFrees?: number;
}

/**
 * A game of Sand: pieces fall like in the falling family, then crumble into
 * grains on landing. A region of one colour reaching from wall to wall
 * vanishes. Elements (water, fire, oil, ice, lightning, seeds, acid) and wind
 * shake things up, and react with each other (`SandReactions`). Its pieces
 * come from a `SandDealer`, its gusts from `SandWind`.
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
  private readonly dealer: SandDealer;
  private readonly wind: SandWind;
  private readonly sampler: GrainSampler;
  private readonly gravity = new GravityCurve();
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
  private readonly boosts: Boosts;
  private readonly mercy: Mercy;
  private readonly windy: boolean;
  private readonly script: ReadonlyMap<number, ScriptedPiece>;
  /** Pieces dealt so far and the centre (in grains) of the last one that landed. */
  private spawned = 0;
  private landedAt: number | null = null;
  /** Reactions already announced in this game (each is named the first time). */
  private readonly announced = new Set<string>();
  /** The second chance has not been used yet. */
  private rescueReady: boolean;
  /** Rescued every time: a game that cannot be lost. */
  private readonly forgiving: boolean;
  private readonly overflowFrees: number;
  /** What the falling element would hit, cached for one grid step and one position. */
  private targetCache: { key: string; region: readonly number[] | null } = {
    key: '',
    region: null,
  };
  private softDropping = false;
  /** A continued game waits for the player's first move before anything falls again. */
  private waiting = false;
  private fallAccumulator = 0;
  private stepAccumulator = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;

  constructor(options: SandOptions) {
    this.random = options.random;
    this.grid = options.grid ?? new SandGrid();
    if (options.bed) layBed(this.grid, options.bed);
    this.timeLimitMs = options.timeLimitMs ?? null;
    this.boosts = options.boosts ?? NO_BOOSTS;
    this.mercy = options.mercy ?? Mercy.NONE;
    const hazards = options.hazards ?? true;
    this.windy = hazards && (options.wind ?? true);
    this.script = new Map((options.script ?? []).map((piece) => [piece.at, piece]));
    this.dealer = new SandDealer(
      this.random,
      {
        hazards,
        pace: options.elementPace ?? { after: ELEMENTS_AFTER, chance: ELEMENT_CHANCE },
        elements: options.elements ?? null,
        script: this.script,
        fireBonus: this.boosts.fireBonus,
        featured: hazards ? (options.featured ?? null) : null,
      },
      () => this._level,
    );
    this.sampler = new GrainSampler(this.grid, this.random);
    this.reactions = new SandReactions(this.grid, this.random);
    this._worm =
      options.boss === 'duneWorm'
        ? new DuneWorm(this.grid, this.random, {
            ...(options.bossDelayMs === undefined ? {} : { firstSurgeMs: options.bossDelayMs }),
            ...(options.bossSeenFirst ? { seenFirst: true } : {}),
            ...(options.bossHealth === undefined ? {} : { health: options.bossHealth }),
          })
        : null;
    this.rescueReady = this.boosts.rescueRows > 0;
    this.forgiving = options.forgiving ?? false;
    this.overflowFrees = options.overflowFrees ?? 0;
    this._level = options.startLevel ?? 1;
    // Drawn even in a calm game, so that a seed always deals the same pieces.
    this.wind = new SandWind(this.grid, this.random, (change) => {
      this.events.emit('wind', change);
      if (change.phase === 'soon') {
        this.events.emit('notice', {
          id: change.direction < 0 ? 'windSoonLeft' : 'windSoonRight',
        });
      }
    });
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
    if (this._state !== 'running' || this.teasing || this.forgiving) return null;
    const spec = this.dealer.peek();
    const piece = SandPiece.spawn(spec.type, spec.tone, this.grid.width);
    return this.fits(piece, 0, GRAINS_PER_CELL) ? null : piece;
  }

  /**
   * How high the sand stands in the well (0 to 1). A game that cannot be lost
   * is never in danger: no alarm where the bottom empties instead.
   */
  pressure(): number {
    if (this.forgiving) return 0;
    return Math.min(1, this.grid.sandHeight() / this.grid.height);
  }

  /** Milliseconds before the next gust, 0 while it blows; null in a game without wind. */
  get windInMs(): number | null {
    return this.windy ? this.wind.inMs(this._elapsedMs) : null;
  }

  preview(count = PREVIEW_COUNT + this.boosts.extraPreview): readonly PieceSpec[] {
    return this.dealer.preview(count);
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
   * The Dune Wyrm shows itself as the level ends (the campaign's teaser): no
   * more pieces, no clock, no wind, no scoring; it swims in under the sand,
   * bursts out in the middle roaring, and dives (1.28.1: it only passed under
   * the sand before, and could go unnoticed). A Wyrm already in the well
   * (the training's, struck once) leaves it instead (1.29). Returns how long
   * its show lasts (ms), 0 when nothing shows.
   */
  /** The Guardian of the well leaves it for good (a race's, its time up): it dives and swims away. */
  dismissBoss(): void {
    this._worm?.retreat();
  }

  tease(): number {
    if (this._state !== 'running' || this.teasing || this._worm?.state === 'dead') return 0;
    this.teasing = true;
    this._active = null;
    this.grid.calm();
    if (this._worm) return this._worm.retreat();
    const worm = new DuneWorm(this.grid, this.random, TEASER_PACE);
    // In from the left, inside the sand (its shadow shows only where there is sand).
    const { height, width } = this.grid;
    const depth = height - Math.max(5, Math.min(18, Math.round(this.grid.sandHeight() * 0.45)));
    worm.passTo(2, depth, width / 2, depth);
    this._worm = worm;
    this.events.emit('tease', {});
    return TEASER_MS;
  }

  update(deltaMs: number): void {
    if (this._state !== 'running' || this.waiting) return;
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
    if (this.windy) this.wind.update(this._elapsedMs);
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
    if (reason === 'blockOut' && this.overflowFrees > 0) {
      this._active = null;
      this.softDropping = false;
      const grains = this.grid.clearTopRows(this.overflowFrees * GRAINS_PER_CELL);
      this.events.emit('overflow', { grains });
      this.spawnNext();
      return;
    }
    this._overReason = reason;
    this._active = null;
    this.grid.calm();
    this.setState('over');
    this.events.emit('over', { reason });
  }

  /** The game was lost to its pile: a continue can bring it back. */
  get revivable(): boolean {
    return this._state === 'over' && this._overReason === 'blockOut';
  }

  /**
   * A lost game continues (the rewarded continue, 1.31): the top `rows` of
   * the pile (in cells) blow away and play goes on, the piece that could not
   * enter coming first.
   */
  revive(rows: number): void {
    if (!this.revivable) return;
    const grains = this.grid.clearTopRows(rows * GRAINS_PER_CELL);
    this._overReason = null;
    this.softDropping = false;
    this.waiting = true;
    this.setState('running');
    this.events.emit('revive', { grains });
    this.spawnNext();
  }

  // --- Player intentions ----------------------------------------------------

  moveLeft(): boolean {
    this.wake();
    return this.shift(-GRAINS_PER_CELL);
  }

  moveRight(): boolean {
    this.wake();
    return this.shift(GRAINS_PER_CELL);
  }

  setSoftDrop(active: boolean): void {
    if (active) this.wake();
    this.softDropping = active;
  }

  /** Down one cell, now (a finger's notch, 1.40): its grains, as far as they fit. */
  softStep(): boolean {
    this.wake();
    const piece = this._active;
    if (this._state !== 'running' || !piece) return false;
    let moved = piece;
    for (let i = 0; i < GRAINS_PER_CELL && this.fits(moved, 0, 1); i++) moved = moved.moved(0, 1);
    if (moved === piece) return false;
    this.place(moved);
    // The next grain of gravity counts from here.
    this.fallAccumulator = 0;
    return true;
  }

  rotate(direction: RotationDirection): boolean {
    this.wake();
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
    this.wake();
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
      : this.gravity.rowIntervalMs(this._level) /
        (this.boosts.gravityScale * this.mercy.pace(this.pressure()));
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
    // Near the top, the early campaign's mercy slows the Wyrm too.
    for (const event of worm.update(STEP_MS * this.mercy.pace(this.pressure()))) {
      this.onBoss(event);
    }
    if (this.stormUntil > 0 && this._elapsedMs >= this.stormUntil) {
      this.stormUntil = 0;
      this.grid.calm();
      this.events.emit('wind', { phase: 'end', direction: 1 });
    }
    // A Guardian only showing itself (the teaser) is out of reach.
    if (!worm.out || !this.isRunning() || this.teasing) return;
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
        this.grid.blow(event.direction);
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
    const samples = this.sampler.removed(removed, tones);
    if (kind === 'quench') {
      this.events.emit('quench', { samples: this.sampler.around(at) });
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
      samples: this.sampler.removed(strike.removed, strike.tones),
    });
    if (strike.kind !== 'ground') {
      this.events.emit('notice', { id: `strike.${strike.kind}`, value: strike.removed.length });
    }
  }

  /** Burning scores half a clear: fire helps, it never beats linking the walls. */
  private burnRegion(region: readonly number[]): void {
    if (region.length === 0) return;
    const samples = this.sampler.standing(region);
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

  /** Adds bonus points won outside the rules (the rift surge's exit), and announces them. */
  awardPoints(points: number, reason: string): void {
    if (this._state === 'over' || points <= 0) return;
    this._score += points;
    this.events.emit('notice', { id: reason, value: points });
  }

  /** Regions cleared at the edge of defeat count double: the rescue is a feat. */
  private closeCall(points: number): void {
    this._score += points;
    this.events.emit('closeCall', { points });
    this.events.emit('notice', { id: 'closeCall', value: points });
  }

  private clearSpanning(): void {
    // The level is won while a Guardian shows itself: the sand it throws scores nothing.
    if (this.teasing) return;
    const regions = this.grid.spanningRegions();
    if (regions.length === 0) return;
    const all = regions.flat();
    const samples = this.sampler.standing(all);
    if (this._worm?.touchesAny(all, 1)) this.hurtBoss(this._worm, 'link');
    // Measured before the clear: regions cleared with the sand this high are a close call.
    const tense = inDanger(this.pressure());
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

  private spawnNext(): void {
    const spec = this.dealer.next();
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
      if (this.rescueReady || this.forgiving) {
        // The second chance (every time in a training): the bottom of the sand vanishes, the piece comes back.
        this.rescueReady = false;
        const rows = Math.max(this.boosts.rescueRows, this.forgiving ? FORGIVING_ROWS : 0);
        this.grid.dropBottomRows(rows * GRAINS_PER_CELL);
        this.events.emit('rescue', { rows });
        this.dealer.giveBack(spec);
        this.spawnNext();
        return;
      }
      // Kept for a continue: the same piece, at the same rank.
      this.dealer.giveBack(spec);
      this.spawned--;
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

  private isRunning(): boolean {
    return this._state === 'running';
  }

  /** The player acts: a continued game that waited for them goes on. */
  private wake(): void {
    if (this._state === 'running') this.waiting = false;
  }

  private setState(state: SandState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
