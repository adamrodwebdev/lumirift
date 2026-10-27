import { DunesSession } from '@/families/dunes';
import { DuelSession, FallingSession } from '@/families/falling';
import { AiPlayer } from '@/families/falling/ai/AiPlayer';
import { SilhouetteAiPlayer } from '@/families/falling/ai/SilhouetteAiPlayer';
import { PlacementSession } from '@/families/placement';
import { RaceSession } from '@/families/race';
import { SandSession } from '@/families/sand';
import type { GameSession } from '@/session/GameSession';
import type { FamilyId, ModeId } from '@/session/ModeId';
import type { CurvePlayerFactory, CurveSeat } from './CurvePlayer';
import { DUNES_SKILLS, DunesCurvePlayer } from './DunesCurvePlayer';
import { FALLING_SKILLS, FallingCurvePlayer } from './FallingCurvePlayer';
import { bigClearValue, clearValue } from './MosaicChoice';
import { MOSAIC_SKILLS, MosaicCurvePlayer } from './MosaicCurvePlayer';
import { RaceCurvePlayer } from './RaceCurvePlayer';
import { SAND_SKILLS, SandCurvePlayer } from './SandCurvePlayer';

/** The player's own well: its side of a duel, or the session itself. */
function fallingSide(session: GameSession): FallingSession {
  if (session instanceof DuelSession) return session.player;
  if (session instanceof FallingSession) return session;
  throw new Error(`"${session.modeId}" is not played in a falling well`);
}

/** Modes whose rules spoil a stack kept for four-line clears: fusions melt it first. */
const NO_ATTACKS: ReadonlySet<ModeId> = new Set(['fusion']);

/** Lines at once that no player gets without building for them. */
const BUILT_CLEAR = 3;

/**
 * A falling well's AI. The goal on screen steers it: three lines at once
 * or more make every player build for them; a silhouette is filled, not
 * cleared.
 */
function fallingAi({ skill, random, goal }: CurveSeat, own: FallingSession): AiPlayer {
  const profile = FALLING_SKILLS[skill];
  if (own.modeId === 'silhouette') return new SilhouetteAiPlayer(own, profile, random);
  const builds = goal?.kind === 'bigClear' && goal.target >= BUILT_CLEAR;
  const attacks = builds || (profile.attacks && !NO_ATTACKS.has(own.modeId));
  return new AiPlayer(own, { ...profile, attacks }, random);
}

const falling: CurvePlayerFactory = (seat) => {
  const own = fallingSide(seat.session);
  return new FallingCurvePlayer(own, fallingAi(seat, own));
};

/** The curve bot's player of each family (the Tower plays the falling engine). */
export const CURVE_PLAYERS: Readonly<Record<FamilyId, CurvePlayerFactory>> = {
  falling,
  volume: falling,
  sand: ({ session, skill, random }) => {
    if (!(session instanceof SandSession))
      throw new Error(`"${session.modeId}" is not a Sand game`);
    return new SandCurvePlayer(session, SAND_SKILLS[skill], random);
  },
  placement: ({ session, skill, random, goal }) => {
    if (!(session instanceof PlacementSession)) {
      throw new Error(`"${session.modeId}" is not a Mosaic game`);
    }
    const value = goal?.kind === 'bigClear' ? bigClearValue(goal.target) : clearValue;
    const mosaic = MOSAIC_SKILLS[skill];
    return new MosaicCurvePlayer(session, mosaic.thinkMs, mosaic.choice(random, value));
  },
  // The race: the player of each world in turn, seated again at every shift.
  rift: ({ session, skill, random }) => {
    if (!(session instanceof RaceSession)) throw new Error(`"${session.modeId}" is not a race`);
    return new RaceCurvePlayer(session, (world) =>
      CURVE_PLAYERS[world.family]({ session: world, skill, random, goal: null }),
    );
  },
  dunes: ({ session, skill, random }) => {
    if (!(session instanceof DunesSession)) throw new Error(`"${session.modeId}" is not Dunes`);
    return new DunesCurvePlayer(session, DUNES_SKILLS[skill], random);
  },
};
