import type { RandomSource } from '@/core/Random';
import type { GameSession } from '@/session/GameSession';
import type { CampaignLevel } from '../Levels';

/** The three players every level is measured with (1.33). */
export const PLAYER_SKILLS = ['newcomer', 'regular', 'expert'] as const;
export type PlayerSkill = (typeof PLAYER_SKILLS)[number];

/**
 * A simulated player of one family, for the curve bot. Like the duel's AI,
 * it reads its game as a player looks at the screen and acts only through
 * the session's commands.
 */
export interface CurvePlayer {
  /** True while the game gives it nothing to act on (between two pieces): dead time. */
  readonly idle: boolean;
  /** A frame: the player thinks and acts. */
  update(deltaMs: number): void;
  dispose(): void;
}

/** What a player sits down to: its game, its skill, its own draws, and the level (its goal is on screen). */
export interface CurveSeat {
  readonly session: GameSession;
  readonly skill: PlayerSkill;
  readonly random: RandomSource;
  readonly level: CampaignLevel;
}

/** Makes a family's player for a seat at a game of that family. */
export type CurvePlayerFactory = (seat: CurveSeat) => CurvePlayer;
