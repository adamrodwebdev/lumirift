import { Board, type ClearedRow, type RemovedCell } from '../board/Board';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import { Mercy } from '@/session/Mercy';
import { inDanger } from '@/session/Tension';
import { Emitter } from '@/core/Emitter';
import type { RandomSource } from '@/core/Random';
import type { GameMode } from '../modes/GameMode';
import { Bag } from '../pieces/Bag';
import { Piece } from '../pieces/Piece';
import type { PieceType, RotationDirection, Tone } from '../pieces/PieceType';
import { kickOffsets, type Cell } from '../pieces/Shapes';
import { GravityCurve } from '../rules/GravityCurve';
import { Scoring } from '../rules/Scoring';
import type { GameEventMap, GameOverReason, GameState } from './GameEvents';

export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const PREVIEW_COUNT = 3;

/** The ends a continue can undo: the stack overflowing, never the clock or a won game. */
const REVIVABLE: ReadonlySet<GameOverReason> = new Set(['blockOut', 'lockOut', 'topOut']);

/** A piece waiting in the queue or in the hold slot. */
/** Points for each block a bomb blows away (times the level). */
export const BLAST_POINTS = 40;

export interface PieceSpec {
  readonly type: PieceType;
  readonly tone: Tone;
  /** Cell carrying a bomb gem (index in the spawn orientation), if any. */
  readonly bomb?: number;
}

export interface GameOptions {
  readonly random: RandomSource;
  readonly startLevel?: number;
  readonly board?: Board;
  /**
   * Pause between a line clear and the next piece, so the destruction can be seen.
   * It is part of the rules (the same whatever the effect settings), 0 by default.
   */
  readonly lineClearDelayMs?: number;
  /** Campaign upgrades (none by default). */
  readonly boosts?: Boosts;
  /** The early campaign's mercy: the fall slows near the top (none by default). */
  readonly mercy?: Mercy;
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
  private readonly lineClearDelayMs: number;
  private readonly boosts: Boosts;
  private readonly mercy: Mercy;
  /** The second chance has not been used yet. */
  private rescueReady: boolean;

  private _state: GameState = 'ready';
  private _overReason: GameOverReason | null = null;
  private _active: Piece | null = null;
  private _held: PieceSpec | null = null;
  /** Pieces dealt so far (the mode decides the bombs from it). */
  private dealt = 0;
  /** Locks so far: the blast preview is valid until the next one. */
  private lockCount = 0;
  private bombAnnounced = false;
  private previewCache: { key: string; cells: readonly RemovedCell[] } = { key: '', cells: [] };
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
  /** Time left before the next piece appears, after a line clear. */
  private spawnDelay = 0;
  /**
   * Around a cylinder (the Tower), where the next piece appears: above the
   * place the last one landed, so that the view stays where the player plays.
   */
  private spawnCentre: number | null = null;
  /** Something was destroyed by the last lock: the next piece waits for the effects. */
  private pauseAfterLock = false;
  /** The piece that found no room to enter: a continued game deals it first. */
  private blocked: PieceSpec | null = null;
  /** A continued game waits for the player's first move before anything falls again. */
  private waiting = false;

