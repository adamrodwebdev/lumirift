import { describe, expect, it } from 'vitest';
import { WEEKLY_TARGETS } from '@/seasons/WeeklyGoals';
import { ELEMENT_NAMES, type ElementName } from '@/session/Elements';
import { playSandWeek } from './elementWeek';

/*
 * The week's goal (1.36), measured: the curve bot's players play free games
 * of Sand (three minutes at most each) with the week's element featured. A
 * regular reaches each goal in 8 to 20 minutes of Sand, about five games; a
 * newcomer in 30 at most: a nudge towards the Sand over a week, never a grind.
 */
const GAMES = 4;

/** Minutes of Sand needed, at the rate the bot's deeds came. */
const minutesToGoal = (skill: 'newcomer' | 'regular', element: ElementName) => {
  const games = Array.from({ length: GAMES }, (_, seed) =>
    playSandWeek(skill, 7000 + seed, element),
  );
  const minutes = games.reduce((sum, each) => sum + each.durationMs, 0) / 60_000;
  const deeds = games.reduce((sum, each) => sum + each.deeds, 0);
  return WEEKLY_TARGETS[element] / (deeds / minutes);
};

describe('The week’s goal', () => {
  for (const element of ELEMENT_NAMES) {
    it(`${element}: a regular reaches it in 8 to 20 minutes of Sand, a newcomer in 30 at most`, () => {
      const regular = minutesToGoal('regular', element);
      expect(regular).toBeGreaterThanOrEqual(8);
      expect(regular).toBeLessThanOrEqual(20);
      expect(minutesToGoal('newcomer', element)).toBeLessThanOrEqual(30);
    }, 120_000);
  }
});
