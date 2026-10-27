import { describe, expect, it } from 'vitest';
import type { PlayerSkill } from '@/campaign/curve/CurvePlayer';
import { FIRST_WYRM_LEVEL, FOURTH_COLOUR_LEVEL } from '@/families/dunes/engine/DunesLevels';
import { playDunes, type DunesRecord } from './dunesBot';

/** Six runs for each player. */
const SEEDS = 6;
/** The sandbox test's gate counts the sessions past three minutes (1.37). */
const GATE_MS = 3 * 60_000;
const TIMEOUT_MS = 300_000;

const played = new Map<PlayerSkill, readonly DunesRecord[]>();
function runs(skill: PlayerSkill): readonly DunesRecord[] {
  const known = played.get(skill);
  if (known) return known;
  const records = Array.from({ length: SEEDS }, (_, k) => playDunes(skill, k + 1));
  played.set(skill, records);
  return records;
}

const count = (records: readonly DunesRecord[], test: (record: DunesRecord) => boolean) =>
  records.filter(test).length;

/*
 * Dunes, played by the curve bot (1.37). Measured: four colours from the
 * start ended most runs within two minutes; three colours, the colour closest
 * to linking dealt more often (more near the top, less as the run climbs) and
 * a fourth colour from D-6 give the bands below. The bot's players differ
 * mostly by their pace; the sandbox test and strangers' sessions will tell
 * the real curve.
 */
describe('Dunes, played by the curve bot (1.37)', () => {
  it(
    'keeps a newcomer past three minutes, through the first Wyrm, with the danger seen',
    () => {
      const newcomer = runs('newcomer');
      expect(count(newcomer, (run) => run.survivedMs >= GATE_MS)).toBe(SEEDS);
      expect(count(newcomer, (run) => run.wyrmBeatenAt !== null)).toBeGreaterThanOrEqual(SEEDS - 1);
      // Never a calm walk: the board climbs into the danger zone in every run.
      expect(count(newcomer, (run) => run.dangerMs > 0)).toBe(SEEDS);
    },
    TIMEOUT_MS,
  );

  it(
    'brings regulars and experts to the first Wyrm and past it, most of the time',
    () => {
      for (const skill of ['regular', 'expert'] as const) {
        const records = runs(skill);
        expect(
          count(records, (run) => run.level >= FIRST_WYRM_LEVEL),
          skill,
        ).toBeGreaterThanOrEqual(SEEDS - 1);
        expect(
          count(records, (run) => run.wyrmBeatenAt !== null),
          skill,
        ).toBeGreaterThanOrEqual(SEEDS - 2);
      }
    },
    TIMEOUT_MS,
  );

  it(
    'ends the runs that climb: the fourth colour is the wall, not the clock',
    () => {
      const climbed = (['regular', 'expert'] as const).flatMap((skill) =>
        runs(skill).filter((run) => run.level >= FOURTH_COLOUR_LEVEL),
      );
      expect(climbed.length).toBeGreaterThan(0);
      expect(count(climbed, (run) => run.end === 'noMoves')).toBe(climbed.length);
      // The dealer keeps its promise: a hand that fits nowhere is never left on the board.
      for (const skill of ['newcomer', 'regular', 'expert'] as const) {
        for (const run of runs(skill)) expect(run.pieces).toBeGreaterThan(30);
      }
    },
    TIMEOUT_MS,
  );
});
