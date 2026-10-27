import { SeededRandom } from '@/core/Random';
import type { GameSession, SessionOptions } from '@/session/GameSession';
import { Mercy } from '@/session/Mercy';
import type { FallingModeId, ModeId } from '@/session/ModeId';
import { isAiLevel } from './ai/AiPlayer';
import { DuelSession } from './DuelSession';
import { FallingSession } from './FallingSession';
import { Game } from './game/Game';
import type { ModeOptions } from './modes/AbstractMode';
import { ChromaMode } from './modes/ChromaMode';
import { ClassicMode } from './modes/ClassicMode';
import { DuelMode } from './modes/DuelMode';
import { FlipMode } from './modes/FlipMode';
import { FusionMode } from './modes/FusionMode';
import type { GameMode } from './modes/GameMode';
import { MirrorMode } from './modes/MirrorMode';
import { RiftHeartMode } from './modes/RiftHeartMode';
import { RhythmMode } from './modes/RhythmMode';
import { SilhouetteMode } from './modes/SilhouetteMode';
import { TideMode } from './modes/TideMode';
import { TiltMode } from './modes/TiltMode';
import { LINE_CLEAR_DELAY_MS } from './rules/Timings';

export { DuelSession } from './DuelSession';
export { FallingSession, type FallingCommand, type FallingView } from './FallingSession';

export { LINE_CLEAR_DELAY_MS } from './rules/Timings';

type SoloModeId = Exclude<FallingModeId, 'duel'>;

/** Modes played alone: one game, one mode. */
const SOLO_MODES: Readonly<Record<SoloModeId, (options: ModeOptions) => GameMode>> = {
  classic: (options) => new ClassicMode(options),
  tide: (options) => new TideMode(options),
  flip: (options) => new FlipMode(options),
  chroma: (options) => new ChromaMode(options),
  mirror: (options) => new MirrorMode(options),
  fusion: (options) => new FusionMode(options),
  tilt: (options) => new TiltMode(options),
  silhouette: (options) => new SilhouetteMode(options),
  rhythm: (options) => new RhythmMode(options),
};

const isSoloMode = (id: ModeId): id is SoloModeId => id in SOLO_MODES;

const modeOptions = (options: SessionOptions): ModeOptions => ({
  timeLimitMs: options.timeLimitMs,
  ...(options.today ? { today: options.today } : {}),
  ...(options.boosts ? { boosts: options.boosts } : {}),
});

/**
 * A duel against the AI: both games are dealt the same pieces (one seed for
 * both), the AI thinks with its own random source.
 */
function createDuelSession(options: SessionOptions): DuelSession {
  const seed = options.random.nextInt(2 ** 32);
  // Upgrades and mercy help the player only, never the AI.
  const player = new Game(new DuelMode(modeOptions(options)), {
    random: new SeededRandom(seed),
    lineClearDelayMs: LINE_CLEAR_DELAY_MS,
    mercy: Mercy.of('falling', options.mercy ?? 0),
    ...(options.boosts ? { boosts: options.boosts } : {}),
  });
  const opponent = new Game(new DuelMode({ timeLimitMs: options.timeLimitMs }), {
    random: new SeededRandom(seed),
    lineClearDelayMs: LINE_CLEAR_DELAY_MS,
  });
  const level = isAiLevel(options.variant) ? options.variant : 'normal';
  return new DuelSession(player, opponent, level, new SeededRandom(seed ^ 0x9e3779b9));
}

/** A game played alone. */
export function createSoloSession(modeId: ModeId, options: SessionOptions): FallingSession {
  if (!isSoloMode(modeId)) throw new Error(`"${modeId}" is not a solo falling mode`);
  // The last Guardian beats under the classic well.
  const mode =
    options.boss === 'riftHeart' && modeId === 'classic'
      ? new RiftHeartMode(modeOptions(options))
      : SOLO_MODES[modeId](modeOptions(options));
  return new FallingSession(
    modeId,
    new Game(mode, {
      random: options.random,
      lineClearDelayMs: LINE_CLEAR_DELAY_MS,
      mercy: Mercy.of('falling', options.mercy ?? 0),
      ...(options.boosts ? { boosts: options.boosts } : {}),
    }),
  );
}

/** Entry point of the falling family chunk (see `ModeCatalog`). */
export function createFallingSession(modeId: ModeId, options: SessionOptions): GameSession {
  return modeId === 'duel' ? createDuelSession(options) : createSoloSession(modeId, options);
}
