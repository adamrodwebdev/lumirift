import { Emitter } from '@/core/Emitter';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import { inDanger } from '@/session/Tension';
import type { RandomSource } from '@/core/Random';
import { JOKER_IDS, JOKERS, type JokerId, type JokerTarget } from '../jokers/Joker';
import { CeramicGolem, type GolemEvent, type GolemSnapshot } from './CeramicGolem';
import { CUBE, Dealer, HAND_SIZE, type OfferedPiece } from './Dealer';
import { Tone } from '@/core/Tone';
import { Grid, type Lines, type RemovedTile } from './Grid';
import type { Cell, Shape } from './Shape';

export type MosaicState = 'ready' | 'running' | 'paused' | 'over';
export type MosaicOverReason = 'noMoves' | 'timeUp' | 'victory';
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
  /** Cleared in danger: these points again, as a bonus (see `Tension`). */
  closeCall: { readonly points: number };
  clear: {
    readonly lines: number;
    readonly rows: readonly number[];
    readonly columns: readonly number[];
    readonly removed: readonly RemovedTile[];
    /** Stones of the Golem the clear cracked (they stay, cracked). */
    readonly cracked: readonly Cell[];
    readonly points: number;
    readonly streak: number;
  };
  /** The board is empty after a clear. */
  perfect: { readonly points: number };
  /** A second chance: the fullest lines vanished instead of the game ending. */
  rescue: { readonly lines: number };
  /** A lost game continues (1.31): the fullest rows blew away, these tiles with them. */
  revive: { readonly removed: readonly RemovedTile[] };
  jokerGained: { readonly joker: JokerId };
  jokerUsed: { readonly joker: JokerId };
  bomb: { readonly x: number; readonly y: number; readonly removed: readonly RemovedTile[] };
  turn: { readonly slot: SlotId };
  undo: Readonly<Record<string, never>>;
  /** What the Guardian of a boss level did. */
  boss: { readonly event: GolemEvent };
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
  readonly golem: GolemSnapshot | null;
}

export interface MosaicOptions {
  readonly random: RandomSource;
  readonly timeLimitMs?: number | null;
  readonly grid?: Grid;
  /** Campaign upgrades (none by default). */
  readonly boosts?: Boosts;
  /** The Ceramic Golem to defeat (the boss level of the Mosaics). */
  readonly boss?: 'ceramicGolem';
  /** The Golem's health, when not a full one (a rematch, 1.38). */
  readonly bossHealth?: number;
  /** The first hand, whatever the dealer would draw (a staged moment). */
  readonly opening?: readonly OpeningPiece[];
}

/** A piece of the first hand, given. */
export interface OpeningPiece {
  readonly shape: Shape;
  readonly tone: Tone;
}

