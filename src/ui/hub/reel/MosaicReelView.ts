import { MosaicEffects } from '@/families/placement/fx/MosaicEffects';
import { PlacementSession } from '@/families/placement/PlacementSession';
import { MosaicRenderer, type BoardOverlay } from '@/families/placement/render/MosaicRenderer';
import type { Scene } from '@/showcase/Scene';
import type { ReelContext, ReelView } from './ReelView';

/** No cursor, no preview: the reel's board is only watched. */
const BARE: BoardOverlay = { preview: null, bomb: null, cursor: null };

/** A Mosaic board in the reel: the ceramics, the Golem and their effects. */
export class MosaicReelView implements ReelView {
  private readonly effects: MosaicEffects;
  private readonly renderer: MosaicRenderer;
  private readonly detach: () => void;

  constructor(
    scene: Scene,
    private readonly context: ReelContext,
  ) {
    const { session } = scene;
    if (!(session instanceof PlacementSession)) {
      throw new Error('A mosaic scene needs a PlacementSession');
    }
    this.effects = new MosaicEffects(
      session.view,
      context.profile,
      context.palette,
      context.formatPoints,
    );
    this.detach = this.effects.attach(session);
    this.renderer = new MosaicRenderer(context.canvas, session.view, this.effects);
    this.renderer.setPalette(context.palette());
  }

  layout(width: number, height: number, pixelRatio: number): void {
    // The board is square: as large as the box allows.
    this.renderer.layout(Math.min(width, height), pixelRatio);
    this.renderer.render(BARE);
  }

  repaint(): void {
    this.renderer.setPalette(this.context.palette());
    this.renderer.render(BARE);
  }

  update(deltaMs: number): void {
    this.effects.update(deltaMs);
  }

  render(): void {
    this.renderer.render(BARE);
  }

  dispose(): void {
    this.detach();
  }
}
