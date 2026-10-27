import { SeededRandom } from '@/core/Random';
import { createFallingSession } from '@/families/falling';
import { createPlacementSession } from '@/families/placement';
import { createRaceSession } from '@/families/race';
import { createSandSession } from '@/families/sand';
import { createVolumeSession } from '@/families/volume';
import { GameTracker } from '@/progression/GameReport';
import { liveStateOf } from '@/run/LiveState';
import { LevelRun } from '@/run/RunKind';
import { ModeCatalog, type SessionFactory } from '@/session/ModeCatalog';
import type { FamilyId } from '@/session/ModeId';
import type { LiveState } from '../Goals';
import type { CampaignLevel } from '../Levels';
import type { UpgradeRanks } from '../Upgrades';
import { loadoutFor } from './CurveLoadout';
import type { CurvePlayerFactory, PlayerSkill } from './CurvePlayer';
import { CURVE_PLAYERS } from './CurvePlayers';
import { CurveMeter, type CurveOutcome, type CurveReport } from './CurveReport';

/** A frame of the simulation, as at 60 Hz. */
export const FRAME_MS = 16;
/** A level without a clock (a duel, the silhouette) is cut after this long. */
export const UNTIMED_CAP_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

/** One game for the bot: a level, a player, a seed for its pieces. */
export interface CurveRun {
  readonly level: CampaignLevel;
  readonly skill: PlayerSkill;
  readonly seed: number;
}

/** What the bot plays with. */
export interface CurveBotPorts {
  /** Creates a game at once (the families' factories, not their lazy chunks). */
  readonly create: SessionFactory;
  /** The player of each family. */
  readonly players: Readonly<Record<FamilyId, CurvePlayerFactory>>;
  /** The first day it plays (seed n plays n days later: the silhouette of the day). */
  readonly today: Date;
  /** The upgrades owned in a chapter. */
  readonly loadout: (chapter: number) => UpgradeRanks;
}

/** Each player decides with its own draws, the same for a seed. */
const DECISION_SEEDS: Readonly<Record<PlayerSkill, number>> = {
  newcomer: 0x1b873593,
  regular: 0x2c1b3c6d,
  expert: 0x297a2d39,
};

/**
 * The curve bot (1.33): it plays a campaign level as a newcomer, a regular
 * or an expert, frame by frame, judged as the game screen judges it (the
 * level's clock and goal, the upgrades of its chapter), and reports how the game felt
 * (`CurveReport`): its pressure, its dead time, its near misses, its end.
 */
export class CurveBot {
  constructor(private readonly ports: CurveBotPorts) {}

  play({ level, skill, seed }: CurveRun): CurveReport {
    const run = new LevelRun(level.modeId, level, this.ports.loadout(level.chapter));
    // Each seed another day: a level that changes daily (the silhouette) is played on several.
    const today = new Date(this.ports.today.getTime() + seed * DAY_MS);
    const session = this.ports.create(level.modeId, run.sessionOptions(seed, today));
    const random = new SeededRandom(seed ^ DECISION_SEEDS[skill]);
    const player = this.ports.players[session.family]({ session, skill, random, goal: level.goal });
    const tracker = new GameTracker(session);
    const judge = run.campaignRun();
    const meter = new CurveMeter();
    const live = (): LiveState => liveStateOf(session, tracker);
    const ending: { outcome: CurveOutcome | null } = { outcome: null };
    const over = () => ending.outcome !== null;
    const reached = (won: boolean) => {
      const { value, target } = judge.progress(live());
      return won ? 1 : Math.min(1, value / target);
    };
    const off = session.events.on('over', ({ reason }) => {
      if (over()) return;
      const { won } = judge.end(reason, live());
      ending.outcome = { won, reason, progress: reached(won) };
    });
    const capMs = (run.timeLimitMs ?? UNTIMED_CAP_MS) + 1000;
    session.start();
    while (!over()) {
      player.update(FRAME_MS);
      if (session.state === 'running') tracker.tick(FRAME_MS);
      session.update(FRAME_MS);
      meter.frame(session.pressure(), player.idle, FRAME_MS);
      if (over()) break;
      if (judge.check(live())) ending.outcome = { won: true, reason: 'goal', progress: 1 };
      else if (meter.durationMs >= capMs) {
        ending.outcome = { won: false, reason: 'cap', progress: reached(false) };
      }
    }
    off();
    player.dispose();
    tracker.dispose();
    session.dispose();
    return meter.report({ levelId: level.id, skill, seed }, ending.outcome!);
  }
}

const SESSIONS: Readonly<Record<FamilyId, SessionFactory>> = {
  falling: createFallingSession,
  sand: createSandSession,
  placement: createPlacementSession,
  volume: createVolumeSession,
  rift: createRaceSession,
};

/** The bot with the real games and players, playing on `today` with a regular's upgrades. */
export function curveBot(
  today: Date,
  loadout: (chapter: number) => UpgradeRanks = loadoutFor,
): CurveBot {
  const catalog = new ModeCatalog();
  return new CurveBot({
    create: (modeId, options) => SESSIONS[catalog.get(modeId).family](modeId, options),
    players: CURVE_PLAYERS,
    today,
    loadout,
  });
}