/** Jokers the start-jokers upgrade adds, in this order. */
const START_JOKERS: readonly JokerId[] = ['bomb', 'reroll', 'rotate'];

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
  /** The Guardian of a boss level, or null. */
  readonly golem: CeramicGolem | null;

  private readonly dealer: Dealer;
  private readonly timeLimitMs: number | null;
  private hand: (OfferedPiece | null)[] = [null, null, null];
  private bonus: OfferedPiece | null = null;
  /** Every game starts with one undo: a first mistake is forgiven. */
  private inventory: JokerId[] = ['undo'];
  private readonly boosts: Boosts;
  /** The second chance has not been used yet. */
  private rescueReady: boolean;
  private history: Snapshot | null = null;
  /** The first hand to deal, if one is given; dealt once. */
  private opening: readonly OpeningPiece[] | null;
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
    this.opening = options.opening ?? null;
    this.boosts = options.boosts ?? NO_BOOSTS;
    this.rescueReady = this.boosts.rescueRows > 0;
    for (const joker of START_JOKERS.slice(0, this.boosts.startJokers)) this.inventory.push(joker);
    this.inventory.sort((a, b) => JOKER_IDS.indexOf(a) - JOKER_IDS.indexOf(b));
    this.timeLimitMs = options.timeLimitMs ?? null;
    this.golem =
      options.boss === 'ceramicGolem'
        ? new CeramicGolem(this.grid, options.random, options.bossHealth)
        : null;
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
    this.golem?.start();
    this.flushBoss();
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

  /** The game ran out of moves: a continue can bring it back. */
  get revivable(): boolean {
    return this._state === 'over' && this._overReason === 'noMoves';
  }

  /**
   * A lost game continues (the rewarded continue, 1.31): the `lines` fullest
   * rows blow away, more while no piece of the hand has room, and play goes
   * on with the same hand.
   */
  revive(lines: number): void {
    if (!this.revivable) return;
    const rows = this.fullestRows();
    const removed: RemovedTile[] = [];
    for (let count = 0; count < rows.length && (count < lines || !this.anyPieceFits()); count++) {
      removed.push(...this.grid.clearLines({ rows: [rows[count]!], columns: [] }));
    }
    this.history = null;
    this._overReason = null;
    this.setState('running');
    this.events.emit('revive', { removed });
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
    this.golem?.placed(cells);
    this.resolveLines();
    if (this.golem) {
      this.golem.endTurn();
      this.flushBoss();
      if (this.golem.defeated) {
        this.finish('victory');
        return true;
      }
    }

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
    if (this.golem && snapshot.golem) this.golem.restore(snapshot.golem);
    this.history = null;
    this.events.emit('undo', {});
    this.events.emit('deal', { hand: [...this.hand] });
  }

  giveCube(): void {
    this.bonus = this.dealer.piece(CUBE);
  }

  // --- Internals ------------------------------------------------------------

  /** How full the board is (0 to 1): a full tray is the danger of the Mosaic. */
  pressure(): number {
    return this.grid.tileCount() / (this.grid.size * this.grid.size);
  }

  /** Lines cleared on a nearly full board count double: the rescue is a feat. */
  private closeCall(points: number): void {
    this._score += points;
    this.events.emit('closeCall', { points });
  }

  private resolveLines(): void {
    const lines = this.grid.fullLines();
    const count = lines.rows.length + lines.columns.length;
    if (count === 0) {
      if (++this.misses >= COMBO_GRACE) this._streak = 0;
      return;
    }
    // Measured before the clear: lines cleared on a board this full are a close call.
    const tense = inDanger(this.pressure());
    const cracked: Cell[] = [];
    const removed = this.grid.clearLines(lines, cracked);
    this.misses = 0;
    this._streak++;
    this._bestStreak = Math.max(this._bestStreak, this._streak);
    const points = Math.round(
      linePoints(count) * comboMultiplier(this._streak) * (1 + this.boosts.scoreBonus),
    );
    const linesBefore = this._lines;
    this._score += points;
    this._lines += count;
    this.events.emit('clear', {
      lines: count,
      ...lines,
      removed,
      cracked,
      points,
      streak: this._streak,
    });
    if (tense) this.closeCall(points);

    const perfect = this.grid.isEmpty();
    if (perfect) {
      this._score += PERFECT_BONUS;
      this.events.emit('perfect', { points: PERFECT_BONUS });
    }
    const shattered = removed.filter((tile) => tile.tone === Tone.CrackedStone).length;
    this.golem?.struck(count, this._streak, shattered, perfect);
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
    const opening = this.opening;
    this.opening = null;
    this.hand = opening
      ? Array.from({ length: HAND_SIZE }, (_, i) => {
          const given = opening[i];
          return given ? this.dealer.piece(given.shape, given.tone) : null;
        })
      : this.dealer.hand(this.grid, this.handsPlayed);
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
    const help = this.inventory.some((joker) => JOKERS[joker].canHelp(this));
    if (this.anyPieceFits() || help) return;
    if (this.rescueReady) {
      this.rescue();
      return;
    }
    this.finish('noMoves');
  }

  /**
   * The second chance (campaign upgrade), once per game: the fullest rows
   * vanish (half as many as the rows of the falling family).
   */
  private rescue(): void {
    this.rescueReady = false;
    const rows = this.fullestRows().slice(0, Math.max(1, Math.round(this.boosts.rescueRows / 2)));
    // Not a clear: it scores nothing and does not count towards objectives.
    this.grid.clearLines({ rows, columns: [] });
    this.history = null;
    this.events.emit('rescue', { lines: rows.length });
    this.checkMoves();
  }

  /** A piece in hand has room somewhere on the board. */
  private anyPieceFits(): boolean {
    return this.pieces().some(({ piece }) => this.grid.fitsAnywhere(piece.shape));
  }

  /** The rows of the board, the fullest first. */
  private fullestRows(): number[] {
    const size = this.grid.size;
    const fill = (y: number) => {
      let taken = 0;
      for (let x = 0; x < size; x++) if (!this.grid.isFree(x, y)) taken++;
      return taken;
    };
    return Array.from({ length: size }, (_, y) => y).sort((a, b) => fill(b) - fill(a));
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
      golem: this.golem?.snapshot() ?? null,
    };
  }

  /** Publishes what the Golem did. */
  private flushBoss(): void {
    if (!this.golem) return;
    for (const event of this.golem.drain()) this.events.emit('boss', { event });
  }

  private setState(state: MosaicState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
