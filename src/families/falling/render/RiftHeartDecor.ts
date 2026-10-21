import type { TonePalette } from '@/render/TonePalette';
import type { FallingView } from '../FallingSession';
import type { RiftHeart } from '../modes/RiftHeart';
import type { RiftHeartMode } from '../modes/RiftHeartMode';
import type { WellDecor } from './WellDecor';

/** The Heart flashes this long when hurt (ms). */
const HURT_MS = 260;
/** A damage figure rises above the Heart this long (ms). */
const POPUP_MS = 900;

interface Popup {
  readonly text: string;
  readonly born: number;
}

interface Pose {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly throb: number;
  readonly swelling: boolean;
}

/**
 * The scenery of the last Guardian. Behind the stack: the Heart of the Rift,
 * a crystal heart of the rift's light beating under the well, and veins of
 * light running to its shards. In front: its outline (seen through the
 * blocks), the shards, the holes of the rows to come glowing on the floor
 * while it swells, and the damage it takes. It keeps only what it shows.
 */
export class RiftHeartDecor implements WellDecor {
  private hurtAt = Number.NEGATIVE_INFINITY;
  private readonly popups: Popup[] = [];

  constructor(
    private readonly mode: RiftHeartMode,
    private readonly formatNumber: (value: number) => string,
  ) {}

  attach(): () => void {
    return this.mode.heartEvents.on('boss', ({ event }) => {
      if (event.type !== 'hurt') return;
      const now = performance.now();
      this.hurtAt = now;
      this.popups.push({ text: `−${this.formatNumber(event.damage)}`, born: now });
    });
  }

