import { Emitter } from '@/core/Emitter';
import type { RandomSource } from '@/core/Random';
import { JOKER_IDS, JOKERS, type JokerId, type JokerTarget } from '../jokers/Joker';
import { CUBE, Dealer, type OfferedPiece } from './Dealer';
import { Grid, type Lines, type RemovedTile } from './Grid';
import type { Cell } from './Shape';

export type MosaicState = 'ready' | 'running' | 'paused' | 'over';
export type MosaicOverReason = 'noMoves' | 'timeUp';
/** The three pieces of the hand, and the extra slot of the cube joker. */
export type SlotId = 0 | 1 | 2 | 'bonus';

export { HAND_SIZE } from './Dealer';
export const POINTS_PER_TILE = 1;
/** Points of a clear by lines at once: 1 → 10, 2 → 30, 3 → 60, 4 → 100, 5 → 150, then +60 each. */
export const linePoints = (lines: number): number =>
  lines <= 0 ? 0 : lines <= 5 ? [0, 10, 30, 60, 100, 150][lines]! : 210 + 60 * (lines - 6);
/** Each clear in a combo adds a quarter to the line points, up to three times. */
export const COMBO_STEP = 0.25;
export const MAX_COMBO_MULTIPLIER = 3;
/** The combo ends after this many placements in a row without a clear (a hand's worth). */
export const COMBO_GRACE = 3;
export const PERFECT_BONUS = 300;
/** At most this many jokers of each kind. */
export const MAX_PER_JOKER = 2;
/** A reroll every this many lines; an undo every this many hands placed in full. */
export const REROLL_EVERY_LINES = 25;
export const UNDO_EVERY_HANDS = 10;
/** A bomb when the combo reaches this. */
export const BOMB_COMBO = 6;

export const comboMultiplier = (combo: number): number =>
  Math.min(MAX_COMBO_MULTIPLIER, 1 + COMBO_STEP * Math.max(0, combo - 1));

export interface MosaicEventMap {
  state: { readonly state: MosaicState };
  deal: { readonly hand: readonly (OfferedPiece | null)[] };
  place: { readonly piece: OfferedPiece; readonly cells: readonly Cell[] };
  clear: {
    readonly lines: number;
    readonly rows: readonly number[];
    readonly columns: readonly number[];
    readonly removed: readonly RemovedTile[];
    readonly points: number;
    readonly streak: number;
  };
  /** The board is empty after a clear. */
  perfect: { readonly points: number };
  jokerGained: { readonly joker: JokerId };
  jokerUsed: { readonly joker: JokerId };
  bomb: { readonly x: number; readonly y: number; readonly removed: readonly RemovedTile[] };
  turn: { readonly slot: SlotId };
  undo: Readonly<Record<string, never>>;
  over: { readonly reason: MosaicOverReason };
}

interface Snapshot {
  readonly grid: Grid;
  readonly hand: readonly (OfferedPiece | null)[];
  readonly bonus: OfferedPiece | null;
  readonly score: number;
  readonly lines: number;
  readonly streak: number;
  readonly misses: number;
  readonly handsPlayed: number;
  readonly jokers: readonly JokerId[];
}

export interface MosaicOptions {
  readonly random: RandomSource;
  readonly timeLimitMs?: number | null;
  readonly grid?: Grid;
}

/**
 * A game of Mosaic: place the offered pieces on an 8 × 8 board; full rows and
 * columns clear; three new pieces come once the three are placed. Clearing
 * well earns jokers. The game ends when no piece fits and no joker can help.
 *
 * Combo: each placement that clears adds one; it survives up to two
 * placements without a clear and multiplies the line points.
 */
export class MosaicGame {
  readonly grid: Grid;
  readonly events = new Emitter<MosaicEventMap>();

  private readonly dealer: Dealer;
  private readonly timeLimitMs: number | null;
  private hand: (OfferedPiece | null)[] = [null, null, null];
  private bonus: OfferedPiece | null = null;
  /** Every game starts with one undo: a first mistake is forgiven. */
  private inventory: JokerId[] = ['undo'];
  private history: Snapshot | null = null;
  private _state: MosaicState = 'ready';
  private _overReason: MosaicOverReason | null = null;
  private _score = 0;
  private _lines = 0;
  private _streak = 0;
  private _bestStreak = 0;
  /** Placements in a row without a clear. */
  private misses = 0;
  private handsPlayed = 0;
  private _elapsedMs = 0;

