import { describe, expect, it } from 'vitest';
import { Emitter } from '@/core/Emitter';
import type { RandomSource } from '@/core/Random';
import type { FallingCommand } from '@/families/falling';
import { RaceSession, type RaceEventMap } from '@/families/race';
import { WORLD_GAMES, type WorldFactory, type WorldSession } from '@/families/race/RaceWorlds';
import type { RaceWorld } from '@/families/race/rules/ShiftSchedule';
import type {
  BossStatus,
  Indicator,
  SessionEventMap,
  SessionOptions,
  SessionResult,
  SessionState,
} from '@/session/GameSession';

/** A world's game the test plays by hand: its clears, its overflows, its Guardian's blows. */
class StubWorld implements WorldSession {
  readonly events = new Emitter<SessionEventMap>();
  readonly modeId;
  readonly family;
  state: SessionState = 'ready';
  points = 0;
  cells = 12;
  overflows = 0;
  dismissed = false;
  disposed = false;
  commands = 0;
  private health: number | null;

  constructor(
    readonly world: RaceWorld,
    readonly options: SessionOptions,
  ) {
    this.modeId = WORLD_GAMES[world].modeId;
    this.family = WORLD_GAMES[world].family;
    this.health = options.boss ? (options.bossHealth ?? 100) : null;
  }

  start(): void {
    this.state = 'running';
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'running';
  }
  update(): void {}
  execute(command: FallingCommand): boolean {
    this.commands++;
    if (command.type === 'hardDrop' && this.state === 'running') this.overflow();
    return true;
  }
  indicators(): readonly Indicator[] {
    return [];
  }
  pressure(): number {
    return 0.5;
  }
  result(): SessionResult {
    return { modeId: this.modeId, kind: 'score', value: this.points };
  }
  subtitleKey(): null {
    return null;
  }
  boss(): BossStatus | null {
    const { boss } = this.options;
    return boss && this.health !== null
      ? { id: boss, health: this.health, maxHealth: this.options.bossHealth ?? 100 }
      : null;
  }
  dismiss(): void {
    this.health = null;
    this.dismissed = true;
  }
  remains(): number {
    return this.cells;
  }
  dispose(): void {
    this.disposed = true;
  }

  // --- What the test makes happen ---------------------------------------------

  clear(lines: number, combo = 0, points = 100): void {
    this.points += points;
    this.events.emit('clear', { lines, points, combo });
  }

  /** The stack overflows: its top blows away, play goes on. */
  overflow(): void {
    this.overflows++;
    this.events.emit('overflow', {});
  }

  hit(damage: number): void {
    if (this.health !== null) this.health -= damage;
  }

  /** The Guardian falls: the game is won. */
  fall(): void {
    this.health = 0;
    this.state = 'over';
    this.events.emit('over', { reason: 'victory' });
  }
}

/** Draws in order, then `rest`: the Guardian's rolls of a test. */
class ScriptedRandom implements RandomSource {
  constructor(
    private readonly draws: number[] = [],
    private readonly rest = 0.99,
  ) {}
  next(): number {
    return this.draws.shift() ?? this.rest;
  }
  nextInt(max: number): number {
    return Math.floor(0.5 * max);
  }
}

const STEP_MS = 100;

/** A race on stub worlds, the worlds it opened, and what it said. */
function race(random: RandomSource = new ScriptedRandom()) {
  const worlds: StubWorld[] = [];
  const open: WorldFactory = (world, options) => {
    const stub = new StubWorld(world, options);
    worlds.push(stub);
    return stub;
  };
  const session = new RaceSession(open, random);
  const heard: { [K in keyof RaceEventMap]: RaceEventMap[K][] } = {
    time: [],
    warning: [],
    wipe: [],
    shift: [],
    guardian: [],
    hurrah: [],
  };
  for (const name of Object.keys(heard) as (keyof RaceEventMap)[]) {
    session.race.on(name, (event) => (heard[name] as unknown[]).push(event));
  }
  const ends: string[] = [];
  session.events.on('over', ({ reason }) => ends.push(reason));
  const current = () => worlds.at(-1)!;
  /** Plays `ms`; `fed`, four lines at once whenever the clock falls under a minute. */
  const play = (ms: number, fed = false) => {
    for (let t = 0; t < ms; t += STEP_MS) {
      if (fed && session.stage === 'play' && session.timeLeftMs < 60_000) current().clear(4, 0, 0);
      session.update(STEP_MS);
    }
  };
  session.start();
  return { session, worlds, heard, ends, play, current };
}