  drawBehind(
    ctx: CanvasRenderingContext2D,
    view: FallingView,
    palette: TonePalette,
    cell: number,
    time: number,
  ): void {
    const heart = this.mode.heart;
    if (!heart || cell === 0) return;
    const { cx, cy, size, throb, swelling } = this.pose(heart, view, cell, time);
    const { board } = view;
    const hidden = board.hiddenRows;
    const rift = palette.effects.rift;
    ctx.save();
    // Veins of light, from the Heart to its shards.
    ctx.strokeStyle = rift;
    ctx.lineWidth = Math.max(1.5, cell * 0.08);
    ctx.globalAlpha = heart.defeated ? 0.1 : 0.45 + 0.3 * throb;
    ctx.beginPath();
    for (let y = hidden; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (!board.hasBomb(x, y)) continue;
        const sx = (x + 0.5) * cell;
        const sy = (y - hidden + 0.5) * cell;
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo((cx + sx) / 2, Math.max(cy, sy) + cell, sx, sy);
      }
    }
    ctx.stroke();
    // Its glow, then its crystal body.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2.4);
    glow.addColorStop(0, rift);
    glow.addColorStop(1, 'rgb(0 0 0 / 0)');
    ctx.globalAlpha = heart.defeated ? 0.15 : 0.4 + 0.3 * throb + (swelling ? 0.25 : 0);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - size * 2.4, cy - size * 2.4, size * 4.8, size * 4.8);
    this.shape(ctx, cx, cy, size);
    const body = ctx.createRadialGradient(cx, cy - size * 0.2, 0, cx, cy, size * 1.2);
    body.addColorStop(0, palette.accent);
    body.addColorStop(0.45, rift);
    body.addColorStop(1, palette.wellBackground);
    ctx.globalAlpha = heart.defeated ? 0.25 : 0.85;
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
  }

  draw(
    ctx: CanvasRenderingContext2D,
    view: FallingView,
    palette: TonePalette,
    cell: number,
    time: number,
  ): void {
    const heart = this.mode.heart;
    if (!heart || cell === 0) return;
    const { cx, cy, size, throb, swelling } = this.pose(heart, view, cell, time);
    const { board } = view;
    const hidden = board.hiddenRows;
    const rows = board.height - hidden;
    const rift = palette.effects.rift;
    const now = performance.now();

    // Its outline, seen through the blocks, and its flash of pain.
    this.shape(ctx, cx, cy, size);
    ctx.globalAlpha = heart.defeated ? 0.2 : 0.45 + 0.35 * throb;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(1.5, cell * 0.08);
    ctx.stroke();
    const hurt = Math.max(0, 1 - (now - this.hurtAt) / HURT_MS);
    if (hurt > 0) {
      ctx.globalAlpha = hurt * 0.8;
      ctx.fillStyle = 'rgb(255 255 255)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Its shards in the rows: crystals of light, pulsing with it.
    for (let y = hidden; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (!board.hasBomb(x, y)) continue;
        const sy = (y - hidden + 0.5) * cell;
        this.drawShard(ctx, (x + 0.5) * cell, sy, cell, rift, palette, throb);
      }
    }

    // While it swells: the holes of the rows to come glow on the floor, and their shards.
    if (swelling) {
      const blink = 0.5 + 0.5 * Math.sin(time / 90);
      for (const row of heart.coming) {
        ctx.globalAlpha = 0.25 + 0.35 * blink;
        ctx.fillStyle = palette.danger;
        ctx.fillRect(row.hole * cell, (rows - 1) * cell, cell, cell);
        ctx.globalAlpha = 0.7 + 0.3 * blink;
        ctx.strokeStyle = palette.danger;
        ctx.lineWidth = Math.max(2, cell * 0.1);
        const hx = (row.hole + 0.5) * cell;
        ctx.beginPath();
        ctx.moveTo(hx - cell * 0.3, (rows - 0.25) * cell);
        ctx.lineTo(hx, (rows - 0.75) * cell);
        ctx.lineTo(hx + cell * 0.3, (rows - 0.25) * cell);
        ctx.stroke();
        const sy = (rows - 0.5) * cell;
        // Only announced: a ghost of the shard, see-through.
        this.drawShard(ctx, (row.shard + 0.5) * cell, sy, cell * 0.7, rift, palette, blink, 0.5);
      }
      ctx.globalAlpha = 1;
    }

    this.drawPopups(ctx, cx, cy - size * 1.6, cell, palette, now);
  }

  /** Where it beats and how big it is now: a throb, larger while it swells. */
  private pose(heart: RiftHeart, view: FallingView, cell: number, time: number): Pose {
    const rows = view.board.height - view.board.hiddenRows;
    const swelling = heart.coming.length > 0;
    const rate = 0.6 + 0.3 * heart.phase;
    const throb = Math.max(0, Math.sin((time / 1000) * Math.PI * 2 * rate)) ** 3;
    const size = cell * (1.3 + 0.2 * throb + (swelling ? 0.35 : 0)) * (heart.defeated ? 0.8 : 1);
    return { cx: (view.board.width / 2) * cell, cy: (rows - 2.6) * cell, size, throb, swelling };
  }

  /** The path of a heart, its tip at the bottom. */
  private shape(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.9);
    ctx.bezierCurveTo(
      cx - size * 1.3,
      cy + size * 0.1,
      cx - size * 0.9,
      cy - size,
      cx,
      cy - size * 0.4,
    );
    ctx.bezierCurveTo(
      cx + size * 0.9,
      cy - size,
      cx + size * 1.3,
      cy + size * 0.1,
      cx,
      cy + size * 0.9,
    );
    ctx.closePath();
  }

  /** A shard of the rift: a crystal with a dark rim and a bright core. */
  private drawShard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cell: number,
    colour: string,
    palette: TonePalette,
    pulse: number,
    alpha = 1,
  ): void {
    const r = cell * (0.38 + 0.05 * pulse);
    const diamond = (scale: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - r * scale);
      ctx.lineTo(x + r * 0.62 * scale, y);
      ctx.lineTo(x, y + r * scale);
      ctx.lineTo(x - r * 0.62 * scale, y);
      ctx.closePath();
    };
    diamond(1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = palette.wellBackground;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.stroke();
    diamond(0.45);
    ctx.globalAlpha = alpha * (0.6 + 0.4 * pulse);
    ctx.fillStyle = 'rgb(255 255 255)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawPopups(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cell: number,
    palette: TonePalette,
    now: number,
  ): void {
    while (this.popups.length > 0 && now - this.popups[0]!.born > POPUP_MS) this.popups.shift();
    if (this.popups.length === 0) return;
    ctx.font = `800 ${Math.round(cell * 0.9)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of this.popups) {
      const t = (now - popup.born) / POPUP_MS;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const py = y - t * cell * 1.5;
      ctx.strokeText(popup.text, x, py);
      ctx.fillText(popup.text, x, py);
    }
    ctx.globalAlpha = 1;
  }
}
