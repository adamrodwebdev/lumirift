import type { RandomSource } from '@/core/Random';
import { GuardianHealth, type GuardianPhase } from '@/session/GuardianHealth';

/*
 * The Eye of the Tower, Guardian of the Vertigos: a great eye circling the
 * tower like a moon. Its gaze lights a sector of columns. It watches while it
 * turns, then stops and charges (the beam reddens), then strikes: a stone
 * falls on each column of its sector (in the last phase, a ring of rubble
 * rises from below as well). A bomb going off in its gaze blinds it: a heavy
 * blow that cancels the charge and leaves it shut for a while. Every ring
 * cleared hurts it too. Rules only: the Tower mode applies its strikes.
 */

/** How far its gaze reaches on each side of its centre, in columns, by phase. */
const REACH = [0, 2, 3, 3] as const;
/** Columns it turns per second while it watches, by phase. */
const SPEED = [0, 0.8, 1.1, 1.4] as const;
/** How long it watches, then charges, by phase (ms). */
const WATCH_MS = [0, 7000, 5500, 4500] as const;
const CHARGE_MS = [0, 2500, 2000, 1800] as const;
/** A blinded eye stays shut this long (ms). */
export const BLIND_MS = 3000;

/** Where a hit comes from: the damage it does is the Eye's rule. */
export type EyeHit = 'rings' | 'blind' | 'bomb';

/** A bomb in its gaze, a bomb elsewhere. */
export const BLIND_DAMAGE = 15;
export const BOMB_DAMAGE = 5;
/** Damage of rings cleared at once: 5 for one, 8 more for each other. */
export const ringDamage = (rings: number): number => (rings <= 0 ? 0 : 5 + 8 * (rings - 1));

export type EyeState = 'watch' | 'charge' | 'blind' | 'dead';

export type EyeEvent =
  | { readonly type: 'charge'; readonly centre: number; readonly reach: number }
  | { readonly type: 'strike'; readonly columns: readonly number[]; readonly rubble: boolean }
  | { readonly type: 'blinded' }
  | { readonly type: 'open' }
  | {
      readonly type: 'hurt';
      readonly hit: EyeHit;
      readonly damage: number;
      readonly health: number;
    }
  | { readonly type: 'phase'; readonly phase: 2 | 3 }
  | { readonly type: 'defeated' };

/** Read-only view of the Eye, for the renderer. */
export interface EyeView {
  readonly health: number;
  readonly phase: GuardianPhase;
  readonly state: EyeState;
  /** Column its gaze is centred on (continuous, around the tower). */
  readonly centre: number;
  /** Columns its gaze reaches on each side. */
  readonly reach: number;
  /** 0 to 1 through a charge. */
  readonly charge: number;
}

/** How an Eye comes: where it looks first, when it first charges, with how much health. */
export interface EyePace {
  /** The column it starts on. */
  readonly start?: number;
  /** First charge after this long, so that the player sees it turn first (ms). */
  readonly firstWatchMs?: number;
  /** Its health (a race's comes weakened); full by default. */
  readonly health?: number;
}

export class TowerEye implements EyeView {
  private readonly life: GuardianHealth;
  private _state: EyeState = 'watch';
  private _centre: number;
  private timer: number;
  private direction: 1 | -1 = 1;
  private readonly events: EyeEvent[] = [];

  constructor(
    private readonly columns: number,
    private readonly random: RandomSource,
    { start = 0, firstWatchMs = 6000, health }: EyePace = {},
  ) {
    this._centre = start;
    this.timer = firstWatchMs;
    this.life = new GuardianHealth(health);
  }

  get health(): number {
    return this.life.health;
  }
  get maxHealth(): number {
    return this.life.maxHealth;
  }
  get phase(): GuardianPhase {
    return this.life.phase;
  }
  get defeated(): boolean {
    return this.life.defeated;
  }
  get state(): EyeState {
    return this._state;
  }
  get centre(): number {
    return this._centre;
  }
  get reach(): number {
    return REACH[this.phase];
  }
  get charge(): number {
    return this._state === 'charge' ? 1 - this.timer / CHARGE_MS[this.phase] : 0;
  }

  /** True when column x lies in its gaze. */
  sees(x: number): boolean {
    const d = Math.abs(this.wrap(Math.floor(x)) - Math.floor(this._centre));
    return Math.min(d, this.columns - d) <= this.reach;
  }

  /** The columns of its gaze, centre first. */
  gaze(): number[] {
    const middle = Math.floor(this._centre);
    const columns = [this.wrap(middle)];
    for (let d = 1; d <= this.reach; d++) {
      columns.push(this.wrap(middle - d), this.wrap(middle + d));
    }
    return columns;
  }

  /** Rings were cleared at once. */
  ringsCleared(rings: number): void {
    this.hurt('rings', ringDamage(rings));
  }

  /** A bomb went off at column x: in its gaze, it is blinded. */
  bombAt(x: number): void {
    if (this.defeated) return;
    if (this._state !== 'blind' && this.sees(x)) {
      this._state = 'blind';
      this.timer = BLIND_MS;
      this.events.push({ type: 'blinded' });
      this.hurt('blind', BLIND_DAMAGE);
    } else {
      this.hurt('bomb', BOMB_DAMAGE);
    }
  }

  /** Time passes: it turns, charges, strikes, opens again. Returns what it did. */
  update(deltaMs: number): EyeEvent[] {
    if (this.defeated) return this.drain();
    this.timer -= deltaMs;
    switch (this._state) {
      case 'watch':
        this._centre = this.wrap(
          this._centre + (this.direction * SPEED[this.phase] * deltaMs) / 1000,
        );
        if (this.timer <= 0) {
          this._state = 'charge';
          this.timer = CHARGE_MS[this.phase];
          this.events.push({ type: 'charge', centre: this._centre, reach: this.reach });
        }
        break;
      case 'charge':
        if (this.timer <= 0) {
          this.events.push({ type: 'strike', columns: this.gaze(), rubble: this.phase === 3 });
          this.watch();
        }
        break;
      case 'blind':
        if (this.timer <= 0) {
          this.events.push({ type: 'open' });
          this.watch();
        }
        break;
      default:
        break;
    }
    return this.drain();
  }

  /** What it did since the last call, oldest first. */
  drain(): EyeEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  private watch(): void {
    this._state = 'watch';
    this.timer = WATCH_MS[this.phase];
    // From the second phase it may turn back, so that the player cannot just wait for it.
    if (this.phase >= 2 && this.random.next() < 0.5) this.direction = this.direction === 1 ? -1 : 1;
  }

  private hurt(hit: EyeHit, amount: number): void {
    if (this.defeated || amount <= 0) return;
    const { damage, health, phase, defeated } = this.life.wound(amount);
    this.events.push({ type: 'hurt', hit, damage, health });
    if (phase) this.events.push({ type: 'phase', phase });
    if (defeated) {
      this._state = 'dead';
      this.events.push({ type: 'defeated' });
    }
  }

  private wrap(x: number): number {
    const r = x % this.columns;
    return r < 0 ? r + this.columns : r;
  }
}
