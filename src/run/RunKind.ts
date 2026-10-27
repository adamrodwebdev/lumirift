import { CampaignRun } from '@/campaign/CampaignRun';
import { weekStart, type GuardianChallenge } from '@/campaign/GuardianChallenge';
import type { CampaignLevel, StarRule } from '@/campaign/Levels';
import type { TrainingStep } from '@/campaign/Training';
import { boostsFor, levelTimeMs, type UpgradeRanks } from '@/campaign/Upgrades';
import { mercyOfChapter } from '@/session/Mercy';
import { dayKey } from '@/core/Day';
import { SeededRandom } from '@/core/Random';
import type { GameReport } from '@/progression/GameReport';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { BossId, SessionOptions, SessionResult } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { ScoreBoard } from '@/services/ScoreBoard';
import { weekEventAt } from '@/seasons/EventCalendar';

/** What a finished game counts: whole points or milliseconds, and their factor. */
export interface RunScore {
  readonly amount: number;
  readonly factor: number;
  /** The Guardian challenge shows its sum: the game's points and their factor. */
  readonly breakdown?: { readonly points: number; readonly factor: number };
}

export type RunKindId = 'free' | 'daily' | 'guardian' | 'level' | 'training' | 'race';

/**
 * The kind of game played (1.27): a free game, the day's challenge, the
 * week's Guardian, a campaign level. Each keeps the rules that change with
 * it: the record it counts for, the game it sets up, whether the HUD chases
 * the record, how its result counts, what the progression hears of it.
 */
export interface RunKind {
  readonly id: RunKindId;
  readonly modeId: ModeId;
  /** The record this game counts for (a campaign level only shows its mode's). */
  readonly recordKey: string;
  /** Its result is saved as a record (never a campaign level's: upgrades help there). */
  readonly records: boolean;
  /** The campaign level played, or null. */
  readonly level: CampaignLevel | null;
  /** The training step played (a portal's first run), or null. */
  readonly training: TrainingStep | null;
  /** The Guardian fought (the week's, or a level's), or null. */
  readonly boss: BossId | null;
  /** The Guardian that shows itself once this game is won (a teaser), or null. */
  readonly teaser: BossId | null;
  /** The portal may show an ad between two of its games (never in the training). */
  readonly adBreaks: boolean;
  /** A lost game may continue once for a rewarded ad (1.31): never in a challenge or the training. */
  readonly continues: boolean;
  /** What the progression hears of the kind of game. */
  readonly progression: Pick<GameReport, 'daily' | 'guardian' | 'variant'>;
  /** A new game's options; `seed` deals the pieces when the kind deals none of its own. */
  sessionOptions(seed: number, today: Date): SessionOptions;
  /** The HUD chases the record live (in a mode that shows it beside the score). */
  chasesRecord(showsBest: boolean): boolean;
  /** The week's record this game also counts for, on `today` (the race's), or null. */
  weekRecordKey(today: Date): string | null;
  /** How a finished game counts. */
  score(result: SessionResult, reason: string, timeLeftMs: number): RunScore;
  /** The judge of a campaign level's goal and stars, or null outside the campaign. */
  campaignRun(): CampaignRun | null;
}

/** Whole points or milliseconds: no float noise in the saved records. */
const whole = (result: SessionResult): RunScore => ({
  amount: Math.round(result.value),
  factor: 1,
});

/** A game of a mode chosen freely (its variant: a duel's AI level). */
export class FreeRun implements RunKind {
  readonly id = 'free';
  readonly records = true;
  readonly level = null;
  readonly training = null;
  readonly boss = null;
  readonly teaser = null;
  readonly adBreaks = true;
  readonly continues = true;
  readonly recordKey: string;
  readonly progression: RunKind['progression'];

  constructor(
    readonly modeId: ModeId,
    private readonly variant: string | null = null,
  ) {
    this.recordKey = modeId;
    this.progression = { daily: false, guardian: false, variant };
  }

