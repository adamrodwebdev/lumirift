import { describe, expect, it } from 'vitest';
import { GuardianChallenge, weekStart } from '@/campaign/GuardianChallenge';
import { dayKey } from '@/core/Day';
import { ScoreBoard } from '@/services/ScoreBoard';

/** The challenge of the week holding this local date. */
const on = (year: number, month: number, day: number) =>
  new GuardianChallenge(new Date(year, month - 1, day, 15, 30));

describe('GuardianChallenge', () => {
  it('runs from Monday to Monday, local time', () => {
    expect(dayKey(weekStart(new Date(2026, 9, 21, 23, 59)))).toBe('20261019');
    expect(dayKey(weekStart(new Date(2026, 9, 19, 0, 0)))).toBe('20261019');
    expect(dayKey(weekStart(new Date(2026, 9, 25, 22, 0)))).toBe('20261019');
    const challenge = on(2026, 10, 22);
    expect(challenge.key).toBe('20261019');
    expect(challenge.endsAt).toEqual(new Date(2026, 9, 26));
    expect(ScoreBoard.guardianKey(challenge.key)).toBe('guardian:20261019');
  });

  it('brings the four Guardians in turn, a week each, across the clock changes', () => {
    const order = [5, 12, 19, 26].map((day) => on(2026, 1, day).boss);
    expect(order).toEqual(['duneWorm', 'ceramicGolem', 'towerEye', 'riftHeart']);
    expect(on(2026, 2, 2).boss).toBe('duneWorm');
    // Before the first week, the turn goes backwards.
    expect(on(2025, 12, 29).boss).toBe('riftHeart');
    // Twelve weeks on, past the spring's change of hour: the Wyrm again.
    expect(on(2026, 3, 30).boss).toBe('duneWorm');
  });

  it('is fought as in its campaign level: same mode and clock, the same pieces all week', () => {
    const challenge = on(2026, 1, 7);
    expect(challenge.modeId).toBe('sand');
    expect(challenge.timeLimitMs).toBe(4 * 60_000);
    const monday = challenge.sessionOptions();
    const sunday = on(2026, 1, 11).sessionOptions();
    expect(monday.boss).toBe('duneWorm');
    expect(monday.timeLimitMs).toBe(4 * 60_000);
    expect(monday.random.next()).toBe(sunday.random.next());
    expect(on(2026, 1, 12).sessionOptions().random.next()).not.toBe(
      on(2026, 1, 7).sessionOptions().random.next(),
    );
    expect(on(2026, 1, 19).modeId).toBe('tower');
  });

  it('multiplies a victory by one plus the share of the clock left', () => {
    const challenge = on(2026, 1, 7);
    const minute = 60_000;
    expect(challenge.factor(false, 2 * minute)).toBe(1);
    expect(challenge.factor(true, 0)).toBe(1);
    expect(challenge.factor(true, 0.4 * 4 * minute)).toBe(1.4);
    expect(challenge.factor(true, 10 * minute)).toBe(2);
    expect(challenge.score(1234, true, 0.4 * 4 * minute)).toBe(1728);
    expect(challenge.score(1234, false, 3 * minute)).toBe(1234);
  });
});
