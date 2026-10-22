import { Tone } from '@/core/Tone';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import { shade, type TonePalette } from '@/render/TonePalette';
import type { WormEvent } from '../engine/DuneWorm';
import type { GrainSample, SandEventMap } from '../engine/SandGame';
import type { SandPiece } from '../engine/SandPiece';
import { GRAINS_PER_CELL, SAND_TONES } from '../engine/SandGrid';
import type { SandSession, SandView } from '../SandSession';

const POPUP_MS = 900;
const GRAVITY = 500;
/** A lightning bolt stays drawn this long (ms), and the well flashes as it strikes. */
const BOLT_MS = 320;
/** Points of a stream join the running popup when they come within this long (ms). */
const TALLY_MS = 400;
const FLASH_MS = 260;
/** While a Guardian passes under the sand (a teaser), the surface above it trembles this often (ms). */
const TREMBLE_EVERY_MS = 70;

/** A bolt being drawn: a jagged line from where it left the piece to where it struck. */
export interface Bolt {
  readonly points: readonly (readonly [number, number])[];
  age: number;
}

export interface Popup {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  age: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Effects of the sand well, in grain units: glitter when a region vanishes,
 * embers when fire burns, a puff when a piece lands, wind streaks.
 */
export class SandEffects {
  readonly pool = new ParticlePool(1200);
  readonly shake = new ScreenShake();
  readonly popups: Popup[] = [];
  readonly colors: string[] = [];
  /** Direction of the gust being drawn, or 0. */
  wind: -1 | 0 | 1 = 0;
  hidden = false;
  readonly bolts: Bolt[] = [];
  /** The popup a stream of points is gathering into. */
  private running: { points: number; at: number; popup: Popup } | null = null;
  /** White flash over the well (0–1), when lightning strikes. */
  flash = 0;
  /** The Guardian was just hurt: it blinks pale this long (ms). */
  wormHurt = 0;
  private trembleIn = 0;

  private readonly colorIndex = new Map<string, number>();
  private readonly world: ParticleWorld;

  constructor(
    private readonly view: SandView,
    private readonly profile: () => EffectsProfile,
    private readonly palette: () => TonePalette | null,
    private readonly formatPoints: (points: number) => string,
  ) {
    this.world = { gravity: GRAVITY, width: view.grid.width, floor: view.grid.height };
  }

  /** Things may move on their own (pulses, glows): the player's effect level allows it. */
  get motion(): boolean {
    return this.profile().motion;
  }

  attach(session: SandSession): () => void {
    const offs = [
      session.onGame('clear', ({ samples, points, regions, multiplier }) =>
        this.onClear(samples, points, regions, multiplier),
      ),
      session.onGame('burn', ({ samples, points }) => this.onBurn(samples, points)),
      session.onGame('quench', ({ samples }) => this.onQuench(samples)),
      session.onGame('lock', ({ piece }) => this.onLock(piece)),
      session.onGame('wind', ({ phase, direction }) => {
        this.wind = phase === 'start' ? direction : 0;
      }),
      session.onGame('react', (event) => this.onReact(event)),
      session.onGame('strike', (event) => this.onStrike(event)),
      session.onGame('boss', ({ event }) => this.onBoss(event)),
      session.onGame('tease', () => {
        if (this.profile().shake) this.shake.kick(3);
      }),
      session.onGame('over', () => this.collapse()),
    ];
    return () => offs.forEach((off) => off());
  }

  color(css: string): number {
    let index = this.colorIndex.get(css);
    if (index === undefined) {
      index = this.colors.length;
      this.colors.push(css);
      this.colorIndex.set(css, index);
    }
    return index;
  }

  update(deltaMs: number): void {
    this.shake.update(deltaMs);
    this.pool.update(deltaMs / 1000, this.world);
    let write = 0;
    for (const popup of this.popups) {
      popup.age += deltaMs;
      if (popup.age < POPUP_MS) this.popups[write++] = popup;
    }
    this.popups.length = write;
    let bolts = 0;
    for (const bolt of this.bolts) {
      bolt.age += deltaMs;
      if (bolt.age < BOLT_MS) this.bolts[bolts++] = bolt;
    }
    this.bolts.length = bolts;
    this.flash = Math.max(0, this.flash - deltaMs / FLASH_MS);
    this.wormHurt = Math.max(0, this.wormHurt - deltaMs);
    if (this.view.isTeasing) this.tremble(deltaMs);
  }

