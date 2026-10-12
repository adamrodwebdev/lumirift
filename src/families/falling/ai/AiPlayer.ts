import type { RandomSource } from '@/core/Random';
import type { FallingSession } from '../FallingSession';
import type { Piece } from '../pieces/Piece';
import { Evaluator } from './Evaluator';
import { searchPlacements, type Placement } from './PlacementSearch';

export const AI_LEVELS = ['easy', 'normal', 'expert'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const isAiLevel = (value: unknown): value is AiLevel =>
  typeof value === 'string' && (AI_LEVELS as readonly string[]).includes(value);

/** How an AI level plays: how long it thinks, how fast it moves, how often it errs. */
export interface AiProfile {
  readonly thinkMs: number;
  /** Time between two moves (rotation or step sideways). */
  readonly stepMs: number;
  /** Chance of choosing a worse placement on purpose. */
  readonly mistakeChance: number;
  /** A mistake picks among this many best placements. */
  readonly mistakeSpread: number;
}

export const AI_PROFILES: Readonly<Record<AiLevel, AiProfile>> = {
  easy: { thinkMs: 900, stepMs: 170, mistakeChance: 0.35, mistakeSpread: 6 },
  normal: { thinkMs: 450, stepMs: 95, mistakeChance: 0.12, mistakeSpread: 3 },
  expert: { thinkMs: 160, stepMs: 45, mistakeChance: 0, mistakeSpread: 1 },
};

/**
 * A computer player. It reads its game like a player looks at the screen and
 * acts only through the same commands as a human: no privileged access.
 */
export class AiPlayer {
  private plan: Placement | null = null;
  private turns = 0;
  private timer = 0;

  constructor(
    private readonly session: FallingSession,
    private readonly profile: AiProfile,
    private readonly random: RandomSource,
    private readonly evaluator = new Evaluator(),
  ) {}

  /** Forgets the plan when a new piece appears; returns the unsubscribe function. */
  attach(): () => void {
    return this.session.onGame('spawn', () => {
      this.plan = null;
    });
  }

  update(deltaMs: number): void {
    if (this.session.state !== 'running') return;
    const piece = this.session.view.active;
    if (!piece) return;
    if (!this.plan) {
      this.plan = this.choose(piece);
      this.turns = 0;
      this.timer = this.profile.thinkMs;
      if (!this.plan) {
        this.session.execute({ type: 'hardDrop' });
        return;
      }
    }
    this.timer -= deltaMs;
    while (this.timer <= 0) {
      this.timer += this.profile.stepMs;
      if (!this.step()) break;
    }
  }

  private choose(piece: Piece): Placement | null {
    const ranked = this.evaluator.rank(searchPlacements(this.session.view.board, piece));
    if (ranked.length === 0) return null;
    const mistake = this.random.next() < this.profile.mistakeChance;
    const index = mistake
      ? this.random.nextInt(Math.min(this.profile.mistakeSpread, ranked.length))
      : 0;
    return ranked[index]!;
  }

  /** One move towards the plan: turn, then slide, then drop. False once dropped. */
  private step(): boolean {
    const piece = this.session.view.active;
    const plan = this.plan;
    if (!piece || !plan) return false;
    if (this.turns < plan.rotation) {
      this.session.execute({ type: 'rotate', direction: 1 });
      this.turns++;
      return true;
    }
    if (piece.x !== plan.x) {
      const moved = this.session.execute({ type: 'move', direction: piece.x < plan.x ? 1 : -1 });
      if (moved) return true;
    }
    this.session.execute({ type: 'hardDrop' });
    this.plan = null;
    return false;
  }
}
