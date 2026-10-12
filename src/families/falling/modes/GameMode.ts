import type { RandomSource } from '@/core/Random';
import type { Indicator, ResultKind } from '@/session/GameSession';
import type { EngineModeId } from '@/session/ModeId';
import type { Game } from '../game/Game';
import type { PieceType, Tone } from '../pieces/PieceType';

/** A special move the player triggers on demand (button or key). */
export type AbilityId = 'flip';

/** Visible size of the well, in cells. */
export interface WellSize {
  readonly width: number;
  readonly height: number;
  /** The last column touches the first one (the Tower's cylinder). */
  readonly wraps?: boolean;
}

/**
 * Strategy for a mode of the falling family. The engine calls these hooks;
 * each mode adds its own twist without the engine knowing which mode it plays.
 * A new instance is created for every game, so modes can keep their own state.
 */
export interface GameMode {
  readonly id: EngineModeId;
  readonly result: ResultKind;
  readonly well: WellSize;
  /** Full rows disappear (false: they stay, as in Silhouette). */
  readonly clearsLines: boolean;
  /** Soft and hard drops earn points. */
  readonly scoresDrops: boolean;
  /** Pure lines (one colour across) score four times. */
  readonly scoresPureLines: boolean;
  readonly ability: AbilityId | null;

  /** Colour of a new piece. */
  toneFor(type: PieceType, random: RandomSource): Tone;
  /** Called once, before the first piece: subscribe to game events here. */
  attach(game: Game): void;
  /** Called every frame while the game runs. */
  update(game: Game, deltaMs: number): void;
  /** Called after each lock and its line clears, before the next piece. */
  afterLock(game: Game): void;
  /** Multiplier of the points of the next line clear. */
  clearMultiplier(game: Game): number;
  /** Uses the mode's ability; returns false when unavailable. */
  useAbility(game: Game): boolean;
  /** Mode-specific HUD values. */
  indicators(game: Game): readonly Indicator[];
  /** Value saved as the player's result: points, or milliseconds survived. */
  resultValue(game: Game): number;
  /** Translation key of a subtitle for this game (the silhouette's name…), or null. */
  subtitleKey(): string | null;
}
