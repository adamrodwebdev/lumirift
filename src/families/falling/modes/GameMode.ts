import type { RandomSource } from '@/core/Random';
import type { Indicator, ResultKind } from '@/session/GameSession';
import type { FallingModeId } from '@/session/ModeId';
import type { Game } from '../game/Game';
import type { PieceType, Tone } from '../pieces/PieceType';

/** A special move the player triggers on demand (button or key). */
export type AbilityId = 'flip';

/**
 * Strategy for a mode of the falling family. The engine calls these hooks;
 * each mode adds its own twist without the engine knowing which mode it plays.
 * A new instance is created for every game, so modes can keep their own state.
 */
export interface GameMode {
  readonly id: FallingModeId;
  readonly result: ResultKind;
  /** Pure lines (one colour across) score four times. */
  readonly scoresPureLines: boolean;
  readonly ability: AbilityId | null;

  /** Colour of a new piece. */
  toneFor(type: PieceType, random: RandomSource): Tone;
  /** Called once, before the first piece: subscribe to game events here. */
  attach(game: Game): void;
  /** Called every frame while the game runs. */
  update(game: Game, deltaMs: number): void;
  /** Uses the mode's ability; returns false when unavailable. */
  useAbility(game: Game): boolean;
  /** Mode-specific HUD values. */
  indicators(game: Game): readonly Indicator[];
  /** Value saved as the player's result: points, or milliseconds survived. */
  resultValue(game: Game): number;
}
