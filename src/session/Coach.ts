/**
 * The first game's guide: one step at a time, each completed by doing it
 * (whatever the input: keys, gestures, buttons), then the mode's goal,
 * completed by a first clear. It can be skipped at any time.
 */
export type CoachStep = 'move' | 'rotate' | 'drop' | 'goal';

/** The commands that complete each step. */
const DONE_BY: Readonly<Record<Exclude<CoachStep, 'goal'>, readonly string[]>> = {
  move: ['move'],
  rotate: ['rotate'],
  drop: ['hardDrop', 'softDrop'],
};

export const COACH_STEPS: readonly CoachStep[] = ['move', 'rotate', 'drop', 'goal'];

export class Coach {
  private index = 0;

  constructor(private readonly steps: readonly CoachStep[] = COACH_STEPS) {}

  /** The step to show, or null once the guide is over. */
  get step(): CoachStep | null {
    return this.steps[this.index] ?? null;
  }

  /** A command the player gave; true when it completed the current step. */
  command(type: string): boolean {
    const step = this.step;
    if (!step || step === 'goal' || !DONE_BY[step].includes(type)) return false;
    this.index++;
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
