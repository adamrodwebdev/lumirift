import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { AI_LEVELS, AI_PROFILES, AiPlayer, type AiLevel } from '@/families/falling/ai/AiPlayer';
import { AttackEvaluator, Evaluator } from '@/families/falling/ai/Evaluator';
import type { Placement } from '@/families/falling/ai/PlacementSearch';
import { Board } from '@/families/falling/board/Board';
import { createSoloSession } from '@/families/falling';

/** Pieces locked per second by a level playing alone for a minute. */
function speed(level: AiLevel, seconds = 60) {
  const session = createSoloSession('classic', { random: new SeededRandom(3), timeLimitMs: null });
  const execute = vi.spyOn(session, 'execute');
  const ai = new AiPlayer(session, AI_PROFILES[level], new SeededRandom(1));
  ai.attach();
  let locks = 0;
  let tetrises = 0;
  session.onGame('lock', () => locks++);
  session.onGame('clear', ({ lines }) => (tetrises += lines === 4 ? 1 : 0));
  session.start();
  for (let t = 0; t < seconds * 1000 && session.state === 'running'; t += 16) {
    session.update(16);
    ai.update(16);
  }
  const holds = execute.mock.calls.filter(([command]) => command.type === 'hold').length;
  return { pps: locks / seconds, holds, tetrises, state: session.state };
}

const placement = (lines: number, maxHeight: number): Placement => ({
  rotation: 0,
  x: 0,
  lines,
  features: {
    aggregateHeight: 20,
    maxHeight,
    holes: 0,
    bumpiness: 4,
    heights: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  },
  after: new Board(),
});

describe('AI levels', () => {
  it('play faster level after level, at the speeds of real players', () => {
    const pps = AI_LEVELS.map((level) => speed(level, 30).pps);
    for (let k = 1; k < pps.length; k++) expect(pps[k]!).toBeGreaterThan(pps[k - 1]!);
    expect(pps[0]!).toBeGreaterThan(0.35);
    expect(pps[0]!).toBeLessThan(0.7);
    expect(pps.at(-1)!).toBeGreaterThan(1.8);
  });

  it('use the reserve from the normal level up, never below', () => {
    expect(speed('easy', 30).holds).toBe(0);
    expect(speed('expert', 30).holds).toBeGreaterThan(0);
  });

  it('keep the hard level alive for two minutes, building four-line clears', () => {
    const hard = speed('hard', 120);
    expect(hard.state).toBe('running');
    expect(hard.tetrises).toBeGreaterThanOrEqual(3);
    expect(speed('easy', 60).tetrises).toBe(0);
  });

  it('save lines for a four-line clear when attacking', () => {
    const attack = new AttackEvaluator();
    const safe = new Evaluator();
    expect(attack.score(placement(4, 4))).toBeGreaterThan(attack.score(placement(1, 4)));
    expect(attack.score(placement(0, 4))).toBeGreaterThan(attack.score(placement(1, 4)));
    expect(safe.score(placement(1, 4))).toBeGreaterThan(safe.score(placement(0, 4)));
  });
});
