import { SandEffects } from '@/families/sand/fx/SandEffects';
import { SandRenderer } from '@/families/sand/render/SandRenderer';
import { SandSession } from '@/families/sand/SandSession';
import type { Scene } from '@/showcase/Scene';
import type { ReelContext, ReelView } from './ReelView';

/** A sand well of the reel: its grains, its elements and their effects. */
export class SandReelView implements ReelView {
  private readonly effects: SandEffects;
  private readonly renderer: SandRenderer;
  private readonly detach: () => void;

  constructor(
    scene: Scene,
    private readonly context: ReelContext,
  ) {
    const { session } = scene;
    if (!(session instanceof SandSession)) throw new Error('A sand scene needs a SandSession');
    this.effects = new SandEffects(
      session.view,
      context.profile,
      context.palette,
      context.formatPoints,
    );
    this.detach = this.effects.attach(session);
    this.renderer = new SandRenderer(context.canvas, session.view, this.effects);
    this.renderer.setGhost(false);
    this.renderer.setPalette(context.palette());
  }

  layout(width: number, height: number, pixelRatio: number): void {
    this.renderer.layout(width, height, pixelRatio);
    this.renderer.render();
  }

  repaint(): void {
    this.renderer.setPalette(this.context.palette());
    this.renderer.render();
  }

  update(deltaMs: number): void {
    this.effects.update(deltaMs);
  }

  render(): void {
    this.renderer.render();
  }

  dispose(): void {
    this.detach();
  }
}