  sessionOptions(seed: number, today: Date): SessionOptions {
    // The week's element (1.36): only free games feature it, so the campaign's and the challenges' stay fair.
    const event = weekEventAt(today);
    return {
      random: new SeededRandom(seed),
      timeLimitMs: null,
      today,
      ...(this.variant ? { variant: this.variant } : {}),
      ...(event ? { featuredElement: event.element } : {}),
    };
  }

  chasesRecord(showsBest: boolean): boolean {
    return showsBest;
  }

  weekRecordKey(): null {
    return null;
  }

  score(result: SessionResult): RunScore {
    return whole(result);
  }

  campaignRun(): null {
    return null;
  }
}

/** The day's challenge: everybody's pieces, its clock, the day's record. */
export class DailyRun implements RunKind {
  readonly id = 'daily';
  readonly records = true;
  readonly level = null;
  readonly training = null;
  readonly boss = null;
  readonly teaser = null;
  readonly adBreaks = true;
  readonly continues = false;
  readonly recordKey: string;
  readonly progression = { daily: true, guardian: false, variant: null };

  constructor(
    readonly modeId: ModeId,
    private readonly daily: DailyChallenge,
  ) {
    this.recordKey = ScoreBoard.dailyKey(daily.key);
  }

  sessionOptions(_seed: number, today: Date): SessionOptions {
    return { ...this.daily.sessionOptions(), today };
  }

  chasesRecord(showsBest: boolean): boolean {
    return showsBest;
  }

  weekRecordKey(): null {
    return null;
  }

  score(result: SessionResult): RunScore {
    return whole(result);
  }

  campaignRun(): null {
    return null;
  }
}

/**
 * The week's Guardian challenge: everybody's pieces, the Guardian's clock, no
 * upgrades. Its score counts a victory's time left (GuardianChallenge), so
 * the HUD does not chase the record in points.
 */
export class GuardianRun implements RunKind {
  readonly id = 'guardian';
  readonly records = true;
  readonly level = null;
  readonly training = null;
  readonly boss: BossId;
  readonly teaser = null;
  readonly adBreaks = true;
  readonly continues = false;
  readonly recordKey: string;
  readonly progression = { daily: false, guardian: true, variant: null };

  constructor(
    readonly modeId: ModeId,
    private readonly challenge: GuardianChallenge,
  ) {
    this.boss = challenge.boss;
    this.recordKey = ScoreBoard.guardianKey(challenge.key);
  }

  sessionOptions(_seed: number, today: Date): SessionOptions {
    return { ...this.challenge.sessionOptions(), today };
  }

  chasesRecord(): boolean {
    return false;
  }

  weekRecordKey(): null {
    return null;
  }

  score(result: SessionResult, reason: string, timeLeftMs: number): RunScore {
    const victory = reason === 'victory';
    const points = Math.round(result.value);
    const factor = this.challenge.factor(victory, timeLeftMs);
    return {
      amount: this.challenge.score(points, victory, timeLeftMs),
      factor,
      breakdown: { points: result.value, factor },
    };
  }

  campaignRun(): null {
    return null;
  }
}

/**
 * A campaign level: its clock (hourglass included), its opponent and the
 * upgrades bought. Its result never counts as a record (the upgrades help):
 * the HUD shows the mode's record without chasing it.
 */
export class LevelRun implements RunKind {
  readonly id = 'level';
  readonly records = false;
  readonly training = null;
  readonly boss: BossId | null;
  readonly teaser: BossId | null;
  readonly adBreaks = true;
  readonly continues = true;
  readonly recordKey: string;
  readonly progression = { daily: false, guardian: false, variant: null };
  /** The clock of this game, hourglass included (null: untimed). */
  readonly timeLimitMs: number | null;

  constructor(
    readonly modeId: ModeId,
    readonly level: CampaignLevel,
    private readonly ranks: UpgradeRanks,
  ) {
    this.boss = level.boss ?? null;
    this.teaser = level.teaser ?? null;
    this.recordKey = modeId;
    this.timeLimitMs = levelTimeMs(level, ranks);
  }

