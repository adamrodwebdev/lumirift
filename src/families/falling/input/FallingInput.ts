import type { FallingCommand } from '../FallingSession';
import { DEFAULT_REPEAT, type RepeatTiming } from './RepeatTiming';

/** What the player wants to do, whatever the device. */
export type FallingAction =
  | 'left'
  | 'right'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCw'
  | 'rotateCcw'
  | 'hold'
  | 'ability'
  | 'pause';

/** The most moves an instant repeat makes in a frame (wider than any well). */
const MAX_SLIDE = 64;

const ONE_SHOT: Readonly<Partial<Record<FallingAction, FallingCommand>>> = {
  hardDrop: { type: 'hardDrop' },
  rotateCw: { type: 'rotate', direction: 1 },
  rotateCcw: { type: 'rotate', direction: -1 },
  hold: { type: 'hold' },
  ability: { type: 'ability' },
};

/**
 * Turns presses and releases (keyboard keys, touch buttons) into commands,
 * including the auto-repeat of held moves, at the player's timing (read each
 * frame: a change in the settings applies at once). Devices only report
 * actions; timing lives here, in one place.
 */
export class FallingInput {
  /** Horizontal directions currently held, most recent last. */
  private readonly held: ('left' | 'right')[] = [];
  private charge = 0;
  private repeating = false;

  /** `execute` answers whether the command did something (a move against a wall does not). */
  constructor(
    private readonly execute: (command: FallingCommand) => boolean,
    private readonly onPause: () => void,
    private readonly timing: () => RepeatTiming = () => DEFAULT_REPEAT,
  ) {}

  press(action: FallingAction): void {
    if (action === 'pause') {
      this.onPause();
      return;
    }
    if (action === 'left' || action === 'right') {
      this.release(action);
      this.held.push(action);
      this.shift(action);
      this.charge = 0;
      this.repeating = false;
      return;
    }
    if (action === 'softDrop') {
      this.execute({ type: 'softDrop', active: true });
      return;
    }
    const command = ONE_SHOT[action];
    if (command) this.execute(command);
  }

  release(action: FallingAction): void {
    if (action === 'softDrop') {
      this.execute({ type: 'softDrop', active: false });
      return;
    }
    if (action !== 'left' && action !== 'right') return;
    const index = this.held.indexOf(action);
    if (index < 0) return;
    this.held.splice(index, 1);
    // Back to the other direction, still held: it restarts its own delay.
    this.charge = 0;
    this.repeating = false;
  }

  /** Releases everything (focus lost, pause): nothing stays stuck down. */
  releaseAll(): void {
    this.held.length = 0;
    this.execute({ type: 'softDrop', active: false });
  }

  update(deltaMs: number): void {
    const direction = this.held.at(-1);
    if (!direction) return;
    const { das, arr } = this.timing();
    this.charge += deltaMs;
    if (!this.repeating) {
      if (this.charge < das) return;
      this.charge -= das;
      this.repeating = true;
      if (arr > 0) this.repeat(direction);
    }
    if (arr <= 0) {
      // Instant: to the wall, and back to it after a rotation, while held.
      this.charge = 0;
      for (let moves = 0; moves < MAX_SLIDE && this.repeat(direction); moves++);
      return;
    }
    while (this.charge >= arr) {
      this.charge -= arr;
      this.repeat(direction);
    }
  }

  /** True when the piece moved (or the next one keeps the step). */
  private shift(direction: 'left' | 'right'): boolean {
    return this.execute({ type: 'move', direction: direction === 'left' ? -1 : 1 });
  }

  /** The held key's repeat: the piece in play only (the next one starts its own, 1.41). */
  private repeat(direction: 'left' | 'right'): boolean {
    return this.execute({ type: 'move', direction: direction === 'left' ? -1 : 1, repeat: true });
  }
}
