import type { RandomSource } from '@/core/Random';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import type { Indicator, ResultKind } from '@/session/GameSession';
import type { EngineModeId } from '@/session/ModeId';
import { Board } from '../board/Board';
import type { Game } from '../game/Game';
import { shapeTone, type PieceType, type Tone } from '../pieces/PieceType';
import type { AbilityId, BlastSize, GameMode, WellSize } from './GameMode';

/** Lumirift's well: ten columns, like the genre's, and 18 rows (see `Board`). */
export const STANDARD_WELL: WellSize = { width: Board.WIDTH, height: Board.VISIBLE_HEIGHT };

export interface ModeOptions {
  /** Ends the game after this time (daily challenge); null for endless. */
  readonly timeLimitMs?: number | null;
  /** Date of play (the silhouette of the day…). */
  readonly today?: Date;
  /** Campaign upgrades read by a mode (the Rhythm's window, the duel's delay). */
  readonly boosts?: Boosts;
}

/**
 * Default behaviour shared by every mode: colour by shape, no ability,
 * endless unless timed, ranked on points. Modes override only their twist,
 * through the `tick` and `ownIndicators` template hooks.
 */
export abstract class AbstractMode implements GameMode {
  abstract readonly id: EngineModeId;
  readonly result: ResultKind = 'score';
  readonly well: WellSize = STANDARD_WELL;
  readonly clearsLines: boolean = true;
  readonly scoresDrops: boolean = true;
  readonly scoresPureLines: boolean = false;
  readonly ability: AbilityId | null = null;
  protected readonly timeLimitMs: number | null;
  protected readonly today: Date;
  protected readonly boosts: Boosts;

  constructor(options: ModeOptions = {}) {
    this.timeLimitMs = options.timeLimitMs ?? null;
    this.today = options.today ?? new Date();
    this.boosts = options.boosts ?? NO_BOOSTS;
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

  afterLock(_game: Game): void {
    // Nothing happens after a lock by default.
  }

  readonly blast: BlastSize | null = null;

  bombFor(_random: RandomSource, _rank: number): number | null {
    return null;
  }

  clearMultiplier(_game: Game): number {
    return 1;
  }

  subtitleKey(): string | null {
    return null;
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
