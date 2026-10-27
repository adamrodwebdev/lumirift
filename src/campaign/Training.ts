import type { BossId, TrainingStage } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { Goal } from './Goals';

export type TrainingStepId = 'firstEncounter';

/**
 * A step of the portals' training (1.29): on a portal, a new player plays
 * these in order before any menu. Independent of the campaign: no stars, no
 * clock, no defeat, no ad; the experience gained counts.
 */
export interface TrainingStep {
  readonly id: TrainingStepId;
  readonly modeId: ModeId;
  readonly goal: Goal;
  /** How its game is staged: its well, its pieces. */
  readonly stage: TrainingStage;
  /** The Guardian in its well, or none. */
  readonly boss?: BossId;
  /** The Guardian that shows itself once the step is won (here: it leaves the well). */
  readonly teaser?: BossId;
}

/**
 * The training (1.33): one game, no window in between. The first bolt shocks
 * the sand wherever it lands, the blaze and the vine follow, then the Dune
 * Wyrm surfaces, before half a minute is out whatever the player does: one
 * hit drives it away, until level 2-7.
 */
export const TRAINING: readonly TrainingStep[] = [
  {
    id: 'firstEncounter',
    modeId: 'sand',
    goal: { kind: 'boss', target: 1 },
    stage: 'hook',
    boss: 'duneWorm',
    teaser: 'duneWorm',
  },
];

/** Where the step stands, found by its id: the screen's state hands it back wrapped. */
function indexOf(step: TrainingStep): number {
  return TRAINING.map((each) => each.id).indexOf(step.id);
}

/** The step after this one, or null after the last. */
export function nextTrainingStep(step: TrainingStep): TrainingStep | null {
  return TRAINING[indexOf(step) + 1] ?? null;
}
