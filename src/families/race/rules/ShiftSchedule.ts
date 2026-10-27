import { GUARDIANS } from './RaceTuning';

/** The worlds the Rift turns through, in order: never the Mosaic, whose board has no fall. */
export const RACE_WORLDS = ['well', 'sand', 'tower'] as const;
export type RaceWorld = (typeof RACE_WORLDS)[number];

/**
 * The turn of the worlds (1.34): one world a phase, the well, the Sand, the
 * Tower, again and again. Each full cycle raises the score's multiplier and,
 * on the fresh board of its first world, the gravity; never right after a
 * Guardian was beaten, when the speed-up waits for the next world.
 */
export class ShiftSchedule {
  private index = 0;
  private gravity = 1;
  /** Speed-ups due, waiting for a world that did not just see a Guardian fall. */
  private owed = 0;

  /** The phase played, from 0. */
  get phase(): number {
    return this.index;
  }

  get world(): RaceWorld {
    return RACE_WORLDS[this.index % RACE_WORLDS.length]!;
  }

  /** The world the next shift opens. */
  get next(): RaceWorld {
    return RACE_WORLDS[(this.index + 1) % RACE_WORLDS.length]!;
  }

  /** The cycle played, from 1: also the score's multiplier. */
  get cycle(): number {
    return Math.floor(this.index / RACE_WORLDS.length) + 1;
  }

  /** The level the world's game starts at: its gravity. */
  get level(): number {
    return this.gravity;
  }

  /** The next shift raises the gravity (the warning says so), given whether a Guardian fell in this phase. */
  speedsUp(beaten: boolean): boolean {
    return !beaten && (this.owed > 0 || this.cycleStartsNext());
  }

  /** The shift: the next world, faster when a cycle begins. */
  advance(beaten: boolean): void {
    if (this.cycleStartsNext()) this.owed++;
    if (!beaten && this.owed > 0) {
      this.owed--;
      this.gravity++;
    }
    this.index++;
  }

  private cycleStartsNext(): boolean {
    return (this.index + 1) % RACE_WORLDS.length === 0;
  }
}

/**
 * Whether a Guardian joins the world a shift opens (1.34): none at the
 * first, one surely at the second, then a quarter's chance, plus a quarter
 * for each shift without one since the last. `roll` is a draw in [0, 1).
 */
export function guardianJoins(shift: number, without: number, roll: number): boolean {
  if (shift < GUARDIANS.sureAtShift) return false;
  if (shift === GUARDIANS.sureAtShift) return true;
  return roll < GUARDIANS.chance * (1 + without);
}
