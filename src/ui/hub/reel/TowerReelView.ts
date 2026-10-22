import { FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSession } from '@/families/falling/FallingSession';
import { TowerCamera } from '@/families/volume/camera/TowerCamera';
import { EyeEffects } from '@/families/volume/fx/EyeEffects';
import { TowerRenderer } from '@/families/volume/render/TowerRenderer';
import { TowerMode } from '@/families/volume/TowerMode';
import type { Scene } from '@/showcase/Scene';
import type { ReelContext, ReelView } from './ReelView';

/** The glass Tower in the reel: the cylinder turning after the piece, the Eye and its effects. */
export class TowerReelView implements ReelView {
  private readonly session: FallingSession;
  private readonly effects: FallingEffects;
  private readonly eyeEffects: EyeEffects | null;
  private readonly camera: TowerCamera;
  private readonly renderer: TowerRenderer;
  private readonly detach: (() => void)[];

  constructor(
    scene: Scene,
    private readonly context: ReelContext,
  ) {
    const { session } = scene;
    if (!(session instanceof FallingSession)) {
      throw new Error('A tower scene needs a FallingSession');
    }
    this.session = session;
    this.effects = new FallingEffects(
      session.view,
      context.profile,
      context.palette,
      context.formatPoints,
      context.comboWord,
    );
    const mode = session.view.mode;
    const eye = mode instanceof TowerMode && mode.eye ? mode : null;
    this.eyeEffects = eye ? new EyeEffects(context.formatPoints) : null;
    this.camera = new TowerCamera(session.view.board.width);
    this.renderer = new TowerRenderer(
      context.canvas,
      session.view,
      this.camera,
      this.effects,
      this.eyeEffects,
    );
    this.renderer.setGhost(false);
    this.detach = [
      this.effects.attach(session),
      ...(eye && this.eyeEffects ? [this.eyeEffects.attach(session, eye)] : []),
      session.onGame('spawn', () => this.camera.recentre()),
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
    this.eyeEffects?.update(deltaMs);
    const piece = this.session.view.active;
    if (piece) this.camera.follow(piece.centre);
    this.camera.update(deltaMs, this.context.profile().motion);
  }

  render(): void {
    this.renderer.render();
  }

  dispose(): void {
    this.detach.forEach((off) => off());
  }
}
