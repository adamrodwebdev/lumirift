import type { RandomSource } from '../core/Random';
import type { Game } from '../game/Game';
import type { PieceType, Tone } from '../pieces/PieceType';

export const MODE_IDS = ['classic', 'daily', 'tide', 'flip', 'chroma'] as const;
export type ModeId = (typeof MODE_IDS)[number];

/** What a mode ranks players on. */
export type ResultKind = 'score' | 'time';

/** A mode-specific value shown in the HUD; `id` is the translation key suffix. */
export interface Indicator {
  readonly id: string;
  readonly value: number;
  readonly format: 'count' | 'duration';
}

/** A special move the player triggers on demand (button or key). */
export type AbilityId = 'flip';

/**
 * Strategy for a game mode. The engine calls these hooks; each mode adds its
 * own twist without the engine knowing which mode it plays. A new instance is
 * created for every game, so modes can keep their own state.
 */
export interface GameMode {
  readonly id: ModeId;
  readonly result: ResultKind;
  /** Pure lines (one colour across) score four times. */
  readonly scoresPureLines: boolean;
  readonly ability: AbilityId | null;
  /** Fixed duration of a game, or null for an endless one. */
  readonly timeLimitMs: number | null;

  /** Seed source: a daily challenge must give everybody the same pieces. */
  createRandom(today: Date): RandomSource;
  /** Colour of a new piece. */
  toneFor(type: PieceType, random: RandomSource): Tone;
  /** Called once, before the first piece: subscribe to game events here. */
  attach(game: Game): void;
  /** Called every frame while the game runs. */
  update(game: Game, deltaMs: number): void;
  /** Uses the mode's ability; returns false when unavailable. */
  useAbility(game: Game): boolean;
  indicators(game: Game): readonly Indicator[];
  /** Value saved as the player's result: points, or milliseconds survived. */
  resultValue(game: Game): number;
}
