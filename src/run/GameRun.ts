import { outcomeOf } from '@/ads/AdPolicy';
import type { AdScheduler } from '@/ads/AdScheduler';
import type { CampaignOutcome, CampaignRun, GoalProgress } from '@/campaign/CampaignRun';
import type { LiveState } from '@/campaign/Goals';
import { Emitter } from '@/core/Emitter';
import type { AdHooks, BreakMoment, Platform } from '@/platform/Platform';
import type { BestLine } from '@/progression/BestLine';
import { GameTracker } from '@/progression/GameReport';
import type { GameProgress } from '@/progression/Profile';
import { RecordChase } from '@/progression/RecordChase';
import type { GameSession, Indicator, ResultKind } from '@/session/GameSession';
import type { ModeCatalog } from '@/session/ModeCatalog';
import { GameEnding, type Ending, type EndingPorts } from './GameEnding';
import type { RunKind } from './RunKind';

export type RunPhase = 'loading' | 'playing' | 'paused' | 'over';

/** A defeat the player may take back once for a rewarded ad (1.31), until they choose. */
export interface ContinueOffer {
  /** Why the game was lost. */
  readonly reason: string;
  /** The result so far, as it would count. */
  readonly amount: number;
  readonly kind: ResultKind;
  /** The record of this kind of game, or null when it has none yet. */
  readonly best: number | null;
}

export interface GameRunEventMap {
  phase: { readonly phase: RunPhase };
  /** The HUD's values changed. */
  indicators: { readonly indicators: readonly Indicator[] };
  /** The record beside the score: its value, beaten or not. */
  best: { readonly best: BestLine | null };
  /** The record was just beaten (once a game). */
  record: Readonly<Record<string, never>>;
  /** Where a campaign level's goal stands. */
  goal: { readonly goal: GoalProgress | null };
  /** The game is over, its end settled; a teased Guardian shows itself this long (ms) first. */
  over: { readonly ending: Ending; readonly reason: string; readonly teaserMs: number };
  /** The game is lost but may continue: its end waits for the player's choice (1.31). */
  offer: { readonly offer: ContinueOffer };
  /** The lost game continues: the top of its board blew away, play goes on. */
  continued: Readonly<Record<string, never>>;
}

/** The doors a run goes through: its ending's, the modes, the portal's, a seed. */
export interface GameRunPorts extends EndingPorts {
  readonly catalog: Pick<ModeCatalog, 'create'>;
  readonly platform: EndingPorts['platform'] &
    Pick<
      Platform,
      | 'loadingStart'
      | 'loadingStop'
      | 'gameplayStart'
      | 'gameplayStop'
      | 'midgameAd'
      | 'rewardedAd'
      | 'stopsOnAutoPause'
    >;
  /** The ad policy: whether a break may show an interstitial or a lost game continue, and when an ad played. */
  readonly ads: EndingPorts['ads'] &
    Pick<AdScheduler, 'breakAllowed' | 'adShown' | 'continueAllowed' | 'continueOffered'>;
  /** A seed for a new game's pieces. */
  readonly seed: () => number;
}

const sameIndicators = (a: readonly Indicator[], b: readonly Indicator[]) =>
  a.length === b.length &&
  a.every((item, i) => {
    const other = b.at(i);
    return other?.id === item.id && other.value === item.value;
  });

/**
 * One game on the screen, from its loading to its end (1.27): the session of
 * its kind created and started, each frame's play (the HUD's values, the
 * record chased, a campaign level's goal judged), the pause and what the
 * portal hears of it, then the end settled (GameEnding) and the portal's ads
 * around it. It publishes what changes; the screen draws it and plays it.
 */
export class GameRun {
  readonly events = new Emitter<GameRunEventMap>();
  private readonly ending: GameEnding;
  private game: GameSession | null = null;
  private offGame: (() => void) | null = null;
  private tracker: GameTracker | null = null;
  private judge: CampaignRun | null = null;
  private chase: RecordChase | null = null;
  private state: RunPhase = 'loading';
  private shown: readonly Indicator[] = [];
  private bestLine: BestLine | null = null;
  private goal: GoalProgress | null = null;
  private ended: Ending | null = null;
  /** A `gameplayStop` was sent for this pause: its resume sends `gameplayStart`. */
  private stopReported = false;
  /** A rewarded ad was just watched: no interstitial on top of it at the next break. */
  private rewardWatched = false;
  /** The continue offered, waiting for the player's choice; null otherwise. */
  private pending: ContinueOffer | null = null;
  /** This game offered its continue (once a game) / the player took it. */
  private continueOffered = false;
  private continued = false;

  constructor(
    readonly kind: RunKind,
    /** The mode shows the record beside the score. */
    private readonly showsBest: boolean,
    private readonly ports: GameRunPorts,
  ) {
    this.ending = new GameEnding(ports);
  }

  get phase(): RunPhase {
    return this.state;
  }

  /** The game played (as the screen set it up), or null between games. */
  get session(): GameSession | null {
    return this.game;
  }

  get indicators(): readonly Indicator[] {
    return this.shown;
  }

