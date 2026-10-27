import { Emitter } from '@/core/Emitter';
import { SeededRandom, type RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Shape } from '@/families/placement/engine/Shape';
import { DuneWorm, TEASER_MS, TEASER_PACE, type WormEvent } from '@/families/sand/engine/DuneWorm';
import { isElement, NOTICE_OF, type ElementTone } from '@/families/sand/engine/Elements';
import { GrainSampler } from '@/families/sand/engine/GrainSampler';
import { layBed, type SandBed } from '@/families/sand/engine/SandBed';
import { BOLT_REACH, OIL_REACH, STEP_MS, type SandEventMap } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import type { LandedPiece } from '@/families/sand/engine/SandPiece';
import { SandReactions, type Reaction } from '@/families/sand/engine/SandReactions';
import { WIND_GUST_MS } from '@/families/sand/engine/SandWind';
import type { ComboView } from '@/session/ComboGauge';
import { Mercy } from '@/session/Mercy';
import { inDanger } from '@/session/Tension';
import {
  CellMap,
  closestToLink,
  dunesGrid,
  DUNES_TONES,
  surfaceColours,
  type Spot,
} from './DunesBoard';
import { DunesDealer, type DunesRoster, type HandSource, type OfferedSand } from './DunesDealer';
import { dunesLevel, type DunesGoal, type DunesLevel } from './DunesLevels';
import { PlacementStreak } from './PlacementStreak';

export type DunesState = 'ready' | 'running' | 'paused' | 'over';

/** Swaps of the hand: one to start with, one more for each goal reached, three at most. */
export const FIRST_SWAPS = 1;
export const MOST_SWAPS = 3;
/** The next hand waits for the sand to settle, at most this long after the last piece (ms). */
export const DEAL_WAIT_MS = 900;
/** Physics steps with nothing moving or happening: the board is at rest. */
const REST_STEPS = 2;
/** Fire burns this many grains at most: the Sand's 1,500 would take 40 % of this board. */
export const DUNES_FIRE_MAX = 700;
/** A Wyrm's first burst comes this long after its level begins (ms): the player sees it coming. */
export const WYRM_DELAY_MS = 3500;
/**
 * The opening (D-1): three bands of sand, each cut by another colour. The
 * first hand's first piece is the top band's colour, and a mark shows where
 * it links the walls: the first move clears a region.
 */
export const OPENING_BED: SandBed = { share: 0.25, variant: 0 };
/** The opening's first piece: a pair, laid flat. */
const PAIR = Shape.parse('##');
/** The reactions that keep a chain going (the Sand's list). */
const FEEDING: ReadonlySet<string> = new Set(['blaze', 'sprout', 'melt', 'freeze', 'fuse']);

/** Why a new hand came. */
export type DealReason = 'deal' | 'swap' | 'promise' | 'revive';

/**
 * The events of a game of Dunes: the Sand's (its effects and sounds listen
 * to them), and those of the hand. The game ends as a Sand game does when no
 * piece can come in: `over` with `blockOut`.
 */
export interface DunesEventMap extends SandEventMap {
  /** A new hand: the three pieces were put down, a swap, the dealer's promise kept, a continue. */
  deal: { readonly reason: DealReason };
  /** A piece of the hand was put down, its top-left corner at this cell. */
  place: { readonly slot: number; readonly x: number; readonly y: number; readonly tone: Tone };
  /** The level's goal is reached (its number): the next level begins. */
  goal: { readonly level: number };
  /** The swaps held changed. */
  swaps: { readonly swaps: number };
}

export interface DunesOptions {
  readonly random: RandomSource;
  /** The week's element (a free game, 1.36): dealt from the start, and more often. */
  readonly featured?: ElementTone;
  /** The level the run starts at: 1 by default, with its opening. */
  readonly startLevel?: number;
  /** Where the hands come from: the dealer by default (with its own draws). */
  readonly hands?: HandSource;
}