  constructor(
    readonly mode: GameMode,
    options: GameOptions,
  ) {
    this.random = options.random;
    this.board =
      options.board ??
      new Board(mode.well.width, mode.well.height, Board.HIDDEN_ROWS, mode.well.wraps ?? false);
    this.bag = new Bag(this.random);
    this.scoring = new Scoring(mode.scoresPureLines);
    this.startLevel = options.startLevel ?? 1;
    this._level = this.startLevel;
    this.lineClearDelayMs = options.lineClearDelayMs ?? 0;
    this.boosts = options.boosts ?? NO_BOOSTS;
    this.mercy = options.mercy ?? Mercy.NONE;
    this.rescueReady = this.boosts.rescueRows > 0;
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
  preview(count = PREVIEW_COUNT + this.boosts.extraPreview): readonly PieceSpec[] {
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
    if (this._state !== 'running') return;
    // A key held when the game paused must not keep the piece dropping on resume.
    this.softDropping = false;
    this.setState('paused');
  }

  resume(): void {
    if (this._state === 'paused') this.setState('running');
  }

  /** Advances the simulation; call once per frame with the elapsed time. */
  update(deltaMs: number): void {
    if (this._state !== 'running' || this.waiting) return;
    this._elapsedMs += deltaMs;
    this.mode.update(this, deltaMs);
    // The mode may have ended the game (time limit, top out).
    if (!this.canAct()) return;
    if (this.spawnDelay > 0) {
      this.spawnDelay -= deltaMs;
      if (this.spawnDelay <= 0) {
        this.spawnDelay = 0;
        this.spawnNext();
      }
      return;
    }
    if (!this._active) return;
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

  /** The game was lost to its stack, in a mode that clears lines: a continue can bring it back. */
  get revivable(): boolean {
    const reason = this._overReason;
    return (
      this._state === 'over' && reason !== null && REVIVABLE.has(reason) && this.mode.clearsLines
    );
  }

  /**
   * A lost game continues (the rewarded continue, 1.31): the top `rows` of
   * the stack blow away and play goes on, the piece that could not enter
   * coming first, the hold free again.
   */
  revive(rows: number): void {
    if (!this.revivable) return;
    const cells = this.board.clearTopRows(rows);
    this._overReason = null;
    this._canHold = true;
    this.softDropping = false;
    this.spawnDelay = 0;
    this.waiting = true;
    this.setState('running');
    this.events.emit('revive', { cells });
    const blocked = this.blocked;
    this.blocked = null;
    if (blocked) this.spawn(blocked);
    else this.spawnNext();
  }

  // --- Player intentions ----------------------------------------------------

  moveLeft(): boolean {
    this.wake();
    return this.shift(-1);
  }

  moveRight(): boolean {
    this.wake();
    return this.shift(1);
  }

  setSoftDrop(active: boolean): void {
    if (active) this.wake();
    this.softDropping = active;
  }

  hardDrop(): void {
    this.wake();
    if (!this.canAct() || !this._active) return;
    const distance = this.dropDistance();
    this._active = this._active.moved(0, distance);
    if (this.mode.scoresDrops) this._score += this.scoring.hardDrop(distance);
    this.events.emit('hardDrop', { piece: this._active, distance });
    this.lockActive();
  }

  rotate(direction: RotationDirection): boolean {
    this.wake();
    const piece = this._active;
    if (!this.canAct() || !piece) return false;
    const rotated = piece.rotated(direction);
    for (const kick of kickOffsets(piece.type, piece.rotation, rotated.rotation)) {
      if (this.board.fits(rotated, kick.x, kick.y)) {
        this.place(rotated.moved(kick.x, kick.y));
        this.events.emit('rotate', { piece: this._active!, kicked: kick.x !== 0 || kick.y !== 0 });
        return true;
      }
    }
    return false;
  }

  hold(): boolean {
    this.wake();
    const piece = this._active;
    if (!this.canAct() || !piece || !this._canHold) return false;
    const previous = this._held;
    this._held = {
      type: piece.type,
      tone: piece.tone,
      ...(piece.bomb === null ? {} : { bomb: piece.bomb }),
    };
    this._canHold = false;
    this.events.emit('hold', { type: piece.type });
    if (previous) this.spawn(previous);
    else this.spawnNext();
    return true;
  }

  useAbility(): boolean {
    this.wake();
    return this.canAct() && this.mode.useAbility(this);
  }

  // --- Hooks for game modes -------------------------------------------------

  /** Pushes a garbage row in from the bottom, with a single hole (and a gem, if given). */
  raiseGarbage(holeX: number, gemX: number | null = null): void {
    if (this._state === 'over') return;
    const overflow = this.board.pushGarbageRow(holeX, gemX);
    this.events.emit('garbage', { rows: 1 });
    if (overflow || !this.liftActiveUntilItFits()) this.overflow();
  }

  /** Turns the well upside down; blocks settle and full rows clear in cascade. */
  flipWell(): void {
    if (this._state === 'over') return;
    this.board.flipAndSettle();
    const cleared = this.board.clearFullRows();
    this.scoreClear(cleared, true);
    this.events.emit('flip', { lines: cleared.length });
    if (!this.liftActiveUntilItFits()) this.overflow();
  }

  /** Reflects the well and the falling piece left to right (no collision can appear). */
  mirrorWell(): void {
    if (this._state === 'over') return;
    this.board.mirror();
    if (this._active) this._active = this._active.mirrored(this.board.width);
    this.events.emit('mirror', {});
  }

  /**
   * Removes fused groups of blocks (Fusion), lets the rest settle and clears
   * the rows completed by the fall. `chain` is the rank of this reaction.
   */
  fuse(groups: readonly (readonly Cell[])[], chain: number): void {
    if (this._state === 'over' || groups.length === 0) return;
    const cells = this.board.removeCells(groups.flat());
    const points = this.scoring.fusion(cells.length, chain, this._level);
    this._score += points;
    this.events.emit('fusion', { cells, chain, points });
    this.board.settle();
    const cleared = this.mode.clearsLines ? this.board.clearFullRows() : [];
    this.scoreClear(cleared, true);
    this.pauseAfterLock = true;
    if (!this.liftActiveUntilItFits()) this.overflow();
  }

  /**
   * Turns the well a quarter left (Tilt): the left wall becomes the floor and
   * every column settles. The falling piece goes back to the front of the queue.
   */
  tiltWell(): void {
    if (this._state === 'over') return;
    const piece = this._active;
    if (piece) {
      this.upcoming.unshift({ type: piece.type, tone: piece.tone });
      this._active = null;
    }
    this.board.rotateLeft();
    this.board.settle();
    const cleared = this.mode.clearsLines ? this.board.clearFullRows() : [];
    this.scoreClear(cleared, true);
    this.events.emit('tilt', { lines: cleared.length });
    if (this._state !== 'running' || this.spawnDelay > 0) return;
    if (this.lineClearDelayMs > 0) this.spawnDelay = this.lineClearDelayMs;
    else this.spawnNext();
  }

  /**
   * Drops a stone on top of each of these columns (the Eye of the Tower). The
   * rows they complete clear as a cascade; a stone left in the hidden rows
   * tops the stack out.
   */
  dropStones(columns: readonly number[], tone: Tone): void {
    if (this._state === 'over') return;
    const active = this._active?.cells() ?? [];
    const taken = (x: number, y: number) =>
      active.some((cell) => this.board.column(cell.x) === x && cell.y === y);
    const cells = columns.flatMap((x) => this.board.dropOn(x, tone, taken) ?? []);
    if (cells.length === 0) return;
    this.events.emit('stones', { cells });
    const cleared = this.board.clearFullRows();
    this.scoreClear(cleared, true);
    this.detonate(cleared);
    if (cells.some((cell) => cell.y < this.board.hiddenRows) && cleared.length === 0)
      this.overflow();
  }

  /** Adds or removes points by a mode rule (never below zero). */
  adjustScore(delta: number): void {
    if (this._state === 'over') return;
    this._score = Math.max(0, this._score + delta);
  }

  /** Publishes a beat of the mode's rhythm. */
  beat(count: number): void {
    this.events.emit('beat', { count });
  }

  /** Publishes the groove reached by the last lock. */
  groove(level: number, onBeat: boolean): void {
    this.events.emit('groove', { level, onBeat });
  }

  /** Adds bonus points granted by a mode rule, and announces them. */
  awardPoints(points: number, reason: string): void {
    if (this._state === 'over' || points <= 0) return;
    this._score += points;
    this.notify(reason, points);
  }

  /** Publishes a mode-specific announcement (`notice.<id>` in translations). */
  notify(id: string, value?: number): void {
    this.events.emit('notice', value === undefined ? { id } : { id, value });
  }

  /**
   * Where the next piece would appear, when the well leaves it no room to
   * enter the visible rows: the last warning, drawn on the well. Null while
   * there is room.
   */
  spawnWarning(): readonly Cell[] | null {
    if (this._state !== 'running') return null;
    this.fillQueue(1);
    const spec = this.upcoming[0]!;
    let piece = Piece.spawn(spec.type, spec.tone, this.board.width);
    if (this.spawnCentre !== null) {
      const above = Piece.spawn(spec.type, spec.tone, this.board.width, this.spawnCentre);
      if (this.board.fits(above)) piece = above;
    }
    return this.board.fits(piece, 0, 1) ? null : piece.cells();
  }

  /**
   * The pace of the threats near the top (the fall, the rising rows): 1 at
   * full speed, less where the early campaign shows mercy.
   */
  get mercyPace(): number {
    return this.mercy.pace(this.pressure());
  }

  /** How full the well is: the stack over the visible height (0 to 1). */
  pressure(): number {
    return Math.min(1, this.board.stackHeight() / (this.board.height - this.board.hiddenRows));
  }

  // --- Internals ------------------------------------------------------------

  private canAct(): boolean {
    return this._state === 'running';
  }

  /** The player acts: a continued game that waited for them goes on. */
  private wake(): void {
    if (this._state === 'running') this.waiting = false;
  }

  private setState(state: GameState): void {
    this._state = state;
    this.events.emit('state', { state });
  }

  private shift(dx: number): boolean {
    const piece = this._active;
    if (!this.canAct() || !piece || !this.board.fits(piece, dx, 0)) return false;
    this.place(piece.moved(dx, 0));
    this.events.emit('move', { piece: this._active! });
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
      : this.gravity.rowIntervalMs(this._level) / (this.boosts.gravityScale * this.mercyPace);
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
      if (this.softDropping && this.mode.scoresDrops) this._score += this.scoring.softDrop(1);
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
    const delay = LOCK_DELAY_MS + this.boosts.extraLockDelayMs;
    if (this.lockTimer >= delay || this.lockResets >= MAX_LOCK_RESETS) {
      this.lockActive();
    }
  }

  private lockActive(): void {
    const piece = this._active;
    if (!piece) return;
    const visible = this.board.lock(piece);
    this.lockCount++;
    if (this.board.wraps) this.spawnCentre = this.board.column(Math.floor(piece.centre)) + 0.5;
    this._active = null;
    this.events.emit('lock', { piece });
    // Measured before the clear: lines cleared with the stack this high are a close call.
    const tense = inDanger(this.pressure());
    const cleared = this.mode.clearsLines ? this.board.clearFullRows() : [];
    this.pauseAfterLock = cleared.length > 0;
    const points = this.scoreClear(cleared, false);
    if (tense && points > 0) this.closeCall(points);
    this.detonate(cleared);
    this.mode.afterLock(this);
    if (this._state === 'over') return;
    if (!visible && cleared.length === 0 && !this.rescue()) {
      this.finish('lockOut');
      return;
    }
    this._canHold = true;
    if (this.pauseAfterLock && this.lineClearDelayMs > 0) this.spawnDelay = this.lineClearDelayMs;
    else this.spawnNext();
  }

  /** Lines cleared at the edge of defeat count double: the rescue is a feat. */
  private closeCall(points: number): void {
    this.awardPoints(points, 'closeCall');
    this.events.emit('closeCall', { points });
  }

  /** Scores the rows cleared at once; returns their points. */
  private scoreClear(cleared: readonly ClearedRow[], cascade: boolean): number {
    if (cleared.length === 0) {
      if (!cascade) this._combo = -1;
      return 0;
    }
    this._combo++;
    const lines = cleared.length;
    const pureLines = cleared.filter((row) => row.pure).length;
    const combo = this._combo;
    const base = this.scoring.clear({ lines, pureLines, level: this._level, combo });
    const points = Math.round(
      base * this.mode.clearMultiplier(this) * (1 + this.boosts.scoreBonus),
    );
    this._score += points;
    this._lines += lines;
    this.events.emit('clear', { lines, pureLines, points, combo, cascade, rows: cleared });

    const level = this.gravity.levelFor(this.startLevel, this._lines);
    if (level > this._level) {
      this._level = level;
      this.events.emit('levelUp', { level });
    }
    return points;
  }

  /**
   * The bombs of the cleared rings go off where their ring was: each blows
   * away a sector of the stack around it, and the bombs it catches go off in
   * turn. Every block blown away scores.
   */
  private detonate(cleared: readonly ClearedRow[]): void {
    const blast = this.mode.blast;
    if (!blast) return;
    // Rows above a cleared one moved down by the rows cleared under it.
    for (const row of cleared) {
      const below = cleared.filter((other) => other.index > row.index).length;
      for (const x of row.bombs) {
        const y = row.index + below;
        const { cells, bombs } = this.board.blast(x, y, blast.radius, blast.above, blast.below);
        if (cells.length === 0 && bombs === 0) continue;
        const points = Math.round(
          cells.length * BLAST_POINTS * this._level * (1 + this.boosts.scoreBonus),
        );
        this._score += points;
        this.events.emit('blast', { x, y, cells, bombs, points });
      }
    }
  }

  /**
   * What the falling piece would blow up if it landed now (where its ghost
   * stands): the blocks of the sectors of the bombs whose ring it would clear.
   */
  blastPreview(): readonly RemovedCell[] {
    const piece = this._active;
    const blast = this.mode.blast;
    if (!piece || !blast) return [];
    const landed = piece.moved(0, this.dropDistance());
    const key = `${this.lockCount}:${this.board.blockCount()}:${landed.x}:${landed.y}:${landed.rotation}`;
    if (this.previewCache.key === key) return this.previewCache.cells;
    const board = this.board.clone();
    board.lock(landed);
    const cleared = board.clearFullRows();
    const cells: RemovedCell[] = [];
    for (const row of cleared) {
      const below = cleared.filter((other) => other.index > row.index).length;
      for (const x of row.bombs) {
        cells.push(
          ...board.blast(x, row.index + below, blast.radius, blast.above, blast.below).cells,
        );
      }
    }
    this.previewCache = { key, cells };
    return cells;
  }

  private spawnNext(): void {
    this.fillQueue(1);
    this.spawn(this.upcoming.shift()!);
  }

  private spawn(spec: PieceSpec): void {
    if (this._state === 'over') return;
    const bomb = spec.bomb ?? null;
    let piece = Piece.spawn(spec.type, spec.tone, this.board.width).withBomb(bomb);
    if (this.spawnCentre !== null) {
      const above = Piece.spawn(spec.type, spec.tone, this.board.width, this.spawnCentre).withBomb(
        bomb,
      );
      if (this.board.fits(above)) piece = above;
    }
    if (bomb !== null && !this.bombAnnounced) {
      this.bombAnnounced = true;
      this.events.emit('notice', { id: 'bombPiece' });
    }
    if (!this.board.fits(piece)) {
      if (this.rescue()) this.spawn(spec);
      else {
        this.blocked = spec;
        this.finish('blockOut');
      }
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
      const tone = this.mode.toneFor(type, this.random);
      const bomb = this.mode.bombFor(this.random, this.dealt++);
      this.upcoming.push(bomb === null ? { type, tone } : { type, tone, bomb });
    }
  }

  /** The stack overflowed: a second chance if there is one, otherwise the end. */
  private overflow(): void {
    if (!this.rescue() || !this.liftActiveUntilItFits()) this.finish('topOut');
  }

  /**
   * The second chance (campaign upgrade), once per game: the bottom rows
   * vanish and the stack drops. Only in modes that clear lines.
   */
  private rescue(): boolean {
    if (!this.rescueReady || !this.mode.clearsLines) return false;
    this.rescueReady = false;
    this.board.dropBottomRows(this.boosts.rescueRows);
    this.events.emit('rescue', { rows: this.boosts.rescueRows });
    return true;
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
