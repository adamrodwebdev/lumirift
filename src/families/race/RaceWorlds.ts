import { createSoloSession, FallingSession, type FallingCommand } from '@/families/falling';
import { createSandSession, SandSession } from '@/families/sand';
import { createVolumeSession } from '@/families/volume';
import type { BossId, GameSession, SessionOptions } from '@/session/GameSession';
import type { FamilyId, ModeId } from '@/session/ModeId';
import type { RaceWorld } from './rules/ShiftSchedule';

/** A world of the race: the mode it plays, its family (its stage), its Guardian. */
export interface WorldGame {
  readonly modeId: ModeId;
  readonly family: FamilyId;
  readonly boss: BossId;
}

/** The race's worlds, each with its own Guardian: the Heart under the well, the Wyrm, the Eye. */
export const WORLD_GAMES: Readonly<Record<RaceWorld, WorldGame>> = {
  well: { modeId: 'classic', family: 'falling', boss: 'riftHeart' },
  sand: { modeId: 'sand', family: 'sand', boss: 'duneWorm' },
  tower: { modeId: 'tower', family: 'volume', boss: 'towerEye' },
};

/** A world's game: all three are played with the falling family's commands. */
export type WorldSession = GameSession<FallingCommand>;

/** Opens a world's game with the race's options (its level, its Guardian). */
export type WorldFactory = (world: RaceWorld, options: SessionOptions) => WorldSession;

const FACTORIES: Readonly<
  Record<RaceWorld, (modeId: ModeId, options: SessionOptions) => GameSession>
> = {
  well: createSoloSession,
  sand: createSandSession,
  tower: createVolumeSession,
};

/** The game of a world, which takes the falling commands (the Tower's is a falling session). */
function played(game: GameSession): WorldSession {
  if (game instanceof FallingSession || game instanceof SandSession) return game;
  throw new Error(`"${game.modeId}" is not a world of the race`);
}

/** The worlds' own games, made by their families. */
export const openWorld: WorldFactory = (world, options) =>
  played(FACTORIES[world](WORLD_GAMES[world].modeId, options));