/** Where the player holds a piece of the hand: its slot and the cell of its top-left corner. */
export interface Aim extends Spot {
  readonly slot: number;
}

/** How far the level's goal is, by kind of goal. */
const GOAL_VALUES: Readonly<Record<DunesGoal['kind'], (game: DunesGame) => number>> = {
  regions: (game) => game.levelClears,
  score: (game) => game.levelPoints,
  wyrm: (game) => game.wyrmDamage,
};

/**
 * A game of Dunes (1.37): a calm mode of the Sand's matter. The player puts
 * one of three pieces down on a board of 9 × 12 cells, where it crumbles
 * into grains that flow and settle; a colour linking both walls vanishes, as
 * in Sand. No clock and no falling piece: the rising sand is the pressure,
 * and the game ends when no piece of the hand fits (and no swap is left).
 * The elements come level after level; the Dune Wyrm fights at boss levels.
 * The grains, the reactions and the Wyrm are the Sand's own modules; the
 * rules that tie them (links, fire, lightning, the Wyrm's wounds) follow the
 * Sand's, adapted to pieces put down.
 */
export class DunesGame {
  readonly grid = dunesGrid();
  readonly events = new Emitter<DunesEventMap>();
  readonly random: RandomSource;

  private readonly dealer: HandSource;
  private readonly reactions: SandReactions;
  private readonly sampler: GrainSampler;
  private readonly streak = new PlacementStreak();
  /** Near the top, the Wyrm slows (lot 16's mercy, always on in a calm mode). */
  private readonly mercy = Mercy.of('dunes', 1);
  private readonly featured: ElementTone | null;
  private _state: DunesState = 'ready';
  private _overReason: 'blockOut' | null = null;
  private _hand: (OfferedSand | null)[] = [];
  private _score = 0;
  private _clears = 0;
  private _swaps = FIRST_SWAPS;
  private _level: DunesLevel;
  private _levelClears = 0;
  /** The score when the level began. */
  private levelFrom = 0;
  /** The element the level just brought: the next hand deals it. */
  private brought: ElementTone | null;
  private _worm: DuneWorm | null = null;
  /** The Wyrm only shows itself (after the first goal): no fight. */
  private showing = false;
  private showUntil = 0;
  /** A sandstorm the Wyrm raised: the wind blows until then (ms of play). */
  private stormUntil = 0;
  private _elapsedMs = 0;
  private stepAccumulator = 0;
  /** Physics steps in a row where nothing moved, reacted or cleared. */
  private resting = 0;
  /** The three pieces are down: the next hand comes once the sand settles. */
  private dealPending = false;
  private lastPlacedAt = 0;
  /** No piece of this hand has been put down yet. */
  private untouched = false;
  /** The opening's mark: where the first piece links the walls. */
  private _hint: Aim | null = null;
  /** Elements and reactions already named in this game. */
  private readonly announced = new Set<string>();
  private cells: CellMap | null = null;
  private targetCache: { key: string; region: readonly number[] | null } = {
    key: '',
    region: null,
  };

  constructor(options: DunesOptions) {
    this.random = options.random;
    // The hands have their own draws: a seed deals the same hands whatever the sand does.
    this.dealer =
      options.hands ?? new DunesDealer(new SeededRandom(Math.floor(this.random.next() * 2 ** 32)));
    this.sampler = new GrainSampler(this.grid, this.random);
    this.reactions = new SandReactions(this.grid, this.random);
    this.featured = options.featured ?? null;
    this._level = dunesLevel(options.startLevel ?? 1);
    this.brought = this._level.brings;
    if (this._level.number === 1) this.layOpening();
    if (this._level.goal.kind === 'wyrm') this.summonWyrm(this._level.goal.target);
  }

  // --- Read model -----------------------------------------------------------

