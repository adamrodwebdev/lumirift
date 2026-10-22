import type { Emitter } from '@/core/Emitter';
import type { Boosts } from './Boosts';
import type { RandomSource } from '@/core/Random';
import type { FamilyId, ModeId } from './ModeId';

export type SessionState = 'ready' | 'running' | 'paused' | 'over';

/** What a mode ranks players on. */
export type ResultKind = 'score' | 'time';

/** A value shown in the HUD; `id` is the translation key suffix (`hud.<id>`). */
export interface Indicator {
  readonly id: string;
  readonly value: number;
  /** `percent`: a value from 0 to 100. */
  readonly format: 'count' | 'duration' | 'percent';
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

/** Events every family publishes, for announcements, sounds and best scores. */
export interface SessionEventMap {
  state: { readonly state: SessionState };
  clear: { readonly lines: number; readonly points: number; readonly combo: number };
  levelUp: { readonly level: number };
  /** Something worth announcing; `id` is the translation key suffix (`notice.<id>`). */
  notice: { readonly id: string; readonly value?: number };
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
  /** The gentle version of the mode, to teach it: none of its hazards (the Sand's wind and elements). */
  readonly calm?: boolean;
  /** The mode opens on its best moments, scripted (the first level of the campaign). */
  readonly showcase?: boolean;
  /** The mode's practice after its show: what was shown, dealt by chance, without the extra hazards (no wind in Sand). */
  readonly practice?: boolean;
  /** A Guardian of the rift to defeat (a boss level of the campaign). */
  readonly boss?: BossId;
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
  /**
   * A Guardian of a later chapter shows itself as this level ends (the
   * campaign's teaser): the game stops taking pieces and its clock, its world
   * keeps moving. False when this game cannot show that Guardian.
   */
  tease?(boss: BossId): boolean;
  /** Releases listeners; the session cannot be used afterwards. */
  dispose(): void;
}