  /** A Guardian passing under the sand (the teaser): the surface above its head trembles. */
  private tremble(deltaMs: number): void {
    const worm = this.view.worm;
    if (!worm || worm.out) return;
    this.trembleIn -= deltaMs;
    if (this.trembleIn > 0) return;
    this.trembleIn = TREMBLE_EVERY_MS;
    const x = worm.headX;
    this.spray(x, worm.surfaceAt(x), 4, 70);
  }

  boltProgress(bolt: Bolt): number {
    return bolt.age / BOLT_MS;
  }

  popupProgress(popup: Popup): number {
    return popup.age / POPUP_MS;
  }

  private onClear(
    samples: readonly GrainSample[],
    points: number,
    regions: number,
    multiplier: number,
  ): void {
    this.popup(samples, points, multiplier >= 2 ? `×${multiplier}` : null);
    const profile = this.profile();
    if (profile.shake) this.shake.kick(2 + regions * 2);
    if (profile.particles === 0) return;
    for (const sample of this.thin(samples)) {
      const color = this.toneColor(sample.tone, random(0.2, 0.6));
      this.pool.spawn(
        ParticleKind.Spark,
        sample.x + 0.5,
        sample.y + 0.5,
        random(-60, 60),
        random(-140, -40),
        random(0.4, 0.9),
        0.6,
        color,
      );
    }
  }

  private onBurn(samples: readonly GrainSample[], points: number): void {
    this.popup(samples, points);
    const profile = this.profile();
    if (profile.shake) this.shake.kick(1.5);
    if (profile.particles === 0) return;
    const palette = this.palette();
    if (!palette) return;
    const embers = palette.effects.embers.map((css) => this.color(css));
    for (const sample of this.thin(samples)) {
      const color = embers[Math.floor(Math.random() * embers.length)]!;
      this.pool.spawn(
        ParticleKind.Spark,
        sample.x + 0.5,
        sample.y + 0.5,
        random(-25, 25),
        random(-160, -60),
        random(0.5, 1.1),
        0.6,
        color,
      );
    }
  }

  /** Water meets fire: a puff of steam rises. */
  private onQuench(samples: readonly GrainSample[]): void {
    const palette = this.palette();
    if (this.profile().particles === 0 || !palette) return;
    const steam = this.color(palette.effects.steam);
    for (const sample of this.thin(samples)) {
      this.pool.spawn(
        ParticleKind.Dust,
        sample.x + 0.5,
        sample.y + 0.5,
        random(-12, 12),
        random(-70, -30),
        random(0.8, 1.4),
        2.5,
        steam,
      );
    }
  }

