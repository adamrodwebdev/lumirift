import type { RandomSource } from '@/core/Random';
import type { FallingSession } from '../FallingSession';
import { SilhouetteMode } from '../modes/SilhouetteMode';
import { AiPlayer, type AiProfile } from './AiPlayer';
import type { Evaluator } from './Evaluator';
import { SilhouetteEvaluator } from './SilhouetteEvaluator';

/** An AI of the Silhouette: it fills the shape drawn in its well instead of clearing lines. */
export class SilhouetteAiPlayer extends AiPlayer {
  private readonly filler: Evaluator;

  constructor(session: FallingSession, profile: AiProfile, random: RandomSource) {
    super(session, profile, random);
    const mode = session.view.mode;
    if (!(mode instanceof SilhouetteMode)) throw new Error('This well has no silhouette to fill');
    this.filler = new SilhouetteEvaluator(mode.target);
  }

  protected override get evaluator(): Evaluator {
    return this.filler;
  }
}
