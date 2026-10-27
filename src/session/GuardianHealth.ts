/** Every Guardian of the rift has this much health; the campaign's boss goal is the same. */
export const GUARDIAN_HEALTH = 100;
/** A Guardian changes phase below these shares of its health (second, then third). */
const PHASE_BELOW = [0.66, 0.33] as const;

export type GuardianPhase = 1 | 2 | 3;

/** What a hit did to a Guardian. */
export interface GuardianWound {
  readonly damage: number;
  readonly health: number;
  /** The phase it has just entered, if the hit crossed a threshold. */
  readonly phase: 2 | 3 | null;
  readonly defeated: boolean;
}

/**
 * The health of a Guardian and its three phases, shared by every boss: each
 * Guardian decides what hurts it and how much, this keeps the count. A
 * Guardian may come with less than a full health (the Rift Race's, 1.34):
 * its phases follow the health it came with.
 */
export class GuardianHealth {
  private _health: number;
  private _phase: GuardianPhase = 1;

  constructor(readonly maxHealth: number = GUARDIAN_HEALTH) {
    this._health = maxHealth;
  }

  get health(): number {
    return this._health;
  }
  get phase(): GuardianPhase {
    return this._phase;
  }
  get defeated(): boolean {
    return this._health <= 0;
  }

  /** Takes `amount` of damage (no more than the health left). */
  wound(amount: number): GuardianWound {
    const damage = Math.max(0, Math.min(this._health, Math.round(amount)));
    this._health -= damage;
    const phase = this.phaseAt(this._health);
    const entered = phase > this._phase ? (phase as 2 | 3) : null;
    this._phase = Math.max(this._phase, phase) as GuardianPhase;
    return { damage, health: this._health, phase: entered, defeated: this.defeated };
  }

  /** Puts back a health saved earlier (the Mosaic's undo). */
  restore(health: number): void {
    this._health = Math.max(0, Math.min(this.maxHealth, health));
    this._phase = this.phaseAt(this._health);
  }

  private phaseAt(health: number): GuardianPhase {
    const share = health / this.maxHealth;
    return share > PHASE_BELOW[0] ? 1 : share > PHASE_BELOW[1] ? 2 : 3;
  }
}
