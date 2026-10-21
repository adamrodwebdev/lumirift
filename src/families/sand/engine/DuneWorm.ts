import type { RandomSource } from '@/core/Random';
import { GUARDIAN_HEALTH, GuardianHealth } from '@/session/GuardianHealth';
import { SAND_TONES, type SandGrid } from './SandGrid';

/*
 * The Dune Wyrm, first Guardian of the rift: a boss living in the sand well.
 * It swims under the sand, warns where it will burst out (cracks), bursts up
 * throwing sand, stays out a few seconds with its weak point bare, then dives.
 * Three phases by health. The game hurts it (`hit`) from the elements and the
 * links; the worm acts on the grid itself (sand thrown up, sand swallowed) and
 * reports what it does as events.
 */

export const WORM_HEALTH = GUARDIAN_HEALTH;
const SEGMENTS = 22;
/** Radius of its body, in grains. */
export const WORM_RADIUS = 3.2;
/** How long each step of its cycle lasts (ms), by phase. */
const ROAM_MS = [0, 7000, 5200, 5200] as const;
const WARN_MS = [0, 2000, 1500, 1500] as const;
const SURGE_MS = 700;
const EXPOSED_MS = 3000;
const DIVE_MS = 900;
/** Grains per physics step it swims at, by phase. */
const SPEED = [0, 0.45, 0.6, 0.75] as const;
/** Sand it throws up when it bursts out, in grains. */
const ERUPTION_GRAINS = 160;
/** A hit's damage is not repeated within this long (ms), per kind. */
const HIT_COOLDOWN_MS = 400;

export type WormState = 'roam' | 'warn' | 'surge' | 'exposed' | 'dive' | 'dead';

/** Where a hit comes from: the damage it does is the worm's rule. */
export type WormHit =
  /** Lightning on its head while it is out. */
  | 'boltHead'
  /** Lightning near its body (sand struck around it). */
  | 'boltNear'
  /** A shock through water that touches its body (it is stunned). */
  | 'shock'
  /** A flame touching it while it is out. */
  | 'fire'
  /** A blaze burning against it (each tick). */
  | 'blaze'
  /** A region linking the walls, crossing its body. */
  | 'link';

export const HIT_DAMAGE: Readonly<Record<WormHit, number>> = {
  boltHead: 12,
  boltNear: 4,
  shock: 8,
  fire: 6,
  blaze: 2,
  link: 5,
};
/** A shock leaves it stunned this long (ms). */
const STUN_MS = 1500;

export type WormEvent =
  | { readonly type: 'warn'; readonly x: number }
  | { readonly type: 'surge'; readonly x: number; readonly y: number }
  | { readonly type: 'swallow'; readonly x: number; readonly grains: number }
  | { readonly type: 'dive' }
  | { readonly type: 'storm'; readonly direction: -1 | 1 }
  | { readonly type: 'phase'; readonly phase: 2 | 3 }
  | {
      readonly type: 'hurt';
      readonly hit: WormHit;
      readonly damage: number;
      readonly health: number;
    }
  | { readonly type: 'defeated' };

export class DuneWorm {
  private readonly life = new GuardianHealth();
  private _state: WormState = 'roam';
  private timer: number;
  private stun = 0;
  private heading = Math.PI;
  private target: [number, number] | null = null;
  private _warnAt: number | null = null;
  private surges = 0;
  private readonly cooldowns = new Map<WormHit, number>();
  private clock = 0;
  /** Its body, head first, in grains (x, y pairs). */
  readonly xs = new Float64Array(SEGMENTS);
  readonly ys = new Float64Array(SEGMENTS);
  private readonly events: WormEvent[] = [];

  constructor(
    private readonly grid: SandGrid,
    private readonly random: RandomSource,
    /** First burst after this long, so that the player sees the arena first. */
    firstSurgeMs = 4000,
  ) {
    this.timer = firstSurgeMs;
    for (let k = 0; k < SEGMENTS; k++) {
      this.xs[k] = grid.width / 3 + k * 1.2;
      this.ys[k] = grid.height - 12;
    }
  }

