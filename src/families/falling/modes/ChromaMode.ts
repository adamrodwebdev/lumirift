import type { RandomSource } from '@/core/Random';
import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { CHROMA_TONES, type PieceType, type Tone } from '../pieces/PieceType';
import { AbstractMode } from './AbstractMode';

/**
 * Colours are dealt independently of shapes; a line of a single colour is
 * "pure" and scores four times.
 */
export class ChromaMode extends AbstractMode {
  readonly id = 'chroma';
  override readonly scoresPureLines = true;

  private pureLines = 0;

  override toneFor(_type: PieceType, random: RandomSource): Tone {
    return CHROMA_TONES[random.nextInt(CHROMA_TONES.length)]!;
  }

  override attach(game: Game): void {
    game.events.on('clear', ({ pureLines }) => {
      if (pureLines === 0) return;
      this.pureLines += pureLines;
      game.notify('pureLine', pureLines);
    });
  }

  protected override ownIndicators(): Indicator[] {
    return [{ id: 'pureLines', value: this.pureLines, format: 'count' }];
  }
}
