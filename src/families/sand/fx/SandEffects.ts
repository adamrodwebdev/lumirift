import type { Tone } from '@/core/Tone';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import { ParticleKind, ParticlePool, type ParticleWorld } from '@/fx/ParticlePool';
import { ScreenShake } from '@/fx/ScreenShake';
import { shade, type TonePalette } from '@/render/TonePalette';
import type { GrainSample } from '../engine/SandGame';
import type { SandPiece } from '../engine/SandPiece';
import { GRAINS_PER_CELL } from '../engine/SandGrid';
import type { SandSession, SandView } from '../SandSession';

const POPUP_MS = 900;
const GRAVITY = 500;

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

  attach(session: SandSession): () => void {
    const offs = [
      session.onGame('clear', ({ samples, points, regions }) =>
        this.onClear(samples, points, regions),
      ),
      session.onGame('burn', ({ samples, points }) => this.onBurn(samples, points)),
      session.onGame('quench', ({ samples }) => this.onQuench(samples)),
      session.onGame('lock', ({ piece }) => this.onLock(piece)),
      session.onGame('wind', ({ phase, direction }) => {
        this.wind = phase === 'start' ? direction : 0;
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
  }

  popupProgress(popup: Popup): number {
    return popup.age / POPUP_MS;
  }

  private onClear(samples: readonly GrainSample[], points: number, regions: number): void {
    this.popup(samples, points);
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

  private onLock(piece: SandPiece): void {
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

  private popup(samples: readonly GrainSample[], points: number): void {
    if (samples.length === 0) return;
    const x = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
    const y = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
    this.popups.push({ text: `+${this.formatPoints(points)}`, x, y, age: 0 });
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
