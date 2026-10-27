import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode, type ModeOptions } from './AbstractMode';
import { silhouetteArea, silhouetteOfDay, type Silhouette } from './silhouettes';

export const SILHOUETTE_INSIDE_POINTS = 10;
export const SILHOUETTE_OUTSIDE_POINTS = -20;
export const SILHOUETTE_PERFECT_BONUS = 1000;
/** Pieces granted beyond the strict minimum (area / 4). */
export const SILHOUETTE_SPARE = 1.25;

/**
 * A puzzle: fill the silhouette of the day with a limited number of pieces.
 * Rows never clear. Every block inside the shape earns points, every block
 * outside costs points; a perfect fill ends the game with a bonus.
 */
export class SilhouetteMode extends AbstractMode {
  readonly id = 'silhouette';
  override readonly clearsLines = false;
  override readonly scoresDrops = false;
  readonly silhouette: Silhouette;
  readonly area: number;
  readonly pieceLimit: number;

  /** Board indices (y × width + x) of the cells to fill. */
  private targetCells = new Set<number>();
  private used = 0;
  private inside = 0;
  private outside = 0;

  constructor(options: ModeOptions = {}) {
    super(options);
    this.silhouette = silhouetteOfDay(this.today);
    this.area = silhouetteArea(this.silhouette);
    this.pieceLimit = Math.ceil((this.area / 4) * SILHOUETTE_SPARE);
  }

  get target(): ReadonlySet<number> {
    return this.targetCells;
  }

  override attach(game: Game): void {
    const { board } = game;
    const rows = this.silhouette.rows;
    const left = Math.floor((board.width - Math.max(...rows.map((row) => row.length))) / 2);
    const top = board.height - rows.length;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') this.targetCells.add((top + y) * board.width + left + x);
      }
    });

    game.events.on('lock', ({ piece }) => {
      this.used++;
      let delta = 0;
      for (const cell of piece.cells()) {
        if (this.targetCells.has(cell.y * board.width + cell.x)) {
          this.inside++;
          delta += SILHOUETTE_INSIDE_POINTS;
        } else {
          this.outside++;
          delta += SILHOUETTE_OUTSIDE_POINTS;
        }
      }
      game.adjustScore(delta);
    });
  }

  override afterLock(game: Game): void {
    if (this.inside >= this.area) {
      game.adjustScore(SILHOUETTE_PERFECT_BONUS);
      game.notify('perfect', SILHOUETTE_PERFECT_BONUS);
      game.finish('shapeComplete');
    } else if (this.used >= this.pieceLimit) {
      game.finish('outOfPieces');
    }
  }

  filled(): number {
    return this.inside / this.area;
  }

  override subtitleKey(): string {
    return `silhouettes.${this.silhouette.id}`;
  }

  protected override ownIndicators(): Indicator[] {
    return [
      { id: 'piecesLeft', value: Math.max(0, this.pieceLimit - this.used), format: 'count' },
      { id: 'filled', value: this.filled() * 100, format: 'percent' },
      { id: 'outside', value: this.outside, format: 'count' },
    ];
  }
}
