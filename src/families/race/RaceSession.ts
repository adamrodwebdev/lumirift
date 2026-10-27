import { Emitter } from '@/core/Emitter';
import { SeededRandom, type RandomSource } from '@/core/Random';
import type { FallingCommand } from '@/families/falling';
import type {
  BossId,
  BossStatus,
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import type { FamilyId } from '@/session/ModeId';
import { WORLD_GAMES, type WorldFactory, type WorldSession } from './RaceWorlds';
import { clearGainMs, RaceClock } from './rules/RaceClock';
import { CLOCK, GAINS, GUARDIANS, POINTS, SHIFTS } from './rules/RaceTuning';
import { guardianJoins, ShiftSchedule, type RaceWorld } from './rules/ShiftSchedule';

/** Where a run stands: a world played, the wipe between two, the last hurrah, the end. */
export type RaceStage = 'play' | 'wipe' | 'hurrah' | 'over';

/** Why the clock moved: a clear, a hit on a Guardian, its fall, a world reached, an overflow. */
export type TimeReason = 'clear' | 'hit' | 'defeat' | 'shift' | 'overflow';

/** The shift announced: the next world, its Guardian, a speed-up. */
export interface RaceWarning {
  readonly next: RaceWorld;
  readonly guardian: BossId | null;
  readonly speedUp: boolean;
}

export interface RaceEventMap {
  /**
   * The clock moved by `ms` (negative for an overflow); `spilled` ms of it
   * went over the cap, paid as `points`. `combo` is the clear's.
   */
  time: {
    readonly ms: number;
    readonly reason: TimeReason;
    readonly combo: number;
    readonly spilled: number;
    readonly points: number;
  };
  warning: RaceWarning;
  /** The Rift wipes the board: its cells scored. */
  wipe: { readonly cells: number; readonly points: number };
  /** A world opens on a fresh board (also after a Guardian's fall, the same world again). */
  shift: { readonly world: RaceWorld; readonly guardian: BossId | null };
  /** A Guardian joined, left (its time up), or fell. */
  guardian: { readonly boss: BossId; readonly change: 'joined' | 'left' | 'beaten' };
  /** 0:00: the last hurrah scores what is left on the board. */
  hurrah: { readonly cells: number; readonly points: number };
}

/** A Guardian of the race in its world: who, and how long it has been there. */
interface Encounter {
  readonly boss: BossId;
  ms: number;
}

/** A shift announced, and whether a Guardian had fallen in the phase when it was. */
interface Announced {
  readonly warning: RaceWarning;
  readonly beaten: boolean;
}

/** The end of a world's game the race takes over: its Guardian's fall. */
const VICTORY = 'victory';
/** The health a race's Guardian comes with: a third. */
const RACE_GUARDIAN_HEALTH = Math.round(GUARDIAN_HEALTH * GUARDIANS.healthShare);

/**
 * The Rift Race (1.34), a session of sessions: it opens each world's game
 * (the well, the Sand, the Tower, with its Guardian when one is drawn) on a
 * fresh board, relays the player's commands to it, and counts the clock.
 * Clears and blows on a Guardian feed the clock; an overflow costs time and
 * blows away the top of the board; only the clock ends the run. Every 40 s
 * the Rift shifts: a warning, a wipe that scores the board, the next world.
 * Score and clock carry over; each cycle multiplies the score more.
 */
export class RaceSession implements GameSession<FallingCommand> {
  readonly modeId = 'race';
  readonly family = 'rift';
  readonly events = new Emitter<SessionEventMap>();
  /** What the race itself does, for its stage. */
  readonly race = new Emitter<RaceEventMap>();
  /** Only the clock ends a run: nothing to continue. */
  readonly revivable = false;

  private readonly clock = new RaceClock();
  private readonly schedule = new ShiftSchedule();
  private _state: SessionState = 'ready';
  private _stage: RaceStage = 'play';
  private game: WorldSession;
  private offGame: (() => void)[] = [];
  /** Time played in the world (the wipes aside). */
  private phaseMs = 0;
  /** Time spent in the wipe or the last hurrah. */
  private stageMs = 0;
  private playedMs = 0;
  /** Points of the worlds closed, and the race's own. */
  private banked = 0;
  /** What the world's own points are worth now: the cycle's multiplier, 0 once banked. */
  private liveFactor = 1;
  private lines = 0;
  private announced: Announced | null = null;
  private encounter: Encounter | null = null;
  private lastHealth: number | null = null;
  /** A Guardian fell in this phase: the speed-up waits. */
  private fell = false;
  private beaten = 0;
  private withoutGuardian = 0;
  private readonly visited: RaceWorld[] = [];
  /** How the world's game ended, settled once its call returns. */
  private pending: string | null = null;

  constructor(
    private readonly open: WorldFactory,
    private readonly random: RandomSource,
  ) {
    this.game = this.openWorld(null);
  }

  // --- The race, read by its stage ---------------------------------------------

  get state(): SessionState {
    return this._state;
  }

  get stage(): RaceStage {
    return this._stage;
  }

  /** The world's game played now. */
  get current(): GameSession {
    return this.game;
  }

  get world(): RaceWorld {
    return this.schedule.world;
  }

  get next(): RaceWorld {
    return this.schedule.next;
  }

  /** The cycle played: the score's multiplier. */
  get cycle(): number {
    return this.schedule.cycle;
  }

  get timeLeftMs(): number {
    return this.clock.leftMs;
  }

  /** Time before the shift (ms). */
  get shiftInMs(): number {
    return Math.max(0, SHIFTS.phaseMs - this.phaseMs);
  }

  /** The share of the world's time played (0 to 1). */
  get phaseShare(): number {
    return Math.min(1, this.phaseMs / SHIFTS.phaseMs);
  }

  /** The shift announced, during its warning; null otherwise. */
  get warning(): RaceWarning | null {
    return this.announced?.warning ?? null;
  }

  /** The Guardian in the world and its time left (ms), or null. */
  get guardian(): { readonly boss: BossId; readonly leftMs: number } | null {
    const encounter = this.encounter;
    return encounter
      ? { boss: encounter.boss, leftMs: Math.max(0, GUARDIANS.stayMs - encounter.ms) }
      : null;
  }

  /** The worlds played so far, in order. */
  get worlds(): readonly RaceWorld[] {
    return this.visited;
  }

  get guardiansBeaten(): number {
    return this.beaten;
  }

  /** Time played, wipes and hurrah included (ms). */
  get survivedMs(): number {
    return this.playedMs;
  }

  get score(): number {
    return Math.round(this.banked + this.game.result().value * this.liveFactor);
  }

  // --- The session ---------------------------------------------------------------

  start(): void {
    if (this._state !== 'ready') return;
    this.game.start();
    this.visited.push(this.world);
    this.setState('running');
  }

  pause(): void {
    if (this._state !== 'running') return;
    this.game.pause();
    this.setState('paused');
  }

  resume(): void {
    if (this._state !== 'paused') return;
    this.game.resume();
    this.setState('running');
  }

  update(deltaMs: number): void {
    if (this._state !== 'running') return;
    this.playedMs += deltaMs;
    if (this._stage === 'play') this.play(deltaMs);
    else if (this._stage === 'wipe') this.wiping(deltaMs);
    else if (this._stage === 'hurrah') this.cheering(deltaMs);
  }

  execute(command: FallingCommand): boolean {
    if (this._state !== 'running' || this._stage !== 'play') return false;
    const done = this.game.execute(command);
    this.settle();
    return done;
  }

  indicators(): readonly Indicator[] {
    return [
      { id: 'score', value: this.score, format: 'count' },
      { id: 'lines', value: this.lines, format: 'count' },
      { id: 'cycle', value: this.cycle, format: 'factor' },
      { id: 'timeLeft', value: this.clock.leftMs, format: 'duration' },
    ];
  }

  pressure(): number {
    return this._stage === 'play' ? this.game.pressure() : 0;
  }

  result(): SessionResult {
    return { modeId: 'race', kind: 'score', value: this.score };
  }

  subtitleKey(): null {
    return null;
  }

  boss(): BossStatus | null {
    return this.encounter ? (this.game.boss?.() ?? null) : null;
  }

  boardFamily(): FamilyId {
    return this.game.family;
  }

  dispose(): void {
    this.offGame.forEach((off) => off());
    this.game.dispose();
    this.events.clear();
    this.race.clear();
  }

  // --- A world played --------------------------------------------------------------

  private play(deltaMs: number): void {
    this.game.update(deltaMs);
    this.settle();
    this.clock.tick(deltaMs);
    this.phaseMs += deltaMs;
    this.followGuardian(deltaMs);
    if (this.clock.expired) {
      this.cheer();
      return;
    }
    if (!this.announced && this.phaseMs >= SHIFTS.phaseMs - SHIFTS.warningMs) this.warn();
    if (this.phaseMs >= SHIFTS.phaseMs) this.wipe();
  }

  /** A clear: its lines, its combo, doubled while the shift is announced (the rush). */
  private cleared(lines: number, points: number, combo: number): void {
    if (this._stage !== 'play') return;
    this.lines += lines;
    const rush = this.announced ? SHIFTS.rushFactor : 1;
    this.banked += points * (rush - 1) * this.schedule.cycle;
    this.gain(clearGainMs(lines, combo) * rush, 'clear', combo);
  }

  private gain(ms: number, reason: TimeReason, combo: number): void {
    const spilled = this.clock.spill(ms);
    const points = Math.round((spilled / 1000) * POINTS.perSpilledSecond) * this.schedule.cycle;
    this.clock.gain(ms);
    this.banked += points;
    this.race.emit('time', { ms, reason, combo, spilled, points });
  }

  /** The Guardian's blows (each one +1 s), and its time: gone after 25 s, at no cost. */
  private followGuardian(deltaMs: number): void {
    const encounter = this.encounter;
    if (!encounter) return;
    encounter.ms += deltaMs;
    const health = this.game.boss?.()?.health ?? null;
    if (health !== null && this.lastHealth !== null && health < this.lastHealth) {
      this.gain(GAINS.hitMs, 'hit', 0);
    }
    this.lastHealth = health;
    if (encounter.ms >= GUARDIANS.stayMs) this.endEncounter('left');
  }

  /** The Guardian goes: its time up, or fallen; at a wipe, with the world (unannounced). */
  private endEncounter(change: 'left' | 'beaten' | null): void {
    const encounter = this.encounter;
    if (!encounter) return;
    if (change !== 'beaten') this.game.dismiss?.();
    if (change) this.race.emit('guardian', { boss: encounter.boss, change });
    this.encounter = null;
    this.lastHealth = null;
  }

  /** The board overflowed (its world blew its top away and goes on): 10 s lost, never below 5 s. */
  private overflowed(): void {
    const before = this.clock.leftMs;
    this.clock.overflow();
    this.race.emit('time', {
      ms: this.clock.leftMs - before,
      reason: 'overflow',
      combo: 0,
      spilled: 0,
      points: 0,
    });
  }

  /**
   * The world's game ended under the player's hand: its Guardian fell (+15 s,
   * a fresh board of the same world). Settled after the call that ended it.
   * Any other end (none is known: an overflow goes on) opens a fresh board,
   * since only the clock ends a run.
   */
  private settle(): void {
    const reason = this.pending;
    if (reason === null) return;
    this.pending = null;
    if (reason === VICTORY && this.encounter) {
      this.gain(GAINS.defeatMs, 'defeat', 0);
      this.endEncounter('beaten');
      this.fell = true;
      this.beaten++;
    } else this.endEncounter('left');
    this.replaceWorld(null);
  }

  // --- The shift ---------------------------------------------------------------------

  /** The shift announced, 3 s ahead: the next world, its Guardian (drawn now), a speed-up. */
  private warn(): void {
    const shift = this.schedule.phase + 1;
    const next = this.schedule.next;
    const joins = guardianJoins(shift, this.withoutGuardian, this.random.next());
    if (shift >= GUARDIANS.sureAtShift) this.withoutGuardian = joins ? 0 : this.withoutGuardian + 1;
    const beaten = this.fell;
    const warning: RaceWarning = {
      next,
      guardian: joins ? WORLD_GAMES[next].boss : null,
      speedUp: this.schedule.speedsUp(beaten),
    };
    this.announced = { warning, beaten };
    this.race.emit('warning', warning);
  }

  /** The Rift wipes the board, the clock frozen: its cells are scored. */
  private wipe(): void {
    this._stage = 'wipe';
    this.stageMs = 0;
    const scored = this.scoreBoard();
    this.endEncounter(null);
    this.race.emit('wipe', scored);
  }

  private wiping(deltaMs: number): void {
    this.stageMs += deltaMs;
    if (this.stageMs < SHIFTS.wipeMs) return;
    // The warning comes 3 s before the wipe, so it is always there; a fall's waits otherwise.
    const guardian = this.announced?.warning.guardian ?? null;
    this.schedule.advance(this.announced?.beaten ?? this.fell);
    this.phaseMs = 0;
    this.fell = false;
    this.announced = null;
    this.replaceWorld(guardian);
    this.visited.push(this.world);
    this._stage = 'play';
    this.gain(GAINS.shiftMs, 'shift', 0);
    if (guardian) {
      this.encounter = { boss: guardian, ms: 0 };
      this.lastHealth = this.game.boss?.()?.health ?? null;
      this.race.emit('guardian', { boss: guardian, change: 'joined' });
    }
  }

  /** The cells left on the board, scored at the cycle's multiplier. */
  private scoreBoard(): { readonly cells: number; readonly points: number } {
    const cells = this.game.remains?.() ?? 0;
    const points = cells * POINTS.perWipedCell * this.schedule.cycle;
    this.banked += points;
    return { cells, points };
  }

  // --- The end -------------------------------------------------------------------

  /** 0:00: the last hurrah scores what is left on the board, then the run ends. */
  private cheer(): void {
    this._stage = 'hurrah';
    this.stageMs = 0;
    this.announced = null;
    this.race.emit('hurrah', this.scoreBoard());
  }

  private cheering(deltaMs: number): void {
    this.stageMs += deltaMs;
    if (this.stageMs < CLOCK.lastHurrahMs) return;
    this.banked += this.game.result().value * this.liveFactor;
    this.liveFactor = 0;
    this._stage = 'over';
    this.setState('over');
    this.events.emit('over', { reason: 'timeUp' });
  }

  // --- The worlds' games -----------------------------------------------------------

  /** A fresh board: the world's game banked and closed, the world's next one open and started. */
  private replaceWorld(guardian: BossId | null): void {
    this.banked += this.game.result().value * this.liveFactor;
    this.offGame.forEach((off) => off());
    this.game.dispose();
    this.liveFactor = this.schedule.cycle;
    this.game = this.openWorld(guardian);
    this.game.start();
    this.race.emit('shift', { world: this.world, guardian });
  }

  private openWorld(guardian: BossId | null): GameSession {
    const game = this.open(this.world, {
      random: new SeededRandom(this.random.nextInt(2 ** 32)),
      timeLimitMs: null,
      startLevel: this.schedule.level,
      overflowGoesOn: true,
      ...(guardian ? { boss: guardian, bossHealth: RACE_GUARDIAN_HEALTH } : {}),
    });
    const { events } = game;
    this.offGame = [
      events.on('clear', (event) => {
        this.cleared(event.lines, event.points, event.combo);
        this.events.emit('clear', event);
      }),
      events.on('levelUp', (event) => this.events.emit('levelUp', event)),
      events.on('notice', (event) => this.events.emit('notice', event)),
      events.on('closeCall', (event) => this.events.emit('closeCall', event)),
      events.on('overflow', () => this.overflowed()),
      events.on('over', ({ reason }) => (this.pending = reason)),
    ];
    return game;
  }

  private setState(state: SessionState): void {
    this._state = state;
    this.events.emit('state', { state });
  }
}
