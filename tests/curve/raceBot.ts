import { FRAME_MS } from '@/campaign/curve/CurveBot';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import { CURVE_PLAYERS } from '@/campaign/curve/CurvePlayers';
import { SeededRandom } from '@/core/Random';
import { createRaceSession, RaceSession } from '@/families/race';
import type { RaceWorld } from '@/families/race/rules/ShiftSchedule';

/** A race as the bot played it. */
export interface RaceRecord {
  readonly survivedMs: number;
  readonly score: number;
  readonly worlds: readonly RaceWorld[];
  /** When the Rift wiped each board (time survived, ms). */
  readonly wipesAt: readonly number[];
  /** Clears made in each world's phase that ended, in order: the player plays every one. */
  readonly clearsByPhase: readonly number[];
  readonly guardians: number;
  readonly beaten: number;
  /** The share of its health each Guardian lost before it left or fell (1: it fell). */
  readonly guardianDamage: readonly number[];
  readonly overflows: number;
  readonly highestLeftMs: number;
  /** The clock right after each overflow. */
  readonly afterOverflowMs: readonly number[];
  readonly end: string;
}

/** An expert may outlive any clock: the run is cut here. */
export const RACE_CAP_MS = 8 * 60_000;

/** Each player decides with its own draws, the same for a seed. */
const DECISIONS = 0x5bd1e995;

/** One race, played frame by frame by the curve bot's player of each world. */
export function playRace(skill: PlayerSkill, seed: number): RaceRecord {
  const session = createRaceSession('race', { random: new SeededRandom(seed), timeLimitMs: null });
  if (!(session instanceof RaceSession)) throw new Error('not a race');
  const player = CURVE_PLAYERS.rift({
    session,
    skill,
    random: new SeededRandom(seed ^ DECISIONS),
    goal: null,
  });
  const wipesAt: number[] = [];
  const clearsByPhase: number[] = [];
  const clears = { phase: 0 };
  const afterOverflowMs: number[] = [];
  const guardianDamage: number[] = [];
  const seen = { share: 0 };
  const tally = { guardians: 0, overflows: 0, highestLeftMs: 0, end: 'cap' };
  session.race.on('wipe', () => {
    wipesAt.push(session.survivedMs);
    clearsByPhase.push(clears.phase);
    clears.phase = 0;
  });
  session.events.on('clear', () => clears.phase++);
  session.race.on('guardian', ({ change }) => {
    if (change === 'joined') tally.guardians++;
    else guardianDamage.push(change === 'beaten' ? 1 : seen.share);
    seen.share = 0;
  });
  session.race.on('time', ({ reason }) => {
    if (reason !== 'overflow') return;
    tally.overflows++;
    afterOverflowMs.push(session.timeLeftMs);
  });
  session.events.on('over', ({ reason }) => (tally.end = reason));
  session.start();
  while (session.state !== 'over' && session.survivedMs < RACE_CAP_MS) {
    player.update(FRAME_MS);
    session.update(FRAME_MS);
    tally.highestLeftMs = Math.max(tally.highestLeftMs, session.timeLeftMs);
    const boss = session.boss();
    if (boss) seen.share = 1 - boss.health / boss.maxHealth;
  }
  const record: RaceRecord = {
    survivedMs: session.survivedMs,
    score: session.score,
    worlds: [...session.worlds],
    wipesAt,
    clearsByPhase,
    guardians: tally.guardians,
    beaten: session.guardiansBeaten,
    guardianDamage,
    overflows: tally.overflows,
    highestLeftMs: tally.highestLeftMs,
    afterOverflowMs,
    end: tally.end,
  };
  player.dispose();
  session.dispose();
  return record;
}
