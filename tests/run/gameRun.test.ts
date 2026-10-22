import { describe, expect, it, vi } from 'vitest';
import { GuardianChallenge } from '@/campaign/GuardianChallenge';
import { levelById } from '@/campaign/Levels';
import { Emitter } from '@/core/Emitter';
import { FULL_EDITION } from '@/platform/Edition';
import type { GameProgress } from '@/progression/Profile';
import { GameRun, type GameRunPorts } from '@/run/GameRun';
import { DailyRun, FreeRun, GuardianRun, LevelRun, runKindFor, type RunKind } from '@/run/RunKind';
import { DailyChallenge } from '@/session/DailyChallenge';
import type {
  GameSession,
  Indicator,
  SessionEventMap,
  SessionOptions,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ScoreBoard } from '@/services/ScoreBoard';

/** A game played by hand: its score, its clock, its clears. */
class FakeSession {
  readonly modeId = 'classic' as const;
  readonly family = 'falling' as const;
  readonly events = new Emitter<SessionEventMap>();
  state: SessionState = 'ready';
  points = 0;
  timeLeftMs = 0;
  paused = 0;
  constructor(readonly options: SessionOptions) {}
  start() {
    this.state = 'running';
  }
  pause() {
    this.state = 'paused';
    this.paused++;
  }
  resume() {
    this.state = 'running';
  }
  update() {}
  execute() {
    return true;
  }
  indicators(): readonly Indicator[] {
    return [
      { id: 'score', value: this.points, format: 'count' },
      { id: 'timeLeft', value: this.timeLeftMs, format: 'duration' },
    ];
  }
  pressure() {
    return 0;
  }
  result(): SessionResult {
    return { modeId: this.modeId, kind: 'score', value: this.points };
  }
  subtitleKey() {
    return null;
  }
  /** Lines cleared, as every family tells them. */
  clear(lines: number) {
    this.events.emit('clear', { lines, points: 0, combo: 0 });
  }
  /** The game ends by itself. */
  end(reason: string) {
    this.state = 'over';
    this.events.emit('over', { reason });
  }
  dispose() {}
}

const PROGRESS: GameProgress = {
  xp: [{ source: 'game', amount: 20 }],
  total: 20,
  levelBefore: 1,
  levelAfter: 1,
  completed: [],
  unlocked: [],
  streak: 0,
};

/** A run with its doors stubbed; the last session it created, to play by hand. */
function setUp(kind: RunKind, { showsBest = true, rewarded = false } = {}) {
  const scores = new ScoreBoard(new MemoryStorage());
  const sessions: FakeSession[] = [];
  const platform = {
    edition: FULL_EDITION,
    supportsRewarded: rewarded,
    loadingStart: vi.fn(),
    loadingStop: vi.fn(),
    gameplayStart: vi.fn(),
    gameplayStop: vi.fn(),
    gameOver: vi.fn(),
    happyTime: vi.fn(),
    midgameAd: vi.fn(() => Promise.resolve()),
    rewardedAd: vi.fn(() => Promise.resolve(true)),
  };
  const profile = {
    recordGame: vi.fn(() => PROGRESS),
    doubleExperience: vi.fn((progress: GameProgress) => ({
      ...progress,
      total: progress.total * 2,
    })),
  };
  const campaign = { record: vi.fn(() => 2), starsOf: vi.fn(() => 0) };
  const ports: GameRunPorts = {
    catalog: {
      create: (_id, options) => {
        const session = new FakeSession(options);
        sessions.push(session);
        return Promise.resolve(session as unknown as GameSession);
      },
    },
    scores,
    profile,
    campaign,
    platform,
    today: () => new Date(2026, 9, 22),
    seed: () => 7,
  };
  const run = new GameRun(kind, showsBest, ports);
  return { run, scores, platform, profile, campaign, game: () => sessions.at(-1)! };
}

