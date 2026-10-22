import { Emitter } from '@/core/Emitter';

/**
 * The danger of a game, read from its pressure (0 calm, 1 about to be lost):
 * from 70 % of the well the music tightens, the well cracks and a clear is a
 * close call; from 85 % it is critical. Back under 55 % after a real danger,
 * the player is safe again: the relief.
 */
export const DANGER_FROM = 0.7;
export const CRITICAL_FROM = 0.85;
/** Critical until the pressure falls back under this (no flicker at the threshold). */
const CRITICAL_UNTIL = 0.8;
export const SAFE_BELOW = 0.55;
/** A danger shorter than this is not worth a relief (ms). */
export const RELIEF_AFTER_MS = 1200;
/** How fast the shown amount follows the danger (ms for about two thirds of the way). */
const FOLLOW_MS = 280;
/** The shown amount: nothing under this pressure, all of it at the top. */
const AMOUNT_FROM = 0.62;
const AMOUNT_FULL = 0.95;

export type TensionStage = 'calm' | 'danger' | 'critical';

export interface TensionEventMap {
  stage: { readonly stage: TensionStage };
  /** The player got out of a danger. */
  relief: Readonly<Record<string, never>>;
}

/** True when a game at this pressure is in danger (the rules' close call). */
export const inDanger = (pressure: number): boolean => pressure >= DANGER_FROM;

/**
 * Follows the danger frame by frame: its stage (calm, danger, critical, with
 * hysteresis), a smooth amount for what is drawn (0 to 1), and the relief
 * when a danger ends.
 */
export class Tension {
  readonly events = new Emitter<TensionEventMap>();
  private _stage: TensionStage = 'calm';
  private _amount = 0;
  private dangerMs = 0;

  get stage(): TensionStage {
    return this._stage;
  }

  /** How much danger to show, 0 to 1, eased. */
  get amount(): number {
    return this._amount;
  }

  /** The game's pressure this frame. */
  update(pressure: number, deltaMs: number): void {
    const target = smoothstep(AMOUNT_FROM, AMOUNT_FULL, pressure);
    this._amount += (target - this._amount) * (1 - Math.exp(-deltaMs / FOLLOW_MS));
    const stage = this.next(pressure);
    if (stage !== 'calm') this.dangerMs += deltaMs;
    if (stage === this._stage) return;
    this._stage = stage;
    this.events.emit('stage', { stage });
    if (stage !== 'calm') return;
    if (this.dangerMs >= RELIEF_AFTER_MS) this.events.emit('relief', {});
    this.dangerMs = 0;
  }

  /** A new game, or none: calm at once, no relief. */
  reset(): void {
    this._amount = 0;
    this.dangerMs = 0;
    if (this._stage === 'calm') return;
    this._stage = 'calm';
    this.events.emit('stage', { stage: 'calm' });
  }

  private next(pressure: number): TensionStage {
    if (pressure >= CRITICAL_FROM) return 'critical';
    if (this._stage === 'critical' && pressure >= CRITICAL_UNTIL) return 'critical';
    if (pressure >= DANGER_FROM) return 'danger';
    if (this._stage !== 'calm' && pressure >= SAFE_BELOW) return 'danger';
    return 'calm';
  }
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}
