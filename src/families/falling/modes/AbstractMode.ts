import type { RandomSource } from '@/core/Random';
import type { Indicator, ResultKind } from '@/session/GameSession';
import type { FallingModeId } from '@/session/ModeId';
import type { Game } from '../game/Game';
import { shapeTone, type PieceType, type Tone } from '../pieces/PieceType';
import type { AbilityId, GameMode } from './GameMode';

export interface ModeOptions {
  /** Ends the game after this time (daily challenge); null for endless. */
  readonly timeLimitMs?: number | null;
}

/**
 * Default behaviour shared by every mode: colour by shape, no ability,
 * endless unless timed, ranked on points. Modes override only their twist,
 * through the `tick` and `ownIndicators` template hooks.
 */
export abstract class AbstractMode implements GameMode {
  abstract readonly id: FallingModeId;
  readonly result: ResultKind = 'score';
  readonly scoresPureLines: boolean = false;
  readonly ability: AbilityId | null = null;
  protected readonly timeLimitMs: number | null;

  constructor(options: ModeOptions = {}) {
    this.timeLimitMs = options.timeLimitMs ?? null;
  }

  toneFor(type: PieceType, _random: RandomSource): Tone {
    return shapeTone(type);
  }

  attach(_game: Game): void {
    // No subscription by default.
  }

  update(game: Game, deltaMs: number): void {
    if (this.timeLimitMs !== null && game.elapsedMs >= this.timeLimitMs) {
      game.finish('timeUp');
      return;
    }
    this.tick(game, deltaMs);
  }

  useAbility(_game: Game): boolean {
    return false;
  }

  indicators(game: Game): readonly Indicator[] {
    const own = this.ownIndicators(game);
    if (this.timeLimitMs === null) return own;
    const timeLeft = Math.max(0, this.timeLimitMs - game.elapsedMs);
    return [{ id: 'timeLeft', value: timeLeft, format: 'duration' }, ...own];
  }

  resultValue(game: Game): number {
    return game.score;
  }

  /** What changes over time in this mode. */
  protected tick(_game: Game, _deltaMs: number): void {
    // Nothing by default.
  }

  /** HUD values specific to this mode. */
  protected ownIndicators(_game: Game): Indicator[] {
    return [];
  }
}
