import { AI_PROFILES, type AiPlayer, type AiProfile } from '@/families/falling/ai/AiPlayer';
import type { FallingSession } from '@/families/falling/FallingSession';
import type { CurvePlayer, PlayerSkill } from './CurvePlayer';

/**
 * The falling family's players, the duel's AI profiles: a regular plays as
 * its easy level, an expert as its hard one. A newcomer is slower and
 * sloppier than its rookie (ranked online players' 10th percentile): about
 * 0.4 pieces a second, a third of them placed a little worse than they
 * could be, one in twenty anywhere at all.
 */
export const FALLING_SKILLS: Readonly<Record<PlayerSkill, AiProfile>> = {
  newcomer: {
    ...AI_PROFILES.rookie,
    thinkMs: 1500,
    stepMs: 220,
    mistakeChance: 0.35,
    mistakeSpread: 6,
    blunderChance: 0.05,
  },
  regular: AI_PROFILES.easy,
  expert: AI_PROFILES.hard,
};

/** A player of a falling well (the Tower's too, and the player's side of a duel): an AI at its controls. */
export class FallingCurvePlayer implements CurvePlayer {
  private readonly detach: () => void;

  constructor(
    private readonly session: FallingSession,
    private readonly ai: AiPlayer,
  ) {
    this.detach = ai.attach();
  }

  get idle(): boolean {
    return this.session.state === 'running' && this.session.view.active === null;
  }

  update(deltaMs: number): void {
    this.ai.update(deltaMs);
  }

  dispose(): void {
    this.detach();
  }
}
