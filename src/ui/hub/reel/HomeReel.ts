import { FrameCap } from '@/app/FrameCap';
import type { EffectsProfile } from '@/fx/EffectsProfile';
import type { TonePalette } from '@/render/TonePalette';
import {
  SCENE_FAMILIES,
  SCENE_IDS,
  SCENE_MS,
  type Scene,
  type SceneFamily,
  type SceneId,
} from '@/showcase/Scene';
import type { ReelView, ReelViewFactory } from './ReelView';

/** A moment ready to play: its scene and the well that draws it. */
interface Staged {
  readonly scene: () => Scene;
  readonly view: ReelViewFactory;
}

interface Playing {
  readonly id: SceneId;
  readonly scene: Scene;
  readonly view: ReelView;
  readonly canvas: HTMLCanvasElement;
}

type SceneTable = Partial<Readonly<Record<SceneId, () => Scene>>>;

const pick = (scenes: SceneTable, id: SceneId): (() => Scene) => {
  const scene = scenes[id];
  if (!scene) throw new Error(`No showcase scene for ${id}`);
  return scene;
};

/**
 * Each family's scenes and well, a chunk of code of their own: loaded when
 * the reel comes to them (and warmed up one moment ahead), never before the
 * title is on screen.
 */
const FAMILIES: Readonly<Record<SceneFamily, (id: SceneId) => Promise<Staged>>> = {
  sand: async (id) => {
    const [{ SAND_SCENES }, { SandReelView }] = await Promise.all([
      import('@/showcase/sandScenes'),
      import('./SandReelView'),
    ]);
    return {
      scene: pick(SAND_SCENES, id),
      view: (scene, context) => new SandReelView(scene, context),
    };
  },
  falling: async (id) => {
    const [{ FALLING_SCENES }, { FallingReelView }] = await Promise.all([
      import('@/showcase/fallingScenes'),
      import('./FallingReelView'),
    ]);
    return {
      scene: pick(FALLING_SCENES, id),
      view: (scene, context) => new FallingReelView(scene, context),
    };
  },
  tower: async (id) => {
    const [{ TOWER_SCENES }, { TowerReelView }] = await Promise.all([
      import('@/showcase/towerScenes'),
      import('./TowerReelView'),
    ]);
    return {
      scene: pick(TOWER_SCENES, id),
      view: (scene, context) => new TowerReelView(scene, context),
    };
  },
  mosaic: async (id) => {
    const [{ MOSAIC_SCENES }, { MosaicReelView }] = await Promise.all([
      import('@/showcase/mosaicScenes'),
      import('./MosaicReelView'),
    ]);
    return {
      scene: pick(MOSAIC_SCENES, id),
      view: (scene, context) => new MosaicReelView(scene, context),
    };
  },
};

/** The time a well takes to fade out under the next one (see the home's styles). */
const FADE_MS = 320;
/** The longest step a frame may take (a tab coming back must not jump ahead). */
const MAX_FRAME_MS = 50;
/** One step of the unseen play of the still picture (ms). */
const STEP_MS = 16;
/** The still picture (motion off): the first moment, played this long unseen (ms). */
const STILL_AT_MS = 2800;

export interface HomeReelOptions {
  /** The player's effect level, without the shake. */
  readonly profile: () => EffectsProfile;
  readonly dark: () => boolean;
  readonly formatPoints: (points: number) => string;
  /** The combo's word, translated ("COMBO ×3"). */
  readonly comboWord: (combo: number) => string;
  /** Motion is off (reduced motion, no effects): one still picture of the first moment. */
  readonly still: boolean;
  /** A moment comes on screen (its caption follows). */
  readonly onScene: (id: SceneId) => void;
  /** Frames drawn per second at most (60 on touch screens); none by default. */
  readonly maxFps?: number | null;
}

/**
 * The title screen's reel: real games playing, one after another, the
 * moments no other game of the genre has (the Sand's elements, the wells that
 * turn, the four Guardians). Each moment is a fresh canvas fading in over the
 * last one in the box; it plays only while shown, and is a single still
 * picture when motion is off.
 */