  /** Two elements met: each reaction has its own burst. */
  private onReact({ kind, x, y, points, samples }: SandEventMap['react']): void {
    // A blaze eats sand step after step: its points show as one running total.
    if (kind === 'scorch') this.tally(samples, points);
    else if (points > 0) this.popup(samples, points);
    const profile = this.profile();
    const palette = this.palette();
    if (profile.particles === 0 || !palette) return;
    const burst = (tone: Tone, count: number, speed: number, rise: number, size: number) => {
      const color = this.toneColor(tone, 0.25);
      for (let k = 0; k < Math.round(count * profile.particles); k++) {
        this.pool.spawn(
          size > 1 ? ParticleKind.Dust : ParticleKind.Spark,
          x + random(-3, 3),
          y + random(-3, 3),
          random(-speed, speed),
          random(-rise, -rise / 3),
          random(0.4, 0.9),
          size,
          color,
        );
      }
    };
    switch (kind) {
      case 'blaze':
        if (profile.shake) this.shake.kick(2);
        burst(Tone.Blaze, 26, 70, 180, 0.6);
        break;
      case 'scorch':
        for (const sample of this.thin(samples)) {
          this.pool.spawn(
            ParticleKind.Spark,
            sample.x + 0.5,
            sample.y + 0.5,
            random(-20, 20),
            random(-120, -40),
            random(0.3, 0.7),
            0.5,
            this.toneColor(Tone.Blaze, random(0, 0.4)),
          );
        }
        break;
      case 'melt':
        burst(Tone.Steam, 14, 20, 70, 2.5);
        burst(Tone.Ice, 10, 50, 80, 0.6);
        break;
      case 'freeze':
        burst(Tone.Ice, 3, 20, 30, 0.5);
        break;
      case 'fuse':
        burst(Tone.Blaze, 18, 40, 140, 0.6);
        break;
      case 'sprout':
        burst(Tone.Seed, 16, 50, 90, 0.8);
        break;
      case 'dilute':
        burst(Tone.Water, 4, 20, 40, 0.6);
        break;
      case 'dissolve':
        burst(Tone.Acid, 3, 15, 50, 0.6);
        break;
      default:
        break;
    }
  }

  /** Lightning: a jagged bolt, a flash, and what it broke bursts into sparks. */
  private onStrike({ kind, x, fromY, toY, points, samples }: SandEventMap['strike']): void {
    const profile = this.profile();
    const path: [number, number][] = [];
    let px = x;
    for (let y = fromY; y < toY; y += 4) {
      path.push([px + 0.5, y]);
      px = Math.max(0, Math.min(this.view.grid.width - 1, px + Math.round(random(-1.4, 1.4))));
    }
    path.push([x + 0.5, toY + 0.5]);
    this.bolts.push({ points: path, age: 0 });
    if (profile.motion) this.flash = kind === 'shock' ? 0.7 : 0.45;
    if (profile.shake) this.shake.kick(kind === 'shock' ? 5 : 2.5);
    if (points > 0) this.popup(samples, points);
    if (profile.particles === 0) return;
    for (const sample of this.thin(samples)) {
      this.pool.spawn(
        ParticleKind.Spark,
        sample.x + 0.5,
        sample.y + 0.5,
        random(-90, 90),
        random(-180, -40),
        random(0.4, 0.9),
        0.6,
        this.toneColor(random(0, 1) < 0.5 ? sample.tone : Tone.Lightning, 0.3),
      );
    }
  }

  /** The Guardian: sand flies when it bursts out, its wounds show, it crumbles when defeated. */
  private onBoss(event: WormEvent): void {
    const profile = this.profile();
    const worm = this.view.worm;
    if (!worm) return;
    switch (event.type) {
      case 'surge':
        if (profile.shake) this.shake.kick(5);
        this.spray(event.x, event.y, 40, 160);
        break;
      case 'hurt': {
        this.wormHurt = 260;
        const critical = event.hit === 'boltHead';
        // A number, the same in every language: no space before the "!".
        this.popups.push({
          text: `−${this.formatPoints(event.damage)}${critical ? '!' : ''}`,
          x: worm.headX,
          y: worm.headY - 8,
          age: 0,
        });
        if (critical && profile.motion) this.flash = Math.max(this.flash, 0.5);
        if (profile.shake) this.shake.kick(critical ? 3 : 1.5);
        break;
      }
      case 'phase':
        if (profile.shake) this.shake.kick(4);
        break;
      case 'defeated':
        // It crumbles into golden sand.
        if (profile.motion) this.flash = 0.7;
        if (profile.shake) this.shake.kick(6);
        for (let k = 0; k < worm.xs.length; k += 2)
          this.spray(worm.xs[k]!, worm.ys[k]!, 14, 120, true);
        break;
      default:
        break;
    }
  }

