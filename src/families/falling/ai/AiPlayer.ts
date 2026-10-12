import type { RandomSource } from '@/core/Random';
import type { FallingSession } from '../FallingSession';
import { Piece } from '../pieces/Piece';
import { ATTACK_SAFE_HEIGHT, AttackEvaluator, Evaluator } from './Evaluator';
import { searchPlacements, type Placement } from './PlacementSearch';

/** From a beginner to a top player, by the speeds of real players (pieces per second). */
export const AI_LEVELS = ['rookie', 'easy', 'normal', 'hard', 'expert'] as const;
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
  /** A mistake picks among this many best placements, the nearest ones more often. */
  readonly mistakeSpread: number;
  /** Weighs each placement with the best one for the next piece. */
  readonly lookahead: boolean;
  /** Puts a piece in reserve when the other one fits better. */
  readonly useHold: boolean;
  /** Builds up for four-line clears while the well is low. */
  readonly attacks: boolean;
}

/*
 * Speeds aimed at, with about four moves per piece: 0.5, 0.8, 1.1, 1.7 and
 * 2.5 pieces per second, roughly the 10th, 30th, 50th, 90th and 99th
 * percentiles of ranked online players.
 */
export const AI_PROFILES: Readonly<Record<AiLevel, AiProfile>> = {
  rookie: {
    thinkMs: 1200,
    stepMs: 200,
    mistakeChance: 0.3,
    mistakeSpread: 5,
    lookahead: false,
    useHold: false,
    attacks: false,
  },
  easy: {
    thinkMs: 650,
    stepMs: 150,
    mistakeChance: 0.18,
    mistakeSpread: 4,
    lookahead: false,
    useHold: false,
    attacks: false,
  },
  normal: {
    thinkMs: 420,
    stepMs: 120,
    mistakeChance: 0.08,
    mistakeSpread: 3,
    lookahead: false,
    useHold: true,
    attacks: true,
  },
  hard: {
    thinkMs: 270,
    stepMs: 80,
    mistakeChance: 0.03,
    mistakeSpread: 2,
    lookahead: true,
    useHold: true,
    attacks: true,
  },
  expert: {
    thinkMs: 160,
    stepMs: 60,
    mistakeChance: 0,
    mistakeSpread: 1,
    lookahead: true,
    useHold: true,
    attacks: true,
  },
};

/** Placements of the current piece weighed with the next one, for lookahead. */
const LOOKAHEAD_WIDTH = 6;
/** The other piece must be this much better to be worth a hold. */
const HOLD_MARGIN = 0.3;

/**
 * A computer player. It reads its game like a player looks at the screen and
 * acts only through the same commands as a human: no privileged access.
 */
export class AiPlayer {
  private plan: Placement | null = null;
  private turns = 0;
  private timer = 0;

  private readonly safe = new Evaluator();
  private readonly attack = new AttackEvaluator();

  constructor(
    private readonly session: FallingSession,
    private readonly profile: AiProfile,
    private readonly random: RandomSource,
  ) {}

  /** Attacks while the well is low, plays safe once it grows. */
  private get evaluator(): Evaluator {
    const low = this.session.view.board.stackHeight() < ATTACK_SAFE_HEIGHT;
    return this.profile.attacks && low ? this.attack : this.safe;
  }

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
      if (this.wantsHold(piece)) {
        // The next piece appears at once; the plan is made for it.
        this.session.execute({ type: 'hold' });
        return;
      }
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
    const ranked = this.rank(piece);
    if (ranked.length === 0) return null;
    const spread = Math.min(this.profile.mistakeSpread, ranked.length);
    if (spread < 2 || this.random.next() >= this.profile.mistakeChance) return ranked[0]!;
    // A human-looking slip: a near-best placement far more often than a bad one.
    let pick = this.random.next() * (1 - 0.5 ** (spread - 1));
    let index = 1;
    while (index < spread - 1 && pick >= 0.5 ** index) {
      pick -= 0.5 ** index;
      index++;
    }
    return ranked[index]!;
  }

  /** Placements from best to worst; with lookahead, each counts the best next placement. */
  private rank(piece: Piece): Placement[] {
    const board = this.session.view.board;
    const ranked = this.evaluator.rank(searchPlacements(board, piece));
    const next = this.session.view.preview(1)[0];
    if (!this.profile.lookahead || !next || ranked.length === 0) return ranked;
    const value = new Map<Placement, number>();
    for (const placement of ranked.slice(0, LOOKAHEAD_WIDTH)) {
      const upcoming = Piece.spawn(next.type, next.tone, board.width);
      const best = this.evaluator.rank(searchPlacements(placement.after, upcoming))[0];
      value.set(
        placement,
        this.evaluator.score(placement) + (best ? this.evaluator.score(best) : -100),
      );
    }
    return [...value.keys()].sort((a, b) => value.get(b)! - value.get(a)!);
  }

  /** Is the held piece (or the next one, when the reserve is empty) clearly better? */
  private wantsHold(piece: Piece): boolean {
    const view = this.session.view;
    if (!this.profile.useHold || !view.canHold) return false;
    const other = view.held ?? view.preview(1)[0];
    if (!other || other.type === piece.type) return false;
    const best = (candidate: Piece) =>
      this.evaluator
        .rank(searchPlacements(view.board, candidate))
        .map((p) => this.evaluator.score(p))[0] ?? -Infinity;
    const swapped = Piece.spawn(other.type, other.tone, view.board.width);
    return best(swapped) > best(piece) + HOLD_MARGIN;
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
