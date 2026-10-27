import type { ElementName } from '@/session/Elements';
import type { GameSession } from '@/session/GameSession';
import type { BossId } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';

/** What a finished game tells the progression, whatever its family. */
export interface GameReport {
  readonly modeId: ModeId;
  readonly daily: boolean;
  /** The week's Guardian challenge (absent: not it). */
  readonly guardian?: boolean;
  /** The variant played (AI level of a duel), or null. */
  readonly variant: string | null;
  /** Why it ended: `victory` and `defeat` for a duel, the family's reasons otherwise. */
  readonly reason: string;
  readonly durationMs: number;
  /** Clears (lines, regions…), and lines in all. */
  readonly clears: number;
  readonly lines: number;
  /** Most lines cleared at once. */
  readonly bestAtOnce: number;
  /** Longest combo, counted from 1 (two clears in a row: 2). */
  readonly bestCombo: number;
  /** The Guardian defeated in this game, if any. */
  readonly boss?: BossId;
  /** Each element's deeds in this game (1.36): the week's goal counts its element's. */
  readonly elements?: Readonly<Partial<Record<ElementName, number>>>;
}

/**
 * Follows a game through the events every family publishes, and the time
 * actually played (paused time does not count).
 */
export class GameTracker {
  private durationMs = 0;
  private clears = 0;
  private lines = 0;
  private bestAtOnce = 0;
  private bestCombo = 0;
  private readonly deeds: Partial<Record<ElementName, number>> = {};
  private readonly offs: readonly (() => void)[];

  constructor(session: GameSession) {
    this.offs = [
      session.events.on('clear', ({ lines, combo }) => {
        this.clears++;
        this.lines += lines;
        this.bestAtOnce = Math.max(this.bestAtOnce, lines);
        this.bestCombo = Math.max(this.bestCombo, combo + 1);
      }),
      session.events.on('element', ({ element }) => {
        this.deeds[element] = (this.deeds[element] ?? 0) + 1;
      }),
    ];
  }

  /** The counts so far, while the game runs (the campaign follows its goal with them). */
  get live(): Pick<GameReport, 'durationMs' | 'clears' | 'lines' | 'bestAtOnce'> {
    return {
      durationMs: this.durationMs,
      clears: this.clears,
      lines: this.lines,
      bestAtOnce: this.bestAtOnce,
    };
  }

  /** Time played, while the game runs. */
  tick(deltaMs: number): void {
    this.durationMs += deltaMs;
  }

  report(
    game: Pick<GameReport, 'modeId' | 'daily' | 'guardian' | 'variant' | 'reason' | 'boss'>,
  ): GameReport {
    return {
      ...game,
      durationMs: this.durationMs,
      clears: this.clears,
      lines: this.lines,
      bestAtOnce: this.bestAtOnce,
      bestCombo: this.bestCombo,
      ...(Object.keys(this.deeds).length > 0 ? { elements: { ...this.deeds } } : {}),
    };
  }

  dispose(): void {
    for (const off of this.offs) off();
  }
}
