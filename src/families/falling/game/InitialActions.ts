import type { RotationDirection } from '../pieces/PieceType';

/** A column to the left (−1) or to the right (1). */
export type Step = -1 | 1;

/** What the kept actions are played on: the piece that has just entered. */
export interface ActionTarget {
  hold(): boolean;
  rotate(direction: RotationDirection): boolean;
  /** One column sideways; false against a wall. */
  shift(dx: Step): boolean;
}

/**
 * What the player asks while the next piece waits to enter after a clear
 * (its pause, which a hit-stop lengthens, 1.41): the turns, a hold and the
 * side steps, played the moment it enters, so that no gesture is lost. A hard
 * drop or a step down is not kept (pressed twice, it would throw the next
 * piece away unseen), nor the repeat of a held key, which the input plays
 * again as soon as the piece is in. The steps stop at the well's width.
 */
export class InitialActions {
  private turns = 0;
  private steps = 0;
  private holding = false;

  constructor(private readonly maxSteps: number) {}

  turn(direction: RotationDirection): void {
    this.turns = (this.turns + direction + 4) % 4;
  }

  /** One more step that way still fits within the well's width. */
  canStep(direction: Step): boolean {
    return Math.abs(this.steps + direction) <= this.maxSteps;
  }

  step(direction: Step): void {
    if (this.canStep(direction)) this.steps += direction;
  }

  hold(): void {
    this.holding = true;
  }

  /** Plays the kept actions on the piece that has just entered (hold, turns, steps), then forgets them. */
  playOn(target: ActionTarget): void {
    const { holding, turns, steps } = this;
    this.forget();
    if (holding) target.hold();
    if (turns === 3) target.rotate(-1);
    else for (let turn = 0; turn < turns; turn++) target.rotate(1);
    const direction: Step = steps < 0 ? -1 : 1;
    for (let step = 0; step < Math.abs(steps) && target.shift(direction); step++);
  }

  forget(): void {
    this.turns = 0;
    this.steps = 0;
    this.holding = false;
  }
}
