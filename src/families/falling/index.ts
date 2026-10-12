import type { SessionOptions } from '@/session/GameSession';
import type { FallingModeId, ModeId } from '@/session/ModeId';
import { FallingSession } from './FallingSession';
import { Game } from './game/Game';
import type { ModeOptions } from './modes/AbstractMode';
import { ChromaMode } from './modes/ChromaMode';
import { ClassicMode } from './modes/ClassicMode';
import { FlipMode } from './modes/FlipMode';
import { FusionMode } from './modes/FusionMode';
import type { GameMode } from './modes/GameMode';
import { MirrorMode } from './modes/MirrorMode';
import { RhythmMode } from './modes/RhythmMode';
import { SilhouetteMode } from './modes/SilhouetteMode';
import { TideMode } from './modes/TideMode';
import { TiltMode } from './modes/TiltMode';

export { FallingSession, type FallingCommand, type FallingView } from './FallingSession';

/** Pause after a line clear, long enough to see the row shatter and the stack fall. */
export const LINE_CLEAR_DELAY_MS = 280;

const MODES: Readonly<Record<FallingModeId, (options: ModeOptions) => GameMode>> = {
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

const isFallingMode = (id: ModeId): id is FallingModeId => id in MODES;

/** Entry point of the falling family chunk (see `ModeCatalog`). */
export function createFallingSession(modeId: ModeId, options: SessionOptions): FallingSession {
  if (!isFallingMode(modeId)) throw new Error(`"${String(modeId)}" is not a falling mode`);
  const mode = MODES[modeId]({
    timeLimitMs: options.timeLimitMs,
    ...(options.today ? { today: options.today } : {}),
  });
  return new FallingSession(
    modeId,
    new Game(mode, { random: options.random, lineClearDelayMs: LINE_CLEAR_DELAY_MS }),
  );
}