export class HomeReel {
  private index = -1;
  private playing: Playing | null = null;
  private elapsed = 0;
  private switching = false;
  private frame = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private disposed = false;
  private readonly cap: FrameCap;

  constructor(
    private readonly box: HTMLElement,
    private palette: TonePalette,
    private readonly options: HomeReelOptions,
  ) {
    this.cap = new FrameCap(options.maxFps ?? null);
  }

  /** The reel is shown: the first moment comes in, or the loop goes on. */
  start(): void {
    if (this.disposed) return;
    if (!this.playing && !this.switching) void this.next();
    if (this.frame || this.options.still) return;
    this.last = performance.now();
    this.cap.reset();
    const tick = (now: number) => {
      if (this.cap.admits(now)) {
        const delta = Math.min(MAX_FRAME_MS, now - this.last);
        this.last = now;
        this.advance(delta);
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Fits the wells in the box (CSS pixels). */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.playing?.view.layout(width, height, pixelRatio());
  }

  setPalette(palette: TonePalette): void {
    this.palette = palette;
    this.playing?.view.repaint();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    if (this.playing) this.end(this.playing);
    this.playing = null;
  }

  private advance(deltaMs: number): void {
    const playing = this.playing;
    if (!playing) return;
    playing.scene.drive(deltaMs);
    playing.scene.session.update(deltaMs);
    playing.view.update(deltaMs);
    playing.view.render();
    this.elapsed += deltaMs;
    if (this.elapsed >= SCENE_MS[playing.id] && !this.switching) void this.next();
  }

  /** The next moment: its family's code loaded, a fresh well fading in over the last one. */
  private async next(): Promise<void> {
    this.switching = true;
    const index = (this.index + 1) % SCENE_IDS.length;
    const id = SCENE_IDS[index]!;
    try {
      const staged = await FAMILIES[SCENE_FAMILIES[id]](id);
      if (this.disposed) return;
      const canvas = document.createElement('canvas');
      // Hidden until laid out, then faded in (a transition: the wells' own moments, flip,
      // mirror and tilt, are CSS animations of the same canvas).
      canvas.className = 'stage__canvas reel__canvas reel__canvas--hidden';
      const scene = staged.scene();
      const view = staged.view(scene, {
        canvas,
        profile: this.options.profile,
        palette: () => this.palette,
        dark: this.options.dark,
        formatPoints: this.options.formatPoints,
        comboWord: this.options.comboWord,
      });
      this.box.append(canvas);
      if (this.width && this.height) view.layout(this.width, this.height, pixelRatio());
      canvas.getBoundingClientRect();
      canvas.classList.remove('reel__canvas--hidden');
      scene.session.start();
      if (this.options.still) this.playUnseen(scene, view);
      const leaving = this.playing;
      this.playing = { id, scene, view, canvas };
      this.index = index;
      this.elapsed = 0;
      this.options.onScene(id);
      if (leaving) {
        leaving.canvas.classList.add('reel__canvas--out');
        setTimeout(() => this.end(leaving), FADE_MS);
      }
      // The next family's code, warmed up while this moment plays.
      const after = SCENE_IDS[(index + 1) % SCENE_IDS.length]!;
      if (!this.options.still) void FAMILIES[SCENE_FAMILIES[after]](after).catch(() => undefined);
    } catch {
      // A chunk that could not load (offline): the moment on screen plays on a while.
      this.elapsed = 0;
    } finally {
      this.switching = false;
    }
  }

  /** Plays a moment unseen, then draws it once: the still picture. */
  private playUnseen(scene: Scene, view: ReelView): void {
    for (let t = 0; t < STILL_AT_MS; t += STEP_MS) {
      scene.drive(STEP_MS);
      scene.session.update(STEP_MS);
      view.update(STEP_MS);
    }
    view.render();
  }

  private end(playing: Playing): void {
    playing.view.dispose();
    playing.scene.dispose();
    playing.canvas.remove();
  }
}

function pixelRatio(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}
