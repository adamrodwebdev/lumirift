import type { GameSession, SessionOptions, TrainingStage } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { SandGame, type SandOptions } from './engine/SandGame';
import {
  BOLTS_SCRIPT,
  PAIRS_SCRIPT,
  PRACTICE_ELEMENTS,
  PRACTICE_PACE,
  SHOWCASE,
} from './engine/Showcase';
import { SandSession } from './SandSession';

/**
 * The portals' training, staged in the Sand (1.29): a prepared well, the
 * pieces in their order, no wind, no defeat. The elements react in pairs;
 * then the Dune Wyrm surfaces soon, a bolt never far.
 */
const TRAINING_GAMES: Readonly<Record<TrainingStage, Omit<SandOptions, 'random'>>> = {
  elements: {
    hazards: false,
    bed: { share: 0.36, variant: 0 },
    script: PAIRS_SCRIPT,
    forgiving: true,
  },
  wyrm: {
    hazards: false,
    bed: { share: 0.42, variant: 1 },
    script: BOLTS_SCRIPT,
    boss: 'duneWorm',
    bossDelayMs: 2500,
    bossSeenFirst: true,
    forgiving: true,
  },
};

export { SandSession, type SandView } from './SandSession';

/** Entry point of the sand family chunk (see `ModeCatalog`). */
export function createSandSession(modeId: ModeId, options: SessionOptions): GameSession {
  if (modeId !== 'sand') throw new Error(`"${modeId}" is not a sand mode`);
  if (options.training) {
    const staged = TRAINING_GAMES[options.training];
    return new SandSession(
      modeId,
      new SandGame({ ...staged, random: options.random, timeLimitMs: null }),
      options.training,
    );
  }
  return new SandSession(
    modeId,
    new SandGame({
      random: options.random,
      timeLimitMs: options.timeLimitMs,
      hazards: options.calm !== true,
      ...(options.showcase ? { script: SHOWCASE } : {}),
      ...(options.practice
        ? { wind: false, elements: PRACTICE_ELEMENTS, elementPace: PRACTICE_PACE }
        : {}),
      ...(options.boss === 'duneWorm' ? { boss: 'duneWorm' as const } : {}),
      ...(options.boosts ? { boosts: options.boosts } : {}),
    }),
  );
}
