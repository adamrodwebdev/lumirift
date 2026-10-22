import { FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSession } from '@/families/falling/FallingSession';
import { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import { FallingRenderer } from '@/families/falling/render/FallingRenderer';
import { RiftHeartDecor } from '@/families/falling/render/RiftHeartDecor';
import { decorFor } from '@/families/falling/render/WellDecor';
import type { Scene } from '@/showcase/Scene';
import type { ReelContext, ReelView } from './ReelView';

type Moment = 'flip' | 'mirror' | 'tilt';
/** Longest of the whole-well animations (see stage.css), plus a margin (ms). */
const MOMENT_MS = 700;

/**
 * A well of the falling family in the reel: its blocks, its effects, its
 * scenery (the Heart's glow under the last Guardian's well), and the
 * whole-well moments (flip, mirror, tilt) as the game screen plays them.
 */
export class FallingReelView implements ReelView {
  private readonly effects: FallingEffects;
  private readonly renderer: FallingRenderer;
  private readonly detach: (() => void)[];
  private momentTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    scene: Scene,
    private readonly context: ReelContext,
  ) {
    const { session } = scene;
    if (!(session instanceof FallingSession)) {
      throw new Error('A falling scene needs a FallingSession');
    }
    this.effects = new FallingEffects(
      session.view,
      context.profile,
      context.palette,
      context.formatPoints,
      context.comboWord,
    );
    this.renderer = new FallingRenderer(context.canvas, session.view);
    this.renderer.setGhost(false);
    this.renderer.setEffects(this.effects);
    const mode = session.view.mode;
    const heart =
      mode instanceof RiftHeartMode ? new RiftHeartDecor(mode, context.formatPoints) : null;
    this.renderer.setDecor(heart ?? decorFor(session.modeId), context.profile().motion);
    this.detach = [
      this.effects.attach(session),
      ...(heart ? [heart.attach()] : []),
      session.onGame('flip', () => this.play('flip')),
      session.onGame('mirror', () => this.play('mirror')),
      session.onGame('tilt', () => this.play('tilt')),
    ];
    this.renderer.setPalette(context.palette(), context.dark());
  }

  layout(width: number, height: number, pixelRatio: number): void {
    this.renderer.layout(width, height, pixelRatio);
    this.renderer.render();
  }

  repaint(): void {
    this.renderer.setPalette(this.context.palette(), this.context.dark());
    this.renderer.render();
  }

  update(deltaMs: number): void {
    this.effects.update(deltaMs);
  }

  render(): void {
    this.renderer.render();
  }

  dispose(): void {
    clearTimeout(this.momentTimer);
    this.detach.forEach((off) => off());
  }

  /** The well turns on screen, as on the game screen (a CSS animation of the canvas). */
  private play(moment: Moment): void {
    if (!this.context.profile().motion) return;
    const { classList } = this.context.canvas;
    classList.remove('stage__canvas--flip', 'stage__canvas--mirror', 'stage__canvas--tilt');
    requestAnimationFrame(() => classList.add(`stage__canvas--${moment}`));
    clearTimeout(this.momentTimer);
    this.momentTimer = setTimeout(() => classList.remove(`stage__canvas--${moment}`), MOMENT_MS);
  }
}
