import type { Emitter } from '@/core/Emitter';
import type { Boosts } from './Boosts';
import type { RandomSource } from '@/core/Random';
import type { ElementName } from './Elements';
import type { FamilyId, ModeId } from './ModeId';

export type SessionState = 'ready' | 'running' | 'paused' | 'over';

/** What a mode ranks players on. */
export type ResultKind = 'score' | 'time';

/** A value shown in the HUD; `id` is the translation key suffix (`hud.<id>`). */
export interface Indicator {
  readonly id: string;
  readonly value: number;
  /** `percent`: a value from 0 to 100; `factor`: a multiplier (×2). */
  readonly format: 'count' | 'duration' | 'percent' | 'factor';
}

/** A player intention, defined by each family (`{ type: 'hardDrop' }`…). */
export interface Command {
  readonly type: string;
}

export interface SessionResult {
  readonly modeId: ModeId;
  readonly kind: ResultKind;
  readonly value: number;
}

/** The points a result holds: a game ranked on time keeps none (nothing to multiply or add to). */
export function pointsOf(result: SessionResult): number {
  return result.kind === 'score' ? result.value : 0;
}

/** Events every family publishes, for announcements, sounds and best scores. */
export interface SessionEventMap {
  state: { readonly state: SessionState };
  clear: { readonly lines: number; readonly points: number; readonly combo: number };
  levelUp: { readonly level: number };
  /** A clear made in danger: its points counted twice (see `Tension`). */
  closeCall: { readonly points: number };
  /** Something worth announcing; `id` is the translation key suffix (`notice.<id>`). */
  notice: { readonly id: string; readonly value?: number };
  /** The board overflowed and play went on, its top blown away (`overflowGoesOn`, the Rift Race). */
  overflow: Readonly<Record<string, never>>;
  /** An element did its deed (1.36): fire burnt sand, a bolt struck… The week's goal counts them. */
  element: { readonly element: ElementName };
  over: { readonly reason: string };
}

export interface SessionOptions {
  readonly random: RandomSource;
  /** Fixed duration (daily challenge), or null for the mode's own rules. */
  readonly timeLimitMs: number | null;
  /** Date of play, for modes that change every day (the silhouette of the day). */
  readonly today?: Date;
  /** A variant chosen before the game (the AI level of a duel), or none. */
  readonly variant?: string;
  /** Campaign upgrades; never set outside the campaign. */
  readonly boosts?: Boosts;
  /** The early campaign's mercy (1.33): how much the threat slows near the top, 0 to 1. */
  readonly mercy?: number;
  /** The level the game starts at, its gravity (the Rift Race's climb, 1.34); 1 by default. */
  readonly startLevel?: number;
  /**
   * The Guardian comes with this much health (the Rift Race's, a third; a
   * campaign rematch's, more); full by default.
   */
  readonly bossHealth?: number;
  /**
   * An overflow does not end the game (the Rift Race, 1.34): the top half of
   * the board blows away (`CONTINUE_FREES`) and play goes on, with an `overflow` event.
   */
  readonly overflowGoesOn?: boolean;
  /** The gentle version of the mode, to teach it: none of its hazards (the Sand's wind and elements). */
  readonly calm?: boolean;
  /** The week's element (1.36): a free game of the Sand deals it from the start, and more often. */
  readonly featuredElement?: ElementName;
  /** The mode opens on its best moments, scripted (the first level of the campaign). */
  readonly showcase?: boolean;
  /** The mode's practice after its show: what was shown, dealt by chance, without the extra hazards (no wind in Sand). */
  readonly practice?: boolean;
  /** A Guardian of the rift to defeat (a boss level of the campaign). */
  readonly boss?: BossId;
  /** A step of the portals' training: its game staged for it, never lost (1.29). */
  readonly training?: TrainingStage;
}

/**
 * How a step of the portals' training is staged (1.33): the hook, one game
 * where the first bolt shocks the sand, the blaze and the vine follow, and
 * the Dune Wyrm surfaces before half a minute is out.
 */
export type TrainingStage = 'hook';

/** What the training's guide asks for: the gesture or keys it shows. */
export type GuideAction = 'move' | 'rotate' | 'drop';

/** A line of the training's guide: a sentence (a translation key), and the gesture it asks for. */
export interface GuideLine {
  readonly text: string;
  readonly action: GuideAction | null;
}

/** The Guardians of the rift (boss levels). */
export const BOSS_IDS = ['duneWorm', 'ceramicGolem', 'towerEye', 'riftHeart'] as const;
export type BossId = (typeof BOSS_IDS)[number];

/** How a boss fight stands. */
export interface BossStatus {
  readonly id: BossId;
  /** Health left, out of `maxHealth`. */
  readonly health: number;
  readonly maxHealth: number;
}

/**
 * A running game, whatever its family. The game screen only knows this
 * contract: it drives the loop, forwards commands and reads indicators.
 */
export interface GameSession<C extends Command = Command> {
  readonly modeId: ModeId;
  readonly family: FamilyId;
  readonly events: Emitter<SessionEventMap>;
  readonly state: SessionState;

  start(): void;
  pause(): void;
  resume(): void;
  /** Advances the game; call once per frame with the elapsed time. */
  update(deltaMs: number): void;
  /** Applies a player intention; returns false when it had no effect. */
  execute(command: C): boolean;
  /** HUD values, the main one first. */
  indicators(): readonly Indicator[];
  /** How close the game is to its end: 0 calm, 1 about to be lost (the music follows it). */
  pressure(): number;
  result(): SessionResult;
  /** Translation key of a subtitle for this game (the silhouette of the day…), or null. */
  subtitleKey(): string | null;
  /** The boss of this game and how it stands; absent or null outside a boss level. */
  boss?(): BossStatus | null;
  /** The share of the shape to fill that is filled (0 to 1); absent, or 0, where there is none. */
  filled?(): number;
  /** The Guardian of the game leaves it for good (the Rift Race's, its time up); the game goes on. */
  dismiss?(): void;
  /** What is left on the board, in cells (the Rift Race's wipe scores it); absent where nothing is counted. */
  remains?(): number;
  /** The family of the board played now, where it changes (the Rift Race's worlds); absent: the session's own. */
  boardFamily?(): FamilyId;
  /**
   * The game was lost to its board and can continue (the rewarded continue,
   * 1.31); absent where a game never continues (the duel).
   */
  readonly revivable?: boolean;
  /** The lost game continues: the top of its board blows away (`CONTINUE_FREES`), play goes on. */
  revive?(): void;
  /**
   * Pays points won outside the mode's rules (the rift surge's exit), with a
   * notice `reason`. Absent where the game keeps no points to add to.
   */
  awardBonus?(points: number, reason: string): void;
  /**
   * A Guardian of a later chapter shows itself as this level ends (the
   * campaign's teaser), or the one already in the game leaves it (a training
   * step won): the game stops taking pieces and its clock, its world keeps
   * moving. Returns how long the show lasts (ms): the end window waits for
   * it. 0 when this game cannot show that Guardian.
   */
  tease?(boss: BossId): number;
  /**
   * What the training's guide says now (1.29), read every frame; null
   * outside a training, or when it has nothing to say.
   */
  guide?(): GuideLine | null;
  /** Every line the training's guide may say in this game: its card keeps the room of the longest. */
  guideLines?(): readonly GuideLine[];
  /** Releases listeners; the session cannot be used afterwards. */
  dispose(): void;
}