  get state(): DunesState {
    return this._state;
  }
  get overReason(): 'blockOut' | null {
    return this._overReason;
  }
  /** The three slots of the hand: a piece, or null once put down. */
  get hand(): readonly (OfferedSand | null)[] {
    return this._hand;
  }
  get score(): number {
    return this._score;
  }
  /** Regions cleared in the whole run. */
  get clears(): number {
    return this._clears;
  }
  get swaps(): number {
    return this._swaps;
  }
  get level(): DunesLevel {
    return this._level;
  }
  /** Regions cleared since the level began. */
  get levelClears(): number {
    return this._levelClears;
  }
  /** Points scored since the level began. */
  get levelPoints(): number {
    return this._score - this.levelFrom;
  }
  /** Health taken from the Wyrm of the level. */
  get wyrmDamage(): number {
    const worm = this.fightingWorm();
    return worm ? worm.maxHealth - worm.health : 0;
  }
  /** How far the level's goal is (regions, points or health taken). */
  get goalValue(): number {
    return GOAL_VALUES[this._level.goal.kind](this);
  }
  /** The Wyrm of a boss level, or the one showing itself; null elsewhere. */
  get worm(): DuneWorm | null {
    return this._worm;
  }
  /** The Wyrm only shows itself: it cannot be hurt, nothing it does is a fight. */
  get isShowing(): boolean {
    return this.showing;
  }
  /** The chain: what the next clear scores with, and the grace left. */
  get comboGauge(): ComboView {
    return this.streak;
  }
  get elapsedMs(): number {
    return this._elapsedMs;
  }
  /** The opening's mark (where the first piece links the walls), until the first piece is down. */
  get hint(): Aim | null {
    return this._hint;
  }
  /** The next hand is waiting for the sand to settle. */
  get dealing(): boolean {
    return this.dealPending;
  }

  /** The board in cells, as it stands now. */
  board(): CellMap {
    this.cells ??= new CellMap(this.grid);
    return this.cells;
  }

  /** Whether each slot's piece fits somewhere now (false for an empty slot). */
  fitting(): boolean[] {
    const board = this.board();
    return this._hand.map((piece) => piece !== null && board.fitsAnywhere(piece.shape));
  }

  canPlace(slot: number, x: number, y: number): boolean {
    const piece = this._hand[slot];
    return this.isRunning() && piece != null && this.board().fits(piece.shape, x, y);
  }

  /** How much of the board is taken (0 to 1): the danger and the music follow it. */
  pressure(): number {
    return this.board().filled;
  }

  /**
   * Grains a fire piece held there would burn, or a lightning piece strike,
   * or null: shown in advance, so that elements are aimed, never a lottery.
   */
  targetAt(aim: Aim): readonly number[] | null {
    const piece = this._hand[aim.slot];
    if (!piece || (piece.tone !== Tone.Fire && piece.tone !== Tone.Lightning)) return null;
    if (!this.board().fits(piece.shape, aim.x, aim.y)) return null;
    const key = `${this.grid.stepCount}:${piece.id}:${aim.x}:${aim.y}`;
    if (this.targetCache.key !== key) {
      const g = GRAINS_PER_CELL;
      const region =
        piece.tone === Tone.Fire
          ? (this.fireTarget(piece.shape, aim.x, aim.y)?.region ?? null)
          : this.reactions.strikeTarget(...this.boltOf(piece.shape, aim.x * g, aim.y * g));
      this.targetCache = { key, region: region && region.length > 0 ? region : null };
    }
    return this.targetCache.region;
  }

  // --- Lifecycle ------------------------------------------------------------

  start(): void {
    if (this._state !== 'ready') return;
    this.setState('running');
    this.deal('deal');
  }

  pause(): void {
    if (this._state === 'running') this.setState('paused');
  }

  resume(): void {
    if (this._state === 'paused') this.setState('running');
  }

  update(deltaMs: number): void {
    if (!this.isRunning()) return;
    this._elapsedMs += deltaMs;
    this.stepAccumulator += deltaMs;
    while (this.stepAccumulator >= STEP_MS && this.isRunning()) {
      this.stepAccumulator -= STEP_MS;
      this.physicsStep();
      this.afterStep();
    }
  }