  get health(): number {
    return this.life.health;
  }
  get phase(): 1 | 2 | 3 {
    return this.life.phase;
  }
  get state(): WormState {
    return this._state;
  }
  /** Column where it is about to burst out (while it warns), or null. */
  get warnAt(): number | null {
    return this._state === 'warn' || this._state === 'surge' ? this._warnAt : null;
  }
  /** Its weak point is bare: it is out of the sand. */
  get exposed(): boolean {
    return this._state === 'exposed';
  }
  /** Out of the sand, or on its way in or out (its body shows above the surface). */
  get out(): boolean {
    return this._state === 'surge' || this._state === 'exposed' || this._state === 'dive';
  }
  get stunned(): boolean {
    return this.stun > 0;
  }
  get headX(): number {
    return this.xs[0]!;
  }
  get headY(): number {
    return this.ys[0]!;
  }

  /** True when (x, y) is within its body (plus `extra` grains). */
  touches(x: number, y: number, extra = 0): boolean {
    const r = (WORM_RADIUS + extra) ** 2;
    for (let k = 0; k < SEGMENTS; k++) {
      const dx = this.xs[k]! - x;
      const dy = this.ys[k]! - y;
      if (dx * dx + dy * dy <= r) return true;
    }
    return false;
  }

  /** True when one of these grains (indices of the grid) lies within its body. */
  touchesAny(indices: Iterable<number>, extra = 0): boolean {
    const W = this.grid.width;
    for (const i of indices) if (this.touches(i % W, (i / W) | 0, extra)) return true;
    return false;
  }

  /** Something hurts it; the damage is its own rule. Returns the damage done. */
  hit(kind: WormHit): number {
    if (this._state === 'dead') return 0;
    const last = this.cooldowns.get(kind);
    if (last !== undefined && this.clock - last < HIT_COOLDOWN_MS && kind !== 'boltHead') return 0;
    this.cooldowns.set(kind, this.clock);
    const { damage, health, phase, defeated } = this.life.wound(HIT_DAMAGE[kind]);
    this.events.push({ type: 'hurt', hit: kind, damage, health });
    if (kind === 'shock') this.stun = STUN_MS;
    if (phase) this.events.push({ type: 'phase', phase });
    if (defeated) {
      this._state = 'dead';
      this.events.push({ type: 'defeated' });
    }
    return damage;
  }

  /** What it did since the last call (a hit, a step), oldest first. */
  drain(): WormEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  /** One physics step (16 ms): it moves, warns, bursts, dives. Returns what it did. */
  update(deltaMs: number): WormEvent[] {
    this.clock += deltaMs;
    if (this._state === 'dead') return this.drain();
    if (this.stun > 0) {
      this.stun -= deltaMs;
      return this.drain();
    }
    this.timer -= deltaMs;
    const speed = SPEED[this.phase];
    switch (this._state) {
      case 'roam':
        if (!this.target || this.swim(...this.target, speed) < 2) this.target = this.roamTarget();
        if (this.timer <= 0) this.warn();
        break;
      case 'warn': {
        // It gathers under the cracks, deep enough to rise straight up.
        const x = this._warnAt!;
        this.swim(x, this.surfaceAt(x) + 14, speed * 1.6, 0.3);
        if (this.timer <= 0) {
          this._state = 'surge';
          this.timer = SURGE_MS;
        }
        break;
      }
      case 'surge': {
        const x = this._warnAt!;
        const top = this.surfaceAt(x) - 10;
        this.heading = -Math.PI / 2;
        this.swim(x, top, 1.4, 1);
        if (this.timer <= 0 || this.headY <= top + 1) this.burst();
        break;
      }
      case 'exposed':
        if (this.timer <= 0) {
          this._state = 'dive';
          this.timer = DIVE_MS;
          this.events.push({ type: 'dive' });
        }
        break;
      case 'dive':
        this.swim(this.headX + Math.cos(this.heading) * 3, this.grid.height - 8, 1.1);
        if (this.timer <= 0) this.afterDive();
        break;
      default:
        break;
    }
    return this.drain();
  }

