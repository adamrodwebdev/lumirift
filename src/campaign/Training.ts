import type { BossId, TrainingStage } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { Goal } from './Goals';

export type TrainingStepId = 'livingSand' | 'firstEncounter';

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
  /** The Guardian that shows itself once the step is won (here: it leaves the well). */
  readonly teaser?: BossId;
}

export const TRAINING: readonly TrainingStep[] = [
  // The elements react in pairs (the shock, the blaze, the vine) while two zones are linked.
  { id: 'livingSand', modeId: 'sand', goal: { kind: 'lines', target: 2 }, stage: 'elements' },
  // The Dune Wyrm surfaces: one hit drives it away, until level 2-7.
  {
    id: 'firstEncounter',
    modeId: 'sand',
    goal: { kind: 'boss', target: 1 },
    stage: 'wyrm',
    teaser: 'duneWorm',
  },
];

/** Where the step stands, found by its id: the screen's state hands it back wrapped. */
function indexOf(step: TrainingStep): number {
  return TRAINING.findIndex((each) => each.id === step.id);
}

/** The step after this one, or null after the last. */
export function nextTrainingStep(step: TrainingStep): TrainingStep | null {
  return TRAINING[indexOf(step) + 1] ?? null;
}

/** The step's rank, from 1, for the player ("step 1 of 2"). */
export function trainingRank(step: TrainingStep): number {
  return indexOf(step) + 1;
}