  /** The game was lost to its sand: a continue can bring it back. */
  get revivable(): boolean {
    return this._state === 'over' && this._overReason === 'blockOut';
  }

  /** A lost game continues (the rewarded continue): the top `rows` of the sand blow away, a new hand comes. */
  revive(rows: number): void {
    if (!this.revivable) return;
    const grains = this.grid.clearTopRows(rows * GRAINS_PER_CELL);
    this.cells = null;
    this._overReason = null;
    this.setState('running');
    this.events.emit('revive', { grains });
    this.deal('revive');
  }

  // --- Player intentions ----------------------------------------------------

  /** Puts the piece of a slot down with its top-left corner at a cell; false where it does not fit. */
  place(slot: number, x: number, y: number): boolean {
    if (!this.canPlace(slot, x, y)) return false;
    const piece = this._hand[slot]!;
    this._hand[slot] = null;
    this.untouched = false;
    this._hint = null;
    const reached = this.streak.placed();
    if (reached >= 2) this.events.emit('comboEnd', { multiplier: reached });
    this.crumble(piece, x, y);
    this.resting = 0;
    this.lastPlacedAt = this._elapsedMs;
    this.events.emit('place', { slot, x, y, tone: piece.tone });
    if (this._hand.every((held) => held === null)) this.dealPending = true;
    this.checkGoal();
    return true;
  }

  /** A new hand for the one held, if a swap is left. */
  swap(): boolean {
    if (!this.isRunning() || this._swaps <= 0 || this.dealPending) return false;
    this.setSwaps(this._swaps - 1);
    this.deal('swap');
    return true;
  }

  // --- The hand ---------------------------------------------------------------

  private roster(): DunesRoster {
    return { elements: this._level.elements, featured: this.featured, brought: this.brought };
  }

  private deal(reason: DealReason): void {
    this.dealPending = false;
    const board = this.board();
    const hand = this.dealer.hand({
      board,
      roster: this.roster(),
      pressure: this.pressure(),
      wanted: closestToLink(surfaceColours(this.grid, board)),
      level: this._level.number,
      colours: this._level.colours,
    });
    if (reason === 'deal' && this._level.number === 1 && this.openingAvailable()) {
      hand[0] = this.openingPiece(hand[0]!);
    }
    this._hand = hand;
    this.brought = null;
    this.untouched = true;
    this.events.emit('deal', { reason });
    for (const piece of hand) {
      if (!isElement(piece.tone) || this.announced.has(`element.${piece.tone}`)) continue;
      // Each element is named the first time it comes.
      this.announced.add(`element.${piece.tone}`);
      this.events.emit('notice', { id: NOTICE_OF[piece.tone] });
    }
  }