  sessionOptions(seed: number, today: Date): SessionOptions {
    const { level } = this;
    const mercy = mercyOfChapter(level.chapter);
    return {
      random: new SeededRandom(seed),
      timeLimitMs: this.timeLimitMs,
      today,
      boosts: boostsFor(this.ranks),
      ...(mercy > 0 ? { mercy } : {}),
      ...(level.variant ? { variant: level.variant } : {}),
      ...(level.calm ? { calm: true } : {}),
      ...(level.showcase ? { showcase: true } : {}),
      ...(level.practice ? { practice: true } : {}),
      ...(level.boss ? { boss: level.boss } : {}),
    };
  }

  chasesRecord(): boolean {
    return false;
  }

  weekRecordKey(): null {
    return null;
  }

  score(result: SessionResult): RunScore {
    return whole(result);
  }

  campaignRun(): CampaignRun {
    return new CampaignRun(this.level, this.timeLimitMs);
  }
}

/** A training step judges its goal as a level does; it has no stars to give. */
const NO_STARS: StarRule = { kind: 'timeLeft' };

/**
 * A step of the portals' training (1.29): its game staged for it, no clock,
 * no record, no ad, no stars; its goal judged as a level's, and once won the
 * way on is the next step, then the campaign.
 */
export class TrainingRun implements RunKind {
  readonly id = 'training';
  readonly records = false;
  readonly level = null;
  readonly boss: BossId | null;
  readonly teaser: BossId | null;
  readonly adBreaks = false;
  readonly continues = false;
  readonly modeId: ModeId;
  readonly recordKey: string;
  readonly progression = { daily: false, guardian: false, variant: null };

  constructor(readonly training: TrainingStep) {
    this.modeId = training.modeId;
    this.recordKey = training.modeId;
    this.boss = training.boss ?? null;
    this.teaser = training.teaser ?? null;
  }

  sessionOptions(seed: number, today: Date): SessionOptions {
    return {
      random: new SeededRandom(seed),
      timeLimitMs: null,
      today,
      training: this.training.stage,
    };
  }

  chasesRecord(): boolean {
    return false;
  }

  weekRecordKey(): null {
    return null;
  }

  score(result: SessionResult): RunScore {
    return whole(result);
  }

  campaignRun(): CampaignRun {
    const { id, goal } = this.training;
    return new CampaignRun({ id, goal, stars: NO_STARS }, null);
  }
}

/**
 * A run of the Rift Race (1.34): a free game of its own, which also counts
 * for the week's best (by its Monday). Only its clock ends it: no continue.
 */
export class RaceRun implements RunKind {
  readonly id = 'race';
  readonly modeId = 'race';
  readonly recordKey = 'race';
  readonly records = true;
  readonly level = null;
  readonly training = null;
  readonly boss = null;
  readonly teaser = null;
  readonly adBreaks = true;
  readonly continues = false;
  readonly progression = { daily: false, guardian: false, variant: null };

  sessionOptions(seed: number, today: Date): SessionOptions {
    return { random: new SeededRandom(seed), timeLimitMs: null, today };
  }

  chasesRecord(): boolean {
    return false;
  }

  weekRecordKey(today: Date): string {
    return ScoreBoard.raceWeekKey(dayKey(weekStart(today)));
  }

  score(result: SessionResult): RunScore {
    return whole(result);
  }

  campaignRun(): null {
    return null;
  }
}

/** What the player chose to play: a level, a Guardian, a day's challenge, or none of them. */
export interface RunChoice {
  readonly modeId: ModeId;
  readonly daily: DailyChallenge | null;
  readonly guardian: GuardianChallenge | null;
  readonly level: CampaignLevel | null;
  readonly variant: string | null;
  /** A step of the portals' training. */
  readonly training?: TrainingStep | null;
}

/** The kind of game the player chose (a training step first, then a level, a Guardian, a day's challenge, the race). */
export function runKindFor(choice: RunChoice, ranks: UpgradeRanks): RunKind {
  if (choice.training) return new TrainingRun(choice.training);
  if (choice.level) return new LevelRun(choice.modeId, choice.level, ranks);
  if (choice.guardian) return new GuardianRun(choice.modeId, choice.guardian);
  if (choice.daily) return new DailyRun(choice.modeId, choice.daily);
  if (choice.modeId === 'race') return new RaceRun();
  return new FreeRun(choice.modeId, choice.variant);
}