  private warn(): void {
    const margin = 6;
    this._warnAt = margin + this.random.nextInt(this.grid.width - margin * 2);
    this._state = 'warn';
    this.timer = WARN_MS[this.phase];
    this.events.push({ type: 'warn', x: this._warnAt });
  }

  /** Out of the sand: it throws sand up around its head, and gulps the surface in phase 2+. */
  private burst(): void {
    const x = Math.round(this.headX);
    const y = Math.max(0, Math.round(this.headY));
    this.erupt(x, y);
    this.events.push({ type: 'surge', x, y });
    if (this.phase >= 2) {
      const grains = this.swallow(x);
      if (grains > 0) this.events.push({ type: 'swallow', x, grains });
    }
    this._state = 'exposed';
    this.timer = EXPOSED_MS;
    this.surges++;
  }

  private afterDive(): void {
    // Last phase: it comes back up at once, every other time, and raises a storm.
    const again = this.phase === 3 && this.surges % 2 === 1;
    if (this.phase === 3) {
      this.events.push({ type: 'storm', direction: this.random.next() < 0.5 ? -1 : 1 });
    }
    if (again) {
      this.warn();
      return;
    }
    this._state = 'roam';
    this._warnAt = null;
    this.timer = ROAM_MS[this.phase] + this.random.next() * 1500;
  }

  private erupt(x: number, y: number): void {
    const { grid, random } = this;
    for (let k = 0; k < ERUPTION_GRAINS; k++) {
      const nx = x + Math.round((random.next() - 0.5) * 18);
      const ny = y - 2 - random.nextInt(10);
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (grid.isFree(nx, ny)) {
        grid.put(nx, ny, SAND_TONES[random.nextInt(SAND_TONES.length)]!, random.nextInt(4));
      }
    }
  }

  /** Gulps a patch of sand where it comes up; returns the grains eaten. */
  private swallow(x: number): number {
    const { grid } = this;
    const top = this.surfaceAt(x);
    let eaten = 0;
    for (let dy = 0; dy < 10; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const nx = x + dx;
        const ny = top + dy;
        if (nx < 0 || ny >= grid.height || nx >= grid.width || dx * dx + dy * dy >= 60) continue;
        const i = ny * grid.width + nx;
        if (grid.isSand(i) && !grid.fixed[i]) {
          grid.clear(i);
          eaten++;
        }
      }
    }
    return eaten;
  }

  private roamTarget(): [number, number] {
    const { grid, random } = this;
    return [8 + random.next() * (grid.width - 16), grid.height - 6 - random.next() * 22];
  }

  /** The head turns towards (tx, ty) and moves on; the body follows. Returns the distance left. */
  private swim(tx: number, ty: number, speed: number, turn = 0.12): number {
    const hx = this.headX;
    const hy = this.headY;
    let d = Math.atan2(ty - hy, tx - hx) - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += Math.max(-turn, Math.min(turn, d));
    const nx = Math.max(2, Math.min(this.grid.width - 3, hx + Math.cos(this.heading) * speed));
    const ny = Math.max(-6, Math.min(this.grid.height - 3, hy + Math.sin(this.heading) * speed));
    this.xs.copyWithin(1, 0, SEGMENTS - 1);
    this.ys.copyWithin(1, 0, SEGMENTS - 1);
    this.xs[0] = nx;
    this.ys[0] = ny;
    return Math.hypot(tx - nx, ty - ny);
  }

  /** The row of the first grain in column x (the height of the pile there). */
  surfaceAt(x: number): number {
    const { grid } = this;
    const column = Math.max(0, Math.min(grid.width - 1, Math.round(x)));
    for (let y = 0; y < grid.height; y++) if (!grid.isFree(column, y)) return y;
    return grid.height;
  }
}
