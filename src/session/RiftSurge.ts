import { Emitter } from '@/core/Emitter';
import type { FamilyId } from './ModeId';

/** How long a surge lasts, in real time (ms), and the pace of the game meanwhile. */
export const SURGE_MS = 8000;
export const SURGE_PACE = 1 / 3;
/** The exit factor's ceiling. */
export const MAX_SURGE_FACTOR = 3;

/** How a family fills the gauge and rewards a surge. */
export interface SurgeTuning {
  /** Clears (lines, or the Sand's regions) that fill the gauge. */
  readonly clearsToFill: number;
  /** What each clear made during a surge adds to its exit factor. */
  readonly bonusPerClear: number;
}

/** The families with a fall to slow down; a region of sand is worth three lines or so. */
export const SURGE_TUNING: Readonly<Partial<Record<FamilyId, SurgeTuning>>> = {
  falling: { clearsToFill: 12, bonusPerClear: 0.25 },
  volume: { clearsToFill: 12, bonusPerClear: 0.25 },
  sand: { clearsToFill: 4, bonusPerClear: 0.5 },
};

/** The modes whose time is not the player's to bend: the Rhythm's pulse, the Duel's fairness. */
const WITHOUT_SURGE: ReadonlySet<string> = new Set(['rhythm', 'duel']);

/** The surge's tuning for a mode, or null when it has none. */
export function surgeTuningFor(family: FamilyId, modeId: string): SurgeTuning | null {
  return WITHOUT_SURGE.has(modeId) ? null : (SURGE_TUNING[family] ?? null);
}

export interface RiftSurgeEventMap {
  /** The gauge is full: the player may trigger the surge. */
  ready: Readonly<Record<string, never>>;
  start: Readonly<Record<string, never>>;
  /** The surge ends: the clears it saw, and the factor on the points it scored. */
  end: { readonly clears: number; readonly factor: number };
}

/**
 * The rift surge (1.25): clears fill a gauge; full, the player triggers it
 * and time runs at a third of its pace for eight seconds, the time to save a
 * game. On the way out, the points scored meanwhile are multiplied by
 * 1 + `bonusPerClear` for each clear made during it (×3 at most). Rules and
 * timing only: the screen slows the clock and pays the bonus.
 */
export class RiftSurge {
  readonly events = new Emitter<RiftSurgeEventMap>();
  /** The gauge, 0 to 1. */
  private charge = 0;
  /** Real time left in a surge (ms); 0 outside one. */
  private left = 0;
  private clears = 0;

  constructor(private readonly tuning: SurgeTuning) {}

  get active(): boolean {
    return this.left > 0;
  }

  get ready(): boolean {
    return !this.active && this.charge >= 1;
  }

  /** What the gauge shows: its charge, or during a surge, the time left. */
  get fill(): number {
    return this.active ? this.left / SURGE_MS : this.charge;
  }

  /** The factor the surge's points would earn now. */
  get factor(): number {
    return Math.min(MAX_SURGE_FACTOR, 1 + this.clears * this.tuning.bonusPerClear);
  }

  /** Lines (or regions) cleared: they fill the gauge, or count toward a running surge. */
  cleared(count: number): void {
    if (count <= 0) return;
    if (this.active) {
      this.clears += count;
      return;
    }
    if (this.charge >= 1) return;
    this.charge = Math.min(1, this.charge + count / this.tuning.clearsToFill);
    if (this.charge >= 1) this.events.emit('ready', {});
  }

  /** The player's call: a full gauge empties into a surge. Returns false when not ready. */
  trigger(): boolean {
    if (!this.ready) return false;
    this.charge = 0;
    this.clears = 0;
    this.left = SURGE_MS;
    this.events.emit('start', {});
    return true;
  }

  /** Real time goes by (the surge counts it while the game runs). */
  update(realMs: number): void {
    if (!this.active) return;
    this.left = Math.max(0, this.left - realMs);
    if (this.left > 0) return;
    this.events.emit('end', { clears: this.clears, factor: this.factor });
    this.clears = 0;
  }

  /** The game ends or starts again: no surge, an empty gauge. */
  reset(): void {
    this.charge = 0;
    this.left = 0;
    this.clears = 0;
  }
}
