import type { RandomSource } from '@/core/Random';
import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { randomChromaTone, Tone, type PieceType } from '../pieces/PieceType';
import { AbstractMode } from './AbstractMode';

/**
 * Blocks of one colour touching by a side fuse from this group size up. A piece
 * alone already holds four blocks of one colour: six makes every fusion need at
 * least two pieces, otherwise each piece would vanish as soon as it landed.
 */
export const FUSION_GROUP = 6;

/**
 * Colours are dealt independently of shapes. After each lock, every group of
 * six or more same-coloured blocks fuses and disappears; the rest falls, and
 * new groups may form: a chain reaction, each link worth more.
 */
export class FusionMode extends AbstractMode {
  readonly id = 'fusion';

  private bestChain = 0;
  private fused = 0;

  override toneFor(_type: PieceType, random: RandomSource): Tone {
    return randomChromaTone(random);
  }

  override attach(game: Game): void {
    game.events.on('fusion', ({ cells }) => {
      this.fused += cells.length;
    });
  }

  override afterLock(game: Game): void {
    let chain = 0;
    for (;;) {
      const groups = game.board.findGroups(FUSION_GROUP, [Tone.Garbage]);
      if (groups.length === 0 || game.state === 'over') break;
      chain++;
      game.fuse(groups, chain);
    }
    this.bestChain = Math.max(this.bestChain, chain);
    if (chain >= 2) game.notify('chain', chain);
  }

  protected override ownIndicators(): Indicator[] {
    return [
      { id: 'fused', value: this.fused, format: 'count' },
      { id: 'bestChain', value: this.bestChain, format: 'count' },
    ];
  }
}
