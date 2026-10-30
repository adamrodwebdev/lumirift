import type { Objective } from '@/progression/Objectives';
import type { ElementName } from '@/session/Elements';

/**
 * Each week's goal (1.36): so many deeds of its element (see `SandSession`),
 * set from the curve bot's free games so that a regular player reaches it in
 * 8 to 20 minutes of Sand, about five games (tests/curve/weekly.test.ts).
 * Water, oil and ice count the pieces poured; acid, the grains it eats.
 */
export const WEEKLY_TARGETS: Readonly<Record<ElementName, number>> = {
  water: 35,
  fire: 35,
  oil: 28,
  ice: 25,
  lightning: 25,
  seed: 70,
  acid: 2000,
};

/** Season points the week's goal brings, once. */
export const WEEKLY_GOAL_POINTS = 150;

/** The week's goal, as an objective of its own kind: the progression advances it like any other. */
export function weeklyObjective(element: ElementName): Objective {
  return { kind: 'element', tier: 'hard', target: WEEKLY_TARGETS[element], element };
}