  constructor(options: MosaicOptions) {
    this.grid = options.grid ?? new Grid();
    this.dealer = new Dealer(options.random);
    this.timeLimitMs = options.timeLimitMs ?? null;
  }

  // --- Read model -----------------------------------------------------------

  get state(): MosaicState {
    return this._state;
  }
  get overReason(): MosaicOverReason | null {
    return this._overReason;
  }
  get score(): number {
    return this._score;
  }
  get lines(): number {
    return this._lines;
  }
  get streak(): number {
    return this._streak;
  }
  get bestStreak(): number {
    return this._bestStreak;
  }
  get elapsedMs(): number {
    return this._elapsedMs;
  }
  get timeLeftMs(): number | null {
    return this.timeLimitMs === null ? null : Math.max(0, this.timeLimitMs - this._elapsedMs);
  }
  get jokers(): readonly JokerId[] {
    return this.inventory;
  }
  get canUndo(): boolean {
    return this.history !== null;
  }

  pieceAt(slot: SlotId): OfferedPiece | null {
    return slot === 'bonus' ? this.bonus : (this.hand[slot] ?? null);
  }

  /** The pieces still to place, with their slots. */
  pieces(): { slot: SlotId; piece: OfferedPiece }[] {
    const slots: SlotId[] = [0, 1, 2, 'bonus'];
    return slots.flatMap((slot) => {
      const piece = this.pieceAt(slot);
      return piece ? [{ slot, piece }] : [];
    });
  }

  /** The rows and columns a placement would clear, for the preview. */
  linesIfPlaced(slot: SlotId, x: number, y: number): Lines {
    const piece = this.pieceAt(slot);
    return piece ? this.grid.linesIfPlaced(piece.shape, x, y) : { rows: [], columns: [] };
  }

  canPlace(slot: SlotId, x: number, y: number): boolean {
    const piece = this.pieceAt(slot);
    return this._state === 'running' && piece !== null && this.grid.fits(piece.shape, x, y);
  }

  // --- Lifecycle ------------------------------------------------------------

  start(): void {
    if (this._state !== 'ready') return;
    this.setState('running');
    this.dealHand();
  }

  pause(): void {
    if (this._state === 'running') this.setState('paused');
  }

  resume(): void {
    if (this._state === 'paused') this.setState('running');
  }

  update(deltaMs: number): void {
    if (this._state !== 'running') return;
    this._elapsedMs += deltaMs;
    if (this.timeLimitMs !== null && this._elapsedMs >= this.timeLimitMs) this.finish('timeUp');
  }

  finish(reason: MosaicOverReason): void {
    if (this._state === 'over') return;
    this._overReason = reason;
    this.setState('over');
    this.events.emit('over', { reason });
  }

  // --- Player intentions ----------------------------------------------------

  place(slot: SlotId, x: number, y: number): boolean {
    const piece = this.pieceAt(slot);
    if (!piece || !this.canPlace(slot, x, y)) return false;
    this.history = this.snapshot();

    const cells = this.grid.place(piece.shape, x, y, piece.tone);
    this.take(slot);
    this._score += piece.shape.size * POINTS_PER_TILE;
    this.events.emit('place', { piece, cells });
    this.resolveLines();

    if (this.hand.every((held) => held === null)) {
      this.handsPlayed++;
      if (this.handsPlayed % UNDO_EVERY_HANDS === 0) this.earnJoker('undo');
      this.dealHand();
    }
    this.checkMoves();
    return true;
  }

  useJoker(index: number, target: JokerTarget = {}): boolean {
    const id = this.inventory[index];
    if (this._state !== 'running' || id === undefined) return false;
    const joker = JOKERS[id];
    if (!joker.canUse(this, target)) return false;
    // Restore the jokers of the snapshot only for an undo: it must not give back
    // a joker earned by the placement it cancels.
    const undoing = id === 'undo';
    this.inventory.splice(index, 1);
    joker.use(this, target);
    if (undoing) this.removeOne('undo');
    else this.history = null;
    this.events.emit('jokerUsed', { joker: id });
    this.checkMoves();
    return true;
  }

