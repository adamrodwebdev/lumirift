import type { RandomSource } from '@/core/Random';
import { GuardianHealth, type GuardianPhase } from '@/session/GuardianHealth';
import type { Grid } from './Grid';
import type { Cell } from './Shape';

/*
 * The Ceramic Golem, Guardian of the Mosaics: the board is its armour. It
 * aims at free cells (they glow, the count of placements left beside them),
 * then throws a stone on each one still free. A stone fills its cell but a
 * cleared line only cracks it; the next line breaks it. Filling an aimed cell
 * first parries the stone. Every clear hurts the Golem, more with several
 * lines at once and with a streak; its own stones broken hurt it too.
 * Turn-based like the Mosaic: it acts after the player's placements.
 */

/** Placements between two throws, and stones per throw, by phase. */
const EVERY = [0, 3, 3, 3] as const;
const STONES = [0, 2, 3, 4] as const;

/** Where a hit comes from: the damage it does is the Golem's rule. */
export type GolemHit = 'clear' | 'parry' | 'shatter' | 'perfect';

/** Damage of a parry (per stone), of a stone of its own broken, of an empty board. */
export const PARRY_DAMAGE = 2;
export const SHATTER_DAMAGE = 3;
export const PERFECT_DAMAGE = 20;

/** Damage of a clear: 4 for a line, 7 more for each other line at once, plus the streak (up to 4). */
export const clearDamage = (lines: number, streak: number): number =>
  lines <= 0 ? 0 : 4 * lines + 3 * (lines - 1) + Math.min(4, Math.max(0, streak - 1));

export type GolemEvent =
  | { readonly type: 'aim'; readonly targets: readonly Cell[] }
  | { readonly type: 'throw'; readonly stones: readonly Cell[] }
  | { readonly type: 'parry'; readonly cells: readonly Cell[] }
  | {
      readonly type: 'hurt';
      readonly hit: GolemHit;
      readonly damage: number;
      readonly health: number;
    }
  | { readonly type: 'phase'; readonly phase: 2 | 3 }
  | { readonly type: 'defeated' };

/** What the undo puts back. */
export interface GolemSnapshot {
  readonly health: number;
  readonly targets: readonly Cell[];
  readonly countdown: number;
}

/** Read-only view of the Golem, for the renderer. */
export interface GolemView {
  readonly health: number;
  readonly phase: GuardianPhase;
  readonly defeated: boolean;
  /** Cells it aims at, for its next throw. */
  readonly targets: readonly Cell[];
  /** Placements left before it throws. */
  readonly countdown: number;
}

export class CeramicGolem implements GolemView {
  private readonly life = new GuardianHealth();
  private _targets: Cell[] = [];
  private _countdown: number = EVERY[1];
  private readonly events: GolemEvent[] = [];

  constructor(
    private readonly grid: Grid,
    private readonly random: RandomSource,
  ) {}

  get health(): number {
    return this.life.health;
  }
  get phase(): GuardianPhase {
    return this.life.phase;
  }
  get defeated(): boolean {
    return this.life.defeated;
  }
  get targets(): readonly Cell[] {
    return this._targets;
  }
  get countdown(): number {
    return this._countdown;
  }

  /** It opens the fight by aiming its first throw. */
  start(): void {
    this.aim();
  }

  /** A piece was set on these cells: the aimed ones are parried. */
  placed(cells: readonly Cell[]): void {
    const parried = this._targets.filter((t) => cells.some((c) => c.x === t.x && c.y === t.y));
    if (parried.length === 0) return;
    this._targets = this._targets.filter((t) => !parried.includes(t));
    this.events.push({ type: 'parry', cells: parried });
    this.hurt('parry', PARRY_DAMAGE * parried.length);
  }

  /** Lines cleared at once (with the streak), and its own stones they broke. */
  struck(lines: number, streak: number, shattered: number, perfect: boolean): void {
    this.hurt('clear', clearDamage(lines, streak));
    if (shattered > 0) this.hurt('shatter', SHATTER_DAMAGE * shattered);
    if (perfect) this.hurt('perfect', PERFECT_DAMAGE);
  }

  /** The player's turn is over: one placement closer to the throw. */
  endTurn(): void {
    if (this.defeated) return;
    if (--this._countdown > 0) return;
    const stones = this._targets.filter(({ x, y }) => this.grid.putStone(x, y));
    this.events.push({ type: 'throw', stones });
    this.aim();
  }

  /** What it did since the last call, oldest first. */
  drain(): GolemEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  snapshot(): GolemSnapshot {
    return { health: this.health, targets: [...this._targets], countdown: this._countdown };
  }

  restore(snapshot: GolemSnapshot): void {
    this.life.restore(snapshot.health);
    this._targets = [...snapshot.targets];
    this._countdown = snapshot.countdown;
    this.events.length = 0;
  }

  private hurt(hit: GolemHit, amount: number): void {
    if (this.defeated || amount <= 0) return;
    const { damage, health, phase, defeated } = this.life.wound(amount);
    this.events.push({ type: 'hurt', hit, damage, health });
    if (phase) this.events.push({ type: 'phase', phase });
    if (defeated) {
      this._targets = [];
      this.events.push({ type: 'defeated' });
    }
  }

  /**
   * Chooses the cells of the next throw: free cells in open ground (a stone
   * there splits the room the pieces need), on different rows and columns
   * when it can, so that one piece cannot parry them all.
   */
  private aim(): void {
    const { grid, random } = this;
    const phase = this.phase;
    this._countdown = EVERY[phase];
    const open = (x: number, y: number) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => grid.isFree(x + dx!, y + dy!)).length;
    const free: { x: number; y: number; rank: number }[] = [];
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.isFree(x, y)) free.push({ x, y, rank: open(x, y) + random.next() * 2.5 });
      }
    }
    free.sort((a, b) => b.rank - a.rank);
    const chosen: Cell[] = [];
    for (const strict of [true, false]) {
      for (const cell of free) {
        if (chosen.length >= STONES[phase]) break;
        if (chosen.some((c) => c.x === cell.x && c.y === cell.y)) continue;
        if (strict && chosen.some((c) => c.x === cell.x || c.y === cell.y)) continue;
        chosen.push({ x: cell.x, y: cell.y });
      }
    }
    this._targets = chosen;
    this.events.push({ type: 'aim', targets: chosen });
  }
}
