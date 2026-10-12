import type { FallingCommand } from '../FallingSession';

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

/** Delayed auto shift, then auto repeat rate, for held horizontal moves. */
export const DAS_MS = 170;
export const ARR_MS = 50;

/**
 * Keys by physical position (`KeyboardEvent.code`): the same places work on
 * AZERTY and QWERTY. `KeyZ` is W on AZERTY, `KeyA` is Q.
 */
export const KEY_BINDINGS: Readonly<Record<string, FallingAction>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'softDrop',
  KeyS: 'softDrop',
  Space: 'hardDrop',
  ArrowUp: 'rotateCw',
  KeyX: 'rotateCw',
  KeyZ: 'rotateCcw',
  ControlLeft: 'rotateCcw',
  ControlRight: 'rotateCcw',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
  KeyF: 'ability',
  Escape: 'pause',
  KeyP: 'pause',
};

const ONE_SHOT: Readonly<Partial<Record<FallingAction, FallingCommand>>> = {
  hardDrop: { type: 'hardDrop' },
  rotateCw: { type: 'rotate', direction: 1 },
  rotateCcw: { type: 'rotate', direction: -1 },
  hold: { type: 'hold' },
  ability: { type: 'ability' },
};

/**
 * Turns presses and releases (keyboard keys, touch buttons) into commands,
 * including the auto-repeat of held moves. Devices only report actions;
 * timing lives here, in one place.
 */
export class FallingInput {
  /** Horizontal directions currently held, most recent last. */
  private readonly held: ('left' | 'right')[] = [];
  private charge = 0;
  private repeating = false;

  constructor(
    private readonly execute: (command: FallingCommand) => void,
    private readonly onPause: () => void,
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
    this.charge += deltaMs;
    if (!this.repeating) {
      if (this.charge < DAS_MS) return;
      this.charge -= DAS_MS;
      this.repeating = true;
      this.shift(direction);
    }
    while (this.charge >= ARR_MS) {
      this.charge -= ARR_MS;
      this.shift(direction);
    }
  }

  private shift(direction: 'left' | 'right'): void {
    this.execute({ type: 'move', direction: direction === 'left' ? -1 : 1 });
  }
}
