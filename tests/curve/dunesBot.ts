import { FRAME_MS } from '@/campaign/curve/CurveBot';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import { CURVE_PLAYERS } from '@/campaign/curve/CurvePlayers';
import { SeededRandom } from '@/core/Random';
import { createDunesSession, DunesSession } from '@/families/dunes';
import { FIRST_WYRM_LEVEL } from '@/families/dunes/engine/DunesLevels';
import { CRITICAL_FROM, DANGER_FROM, SAFE_BELOW } from '@/session/Tension';

/** A run of Dunes as the bot played it (1.37). */
export interface DunesRecord {
  readonly survivedMs: number;
  readonly score: number;
  /** The level the run ended at (1 for D-1). */
  readonly level: number;
  readonly clears: number;
  readonly pieces: number;
  readonly swaps: number;
  /** Hands dealt again because they fit nowhere before any piece was down. */
  readonly promises: number;
  /** When the first Wyrm's level began and when it fell (ms), or null. */
  readonly wyrmFrom: number | null;
  readonly wyrmBeatenAt: number | null;
  /** Time spent with the board in danger (70 % taken and more), and nearly full (85 %). */
  readonly dangerMs: number;
  readonly criticalMs: number;
  /** Times the board came back from nearly full (85 %) to calm (under 55 %). */
  readonly nearMisses: number;
  readonly end: string;
}

/** An expert may play on and on: the run is cut here. */
export const DUNES_CAP_MS = 15 * 60_000;

/** Each player decides with its own draws, the same for a seed. */
const DECISIONS = 0x2545f491;

/** One run of Dunes, played frame by frame by the curve bot's player. */
export function playDunes(skill: PlayerSkill, seed: number): DunesRecord {
  const session = createDunesSession('dunes', {
    random: new SeededRandom(seed),
    timeLimitMs: null,
  });
  if (!(session instanceof DunesSession)) throw new Error('not Dunes');
  const player = CURVE_PLAYERS.dunes({
    session,
    skill,
    random: new SeededRandom(seed ^ DECISIONS),
    goal: null,
  });
  const { game } = session;
  const tally = { pieces: 0, swaps: 0, promises: 0, end: 'cap' };
  const wyrm: { from: number | null; beaten: number | null } = { from: null, beaten: null };
  session.onDunes('place', () => tally.pieces++);
  session.onDunes('deal', ({ reason }) => {
    if (reason === 'swap') tally.swaps++;
    if (reason === 'promise') tally.promises++;
  });
  session.onDunes('levelUp', ({ level }) => {
    if (level === FIRST_WYRM_LEVEL) wyrm.from = game.elapsedMs;
    if (level === FIRST_WYRM_LEVEL + 1) wyrm.beaten = game.elapsedMs;
  });
  session.events.on('over', ({ reason }) => (tally.end = reason));
  const tension = { dangerMs: 0, criticalMs: 0, nearMisses: 0, critical: false };
  session.start();
  while (session.state !== 'over' && game.elapsedMs < DUNES_CAP_MS) {
    player.update(FRAME_MS);
    session.update(FRAME_MS);
    const pressure = game.pressure();
    if (pressure >= DANGER_FROM) tension.dangerMs += FRAME_MS;
    if (pressure >= CRITICAL_FROM) {
      tension.criticalMs += FRAME_MS;
      tension.critical = true;
    } else if (tension.critical && pressure < SAFE_BELOW) {
      tension.nearMisses++;
      tension.critical = false;
    }
  }
  const record: DunesRecord = {
    survivedMs: game.elapsedMs,
    score: game.score,
    level: game.level.number,
    clears: game.clears,
    pieces: tally.pieces,
    swaps: tally.swaps,
    promises: tally.promises,
    wyrmFrom: wyrm.from,
    wyrmBeatenAt: wyrm.beaten,
    dangerMs: tension.dangerMs,
    criticalMs: tension.criticalMs,
    nearMisses: tension.nearMisses,
    end: tally.end,
  };
  player.dispose();
  session.dispose();
  return record;
}
