import { describe, expect, it, vi } from 'vitest';
import type { AdTuning } from '@/ads/AdPolicy';
import { AdScheduler } from '@/ads/AdScheduler';
import { GuardianChallenge } from '@/campaign/GuardianChallenge';
import { levelById } from '@/campaign/Levels';
import { TRAINING } from '@/campaign/Training';
import { Emitter } from '@/core/Emitter';
import { FULL_EDITION } from '@/platform/Edition';
import type { GameProgress } from '@/progression/Profile';
import { GameRun, type GameRunPorts } from '@/run/GameRun';
import {
  DailyRun,
  FreeRun,
  GuardianRun,
  LevelRun,
  runKindFor,
  TrainingRun,
  type RunKind,
} from '@/run/RunKind';
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
  /** Lost to its board: a continue can bring it back. */
  revivable = false;
  revived = 0;
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
  /** The game is lost to its board: it may continue. */
  lose() {
    this.revivable = true;
    this.end('topOut');
  }
  revive() {
    this.revived++;
    this.revivable = false;
    this.state = 'running';
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

/** An ad policy with no grace and no interval: only the run's own rules hold ads back. */
const OPEN: AdTuning = {
  firstAfterMs: 0,
  visitGraceMs: 0,
  intervalMs: 0,
  onLeave: true,
  rewarded: true,
  rewardedAfterMs: 0,
  continueAfterMs: 0,
  continueIntervalMs: 0,
  continueMinRunMs: 0,
};

/** A run with its doors stubbed; the last session it created, to play by hand. */
function setUp(
  kind: RunKind,
  { showsBest = true, rewarded = false, stopsOnAutoPause = false, tuning = OPEN } = {},
) {
  const scores = new ScoreBoard(new MemoryStorage());
  const sessions: FakeSession[] = [];
  const platform = {
    edition: FULL_EDITION,
    supportsRewarded: rewarded,
    stopsOnAutoPause,
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
    finishTraining: vi.fn(),
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
    ads: new AdScheduler(
      tuning,
      () => ({ playedMs: 0, adFree: false }),
      () => 0,
    ),
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

  it('plays the training: no clock, no record, no ad; once won, the campaign comes next', async () => {
    const { run, scores, campaign, platform, profile, game } = setUp(
      new TrainingRun(TRAINING[0]!),
      {
        rewarded: true,
      },
    );
    await run.start();
    expect(game().options).toMatchObject({ timeLimitMs: null, training: 'hook' });
    expect(run.kind.boss).toBe('duneWorm');
    game().end('victory');
    const ending = run.last!;
    expect(ending.training).toEqual({ step: 'firstEncounter', won: true, next: null });
    expect(ending.campaign).toBeUndefined();
    expect(campaign.record).not.toHaveBeenCalled();
    expect(scores.best('sand')).toBeNull();
    // Its experience counts; no ad to double it, none after it.
    expect(profile.recordGame).toHaveBeenCalledOnce();
    expect(ending.rewardOffered).toBe(false);
    await run.adBreak({ onStart: () => {}, onEnd: () => {} }, 'replay');
    expect(platform.midgameAd).not.toHaveBeenCalled();
    expect(profile.finishTraining).toHaveBeenCalledOnce();
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

  it('tells a portal that counts it (Yandex) of an automatic pause too, and of the resume', async () => {
    const { run, platform } = setUp(new FreeRun('classic'), { stopsOnAutoPause: true });
    await run.start();
    run.pause(false);
    expect(platform.gameplayStop).toHaveBeenCalledOnce();
    run.resume();
    expect(platform.gameplayStart).toHaveBeenCalledTimes(2);
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
    // Another game, run out on the clock: no reward watched, so its break shows the portal's ad.
    await run.start();
    game().end('timeUp');
    platform.rewardedAd.mockResolvedValueOnce(false);
    expect(await run.doubleExperience({ onStart: () => {}, onEnd: () => {} })).toBe('refused');
    await run.adBreak({ onStart: () => {}, onEnd: () => {} }, 'leave');
    expect(platform.midgameAd).toHaveBeenCalledOnce();
  });

  it('never shows an interstitial after a defeat: a won game, or one run out, may have one', async () => {
    const { run, platform, game } = setUp(new FreeRun('classic'));
    const hooks = { onStart: () => {}, onEnd: () => {} };
    await run.start();
    game().end('topOut');
    await run.adBreak(hooks, 'replay');
    expect(platform.midgameAd).not.toHaveBeenCalled();
    await run.start();
    game().end('victory');
    await run.adBreak(hooks, 'replay');
    expect(platform.midgameAd).toHaveBeenCalledOnce();
  });

  it('judges a campaign level by its verdict: lost, no interstitial; won, one', async () => {
    const level = levelById('1-2')!;
    const { run, platform, game } = setUp(new LevelRun(level.modeId, level, {}));
    const hooks = { onStart: () => {}, onEnd: () => {} };
    await run.start();
    game().end('topOut');
    expect(run.last?.campaign?.won).toBe(false);
    await run.adBreak(hooks, 'replay');
    expect(platform.midgameAd).not.toHaveBeenCalled();
    await run.start();
    game().clear(level.goal.target);
    run.update(16);
    expect(run.last?.campaign?.won).toBe(true);
    await run.adBreak(hooks, 'leave');
    expect(platform.midgameAd).toHaveBeenCalledOnce();
  });

  it('offers a lost game its continue; declined, the end settles as usual', async () => {
    const { run, scores, platform, game } = setUp(new FreeRun('classic'), { rewarded: true });
    scores.record('classic', 100);
    const offer = vi.fn();
    const over = vi.fn();
    run.events.on('offer', offer);
    run.events.on('over', over);
    await run.start();
    game().points = 140;
    game().lose();
    expect(run.phase).toBe('over');
    expect(offer).toHaveBeenCalledWith({
      offer: { reason: 'topOut', amount: 140, kind: 'score', best: 100 },
    });
    // Nothing settled yet: no record, no game over told, gameplay stopped.
    expect(over).not.toHaveBeenCalled();
    expect(scores.best('classic')).toBe(100);
    expect(platform.gameplayStop).toHaveBeenCalledOnce();
    expect(platform.gameOver).not.toHaveBeenCalled();

    run.decline();
    expect(run.offer).toBeNull();
    expect(over).toHaveBeenCalledOnce();
    expect(run.last).toMatchObject({ amount: 140, isNewBest: true, rewardOffered: false });
    expect(scores.best('classic')).toBe(140);
    expect(platform.gameOver).toHaveBeenCalledWith(false);
  });

  it('continues a lost game after the rewarded ad: play goes on, its record still counting', async () => {
    const { run, scores, platform, game } = setUp(new FreeRun('classic'), { rewarded: true });
    scores.record('classic', 100);
    const best = vi.fn();
    const continued = vi.fn();
    run.events.on('best', best);
    run.events.on('continued', continued);
    await run.start();
    game().points = 90;
    game().lose();
    // No ad played: the offer stands.
    platform.rewardedAd.mockResolvedValueOnce(false);
    expect(await run.continueGame({ onStart: () => {}, onEnd: () => {} })).toBe(false);
    expect(run.offer).not.toBeNull();

    expect(await run.continueGame({ onStart: () => {}, onEnd: () => {} })).toBe(true);
    expect(game().revived).toBe(1);
    expect(run.phase).toBe('playing');
    expect(platform.gameplayStart).toHaveBeenCalledTimes(2);
    expect(continued).toHaveBeenCalledOnce();
    // The HUD keeps chasing the record: a continued game counts, as in the genre's hits.
    expect(best).not.toHaveBeenCalledWith({ best: null });

    // Lost again: no second offer, nor a second ad; the record counts.
    const offer = vi.fn();
    run.events.on('offer', offer);
    game().points = 400;
    run.update(16);
    expect(best).toHaveBeenLastCalledWith({ best: { value: 400, beaten: true } });
    game().lose();
    expect(offer).not.toHaveBeenCalled();
    expect(run.last).toMatchObject({ amount: 400, isNewBest: true, rewardOffered: false });
    expect(scores.best('classic')).toBe(400);
    // No interstitial right after it, either.
    await run.adBreak({ onStart: () => {}, onEnd: () => {} }, 'replay');
    expect(platform.midgameAd).not.toHaveBeenCalled();
  });

  it('offers no continue in a challenge, the training, without rewarded ads, or to a newcomer', async () => {
    const daily = new DailyChallenge(new Date(2026, 9, 22), ['classic']);
    const challenge = new GuardianChallenge(new Date(2026, 9, 22));
    const cases = [
      setUp(new DailyRun('classic', daily), { rewarded: true }),
      setUp(new GuardianRun(challenge.modeId, challenge), { rewarded: true }),
      setUp(new TrainingRun(TRAINING[0]!), { rewarded: true }),
      setUp(new FreeRun('classic')),
      setUp(new FreeRun('classic'), {
        rewarded: true,
        tuning: { ...OPEN, continueAfterMs: 5 * 60_000 },
      }),
    ];
    for (const { run, game } of cases) {
      const offer = vi.fn();
      run.events.on('offer', offer);
      await run.start();
      game().lose();
      expect(offer).not.toHaveBeenCalled();
      expect(run.last).not.toBeNull();
    }
    // Not on CrazyGames yet, nor at every defeat, nor after a short run.
    for (const tuning of [
      { ...OPEN, rewarded: false },
      { ...OPEN, continueMinRunMs: 2 * 60_000 },
    ]) {
      const { run, game } = setUp(new FreeRun('classic'), { rewarded: true, tuning });
      await run.start();
      game().lose();
      expect(run.offer).toBeNull();
    }
    const twice = setUp(new FreeRun('classic'), {
      rewarded: true,
      tuning: { ...OPEN, continueIntervalMs: 10 * 60_000 },
    });
    await twice.run.start();
    twice.game().lose();
    expect(twice.run.offer).not.toBeNull();
    twice.run.decline();
    await twice.run.start();
    twice.game().lose();
    expect(twice.run.offer).toBeNull();
    // A game that ran out of time cannot continue: only a board lost can.
    const { run, game } = setUp(new FreeRun('classic'), { rewarded: true });
    await run.start();
    game().end('timeUp');
    expect(run.offer).toBeNull();
  });
});

describe('RunKind', () => {
  const daily = new DailyChallenge(new Date(2026, 9, 22), ['classic']);
  const guardian = new GuardianChallenge(new Date(2026, 9, 22));
  const level = levelById('1-2')!;

  it('picks the kind of game: a training step first, then a level, a Guardian, the day', () => {
    const choice = { modeId: 'classic' as const, variant: null };
    const step = TRAINING[0]!;
    expect(runKindFor({ ...choice, daily, guardian, level, training: step }, {})).toBeInstanceOf(
      TrainingRun,
    );
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
