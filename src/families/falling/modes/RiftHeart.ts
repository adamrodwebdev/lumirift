import type { RandomSource } from '@/core/Random';
import { GuardianHealth, type GuardianPhase } from '@/session/GuardianHealth';

/*
 * The Heart of the Rift, last Guardian: it beats under the well. Before each
 * beat it swells (the holes of the rows to come glow on the floor), then it
 * pushes rows of rubble up from below, each holding a shard of the rift. A
 * row cleared with its shard wounds the Heart deeply: its attack is also its
 * weak point. Every line cleared hurts it a little and holds back its beat.
 * It beats faster by phase; at the last the rift bends the rules: the well
 * is mirrored at each beat, and two rows rise at a time.
 */

/** Time between two beats, by phase (ms). */
const BEAT_MS = [0, 9000, 7500, 6000] as const;
/** It swells this long before it beats: the warning (ms). */
export const SWELL_MS = 2000;
/** Rows pushed up at each beat, by phase. */
const ROWS = [0, 1, 1, 2] as const;
/** Each line cleared holds the next beat back this long (ms), never past a full interval. */
export const HOLD_PER_LINE_MS = 800;

/** Where a hit comes from: the damage it does is the Heart's rule. */
export type HeartHit = 'lines' | 'shard';

/** A shard of the rift cleared with its row. */
export const SHARD_DAMAGE = 15;
/** Lines cleared at once: 1 → 2, 2 → 4, 3 → 7, 4 → 12. */
export const lineDamage = (lines: number): number => [0, 2, 4, 7, 12][Math.min(4, lines)] ?? 0;

/** A row it pushes up: its hole, and the column of its shard. */
export interface RiftRow {
  readonly hole: number;
  readonly shard: number;
}

export type HeartEvent =
  | { readonly type: 'swell'; readonly rows: readonly RiftRow[] }
  | { readonly type: 'beat'; readonly rows: readonly RiftRow[]; readonly mirror: boolean }
  | {
      readonly type: 'hurt';
      readonly hit: HeartHit;
      readonly damage: number;
      readonly health: number;
    }
  | { readonly type: 'phase'; readonly phase: 2 | 3 }
  | { readonly type: 'defeated' };

/** Read-only view of the Heart, for the scenery. */
export interface HeartView {
  readonly health: number;
  readonly phase: GuardianPhase;
  readonly defeated: boolean;
  /** 0 just after a beat, 1 at the next one. */
  readonly beat: number;
  /** The rows it is about to push (while it swells), or none. */
  readonly coming: readonly RiftRow[];
}

export class RiftHeart implements HeartView {
  private readonly life = new GuardianHealth();
  private untilBeat: number;
  private _coming: RiftRow[] = [];
  private readonly events: HeartEvent[] = [];

  constructor(
    private readonly width: number,
    private readonly random: RandomSource,
    /** First beat after this long, so that the player can start building. */
    firstBeatMs = 8000,
  ) {
    this.untilBeat = firstBeatMs;
  }

  get health(): number {
    return this.life.health;
  }
  get phase(): GuardianPhase {
    return this.life.phase;
  }
  get defeated(): boolean {
    return this.life.defeated;
  }
  get beat(): number {
    return 1 - Math.max(0, Math.min(1, this.untilBeat / BEAT_MS[this.phase]));
  }
  /** Time left before its next beat (ms). */
  get nextBeatMs(): number {
    return Math.max(0, this.untilBeat);
  }
  get coming(): readonly RiftRow[] {
    return this._coming;
  }

  /** Lines were cleared at once, `shards` of its shards with them. */
  cleared(lines: number, shards: number): void {
    if (this.defeated || lines <= 0) return;
    this.hurt('lines', lineDamage(lines));
    if (shards > 0) this.hurt('shard', SHARD_DAMAGE * shards);
    // Clearing holds the beat back, but never once it has started to swell.
    if (this._coming.length === 0) {
      this.untilBeat = Math.min(BEAT_MS[this.phase], this.untilBeat + lines * HOLD_PER_LINE_MS);
    }
  }

  /** Time passes: it swells, then beats. Returns what it did. */
  update(deltaMs: number): HeartEvent[] {
    if (this.defeated) return this.drain();
    this.untilBeat -= deltaMs;
    if (this._coming.length === 0 && this.untilBeat <= SWELL_MS) {
      this._coming = this.plan();
      this.events.push({ type: 'swell', rows: this._coming });
    }
    if (this.untilBeat <= 0) {
      this.events.push({ type: 'beat', rows: this._coming, mirror: this.phase === 3 });
      this._coming = [];
      this.untilBeat += BEAT_MS[this.phase];
    }
    return this.drain();
  }

  /** What it did since the last call, oldest first. */
  drain(): HeartEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  /** The rows of the next beat: two rows of one beat share their hole, to be cleared together. */
  private plan(): RiftRow[] {
    const hole = this.random.nextInt(this.width);
    return Array.from({ length: ROWS[this.phase] }, () => {
      const shard = (hole + 1 + this.random.nextInt(this.width - 1)) % this.width;
      return { hole, shard };
    });
  }

  private hurt(hit: HeartHit, amount: number): void {
    if (this.defeated || amount <= 0) return;
    const { damage, health, phase, defeated } = this.life.wound(amount);
    this.events.push({ type: 'hurt', hit, damage, health });
    if (phase) this.events.push({ type: 'phase', phase });
    if (defeated) {
      this._coming = [];
      this.events.push({ type: 'defeated' });
    }
  }
}
