import type { RandomSource } from '@/core/Random';
import type { SandSession } from '@/families/sand';
import type { CurvePlayer, PlayerSkill } from './CurvePlayer';
import { aimSand, type SandPlan } from './SandAim';

/** How a Sand player of a skill plays. */
export interface SandSkill {
  /** Time before it acts on a new piece. */
  readonly thinkMs: number;
  /** Time between two moves (a turn or a cell sideways). */
  readonly stepMs: number;
  /** Chance that it aims a piece (`aimSand`) rather than drop it where it appears. */
  readonly aimChance: number;
}

/**
 * The Sand's players. A newcomer is the training's beginner: each piece
 * dropped two seconds after it appears, where it appears. A regular aims
 * most of its pieces; an expert nearly all, and sooner.
 */
export const SAND_SKILLS: Readonly<Record<PlayerSkill, SandSkill>> = {
  newcomer: { thinkMs: 2000, stepMs: 250, aimChance: 0 },
  regular: { thinkMs: 1100, stepMs: 160, aimChance: 0.75 },
  expert: { thinkMs: 700, stepMs: 90, aimChance: 0.95 },
};

/** A player of the Sand: it turns, slides, then drops each piece where it planned. */
export class SandCurvePlayer implements CurvePlayer {
  private plan: SandPlan | null = null;
  private timer = 0;
  private readonly detach: () => void;

  constructor(
    private readonly session: SandSession,
    private readonly skill: SandSkill,
    private readonly random: RandomSource,
  ) {
    this.detach = session.onGame('spawn', () => {
      this.plan = null;
    });
  }

  get idle(): boolean {
    return this.session.state === 'running' && this.session.view.active === null;
  }

  update(deltaMs: number): void {
    if (this.session.state !== 'running') return;
    const piece = this.session.view.active;
    if (!piece) return;
    if (!this.plan) {
      const aims = this.random.next() < this.skill.aimChance;
      this.plan = aims
        ? aimSand(this.session.view, piece)
        : { x: piece.x, rotation: piece.rotation };
      this.timer = this.skill.thinkMs;
    }
    this.timer -= deltaMs;
    while (this.timer <= 0) {
      this.timer += this.skill.stepMs;
      if (!this.step()) break;
    }
  }

  dispose(): void {
    this.detach();
  }

  /**
   * One move towards the plan: turn, then slide, then drop. False once
   * dropped; the next piece's arrival clears the plan.
   */
  private step(): boolean {
    const piece = this.session.view.active;
    const plan = this.plan;
    if (!piece || !plan) return false;
    if (
      piece.rotation !== plan.rotation &&
      this.session.execute({ type: 'rotate', direction: 1 })
    ) {
      return true;
    }
    if (piece.x !== plan.x) {
      const direction = piece.x < plan.x ? 1 : -1;
      if (this.session.execute({ type: 'move', direction })) return true;
    }
    this.session.execute({ type: 'hardDrop' });
    return false;
  }
}