  /** Grains thrown up in a fan. */
  private spray(x: number, y: number, count: number, force: number, gold = false): void {
    const profile = this.profile();
    const palette = this.palette();
    if (profile.particles === 0 || !palette) return;
    const golds = palette.effects.gold.map((css) => this.color(css));
    for (let k = 0; k < Math.round(count * profile.particles); k++) {
      const tone = SAND_TONES[k % SAND_TONES.length]!;
      this.pool.spawn(
        ParticleKind.Dust,
        x + random(-3, 3),
        y + random(-2, 2),
        random(-force / 2, force / 2),
        random(-force * 1.4, -force / 3),
        random(0.6, 1.2),
        random(0.8, 1.6),
        gold ? golds[k % golds.length]! : this.toneColor(tone, 0.1),
      );
    }
  }

  private onLock(piece: SandPiece): void {
    if (piece.tone === Tone.Lightning) return;
    if (this.profile().particles === 0) return;
    const color = this.toneColor(piece.tone, 0.4);
    const g = GRAINS_PER_CELL;
    for (const cell of piece.localCells) {
      if (piece.localCells.some((other) => other.x === cell.x && other.y === cell.y + 1)) continue;
      for (let i = 0; i < 3; i++) {
        const x = piece.x + cell.x * g + random(0, g);
        const y = piece.y + (cell.y + 1) * g;
        this.pool.spawn(
          ParticleKind.Dust,
          x,
          y - 0.5,
          random(-40, 40),
          random(-60, -10),
          random(0.3, 0.6),
          random(0.8, 1.4),
          color,
        );
      }
    }
  }

  /** Game over: the sand bursts up in a cloud. */
  private collapse(): void {
    const profile = this.profile();
    if (!profile.destruction) return;
    const { grid } = this.view;
    const step = Math.max(1, Math.floor(grid.grainCount() / (300 * profile.particles || 1)));
    let k = 0;
    for (let i = 0; i < grid.tones.length; i++) {
      const tone = grid.tones[i]!;
      if (tone === 0 || k++ % step !== 0) continue;
      const color = this.toneColor(tone as Tone, 0.1);
      this.pool.spawn(
        ParticleKind.Dust,
        i % grid.width,
        Math.floor(i / grid.width),
        random(-80, 80),
        random(-260, -80),
        random(0.8, 1.6),
        random(1, 2),
        color,
      );
    }
    this.hidden = true;
    if (profile.shake) this.shake.kick(4);
  }

  /** Points that come in a stream (a blaze) gather into one popup that grows, then rises. */
  private tally(samples: readonly GrainSample[], points: number): void {
    if (points <= 0 || samples.length === 0) return;
    const now = performance.now();
    if (this.running && now - this.running.at < TALLY_MS) {
      this.running.points += points;
      this.running.at = now;
      const index = this.popups.indexOf(this.running.popup);
      const popup = {
        ...this.running.popup,
        text: `+${this.formatPoints(this.running.points)}`,
        age: 0,
      };
      if (index >= 0) this.popups[index] = popup;
      else this.popups.push(popup);
      this.running.popup = popup;
      return;
    }
    const x = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
    const y = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
    const popup = { text: `+${this.formatPoints(points)}`, x, y, age: 0 };
    this.popups.push(popup);
    this.running = { points, at: now, popup };
  }

  /** The points over what vanished, and above them a word of the moment (the combo's ×N). */
  private popup(
    samples: readonly GrainSample[],
    points: number,
    label: string | null = null,
  ): void {
    if (samples.length === 0) return;
    const x = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
    const y = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
    this.popups.push({ text: `+${this.formatPoints(points)}`, x, y, age: 0 });
    if (label) this.popups.push({ text: label, x, y: y - GRAINS_PER_CELL * 1.2, age: 0 });
  }

  /** Fewer particles on calm effects. */
  private thin(samples: readonly GrainSample[]): readonly GrainSample[] {
    const keep = this.profile().particles;
    if (keep >= 1) return samples;
    return samples.filter((_, i) => i % Math.round(1 / keep) === 0);
  }

  private toneColor(tone: Tone, lighten: number): number {
    const palette = this.palette();
    if (!palette) return this.color('rgb(200 200 200)');
    return this.color(shade(palette.color(tone), lighten));
  }
}

export const SAND_POPUP_MS = POPUP_MS;
