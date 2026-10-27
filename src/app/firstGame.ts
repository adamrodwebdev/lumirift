import { TRAINING, type TrainingStep } from '@/campaign/Training';
import type { Platform } from '@/platform/Platform';
import type { ModeId } from '@/session/ModeId';

/** The game a new player starts in, before any menu. */
export interface FirstGame {
  readonly modeId: ModeId;
  /** The training's step, or null for a free game. */
  readonly training: TrainingStep | null;
}

/**
 * A new player on a portal starts straight in a game, with no title or menu
 * before it: the training (1.29), or in a test build of one mode, a free game
 * of that mode (1.37: the two builds of a test start alike, the training being
 * a game of Sand). Everywhere else, null: the title screen and its menus.
 */
export function firstGameOf(
  platform: Pick<Platform, 'firstRun' | 'edition'>,
  needsTraining: boolean,
): FirstGame | null {
  if (platform.firstRun !== 'training' || !needsTraining) return null;
  const solo = platform.edition.solo;
  if (solo) return { modeId: solo, training: null };
  const step = TRAINING[0]!;
  return { modeId: step.modeId, training: step };
}
