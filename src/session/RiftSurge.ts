import { Emitter } from '@/core/Emitter';
import { MAX_SURGE_FACTOR, SURGE_MS, type SurgeTuning } from './SurgeTuning';

export interface RiftSurgeEventMap {
  /** The gauge is full: the player may trigger the surge. */
  ready: Readonly<Record<string, never>>;
  start: Readonly<Record<string, never>>;
  /**
   * The surge ends: the clears it saw, the factor on the points it scored,
   * and its bonus (those points multiplied, less themselves).
   */
  end: { readonly clears: number; readonly factor: number; readonly bonus: number };
}

/**
 * The rift surge (1.25): clears fill a gauge; full, the player triggers it
 * and time runs at a third of its pace for eight seconds, the time to save a
 * game. On the way out, the points scored meanwhile are multiplied by
 * 1 + `bonusPerClear` for each clear made during it (×3 at most): the surge
 * reckons that bonus from the game's points (`points`, 0 where the game keeps
 * none). Rules and timing only: the screen slows the clock and hands the
 * bonus to the game.
 */
export class RiftSurge {
  readonly events = new Emitter<RiftSurgeEventMap>();
  /** The gauge, 0 to 1. */
  private charge = 0;
  /** Real time left in a surge (ms); 0 outside one. */
  private left = 0;
  private clears = 0;
  /** The game's points when the surge began. */
  private pointsAtStart = 0;

  constructor(
    private readonly tuning: SurgeTuning,
    private readonly points: () => number = () => 0,
  ) {}

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
    this.pointsAtStart = this.points();
    this.left = SURGE_MS;
    this.events.emit('start', {});
    return true;
  }

  /** Real time goes by (the surge counts it while the game runs). */
  update(realMs: number): void {
    if (!this.active) return;
    this.left = Math.max(0, this.left - realMs);
    if (this.left > 0) return;
    const scored = Math.max(0, this.points() - this.pointsAtStart);
    const bonus = Math.round(scored * (this.factor - 1));
    this.events.emit('end', { clears: this.clears, factor: this.factor, bonus });
    this.clears = 0;
  }

  /** The game ends or starts again: no surge, an empty gauge. */
  reset(): void {
    this.charge = 0;
    this.left = 0;
    this.clears = 0;
    this.pointsAtStart = 0;
  }
}
