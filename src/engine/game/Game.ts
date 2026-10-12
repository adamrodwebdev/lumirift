import { Board, type ClearedRow } from '../board/Board';
import { Emitter } from '../core/Emitter';
import type { RandomSource } from '../core/Random';
import type { GameMode } from '../modes/GameMode';
import { Bag } from '../pieces/Bag';
import { Piece } from '../pieces/Piece';
import type { PieceType, RotationDirection, Tone } from '../pieces/PieceType';
import { kickOffsets } from '../pieces/Shapes';
import { GravityCurve } from '../rules/GravityCurve';
import { Scoring } from '../rules/Scoring';
import type { GameEventMap, GameOverReason, GameState } from './GameEvents';

export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const PREVIEW_COUNT = 3;

/** A piece waiting in the queue or in the hold slot. */
export interface PieceSpec {
  readonly type: PieceType;
  readonly tone: Tone;
}

export interface GameOptions {
  readonly random: RandomSource;
  readonly startLevel?: number;
  readonly board?: Board;
}

/**
 * One game: owns the well, the falling piece and the score, and applies the
 * rules frame by frame. Input calls the intention methods (`moveLeft`,
 * `rotate`, `hardDrop`…); modes use the public hooks (`raiseGarbage`,
 * `flipWell`, `finish`).
 */
export class Game {
  readonly board: Board;
  readonly events = new Emitter<GameEventMap>();
  readonly random: RandomSource;

  private readonly bag: Bag;
  private readonly scoring: Scoring;
  private readonly gravity = new GravityCurve();
  private readonly startLevel: number;
  private readonly upcoming: PieceSpec[] = [];

  private _state: GameState = 'ready';
  private _overReason: GameOverReason | null = null;
  private _active: Piece | null = null;
  private _held: PieceSpec | null = null;
  private _canHold = true;
  private _score = 0;
  private _lines = 0;
  private _level: number;
  private _combo = -1;
  private _elapsedMs = 0;

  private softDropping = false;
  private fallAccumulator = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;

  constructor(
    readonly mode: GameMode,
    options: GameOptions,
  ) {
    this.random = options.random;
    this.board = options.board ?? new Board();
    this.bag = new Bag(this.random);
    this.scoring = new Scoring(mode.scoresPureLines);
    this.startLevel = options.startLevel ?? 1;
    this._level = this.startLevel;
    mode.attach(this);
  }

  // --- Read model -----------------------------------------------------------

  get state(): GameState {
    return this._state;
  }
  get overReason(): GameOverReason | null {
    return this._overReason;
  }
  get active(): Piece | null {
    return this._active;
  }
  get held(): PieceSpec | null {
    return this._held;
  }
  get canHold(): boolean {
    return this._canHold;
  }
  get score(): number {
    return this._score;
  }
  get lines(): number {
    return this._lines;
  }
  get level(): number {
    return this._level;
  }
  get combo(): number {
    return Math.max(this._combo, 0);
  }
  get elapsedMs(): number {
    return this._elapsedMs;
  }

  /** The next pieces, in order. */
  preview(count = PREVIEW_COUNT): readonly PieceSpec[] {
    this.fillQueue(count);
    return this.upcoming.slice(0, count);
  }

  /** How many rows the active piece can still fall. */
  dropDistance(): number {
    const piece = this._active;
    if (!piece) return 0;
    let distance = 0;
    while (this.board.fits(piece, 0, distance + 1)) distance++;
    return distance;
  }

  // --- Lifecycle ------------------------------------------------------------

  start(): void {
    if (this._state !== 'ready') return;
    this.setState('running');
    this.spawnNext();
  }

  pause(): void {
    if (this._state === 'running') this.setState('paused');
  }

  resume(): void {
    if (this._state === 'paused') this.setState('running');
  }

  /** Advances the simulation; call once per frame with the elapsed time. */
  update(deltaMs: number): void {
    if (this._state !== 'running') return;
    this._elapsedMs += deltaMs;
    this.mode.update(this, deltaMs);
    // The mode may have ended the game (time limit, top out).
    if (!this.canAct() || !this._active) return;
    // The lock delay starts on the frame after landing, never on the landing frame.
    if (!this.applyGravity(deltaMs)) this.applyLockDelay(deltaMs);
  }

  /** Ends the game (time limit, top out…). */
  finish(reason: GameOverReason): void {
    if (this._state === 'over') return;
    this._overReason = reason;
    this._active = null;
    this.setState('over');
    this.events.emit('over', { reason });
  }

  // --- Player intentions ----------------------------------------------------

  moveLeft(): boolean {
    return this.shift(-1);
  }

  moveRight(): boolean {
    return this.shift(1);
  }

  setSoftDrop(active: boolean): void {
    this.softDropping = active;
  }

  hardDrop(): void {
    if (!this.canAct() || !this._active) return;
    const distance = this.dropDistance();
    this._active = this._active.moved(0, distance);
    this._score += this.scoring.hardDrop(distance);
    this.lockActive();
  }

  rotate(direction: RotationDirection): boolean {
    const piece = this._active;
    if (!this.canAct() || !piece) return false;
    const rotated = piece.rotated(direction);
    for (const kick of kickOffsets(piece.type, piece.rotation, rotated.rotation)) {
      if (this.board.fits(rotated, kick.x, kick.y)) {
        this.place(rotated.moved(kick.x, kick.y));
        return true;
      }
    }
    return false;
  }