describe('The Rift Race (1.34)', () => {
  it('turns through the well, the Sand and the Tower, a 3-s warning, a 1-s wipe and 10 s at every shift', () => {
    const { session, heard, play, current } = race();
    expect(session.world).toBe('well');
    play(36_900);
    expect(heard.warning).toHaveLength(0);
    play(100);
    expect(heard.warning).toEqual([{ next: 'sand', guardian: null, speedUp: false }]);
    play(3000);
    expect(session.stage).toBe('wipe');
    expect(heard.wipe).toEqual([{ cells: 12, points: 60 }]);
    expect(session.timeLeftMs).toBe(50_000);
    expect(session.execute({ type: 'hold' })).toBe(false);
    play(900);
    // The clock waits while the Rift wipes the board, then the world reached gives 10 s.
    expect(session.timeLeftMs).toBe(50_000);
    play(100);
    expect(session.timeLeftMs).toBe(60_000);
    expect(heard.time.at(-1)).toMatchObject({ ms: 10_000, reason: 'shift' });
    expect(session.stage).toBe('play');
    expect(session.world).toBe('sand');
    expect(current().world).toBe('sand');
    expect(heard.shift).toEqual([{ world: 'sand', guardian: null }]);
    play(41_000);
    expect(session.world).toBe('tower');
    expect(session.worlds).toEqual(['well', 'sand', 'tower']);
  });

  it('pays clears in seconds, twice during the warning, and what spills over the 99 s in points', () => {
    const { session, heard, play, current } = race();
    current().clear(1);
    expect(session.timeLeftMs).toBe(92_000);
    current().clear(4, 0, 800);
    expect(session.timeLeftMs).toBe(99_000);
    expect(heard.time.at(-1)).toEqual({
      ms: 13_000,
      reason: 'clear',
      combo: 0,
      spilled: 6000,
      points: 300,
    });
    expect(session.score).toBe(300 + 900);
    play(37_000);
    current().clear(1, 0, 100);
    // The rush: 4 s instead of 2, and the clear's points once more.
    expect(session.timeLeftMs).toBe(99_000 - 37_000 + 4000);
    expect(session.score).toBe(300 + 1000 + 100);
  });

  it('costs 10 s an overflow, never below 5 s, and the world goes on', () => {
    const { session, heard, play, current } = race();
    expect(session.execute({ type: 'hardDrop' })).toBe(true);
    expect(current().overflows).toBe(1);
    expect(session.timeLeftMs).toBe(80_000);
    expect(heard.time.at(-1)).toMatchObject({ ms: -10_000, reason: 'overflow' });
    for (let k = 0; k < 7; k++) session.execute({ type: 'hardDrop' });
    expect(session.timeLeftMs).toBe(10_000);
    session.execute({ type: 'hardDrop' });
    expect(session.timeLeftMs).toBe(5000);
    session.execute({ type: 'hardDrop' });
    expect(session.timeLeftMs).toBe(5000);
    expect(current().overflows).toBe(10);
    play(1000);
    expect(session.state).toBe('running');
  });

  it('brings a Guardian at the second shift with a third of its health, for 25 s', () => {
    const { session, heard, play, current } = race();
    play(41_000);
    play(37_000);
    expect(heard.warning.at(-1)).toMatchObject({ next: 'tower', guardian: 'towerEye' });
    play(4000);
    const tower = current();
    expect(tower.options.boss).toBe('towerEye');
    expect(tower.options.bossHealth).toBe(33);
    expect(session.boss()).toEqual({ id: 'towerEye', health: 33, maxHealth: 33 });
    expect(heard.guardian).toEqual([{ boss: 'towerEye', change: 'joined' }]);
    const before = session.timeLeftMs;
    tower.hit(4);
    play(STEP_MS);
    expect(heard.time.at(-1)).toMatchObject({ ms: 1000, reason: 'hit' });
    expect(session.timeLeftMs).toBe(before + 1000 - STEP_MS);
    play(25_000, true);
    expect(tower.dismissed).toBe(true);
    expect(heard.guardian.at(-1)).toEqual({ boss: 'towerEye', change: 'left' });
    expect(session.boss()).toBeNull();
  });

  it('gives 15 s and a fresh board of the same world for a Guardian’s fall', () => {
    const { session, worlds, heard, play, current } = race();
    play(82_000);
    const tower = current();
    const before = session.timeLeftMs;
    tower.fall();
    play(STEP_MS);
    expect(heard.guardian.at(-1)).toEqual({ boss: 'towerEye', change: 'beaten' });
    expect(session.timeLeftMs).toBe(before + 15_000 - STEP_MS);
    expect(tower.disposed).toBe(true);
    expect(current()).not.toBe(tower);
    expect(current().world).toBe('tower');
    expect(current().options.boss).toBeUndefined();
    expect(heard.shift.at(-1)).toEqual({ world: 'tower', guardian: null });
    expect(session.guardiansBeaten).toBe(1);
    expect(worlds).toHaveLength(4);
  });

  it('raises the gravity and the multiplier with every cycle, the speed-up waiting after a fall', () => {
    const plain = race();
    plain.play(3 * 41_000 - 4000, true);
    expect(plain.heard.warning.at(-1)).toMatchObject({ next: 'well', speedUp: true });
    plain.play(4000, true);
    expect(plain.session.cycle).toBe(2);
    expect(plain.current().options.startLevel).toBe(2);

    const fallen = race();
    fallen.play(82_000);
    fallen.current().fall();
    fallen.play(41_000 - 2000, true);
    expect(fallen.heard.warning.at(-1)).toMatchObject({ next: 'well', speedUp: false });
    fallen.play(2000, true);
    expect(fallen.session.cycle).toBe(2);
    expect(fallen.current().options.startLevel).toBe(1);
    fallen.play(37_000, true);
    expect(fallen.heard.warning.at(-1)).toMatchObject({ next: 'sand', speedUp: true });
    fallen.play(4000, true);
    expect(fallen.current().options.startLevel).toBe(2);
  });

  it('counts the points of a cycle at its multiplier', () => {
    const { session, play, current } = race();
    play(3 * 41_000, true);
    const before = session.score;
    current().clear(1, 0, 100);
    expect(session.score - before).toBe(200);
  });

  it('ends at 0:00 with a last hurrah that scores the board', () => {
    const { session, heard, ends, play } = race();
    // 90 s, and 10 s at each of the two worlds reached: 1:50 of play.
    play(41_000 + 41_000 + 29_900);
    expect(session.stage).toBe('play');
    play(STEP_MS);
    expect(session.stage).toBe('hurrah');
    expect(heard.hurrah).toEqual([{ cells: 12, points: 60 }]);
    expect(session.execute({ type: 'hold' })).toBe(false);
    play(1900);
    expect(ends).toEqual([]);
    play(STEP_MS);
    expect(ends).toEqual(['timeUp']);
    expect(session.state).toBe('over');
    expect(session.timeLeftMs).toBe(0);
    expect(session.survivedMs).toBe(112_000 + 2000);
    expect(session.result()).toEqual({ modeId: 'race', kind: 'score', value: session.score });
  });

  it('draws a Guardian after the second shift a quarter of the time, more for each shift without', () => {
    // Shift 3 rolls 0.3 (no: 0.3 ≥ 25 %), shift 4 rolls 0.3 (yes: < 50 %).
    const { heard, play } = race(new ScriptedRandom([0.99, 0.99, 0.3, 0.3]));
    play(4 * 41_000, true);
    expect(heard.warning.map(({ guardian }) => guardian)).toEqual([
      null,
      'towerEye',
      null,
      'duneWorm',
    ]);
  });
});
