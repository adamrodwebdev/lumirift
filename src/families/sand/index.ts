import { CONTINUE_FREES } from '@/session/ContinueRule';
import type { GameSession, SessionOptions, TrainingStage } from '@/session/GameSession';
import { Mercy } from '@/session/Mercy';
import type { ModeId } from '@/session/ModeId';
import { SandGame, type SandOptions } from './engine/SandGame';
import {
  HOOK_SCRIPT,
  HOOK_WYRM_MS,
  PRACTICE_BED,
  PRACTICE_ELEMENTS,
  PRACTICE_PACE,
  SHOWCASE,
  WYRM_ELEMENTS,
  WYRM_PACE,
} from './engine/Showcase';
import { SandSession } from './SandSession';

/**
 * The portals' training, staged in the Sand (1.33): a prepared well, the
 * pieces in their order, no wind, no defeat. The first bolt shocks the bed
 * wherever it lands; the elements react in pairs; the Dune Wyrm surfaces
 * on its own clock, a bolt never far.
 */
const TRAINING_GAMES: Readonly<Record<TrainingStage, Omit<SandOptions, 'random'>>> = {
  hook: {
    hazards: false,
    bed: { share: 0.36, variant: 0, water: 3 },
    script: HOOK_SCRIPT,
    boss: 'duneWorm',
    bossDelayMs: HOOK_WYRM_MS,
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
        ? {
            wind: false,
            elements: PRACTICE_ELEMENTS,
            elementPace: PRACTICE_PACE,
            bed: PRACTICE_BED,
          }
        : {}),
      ...(options.boss === 'duneWorm'
        ? { boss: 'duneWorm' as const, elements: WYRM_ELEMENTS, elementPace: WYRM_PACE }
        : {}),
      ...(options.boosts ? { boosts: options.boosts } : {}),
      mercy: Mercy.of('sand', options.mercy ?? 0),
      ...(options.startLevel === undefined ? {} : { startLevel: options.startLevel }),
      ...(options.bossHealth === undefined ? {} : { bossHealth: options.bossHealth }),
      ...(options.overflowGoesOn ? { overflowFrees: CONTINUE_FREES.sand } : {}),
    }),
  );
}
