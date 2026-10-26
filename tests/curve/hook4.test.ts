import { describe, expect, it } from 'vitest';
import { GATE_TIMEOUT_MS, hookProblems } from './hookGate';

describe('The training’s opening, games 751 to 1000 of 1,000 (1.33)', () => {
  it(
    'shocks the bed with the first bolt and brings the Wyrm out before 50 s, whatever the first move',
    () => {
      expect(hookProblems(751, 1000)).toEqual([]);
    },
    GATE_TIMEOUT_MS,
  );
});
