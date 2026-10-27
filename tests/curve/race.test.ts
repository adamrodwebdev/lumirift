import { describe, expect, it } from 'vitest';
import { FRAME_MS } from '@/campaign/curve/CurveBot';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import { CLOCK, SHIFTS } from '@/families/race/rules/RaceTuning';
import { RACE_WORLDS } from '@/families/race/rules/ShiftSchedule';
import { CURVE_TIMEOUT_MS } from './campaignCurve';
import { playRace, type RaceRecord } from './raceBot';

/** Eight races for each player. */
const SEEDS = 8;
/** A newcomer's run lasts about two and a half minutes (the specification, 1.34). */
const NEWCOMER_RUN_MS = { from: 135_000, to: 170_000 };
/** A regular's lasts three minutes at least: the portals' gate for a session. */
const REGULAR_LEAST_MS = 180_000;

const played = new Map<PlayerSkill, readonly RaceRecord[]>();
function races(skill: PlayerSkill): readonly RaceRecord[] {
  const known = played.get(skill);
  if (known) return known;
  const runs = Array.from({ length: SEEDS }, (_, k) => playRace(skill, k + 1));
  played.set(skill, runs);
  return runs;
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('The Rift Race, played by the curve bot (1.34)', () => {
  it(
    'lasts about two and a half minutes for a newcomer, three and more for a regular',
    () => {
      const newcomer = mean(races('newcomer').map((run) => run.survivedMs));
      expect(newcomer).toBeGreaterThanOrEqual(NEWCOMER_RUN_MS.from);
      expect(newcomer).toBeLessThanOrEqual(NEWCOMER_RUN_MS.to);
      expect(mean(races('regular').map((run) => run.survivedMs))).toBeGreaterThanOrEqual(
        REGULAR_LEAST_MS,
      );
      for (const skill of ['newcomer', 'regular'] as const) {
        expect(races(skill).map((run) => run.end)).toEqual(Array(SEEDS).fill('timeUp'));
      }
    },
    CURVE_TIMEOUT_MS,
  );

  it(
    'shifts on time through the three worlds, its clock in bounds, whatever is going on',
    () => {
      for (const skill of ['newcomer', 'regular', 'expert'] as const) {
        for (const run of races(skill)) {
          run.wipesAt.forEach((at, k) => {
            const due = SHIFTS.phaseMs + k * (SHIFTS.phaseMs + SHIFTS.wipeMs);
            // A frame late at most for each phase and wipe before.
            expect(at - due).toBeGreaterThanOrEqual(0);
            expect(at - due).toBeLessThanOrEqual(2 * (k + 1) * FRAME_MS);
          });
          expect(run.worlds).toEqual(run.worlds.map((_, k) => RACE_WORLDS[k % RACE_WORLDS.length]));
          expect(run.highestLeftMs).toBeLessThanOrEqual(CLOCK.capMs);
          for (const left of run.afterOverflowMs) {
            expect(left).toBeGreaterThanOrEqual(CLOCK.overflowFloorMs);
          }
          // A sure Guardian at the second shift, whoever plays.
          if (run.wipesAt.length >= 2) expect(run.guardians).toBeGreaterThanOrEqual(1);
        }
      }
      // Regulars and experts clear in every world: the player is seated again at each shift.
      for (const skill of ['regular', 'expert'] as const) {
        for (const run of races(skill)) expect(Math.min(...run.clearsByPhase)).toBeGreaterThan(0);
      }
    },
    CURVE_TIMEOUT_MS,
  );
});