  // --- Hooks for the jokers -------------------------------------------------

  turnPiece(slot: SlotId): void {
    const piece = this.pieceAt(slot);
    if (!piece) return;
    const turned = this.dealer.turned(piece);
    if (slot === 'bonus') this.bonus = turned;
    else this.hand[slot] = turned;
    this.events.emit('turn', { slot });
  }

  redeal(): void {
    this.dealHand();
  }

  bomb(x: number, y: number): void {
    const removed = this.grid.clearArea(x, y);
    this.events.emit('bomb', { x, y, removed });
  }

  undo(): void {
    const snapshot = this.history;
    if (!snapshot) return;
    this.grid.restore(snapshot.grid);
    this.hand = [...snapshot.hand];
    this.bonus = snapshot.bonus;
    this._score = snapshot.score;
    this._lines = snapshot.lines;
    this._streak = snapshot.streak;
    this.misses = snapshot.misses;
    this.handsPlayed = snapshot.handsPlayed;
    this.inventory = [...snapshot.jokers];
    this.history = null;
    this.events.emit('undo', {});
    this.events.emit('deal', { hand: [...this.hand] });
  }

  giveCube(): void {
    this.bonus = this.dealer.piece(CUBE);
  }

  // --- Internals ------------------------------------------------------------

  private resolveLines(): void {
    const lines = this.grid.fullLines();
    const count = lines.rows.length + lines.columns.length;
    if (count === 0) {
      if (++this.misses >= COMBO_GRACE) this._streak = 0;
      return;
    }
    const removed = this.grid.clearLines(lines);
    this.misses = 0;
    this._streak++;
    this._bestStreak = Math.max(this._bestStreak, this._streak);
    const points = Math.round(linePoints(count) * comboMultiplier(this._streak));
    const linesBefore = this._lines;
    this._score += points;
    this._lines += count;
    this.events.emit('clear', { lines: count, ...lines, removed, points, streak: this._streak });

    const perfect = this.grid.isEmpty();
    if (perfect) {
      this._score += PERFECT_BONUS;
      this.events.emit('perfect', { points: PERFECT_BONUS });
    }
    // Each feat earns its own joker: the bigger the feat, the stronger the joker.
    if (count === 2) this.earnJoker('rotate');
    else if (count === 3) this.earnJoker('cube');
    else if (count >= 4) this.earnJoker('bomb');
    if (this._streak === BOMB_COMBO) this.earnJoker('bomb');
    if (Math.floor(this._lines / REROLL_EVERY_LINES) > Math.floor(linesBefore / REROLL_EVERY_LINES))
      this.earnJoker('reroll');
    if (perfect) this.earnJoker('undo');
  }

  private earnJoker(joker: JokerId): void {
    if (this.inventory.filter((held) => held === joker).length >= MAX_PER_JOKER) return;
    // Kept in a fixed order, so that the bar never reshuffles.
    this.inventory.push(joker);
    this.inventory.sort((a, b) => JOKER_IDS.indexOf(a) - JOKER_IDS.indexOf(b));
    this.events.emit('jokerGained', { joker });
  }

  private dealHand(): void {
    this.hand = this.dealer.hand(this.grid, this.handsPlayed);
    this.events.emit('deal', { hand: [...this.hand] });
  }

  private take(slot: SlotId): void {
    if (slot === 'bonus') this.bonus = null;
    else this.hand[slot] = null;
  }

  private removeOne(joker: JokerId): void {
    const index = this.inventory.indexOf(joker);
    if (index >= 0) this.inventory.splice(index, 1);
  }

  /** Over when no piece fits and no joker could change that. */
  private checkMoves(): void {
    if (this._state !== 'running') return;
    const fits = this.pieces().some(({ piece }) => this.grid.fitsAnywhere(piece.shape));
    const help = this.inventory.some((joker) => JOKERS[joker].canHelp(this));
    if (!fits && !help) this.finish('noMoves');
  }

  private snapshot(): Snapshot {
    return {
      grid: this.grid.clone(),
      hand: [...this.hand],
      bonus: this.bonus,
      score: this._score,
      lines: this._lines,
      streak: this._streak,
      misses: this.misses,
      handsPlayed: this.handsPlayed,
      jokers: [...this.inventory],
    };
  }

  private setState(state: MosaicState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