  /**
   * The opening's bed, in the first level's colours: the Sand's bed cuts one
   * band with a fourth colour, which takes the third here.
   */
  private layOpening(): void {
    layBed(this.grid, OPENING_BED);
    const { tones } = this.grid;
    const dealt = DUNES_TONES.slice(0, this._level.colours);
    const last = dealt[dealt.length - 1]!;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i] as Tone;
      if (tone !== Tone.Empty && !dealt.includes(tone)) this.grid.set(i, last);
    }
  }

  /** The opening is still there: nothing put down yet, the bed untouched. */
  private openingAvailable(): boolean {
    return this._clears === 0 && this._hand.length === 0;
  }

  /**
   * The opening's first piece: a pair of the top band's colour, and the mark
   * where it bridges the band's cut (the first move links the walls).
   */
  private openingPiece(drawn: OfferedSand): OfferedSand {
    const { grid } = this;
    const W = grid.width;
    const g = GRAINS_PER_CELL;
    const top = grid.height - Math.round(grid.height * OPENING_BED.share);
    const row = Array.from({ length: W }, (_, x) => grid.tones[top * W + x]!);
    const counts = new Map<number, number>();
    for (const tone of row) counts.set(tone, (counts.get(tone) ?? 0) + 1);
    const tone = [...counts].sort((a, b) => b[1] - a[1])[0]![0] as Tone;
    const cut = row.flatMap((other, x) => (other === tone ? [] : [x]));
    const shape = PAIR;
    const centre = cut.length > 0 ? (cut[0]! + cut[cut.length - 1]! + 1) / 2 : W / 2;
    const x = Math.max(0, Math.min(grid.width / g - shape.width, Math.round(centre / g - 1)));
    this._hint = { slot: 0, x, y: Math.floor(top / g) - 1 };
    return { id: drawn.id, shape, tone };
  }

  // --- The matter -------------------------------------------------------------

  /**
   * The piece crumbles where it is put: each cell becomes 6 × 6 grains that
   * flow and settle. Fire falls to what it rests on and burns the region it
   * touches most (or sets oil ablaze); lightning strikes down its column and
   * leaves nothing behind.
   */
  private crumble(piece: OfferedSand, cx: number, cy: number): void {
    const g = GRAINS_PER_CELL;
    const landed: LandedPiece = {
      tone: piece.tone,
      x: cx * g,
      y: cy * g,
      localCells: piece.shape.cells,
    };
    this.cells = null;
    this.events.emit('lock', { piece: landed });
    if (piece.tone === Tone.Lightning) {
      this.strike(piece.shape, landed.x, landed.y);
      return;
    }
    const aimed = piece.tone === Tone.Fire ? this.fireTarget(piece.shape, cx, cy) : null;
    if (aimed?.kind === 'oil') {
      // Near oil, the flame sets the whole slick ablaze.
      this.reactions.blaze(aimed.region);
      this.onReaction({ kind: 'blaze', at: aimed.region[0]!, removed: [], tones: [] });
      return;
    }
    if (aimed) {
      this.burnRegion(aimed.region);
      return;
    }
    for (const cell of piece.shape.cells) {
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          this.grid.put(
            landed.x + cell.x * g + x,
            landed.y + cell.y * g + y,
            piece.tone,
            this.random.nextInt(4),
          );
        }
      }
    }
  }

  private physicsStep(): void {
    this.cells = null;
    let moving = this.grid.simulate(this.random) > 0;
    for (const reaction of this.reactions.step()) {
      this.onReaction(reaction);
      moving = true;
    }
    if (this.clearSpanning()) moving = true;
    if (this._worm) this.bossStep(this._worm);
    this.cells = null;
    this.resting = moving ? 0 : this.resting + 1;
  }

  /** After each step: the show ends, the next hand comes, a stuck hand is settled. */
  private afterStep(): void {
    if (!this.isRunning()) return;
    if (this.showing && this._elapsedMs >= this.showUntil) {
      this.showing = false;
      this._worm = null;
    }
    this.checkGoal();
    if (this.dealPending) {
      const settled = this.resting >= REST_STEPS;
      if (settled || this._elapsedMs - this.lastPlacedAt >= DEAL_WAIT_MS) this.deal('deal');
      return;
    }
    if (this.resting >= REST_STEPS) this.checkStuck();
  }

  /**
   * No piece of the hand fits, and the sand is at rest. A hand dealt so (the
   * sand moved after the deal) breaks the dealer's promise: it is dealt
   * again. Otherwise the player may swap; without a swap the game is over.
   */
  private checkStuck(): void {
    const board = this.board();
    if (this._hand.some((piece) => piece !== null && board.fitsAnywhere(piece.shape))) return;
    if (board.freeCells === 0) {
      this.finish();
    } else if (this.untouched) {
      this.deal('promise');
    } else if (this._swaps === 0) {
      this.finish();
    }
  }

  // --- Levels -----------------------------------------------------------------

  private checkGoal(): void {
    const { goal } = this._level;
    if (!this.isRunning() || goal.kind === 'wyrm') return;
    if (this.goalValue >= goal.target) this.reachGoal();
  }

  /** The goal is reached: a swap more, the next level, its element, perhaps its Wyrm. */
  private reachGoal(): void {
    const done = this._level.number;
    this.events.emit('goal', { level: done });
    this.setSwaps(Math.min(MOST_SWAPS, this._swaps + 1));
    if (this._level.goal.kind === 'wyrm') this._worm = null;
    this._level = dunesLevel(done + 1);
    this._levelClears = 0;
    this.levelFrom = this._score;
    this.brought = this._level.brings;
    this.events.emit('levelUp', { level: this._level.number });
    if (this._level.colours > dunesLevel(done).colours) {
      this.events.emit('notice', { id: 'dunesColour' });
    }
    if (this._level.goal.kind === 'wyrm') this.summonWyrm(this._level.goal.target);
    else if (done === 1) this.showWyrm();
  }

  private setSwaps(swaps: number): void {
    if (swaps === this._swaps) return;
    this._swaps = swaps;
    this.events.emit('swaps', { swaps });
  }

  // --- The Wyrm ---------------------------------------------------------------

  private summonWyrm(health: number): void {
    this.showing = false;
    this._worm = new DuneWorm(this.grid, this.random, { firstSurgeMs: WYRM_DELAY_MS, health });
  }

  /**
   * After the first goal, the Wyrm shows itself (the hook of the first
   * minute): it swims in under the sand, bursts out roaring and dives. The
   * game goes on; it cannot be hurt, and its fight comes at D-5.
   */
  private showWyrm(): void {
    const worm = new DuneWorm(this.grid, this.random, TEASER_PACE);
    const { height, width } = this.grid;
    const depth = height - Math.max(5, Math.min(18, Math.round(this.grid.sandHeight() * 0.45)));
    worm.passTo(2, depth, width / 2, depth);
    this._worm = worm;
    this.showing = true;
    this.showUntil = this._elapsedMs + TEASER_MS;
    this.events.emit('tease', {});
  }

  /** The Wyrm of the level, while it fights; null when there is none or it only shows itself. */
  private fightingWorm(): DuneWorm | null {
    return this.showing ? null : this._worm;
  }

  /** The Wyrm moves and acts; flames and blazes against it hurt it. */
  private bossStep(worm: DuneWorm): void {
    // Near the top, the Wyrm slows: the mercy of a calm mode.
    for (const event of worm.update(STEP_MS * this.mercy.pace(this.pressure()))) {
      this.onBoss(event);
    }
    if (this.stormUntil > 0 && this._elapsedMs >= this.stormUntil) {
      this.stormUntil = 0;
      this.grid.calm();
      this.events.emit('wind', { phase: 'end', direction: 1 });
    }
    if (this._worm !== worm || !worm.out || !this.isRunning() || this.showing) return;
    // Only the grains around its body matter: a box around it, not the whole board.
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
    if (worm.hit(hit) > 0) for (const event of worm.drain()) this.onBoss(event);
  }

  private onBoss(event: WormEvent): void {
    this.events.emit('boss', { event });
    if (event.type === 'storm') {
      // The sandstorm of its last phase: a gust, as the wind blows in Sand.
      this.grid.resetDrift();
      this.grid.blow(event.direction);
      this.stormUntil = this._elapsedMs + WIND_GUST_MS;
      this.events.emit('wind', { phase: 'start', direction: event.direction });
    } else if (event.type === 'defeated' && !this.showing) {
      this.reachGoal();
    }
  }

  // --- Scoring ------------------------------------------------------------------

  /** Destroying sand with an element scores half a clear: elements help, linking wins. */
  private elementPoints(grains: number, rate = 0.5): number {
    return Math.round(grains * rate);
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
      this.streak.feed();
      this.events.emit('burn', { grains: removed.length, points, samples });
      return;
    }
    if (FEEDING.has(kind) && removed.length > 0) this.streak.feed();
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

  /** The column a lightning piece strikes down (grains), and the row the bolt leaves it from. */
  private boltOf(shape: Shape, x: number, y: number): [number, number] {
    const g = GRAINS_PER_CELL;
    const cells = shape.cells;
    const centre = cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length;
    const column = Math.floor(centre);
    const own = cells.filter((cell) => cell.x === column);
    const bottom = Math.max(...(own.length > 0 ? own : cells).map((cell) => cell.y)) + 1;
    return [x + Math.floor(centre * g), y + bottom * g];
  }

  private strike(shape: Shape, x: number, y: number): void {
    const [boltX, boltY] = this.boltOf(shape, x, y);
    const worm = this.fightingWorm();
    if (worm?.exposed && Math.abs(worm.headX - boltX) < BOLT_REACH) {
      // On the Wyrm's bare head: its weak point takes the whole bolt.
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
    if (strike.removed.length > 0) this.streak.feed();
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
    this.cells = null;
    const points = Math.round(region.length / 2);
    this._score += points;
    this.streak.feed();
    this.events.emit('burn', { grains: region.length, points, samples });
  }

  /**
   * Where a fire piece put at this cell comes to rest (it falls through
   * what is open), and what it burns there: oil near it first, else the
   * region of sand it touches most (below or on a side), at most
   * `DUNES_FIRE_MAX` grains.
   */
  private fireTarget(
    shape: Shape,
    cx: number,
    cy: number,
  ): { kind: 'oil' | 'sand'; region: number[] } | null {
    const g = GRAINS_PER_CELL;
    const left = cx * g;
    let top = cy * g;
    while (this.footprintOpen(shape, left, top + 1)) top++;
    const { grid } = this;
    const W = grid.width;
    const own = new Set<number>();
    for (const cell of shape.cells) {
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const gx = left + cell.x * g + x;
          const gy = top + cell.y * g + y;
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
    return best ? { kind: 'sand', region: best.slice(0, DUNES_FIRE_MAX) } : null;
  }

  /** Every grain of the shape's cells, its top-left corner at (x, y) in grains, is open. */
  private footprintOpen(shape: Shape, x: number, y: number): boolean {
    const g = GRAINS_PER_CELL;
    for (const cell of shape.cells) {
      for (let gy = y + cell.y * g; gy < y + cell.y * g + g; gy++) {
        for (let gx = x + cell.x * g; gx < x + cell.x * g + g; gx++) {
          if (!this.grid.isOpen(gx, gy)) return false;
        }
      }
    }
    return true;
  }

  /** Regions cleared in danger count double: the rescue is a feat. */
  private closeCall(points: number): void {
    this._score += points;
    this.events.emit('closeCall', { points });
    this.events.emit('notice', { id: 'closeCall', value: points });
  }

  /** Regions of one colour linking the walls vanish; returns true when some did. */
  private clearSpanning(): boolean {
    const regions = this.grid.spanningRegions();
    if (regions.length === 0) return false;
    const all = regions.flat();
    const samples = this.sampler.standing(all);
    const worm = this.fightingWorm();
    if (worm?.touchesAny(all, 1)) this.hurtBoss(worm, 'link');
    // Measured before the clear: regions cleared with the board this full are a close call.
    const tense = inDanger(this.pressure());
    this.grid.remove(all);
    this.cells = null;
    const multiplier = this.streak.clear();
    const points = Math.round(all.length * regions.length * multiplier);
    this._score += points;
    this._clears += regions.length;
    this._levelClears += regions.length;
    this.events.emit('clear', {
      regions: regions.length,
      grains: all.length,
      points,
      multiplier,
      samples,
    });
    if (tense) this.closeCall(points);
    return true;
  }

  private finish(): void {
    if (this._state === 'over') return;
    this._overReason = 'blockOut';
    this.grid.calm();
    this.setState('over');
    this.events.emit('over', { reason: 'blockOut' });
  }

  private isRunning(): boolean {
    return this._state === 'running';
  }

  private setState(state: DunesState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
