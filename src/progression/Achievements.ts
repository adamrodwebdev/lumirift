import type { Achievements } from './Cosmetics';
import { levelProgress } from './Experience';
import type { ProfileData } from './Profile';

/** What the unlock rules look at, in saved data. */
export function achievementsOf(data: ProfileData): Achievements {
  return {
    level: levelProgress(data.xp).level,
    bestStreak: data.streak.best,
    objectivesDone: data.objectivesDone,
    bosses: data.bosses,
    gifted: data.gifted,
  };
}
