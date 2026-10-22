import type { CampaignOutcome } from '@/campaign/CampaignRun';
import { guardianLevel, LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { dayKey } from '@/core/Day';
import { allowsLevel } from '@/platform/Edition';
import type { Platform } from '@/platform/Platform';
import type { GameReport } from '@/progression/GameReport';
import type { GameProgress } from '@/progression/Profile';
import type { BossId, ResultKind, SessionResult } from '@/session/GameSession';
import type { ProfileService } from '@/services/ProfileService';
import type { ScoreBoard } from '@/services/ScoreBoard';
import type { RunKind } from './RunKind';

/** A campaign level's ending: won or not, its stars, and the way on. */
export interface CampaignResult {
  readonly levelId: string;
  readonly won: boolean;
  readonly stars: number;
  /** Stars added to the campaign by this game (a better result than before). */
  readonly gained: number;
  /** The level after this one, open now that this one is won; null at the end. */
  readonly next: CampaignLevel | null;
  /** A Guardian the won level teased, and the level where it waits. */
  readonly teaser?: { readonly boss: BossId; readonly levelId: string };
}

/** How a game ended, every count settled; the end window formats it. */
export interface Ending {
  /** Why it ended: `guardian` for a Guardian's fall, the family's reason otherwise. */
  readonly reason: string;
  /** The result counted: whole points or milliseconds (the Guardian's factor applied). */
  readonly amount: number;
  readonly kind: ResultKind;
  /** The record after this game. */
  readonly best: number;
  readonly isNewBest: boolean;
  /** Experience, objectives and unlocks the game brought. */
  readonly progress: GameProgress;
  /** Set for a campaign level. */
  readonly campaign?: CampaignResult;
  /** Set for the Guardian challenge: the game's points and their factor. */
  readonly guardian?: { readonly points: number; readonly factor: number };
  /** The portal's rewarded ad may double the experience (a portal that has one, XP to double). */
  readonly rewardOffered: boolean;
}

/** The narrow doors an ending goes through: records, progression, campaign, portal, clock. */
export interface EndingPorts {
  readonly scores: Pick<ScoreBoard, 'best' | 'record'>;
  readonly profile: Pick<ProfileService, 'recordGame' | 'doubleExperience'>;
  readonly campaign: {
    /** Records a level's verdict; returns the stars it added. */
    record(outcome: CampaignOutcome): number;
    starsOf(levelId: string): number;
  };
  readonly platform: Pick<Platform, 'edition' | 'gameOver' | 'happyTime' | 'supportsRewarded'>;
  readonly today: () => Date;
}

/** A finished game, as its run hands it over. */
export interface FinishedGame {
  readonly kind: RunKind;
  readonly result: SessionResult;
  readonly reason: string;
  /** The clock's time left (the Guardian challenge counts it). */
  readonly timeLeftMs: number;
  /** The campaign's verdict, for a level. */
  readonly verdict: CampaignOutcome | null;
  /** A Guardian the won level teased passes before the end window. */
  readonly teased: boolean;
  /** What the game tells the progression, given how it ended. */
  report(
    game: Pick<GameReport, 'modeId' | 'daily' | 'guardian' | 'variant' | 'reason' | 'boss'>,
  ): GameReport;
}

/**
 * Settles a game's end (1.27): the record it may beat, the experience and
 * objectives it brings, a campaign level's stars and the way on, and what
 * the portal hears (the game over, its rare celebrations). The order holds:
 * the record and the stars before are read before they change.
 */
export class GameEnding {
  constructor(private readonly ports: EndingPorts) {}

  settle(game: FinishedGame): Ending {
    const { kind, result, reason, verdict } = game;
    const { scores, platform } = this.ports;
    const score = kind.score(result, reason, game.timeLeftMs);
    // Read before this game is recorded: the record it may beat.
    const previousBest = kind.records ? scores.best(kind.recordKey) : null;
    const record = kind.records
      ? scores.record(kind.recordKey, score.amount)
      : { best: scores.best(kind.recordKey) ?? score.amount, isNewBest: false };
    const report = game.report({
      modeId: kind.modeId,
      ...kind.progression,
      reason,
      // A Guardian defeated is remembered (it earns its cosmetic).
      ...(verdict?.won && kind.level?.boss ? { boss: kind.level.boss } : {}),
    });
    platform.gameOver(verdict ? verdict.won : reason === 'victory');
    // Only a real feat is worth the portal's celebration (it asks for it
    // sparingly): a record beaten, a Guardian defeated for the first time.
    const recordBeaten = record.isNewBest && previousBest !== null;
    const guardianDown =
      verdict?.won === true &&
      kind.level?.boss !== undefined &&
      this.ports.campaign.starsOf(verdict.levelId) === 0;
    if (recordBeaten || guardianDown) platform.happyTime();
    const progress = this.ports.profile.recordGame(report, dayKey(this.ports.today()));
    return {
      // A Guardian's fall is told as such, not as a duel's victory.
      reason: reason === 'victory' && kind.boss !== null ? 'guardian' : reason,
      amount: score.amount,
      kind: result.kind,
      best: record.best,
      isNewBest: record.isNewBest,
      progress,
      ...(verdict ? { campaign: this.judge(verdict, game.teased, kind.level) } : {}),
      ...(score.breakdown ? { guardian: score.breakdown } : {}),
      rewardOffered: platform.supportsRewarded && progress.total > 0,
    };
  }

  /** The campaign's verdict, recorded; the next level once won, and a teased Guardian's lair. */
  private judge(
    decided: CampaignOutcome,
    teased: boolean,
    level: CampaignLevel | null,
  ): CampaignResult {
    const gained = this.ports.campaign.record(decided);
    const index = LEVELS.findIndex((each) => each.id === decided.levelId);
    const teaser = teased ? level?.teaser : undefined;
    const lair = teaser ? guardianLevel(teaser) : undefined;
    return {
      levelId: decided.levelId,
      won: decided.won,
      stars: decided.stars,
      gained,
      next: decided.won ? this.nextLevel(index) : null,
      ...(teaser && lair ? { teaser: { boss: teaser, levelId: lair.id } } : {}),
    };
  }

  /** The level after this one, if the edition opens it. */
  private nextLevel(index: number): CampaignLevel | null {
    const next = LEVELS[index + 1];
    return next && allowsLevel(this.ports.platform.edition, next) ? next : null;
  }
}
