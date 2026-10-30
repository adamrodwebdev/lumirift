/**
 * The first game's guide: one step at a time, each completed by doing it
 * (whatever the input: keys, gestures, buttons), then the mode's goal,
 * completed by a first clear. It can be skipped at any time. A player who
 * drops pieces without doing the step shown is past it: after two drops the
 * guide steps aside and shows the goal.
 */
export type CoachStep = 'move' | 'rotate' | 'drop' | 'goal';

/** The commands that drop a piece: two of them past a step, and the guide moves on to the goal. */
const DROPS: readonly string[] = ['hardDrop', 'softDrop'];

/** The commands that complete each step (a finger's row down too, 1.40, though it drops nothing yet). */
const DONE_BY: Readonly<Record<Exclude<CoachStep, 'goal'>, readonly string[]>> = {
  move: ['move'],
  rotate: ['rotate'],
  drop: [...DROPS, 'softStep'],
};

export const COACH_STEPS: readonly CoachStep[] = ['move', 'rotate', 'drop', 'goal'];
/** Pieces dropped without doing the step shown, after which the guide moves on to the goal. */
export const DROPS_BEFORE_GOAL = 2;

export class Coach {
  private index = 0;
  /** Pieces dropped while the current step was shown, without doing it. */
  private drops = 0;

  constructor(private readonly steps: readonly CoachStep[] = COACH_STEPS) {}

  /** The step to show, or null once the guide is over. */
  get step(): CoachStep | null {
    return this.steps[this.index] ?? null;
  }

  /** A command the player gave; true when it completed the current step. */
  command(type: string): boolean {
    const step = this.step;
    if (!step || step === 'goal') return false;
    if (DONE_BY[step].includes(type)) {
      this.index++;
      this.drops = 0;
      return true;
    }
    if (!DROPS.includes(type) || ++this.drops < DROPS_BEFORE_GOAL) return false;
    // Already playing: the remaining steps would only hide the well.
    const goal = this.steps.indexOf('goal');
    this.index = goal < 0 ? this.steps.length : goal;
    this.drops = 0;
    return true;
  }

  /** A first clear completes the goal (and any step still shown). */
  cleared(): boolean {
    if (!this.step) return false;
    this.index = this.steps.length;
    return true;
  }

  skip(): void {
    this.index = this.steps.length;
  }
}