describe('GameRun', () => {
  it('chases the record live, then counts the game as a new record', async () => {
    const { run, scores, platform, profile, game } = setUp(new FreeRun('classic'));
    scores.record('classic', 100);
    const best = vi.fn();
    const record = vi.fn();
    run.events.on('best', best);
    run.events.on('record', record);
    await run.start();
    expect(run.phase).toBe('playing');
    expect(platform.gameplayStart).toHaveBeenCalledOnce();
    expect(best).toHaveBeenLastCalledWith({ best: { value: 100, beaten: false } });

    game().points = 140;
    run.update(16);
    run.update(16);
    expect(record).toHaveBeenCalledOnce();
    expect(best).toHaveBeenLastCalledWith({ best: { value: 140, beaten: true } });

    const over = vi.fn();
    run.events.on('over', over);
    game().end('topOut');
    expect(run.phase).toBe('over');
    const { ending } = over.mock.calls[0]![0] as { ending: NonNullable<typeof run.last> };
    expect(ending).toMatchObject({ reason: 'topOut', amount: 140, best: 140, isNewBest: true });
    expect(scores.best('classic')).toBe(140);
    expect(platform.gameOver).toHaveBeenCalledWith(false);
    // A record beaten (there was one to beat): the portal's celebration.
    expect(platform.happyTime).toHaveBeenCalledOnce();
    expect(profile.recordGame).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'classic',
        daily: false,
        guardian: false,
        reason: 'topOut',
      }),
      '20261022',
    );
    expect(ending.rewardOffered).toBe(false);
  });

  it('counts the Guardian challenge with its factor, never chasing it in points', async () => {
    const challenge = new GuardianChallenge(new Date(2026, 9, 22));
    const { run, scores, game } = setUp(new GuardianRun(challenge.modeId, challenge));
    const best = vi.fn();
    run.events.on('best', best);
    await run.start();
    expect(best).toHaveBeenLastCalledWith({ best: null });
    expect(game().options.boss).toBe(challenge.boss);
    game().points = 1000;
    game().timeLeftMs = challenge.timeLimitMs * 0.4;
    const over = vi.fn();
    run.events.on('over', over);
    game().end('victory');
    const { ending } = over.mock.calls[0]![0] as { ending: NonNullable<typeof run.last> };
    expect(ending).toMatchObject({
      reason: 'guardian',
      amount: 1400,
      guardian: { points: 1000, factor: 1.4 },
    });
    expect(scores.best(ScoreBoard.guardianKey(challenge.key))).toBe(1400);
  });

  it('ends a campaign level as soon as its goal is met, and records its stars', async () => {
    const level = levelById('1-2')!;
    const { run, scores, campaign, platform, game } = setUp(
      new LevelRun(level.modeId, level, { hourglass: 1 }),
    );
    const goal = vi.fn();
    run.events.on('goal', goal);
    await run.start();
    // The level's clock, hourglass included.
    expect(game().options.timeLimitMs).toBe(level.timeLimitMs! + 15_000);
    expect(goal).toHaveBeenLastCalledWith({ goal: { value: 0, target: level.goal.target } });
    game().clear(2);
    run.update(16);
    expect(goal).toHaveBeenLastCalledWith({ goal: { value: 2, target: level.goal.target } });
    expect(run.phase).toBe('playing');

    const over = vi.fn();
    run.events.on('over', over);
    game().clear(2);
    run.update(16);
    expect(run.phase).toBe('over');
    expect(game().paused).toBe(1);
    const { ending } = over.mock.calls[0]![0] as { ending: NonNullable<typeof run.last> };
    expect(ending.campaign).toMatchObject({
      levelId: '1-2',
      won: true,
      gained: 2,
      next: levelById('1-3'),
    });
    expect(campaign.record).toHaveBeenCalledWith(expect.objectContaining({ won: true }));
    // A campaign game never counts as a record.
    expect(scores.best(level.modeId)).toBeNull();
    expect(platform.gameOver).toHaveBeenCalledWith(true);
  });

  it('tells the portal of a pause only when the player asked for it', async () => {
    const { run, platform } = setUp(new FreeRun('classic'));
    await run.start();
    const phases: string[] = [];
    run.events.on('phase', ({ phase }) => phases.push(phase));
    run.pause(false);
    run.resume();
    expect(platform.gameplayStop).not.toHaveBeenCalled();
    expect(platform.gameplayStart).toHaveBeenCalledOnce();
    run.pause(true);
    run.resume();
    expect(platform.gameplayStop).toHaveBeenCalledOnce();
    expect(platform.gameplayStart).toHaveBeenCalledTimes(2);
    expect(phases).toEqual(['paused', 'playing', 'paused', 'playing']);
  });

  it('doubles the experience after a rewarded ad, and spares the next break its ad', async () => {
    const { run, platform, profile, game } = setUp(new FreeRun('classic'), { rewarded: true });
    await run.start();
    game().end('topOut');
    expect(run.last?.rewardOffered).toBe(true);
    const progress = await run.doubleExperience({ onStart: () => {}, onEnd: () => {} });
    expect(progress).toMatchObject({ total: 40 });
    expect(profile.doubleExperience).toHaveBeenCalledOnce();
    expect(platform.happyTime).toHaveBeenCalledOnce();
    await run.adBreak({ onStart: () => {}, onEnd: () => {} }, 'replay');
    expect(platform.midgameAd).not.toHaveBeenCalled();
    // Another game: no reward to double twice; its break shows the portal's ad.
    await run.start();
    game().end('topOut');
    platform.rewardedAd.mockResolvedValueOnce(false);
    expect(await run.doubleExperience({ onStart: () => {}, onEnd: () => {} })).toBe('refused');
    await run.adBreak({ onStart: () => {}, onEnd: () => {} }, 'leave');
    expect(platform.midgameAd).toHaveBeenCalledOnce();
  });
});

describe('RunKind', () => {
  const daily = new DailyChallenge(new Date(2026, 9, 22), ['classic']);
  const guardian = new GuardianChallenge(new Date(2026, 9, 22));
  const level = levelById('1-2')!;

  it('picks the kind of game: a level first, then a Guardian, then the day', () => {
    const choice = { modeId: 'classic' as const, variant: null };
    expect(runKindFor({ ...choice, daily, guardian, level }, {}).id).toBe('level');
    expect(runKindFor({ ...choice, daily, guardian, level: null }, {}).id).toBe('guardian');
    expect(runKindFor({ ...choice, daily, guardian: null, level: null }, {}).id).toBe('daily');
    expect(runKindFor({ ...choice, daily: null, guardian: null, level: null }, {}).id).toBe('free');
  });

  it('keeps the record each kind counts for, and what the progression hears', () => {
    expect(new FreeRun('duel', 'hard').recordKey).toBe('duel');
    expect(new FreeRun('duel', 'hard').progression).toEqual({
      daily: false,
      guardian: false,
      variant: 'hard',
    });
    expect(new DailyRun('classic', daily).recordKey).toBe('daily:20261022');
    expect(new DailyRun('classic', daily).progression.daily).toBe(true);
    expect(new GuardianRun(guardian.modeId, guardian).recordKey).toBe(`guardian:${guardian.key}`);
    expect(new LevelRun(level.modeId, level, {}).records).toBe(false);
    expect(new FreeRun('duel', 'hard').sessionOptions(3, new Date()).variant).toBe('hard');
  });
});