  /** The last game's end, settled; null while it runs. */
  get last(): Ending | null {
    return this.ended;
  }

  /** The continue offered after a defeat, until the player takes it or lets it go; null otherwise. */
  get offer(): ContinueOffer | null {
    return this.pending;
  }

  /**
   * A new game: its session created and followed, `setup` (the screen's
   * listeners, the guide's watch) given the session to hold, then started.
   */
  async start(
    setup: (session: GameSession) => GameSession = (session) => session,
  ): Promise<GameSession> {
    this.dispose();
    this.setPhase('loading');
    const { platform } = this.ports;
    platform.loadingStart();
    const created = await this.ports.catalog.create(
      this.kind.modeId,
      this.kind.sessionOptions(this.ports.seed(), this.ports.today()),
    );
    platform.loadingStop();
    this.tracker = new GameTracker(created);
    this.judge = this.kind.campaignRun();
    this.setGoal(this.judge ? { value: 0, target: this.judge.level.goal.target } : null);
    this.chase = this.kind.chasesRecord(this.showsBest)
      ? new RecordChase(this.ports.scores.best(this.kind.recordKey))
      : null;
    this.setBest(this.chase ? { value: this.chase.shown(0), beaten: false } : null);
    this.offGame = created.events.on('over', ({ reason }) => this.finish(reason));
    this.game = setup(created);
    this.ended = null;
    this.pending = null;
    this.continueOffered = false;
    this.continued = false;
    this.shown = created.indicators();
    this.events.emit('indicators', { indicators: this.shown });
    created.start();
    this.setPhase('playing');
    platform.gameplayStart();
    return this.game;
  }

  /** A frame: the game goes on, the HUD follows, the record and a level's goal are judged. */
  update(deltaMs: number): void {
    const game = this.game;
    if (!game) return;
    if (game.state === 'running') this.tracker?.tick(deltaMs);
    game.update(deltaMs);
    const next = game.indicators();
    if (!sameIndicators(next, this.shown)) {
      this.shown = next;
      this.events.emit('indicators', { indicators: next });
    }
    if (this.chase && game.state === 'running') this.follow(this.chase, game.result().value);
    if (this.judge && this.state === 'playing' && game.state === 'running') {
      const state = this.liveState(game);
      const progress = this.judge.progress(state);
      if (progress.value !== this.goal?.value) this.setGoal(progress);
      // A goal met during play ends the level at once; a level that teases a
      // Guardian lets it pass first, its world still moving, before its window.
      const won = this.judge.check(state);
      if (won) {
        const teaser = this.kind.teaser;
        const teaserMs = won.won && teaser !== null ? (game.tease?.(teaser) ?? 0) : 0;
        if (teaserMs === 0) game.pause();
        this.finish('goal', won, teaserMs);
      }
    }
  }

