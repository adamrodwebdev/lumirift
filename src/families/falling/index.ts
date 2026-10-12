import type { SessionOptions } from '@/session/GameSession';
import type { FallingModeId, ModeId } from '@/session/ModeId';
import { FallingSession } from './FallingSession';
import { Game } from './game/Game';
import type { ModeOptions } from './modes/AbstractMode';
import { ChromaMode } from './modes/ChromaMode';
import { ClassicMode } from './modes/ClassicMode';
import { FlipMode } from './modes/FlipMode';
import type { GameMode } from './modes/GameMode';
import { MirrorMode } from './modes/MirrorMode';
import { TideMode } from './modes/TideMode';

export { FallingSession, type FallingCommand, type FallingView } from './FallingSession';

const MODES: Readonly<Record<FallingModeId, (options: ModeOptions) => GameMode>> = {
  classic: (options) => new ClassicMode(options),
  tide: (options) => new TideMode(options),
  flip: (options) => new FlipMode(options),
  chroma: (options) => new ChromaMode(options),
  mirror: (options) => new MirrorMode(options),
};

const isFallingMode = (id: ModeId): id is FallingModeId => id in MODES;

/** Entry point of the falling family chunk (see `ModeCatalog`). */
export function createFallingSession(modeId: ModeId, options: SessionOptions): FallingSession {
  if (!isFallingMode(modeId)) throw new Error(`"${String(modeId)}" is not a falling mode`);
  const mode = MODES[modeId]({ timeLimitMs: options.timeLimitMs });
  return new FallingSession(modeId, new Game(mode, { random: options.random }));
}
