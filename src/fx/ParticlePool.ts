export const ParticleKind = {
  /** A triangular splinter (crystal, ceramic): spins, bounces, settles. */
  Shard: 0,
  /** A bright streak: no collision, slowed by drag. */
  Spark: 1,
  /** A small square grain: bounces, settles. */
  Dust: 2,
  /** A mote of the rift's light (1.44): drifts up, touches nothing, glows out. */
  Ember: 3,
  /** A light triangle (confetti, a petal, gold leaf; 1.44): floats up, drifts down, touches nothing. */
  Flake: 4,
} as const;
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];

/** Where particles live: gravity, the floor, the walls and the solid blocks. */
export interface ParticleWorld {
  readonly gravity: number;
  readonly width: number;
  readonly floor: number;
  /** No side walls: particles leaving one side come back on the other (a cylinder). */
  readonly wraps?: boolean;
  /** Top edge of the solid cell containing (x, y), or null when that point is free. */
  readonly solidTop?: (x: number, y: number) => number | null;
}

const RESTITUTION = 0.32;
const FRICTION = 0.72;
const SPARK_DRAG = 0.22;
/** Embers slow sideways; flakes ride the air, falling at this share of gravity. */
const EMBER_DRAG = 0.4;
const FLAKE_DRAG = 0.12;
const FLAKE_WEIGHT = 0.12;

/**
 * Every particle of a scene in flat typed arrays (structure of arrays): no
 * object is created or collected while the game runs. A dead particle is
 * replaced by the last live one, so live particles stay packed at the front.
 */
export class ParticlePool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly angle: Float32Array;
  readonly spin: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly size: Float32Array;
  readonly kind: Uint8Array;
  /** Index in the scene's colour table. */
  readonly color: Uint16Array;
  /** Shard triangles, six coordinates per particle, relative to its centre. */
  readonly shape: Float32Array;
  /** A shard cut from a block keeps its picture: the block's tone, or -1 for a plain colour. */
  readonly texture: Int16Array;
  /** Where the shard's centre sat in its block: two coordinates per particle, in cells. */
  readonly uv: Float32Array;

  private _count = 0;
  private _limit: number;

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.angle = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.color = new Uint16Array(capacity);
    this.shape = new Float32Array(capacity * 6);
    this.texture = new Int16Array(capacity).fill(-1);
    this.uv = new Float32Array(capacity * 2);
    this._limit = capacity;
  }

  get count(): number {
    return this._count;
  }

  /** Budget set by the quality level: new particles are refused beyond it. */
  setLimit(limit: number): void {
    this._limit = Math.max(0, Math.min(this.capacity, Math.floor(limit)));
  }

  /** Adds a particle and returns its slot, or -1 when the budget is spent. */
  spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: number,
  ): number {
    if (this._count >= this._limit) return -1;
    const i = this._count++;
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.age[i] = 0;
    this.size[i] = size;
    this.color[i] = color;
    this.angle[i] = 0;
    this.spin[i] = 0;
    this.texture[i] = -1;
    return i;
  }

  /** Gives a shard the picture of the block it was cut from, its centre at (`u`, `v`) in that block. */
  setTexture(i: number, tone: number, u: number, v: number): void {
    this.texture[i] = tone;
    this.uv[i * 2] = u;
    this.uv[i * 2 + 1] = v;
  }

  setTriangle(
    i: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ): void {
    const o = i * 6;
    this.shape[o] = ax;
    this.shape[o + 1] = ay;
    this.shape[o + 2] = bx;
    this.shape[o + 3] = by;
    this.shape[o + 4] = cx;
    this.shape[o + 5] = cy;
  }

  /** Remaining opacity of a particle: full, then fading over the last 45 % of its life. */
  alpha(i: number): number {
    const fadeStart = this.life[i]! * 0.55;
    const age = this.age[i]!;
    return age <= fadeStart ? 1 : Math.max(0, 1 - (age - fadeStart) / (this.life[i]! - fadeStart));
  }

  /** Advances every particle by `dt` seconds. */
  update(dt: number, world: ParticleWorld): void {
    let i = 0;
    while (i < this._count) {
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) {
        this.kill(i);
        continue;
      }
      const kind = this.kind[i];
      if (kind === ParticleKind.Spark) this.moveSpark(i, dt, world);
      else if (kind === ParticleKind.Ember || kind === ParticleKind.Flake) this.drift(i, dt, world);
      else this.moveSolid(i, dt, world);
      i++;
    }
  }

  clear(): void {
    this._count = 0;
  }

  private moveSpark(i: number, dt: number, world: ParticleWorld): void {
    const drag = SPARK_DRAG ** dt;
    this.vx[i]! *= drag;
    this.vy[i] = this.vy[i]! * drag + world.gravity * 0.5 * dt;
    this.x[i]! += this.vx[i]! * dt;
    this.y[i]! += this.vy[i] * dt;
  }

  /** Embers and flakes ride the air: slowed, never landing; a flake sinks and spins. */
  private drift(i: number, dt: number, world: ParticleWorld): void {
    if (this.kind[i] === ParticleKind.Flake) {
      const drag = FLAKE_DRAG ** dt;
      this.vx[i]! *= drag;
      this.vy[i] = this.vy[i]! * drag + world.gravity * FLAKE_WEIGHT * dt;
      this.angle[i]! += this.spin[i]! * dt;
    } else {
      this.vx[i]! *= EMBER_DRAG ** dt;
    }
    this.x[i]! += this.vx[i]! * dt;
    this.y[i]! += this.vy[i]! * dt;
    if (world.wraps) this.x[i] = ((this.x[i]! % world.width) + world.width) % world.width;
  }

  private moveSolid(i: number, dt: number, world: ParticleWorld): void {
    this.vy[i]! += world.gravity * dt;
    this.x[i]! += this.vx[i]! * dt;
    this.y[i]! += this.vy[i]! * dt;
    this.angle[i]! += this.spin[i]! * dt;
    const half = this.size[i]! / 2;

    if (this.y[i]! + half > world.floor) {
      this.y[i] = world.floor - half;
      this.bounce(i);
    } else if (this.vy[i]! > 0 && world.solidTop) {
      const top = world.solidTop(this.x[i]!, this.y[i]! + half);
      if (top !== null) {
        this.y[i] = top - half;
        this.bounce(i);
      }
    }
    if (world.wraps) {
      this.x[i] = ((this.x[i]! % world.width) + world.width) % world.width;
    } else if (this.x[i]! < half || this.x[i]! > world.width - half) {
      this.x[i] = Math.min(world.width - half, Math.max(half, this.x[i]!));
      this.vx[i]! *= -0.5;
    }
  }

  private bounce(i: number): void {
    this.vy[i]! *= -RESTITUTION;
    this.vx[i]! *= FRICTION;
    this.spin[i]! *= 0.6;
  }

  private kill(i: number): void {
    const last = --this._count;
    if (i === last) return;
    this.x[i] = this.x[last]!;
    this.y[i] = this.y[last]!;
    this.vx[i] = this.vx[last]!;
    this.vy[i] = this.vy[last]!;
    this.angle[i] = this.angle[last]!;
    this.spin[i] = this.spin[last]!;
    this.age[i] = this.age[last]!;
    this.life[i] = this.life[last]!;
    this.size[i] = this.size[last]!;
    this.kind[i] = this.kind[last]!;
    this.color[i] = this.color[last]!;
    this.shape.copyWithin(i * 6, last * 6, last * 6 + 6);
    this.texture[i] = this.texture[last]!;
    this.uv.copyWithin(i * 2, last * 2, last * 2 + 2);
  }
}