  /**
   * The game pauses. The portal hears of it when the player asked for it; a
   * lost focus, a hidden tab or the portal's own pause are the portal's to
   * track (CrazyGames: no gameplayStop on focus loss), unless it counts them
   * as a stop (Yandex: `stopsOnAutoPause`).
   */
  pause(byPlayer: boolean): void {
    if (this.state !== 'playing') return;
    this.game?.pause();
    this.setPhase('paused');
    if (byPlayer || this.ports.platform.stopsOnAutoPause) {
      this.ports.platform.gameplayStop();
      this.stopReported = true;
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.game?.resume();
    this.setPhase('playing');
    if (this.stopReported) this.ports.platform.gameplayStart();
    this.stopReported = false;
  }

  /**
   * The game ends (by itself, or a level's goal met): its end settled and
   * told; a game lost to its board may first offer its continue (1.31).
   */
  finish(reason: string, decided: CampaignOutcome | null = null, teaserMs = 0): void {
    const game = this.game;
    if (!game || this.state === 'over') return;
    if (decided === null && this.mayContinue(game)) this.offerContinue(game, reason);
    else this.settle(game, reason, decided, teaserMs);
  }

  /**
   * The player takes the continue: the portal's rewarded ad, then the game
   * goes on, the top of its board blown away. It sets no record any more.
   * Returns false when no ad played (the offer stands).
   */
  async continueGame(hooks: AdHooks): Promise<boolean> {
    const offer = this.pending;
    const game = this.game;
    if (!offer || !game) return false;
    const watched = await this.ports.platform.rewardedAd(hooks);
    if (!watched || this.pending !== offer || this.game !== game) return false;
    this.pending = null;
    this.continued = true;
    this.rewardWatched = true;
    this.ports.ads.adShown();
    this.chase = null;
    this.setBest(null);
    game.revive?.();
    this.setPhase('playing');
    this.ports.platform.gameplayStart();
    this.events.emit('continued', {});
    return true;
  }

  /** The player lets the continue go (its time ran out, Play again, Home): the end settles. */
  decline(): void {
    const offer = this.pending;
    const game = this.game;
    if (!offer || !game) return;
    this.pending = null;
    this.settle(game, offer.reason, null, 0);
  }

  /** A game lost to its board may continue once, if the kind, the portal and the ad policy allow it. */
  private mayContinue(game: GameSession): boolean {
    return (
      !this.continueOffered &&
      this.kind.continues &&
      game.revivable === true &&
      this.ports.platform.supportsRewarded &&
      this.ports.ads.continueAllowed(this.tracker?.live.durationMs ?? 0)
    );
  }

  /** The defeat waits: gameplay stops, the offer is told with the result as it stands. */
  private offerContinue(game: GameSession, reason: string): void {
    const result = game.result();
    const offer: ContinueOffer = {
      reason,
      amount: this.kind.score(result, reason, 0).amount,
      kind: result.kind,
      best: this.kind.records ? this.ports.scores.best(this.kind.recordKey) : null,
    };
    this.pending = offer;
    this.continueOffered = true;
    this.ports.ads.continueOffered();
    this.setPhase('over');
    this.ports.platform.gameplayStop();
    this.events.emit('offer', { offer });
  }

  /** The end settled (GameEnding) and told. */
  private settle(
    game: GameSession,
    reason: string,
    decided: CampaignOutcome | null,
    teaserMs: number,
  ): void {
    const tracker = this.tracker;
    const state = this.liveState(game);
    const verdict = this.judge ? (decided ?? this.judge.end(reason, state)) : null;
    // The goal shows the last blow (a Guardian's last hit ends the game in the same frame).
    if (this.judge) this.setGoal(this.judge.progress(state));
    const ending = this.ending.settle({
      kind: this.kind,
      result: game.result(),
      reason,
      timeLeftMs: game.indicators().find((item) => item.id === 'timeLeft')?.value ?? 0,
      verdict,
      teased: teaserMs > 0,
      continued: this.continued,
      continueOffered: this.continueOffered,
      report: (base) =>
        tracker
          ? tracker.report(base)
          : { ...base, durationMs: 0, clears: 0, lines: 0, bestAtOnce: 0, bestCombo: 0 },
    });
    this.ended = ending;
    this.rewardWatched = false;
    this.setPhase('over');
    this.events.emit('over', { ending, reason, teaserMs });
  }

  /**
   * The portal's rewarded ad, for the last game's end: watched, its
   * experience counts twice. Returns the new progress, `refused` when no ad
   * played, or null when another game started meanwhile.
   */
  async doubleExperience(hooks: AdHooks): Promise<GameProgress | 'refused' | null> {
    const ended = this.ended;
    if (!ended?.rewardOffered) return 'refused';
    const watched = await this.ports.platform.rewardedAd(hooks);
    if (!watched) return 'refused';
    if (this.ended !== ended) return null;
    const progress = this.ports.profile.doubleExperience(ended.progress);
    this.ended = { ...ended, progress, rewardOffered: false };
    this.rewardWatched = true;
    this.ports.ads.adShown();
    this.ports.platform.happyTime();
    return progress;
  }

  /**
   * Leaving a game's end: the portal may show an ad if the ad policy allows
   * it (never after a defeat, nor in the first minutes), never right after a
   * rewarded one. Its interval starts only if the ad really plays.
   */
  async adBreak(hooks: AdHooks, moment: BreakMoment): Promise<void> {
    const ended = this.ended;
    if (!ended || !this.kind.adBreaks || this.rewardWatched) return;
    const { ads, platform } = this.ports;
    if (!ads.breakAllowed(moment, outcomeOf(ended.reason, ended.campaign?.won ?? null))) return;
    const shown: AdHooks = {
      onStart: () => {
        ads.adShown();
        hooks.onStart();
      },
      onEnd: hooks.onEnd,
    };
    await platform.midgameAd(shown, moment);
  }

  /** The game is left: its session and its followers let go. */
  dispose(): void {
    this.offGame?.();
    this.offGame = null;
    this.tracker?.dispose();
    this.tracker = null;
    this.game?.dispose();
    this.game = null;
    this.judge = null;
    this.chase = null;
  }

  /** Where the game stands, for a campaign level's goal. */
  private liveState(game: GameSession): LiveState {
    const boss = game.boss?.() ?? null;
    return {
      ...(this.tracker?.live ?? { durationMs: 0, clears: 0, lines: 0, bestAtOnce: 0 }),
      score: game.result().value,
      bossDamage: boss ? boss.maxHealth - boss.health : 0,
    };
  }

  /** The record chased: beaten once a game, then the score shown in its place. */
  private follow(chase: RecordChase, score: number): void {
    if (chase.update(score)) this.events.emit('record', {});
    const shown = chase.shown(score);
    if (this.bestLine?.value !== shown || this.bestLine.beaten !== chase.beaten)
      this.setBest({ value: shown, beaten: chase.beaten });
  }

  private setPhase(phase: RunPhase): void {
    if (phase === this.state) return;
    this.state = phase;
    this.events.emit('phase', { phase });
  }

  private setBest(best: BestLine | null): void {
    this.bestLine = best;
    this.events.emit('best', { best });
  }

  private setGoal(goal: GoalProgress | null): void {
    this.goal = goal;
    this.events.emit('goal', { goal });
  }
}
