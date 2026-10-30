import { MOTIFS } from '@/render/motifs';
import { luminance, type Rgb, type TonePalette } from '@/render/TonePalette';
import { LINK, LINK_MASKS } from '../board/Links';
import { Tone } from '../pieces/PieceType';

/** The thickness, in pixels, of the strip of body stretched over a linked side's band. */
const STRIP = 2;

/**
 * A block style (a material), pre-drawn once per tone at the current cell
 * size: drawing a frame is then one `drawImage` per block. Each material
 * only says how one block looks; every one keeps the engraved motif, so
 * colour never carries the information alone.
 *
 * A block joined to blocks of its piece (`links`, 1.43) is drawn without its
 * edge on those sides, so that a piece reads as one crystal, not four tiles.
 */
export abstract class BlockSprites {
  private readonly sprites = new Map<number, HTMLCanvasElement>();
  private readonly plains = new Map<Tone, HTMLCanvasElement>();
  private engraving = true;
  /** The band, as a share of the block, that holds a material's edge (gap, rim, bevel). */
  protected readonly edge: number = 0.26;

  constructor(
    readonly size: number,
    protected readonly palette: TonePalette,
  ) {}

  /** The block of a tone, joined on the sides `links` names (`LINK` bits). */
  get(tone: Tone, links = 0): HTMLCanvasElement {
    const key = tone * LINK_MASKS + links;
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = this.draw(tone, links);
      this.sprites.set(key, sprite);
    }
    return sprite;
  }

  private draw(tone: Tone, links: number): HTMLCanvasElement {
    const canvas = this.blank();
    const ctx = canvas.getContext('2d');
    if (ctx && tone !== Tone.Empty) {
      const rgb = this.palette.color(tone);
      if (tone === Tone.Garbage) this.paintStone(ctx, links);
      else if (links === 0) this.paint(ctx, tone, rgb);
      else this.paintLinked(ctx, tone, rgb, links);
    }
    return canvas;
  }

  private blank(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    return canvas;
  }

  /** Draws one block of the given tone on a square of `size`. */
  protected abstract paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void;

  /**
   * A block joined to its piece on the `links` sides. By default, the lone block
   * whose edge band on each linked side (corners included) is replaced by a strip
   * of its body, without the motif, stretched out to the border: neighbours of a
   * piece meet without a seam. A material may draw its joined blocks itself.
   */
  protected paintLinked(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb, links: number): void {
    const s = this.size;
    const e = Math.max(STRIP, Math.round(s * this.edge));
    const k = STRIP;
    const plain = this.plain(tone, rgb);
    const n = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const w = (links & LINK.west) !== 0;
    const far = s - e;

    ctx.drawImage(this.get(tone), 0, 0);
    /** Clears a region of the block and fills it with a part of the plain block, stretched. */
    const stretch = (
      [sx, sy, sw, sh]: readonly [number, number, number, number],
      [dx, dy, dw, dh]: readonly [number, number, number, number],
    ) => {
      ctx.clearRect(dx, dy, dw, dh);
      ctx.drawImage(plain, sx, sy, sw, sh, dx, dy, dw, dh);
    };
    // The sides: the body just inside the band, stretched across it.
    if (n) stretch([e, e, s - 2 * e, k], [e, 0, s - 2 * e, e]);
    if (south) stretch([e, far - k, s - 2 * e, k], [e, far, s - 2 * e, e]);
    if (w) stretch([e, e, k, s - 2 * e], [0, e, e, s - 2 * e]);
    if (east) stretch([far - k, e, k, s - 2 * e], [far, e, e, s - 2 * e]);
    // The corners: the body where both sides join, else the edge of the side that does not.
    const corner = (
      vertical: boolean,
      horizontal: boolean,
      into: readonly [number, number],
      body: readonly [number, number],
      verticalEdge: readonly [number, number, number, number],
      horizontalEdge: readonly [number, number, number, number],
    ) => {
      const target = [into[0], into[1], e, e] as const;
      if (vertical && horizontal) stretch([body[0], body[1], k, k], target);
      else if (vertical) stretch(verticalEdge, target);
      else if (horizontal) stretch(horizontalEdge, target);
    };
    // North-west: joined north, the west edge goes on up; joined west, the north edge goes on.
    corner(n, w, [0, 0], [e, e], [0, e, e, k], [e, 0, k, e]);
    corner(n, east, [far, 0], [far - k, e], [far, e, e, k], [far - k, 0, k, e]);
    corner(south, east, [far, far], [far - k, far - k], [far, far - k, e, k], [far - k, far, k, e]);
    corner(south, w, [0, far], [e, far - k], [0, far - k, e, k], [e, far, k, e]);
  }

  /**
   * Rift stone (1.43), whatever the material: the Duel's attack rows and the rubble
   * under the Heart. Dark slate lit along its free top, shaded along its free bottom
   * and right, joined to the stone around it; the renderer adds its cracks and veins.
   */
  private paintStone(ctx: CanvasRenderingContext2D, links: number): void {
    const s = this.size;
    const { body, edge, shade } = this.palette.effects.stone;
    const gap = Math.max(1, Math.round(s * 0.05));
    const north = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const west = (links & LINK.west) !== 0;
    const right = east ? s : s - gap;
    const bottom = south ? s : s - gap;
    const radius = s * 0.1;
    const round = (free: boolean) => (free ? radius : 0);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, right, bottom, [
      round(!north && !west),
      round(!north && !east),
      round(!south && !east),
      round(!south && !west),
    ]);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();
    const band = Math.max(1, s * 0.08);
    ctx.fillStyle = edge;
    if (!north) ctx.fillRect(0, 0, right, band);
    ctx.fillStyle = shade;
    if (!south) ctx.fillRect(0, bottom - band, right, band);
    if (!east) ctx.fillRect(right - band, 0, band, bottom);
    ctx.restore();
  }

  /** The lone block of a tone without its motif: the body a joined side is filled from. */
  private plain(tone: Tone, rgb: Rgb): HTMLCanvasElement {
    let plain = this.plains.get(tone);
    if (!plain) {
      plain = this.blank();
      const ctx = plain.getContext('2d');
      if (ctx) {
        this.engraving = false;
        this.paint(ctx, tone, rgb);
        this.engraving = true;
      }
      this.plains.set(tone, plain);
    }
    return plain;
  }

  /** The tone's motif, engraved in a colour that stands out from `background`. */
  protected engrave(
    ctx: CanvasRenderingContext2D,
    tone: Exclude<Tone, typeof Tone.Empty>,
    background: Rgb,
    centre: number,
    radius: number,
    ink?: string,
  ): void {
    if (!this.engraving) return;
    const colour =
      ink ?? (luminance(background) > 0.35 ? 'rgb(0 0 0 / 0.38)' : 'rgb(255 255 255 / 0.5)');
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = Math.max(1.5, this.size * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, centre, radius);
  }
}