  hold(): boolean {
    const piece = this._active;
    if (!this.canAct() || !piece || !this._canHold) return false;
    const previous = this._held;
    this._held = { type: piece.type, tone: piece.tone };
    this._canHold = false;
    this.events.emit('hold', { type: piece.type });
    if (previous) this.spawn(previous);
    else this.spawnNext();
    return true;
  }

  useAbility(): boolean {
    return this.canAct() && this.mode.useAbility(this);
  }

  // --- Hooks for game modes -------------------------------------------------

  /** Pushes a garbage row in from the bottom, with a single hole. */
  raiseGarbage(holeX: number): void {
    if (this._state === 'over') return;
    const overflow = this.board.pushGarbageRow(holeX);
    this.events.emit('garbage', { rows: 1 });
    if (overflow || !this.liftActiveUntilItFits()) this.finish('topOut');
  }

  /** Turns the well upside down; blocks settle and full rows clear in cascade. */
  flipWell(): void {
    if (this._state === 'over') return;
    this.board.flipAndSettle();
    const cleared = this.board.clearFullRows();
    this.scoreClear(cleared, true);
    this.events.emit('flip', { lines: cleared.length });
    if (!this.liftActiveUntilItFits()) this.finish('topOut');
  }

  // --- Internals ------------------------------------------------------------

  private canAct(): boolean {
    return this._state === 'running';
  }

  private setState(state: GameState): void {
    this._state = state;
    this.events.emit('state', { state });
  }

  private shift(dx: number): boolean {
    const piece = this._active;
    if (!this.canAct() || !piece || !this.board.fits(piece, dx, 0)) return false;
    this.place(piece.moved(dx, 0));
    return true;
  }

  /** Accepts a successful move or rotation, applying the lock-delay reset rule. */
  private place(piece: Piece): void {
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

  /** Lets the piece fall; returns true when it moved down this frame. */
  private applyGravity(deltaMs: number): boolean {
    const interval = this.softDropping
      ? this.gravity.softDropIntervalMs(this._level)
      : this.gravity.rowIntervalMs(this._level);
    let fell = false;
    this.fallAccumulator += deltaMs;
    while (this.fallAccumulator >= interval && this._active) {
      this.fallAccumulator -= interval;
      if (!this.board.fits(this._active, 0, 1)) {
        this.fallAccumulator = 0;
        break;
      }
      this.place(this._active.moved(0, 1));
      fell = true;
      if (this.softDropping) this._score += this.scoring.softDrop(1);
    }
    return fell;
  }

  private applyLockDelay(deltaMs: number): void {
    const piece = this._active;
    if (!piece) return;
    if (this.board.fits(piece, 0, 1)) {
      this.lockTimer = 0;
      return;
    }
    this.lockTimer += deltaMs;
    if (this.lockTimer >= LOCK_DELAY_MS || this.lockResets >= MAX_LOCK_RESETS) {
      this.lockActive();
    }
  }

  private lockActive(): void {
    const piece = this._active;
    if (!piece) return;
    const visible = this.board.lock(piece);
    this._active = null;
    this.events.emit('lock', { piece });
    const cleared = this.board.clearFullRows();
    this.scoreClear(cleared, false);
    if (!visible && cleared.length === 0) {
      this.finish('lockOut');
      return;
    }
    this._canHold = true;
    this.spawnNext();
  }

  private scoreClear(cleared: readonly ClearedRow[], cascade: boolean): void {
    if (cleared.length === 0) {
      if (!cascade) this._combo = -1;
      return;
    }
    this._combo++;
    const lines = cleared.length;
    const pureLines = cleared.filter((row) => row.pure).length;
    const combo = this._combo;
    const points = this.scoring.clear({ lines, pureLines, level: this._level, combo });
    this._score += points;
    this._lines += lines;
    this.events.emit('clear', { lines, pureLines, points, combo, cascade });

    const level = this.gravity.levelFor(this.startLevel, this._lines);
    if (level > this._level) {
      this._level = level;
      this.events.emit('levelUp', { level });
    }
  }

  private spawnNext(): void {
    this.fillQueue(1);
    this.spawn(this.upcoming.shift()!);
  }

  private spawn(spec: PieceSpec): void {
    if (this._state === 'over') return;
    let piece = Piece.spawn(spec.type, spec.tone, this.board.width);
    if (!this.board.fits(piece)) {
      this.finish('blockOut');
      return;
    }
    // Pieces enter the visible well right away when there is room.
    if (this.board.fits(piece, 0, 1)) piece = piece.moved(0, 1);
    this._active = piece;
    this.lowestY = piece.y;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.fallAccumulator = 0;
    this.events.emit('spawn', { piece });
  }

  private fillQueue(count: number): void {
    while (this.upcoming.length < count) {
      const type = this.bag.next();
      this.upcoming.push({ type, tone: this.mode.toneFor(type, this.random) });
    }
  }

  /** After the stack moved under it, nudges the active piece up until it fits. */
  private liftActiveUntilItFits(): boolean {
    let piece = this._active;
    if (!piece) return true;
    while (!this.board.fits(piece)) {
      if (piece.y < -1) return false;
      piece = piece.moved(0, -1);
    }
    this._active = piece;
    this.lowestY = Math.min(this.lowestY, piece.y);
    return true;
  }
}
