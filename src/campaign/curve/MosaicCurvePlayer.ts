import type { RandomSource } from '@/core/Random';
import type { PlacementSession } from '@/families/placement';
import type { CurvePlayer, PlayerSkill } from './CurvePlayer';
import {
  CasualChoice,
  GreedyChoice,
  LookaheadChoice,
  rescueOf,
  type MosaicChoice,
  type MoveValue,
} from './MosaicChoice';

/** How a Mosaic player of a skill plays: its pace, and how it picks a move worth what it values. */
export interface MosaicSkill {
  /** Time it takes for each piece. */
  readonly thinkMs: number;
  choice(random: RandomSource, value: MoveValue): MosaicChoice;
}

/** A newcomer places anything anywhere; a regular takes the best move now; an expert keeps the hand playable. */
export const MOSAIC_SKILLS: Readonly<Record<PlayerSkill, MosaicSkill>> = {
  newcomer: { thinkMs: 4000, choice: (random) => new CasualChoice(random) },
  regular: { thinkMs: 2500, choice: (_random, value) => new GreedyChoice(value) },
  expert: { thinkMs: 1500, choice: (_random, value) => new LookaheadChoice(value) },
};

/** A player of the Mosaic: a piece of its hand placed at its own pace. */
export class MosaicCurvePlayer implements CurvePlayer {
  /** A hand is always there to play: the Mosaic never makes it wait. */
  readonly idle = false;
  private timer: number;

  constructor(
    private readonly session: PlacementSession,
    private readonly thinkMs: number,
    private readonly choice: MosaicChoice,
  ) {
    this.timer = thinkMs;
  }

  update(deltaMs: number): void {
    if (this.session.state !== 'running') return;
    this.timer -= deltaMs;
    if (this.timer > 0) return;
    this.timer += this.thinkMs;
    const view = this.session.view;
    const move = this.choice.choose(view);
    // Stuck, the game waits for a joker: the player presses one.
    const command = move ? { type: 'place' as const, ...move } : rescueOf(view);
    if (command) this.session.execute(command);
  }

  dispose(): void {
    // Nothing to release: it listens to nothing.
  }
}
