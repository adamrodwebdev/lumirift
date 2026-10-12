import { SeededRandom, type RandomSource } from '../core/Random';
import type { Game } from '../game/Game';
import { shapeTone, type PieceType, type Tone } from '../pieces/PieceType';
import type { AbilityId, GameMode, Indicator, ModeId, ResultKind } from './GameMode';

/**
 * Default behaviour shared by every mode: random seed, colour by shape, no
 * ability, endless game, ranked on points. Modes override only their twist.
 */
export abstract class AbstractMode implements GameMode {
  abstract readonly id: ModeId;
  readonly result: ResultKind = 'score';
  readonly scoresPureLines: boolean = false;
  readonly ability: AbilityId | null = null;
  readonly timeLimitMs: number | null = null;

  createRandom(_today: Date): RandomSource {
    return new SeededRandom(Math.floor(Math.random() * 2 ** 32));
  }

  toneFor(type: PieceType, _random: RandomSource): Tone {
    return shapeTone(type);
  }

  attach(_game: Game): void {
    // No subscription by default.
  }

  update(_game: Game, _deltaMs: number): void {
    // Nothing happens over time by default.
  }

  useAbility(_game: Game): boolean {
    return false;
  }

  indicators(_game: Game): readonly Indicator[] {
    return [];
  }

  resultValue(game: Game): number {
    return game.score;
  }
}
