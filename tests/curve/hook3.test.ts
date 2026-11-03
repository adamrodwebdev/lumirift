import { describe, expect, it } from 'vitest';
import { GATE_TIMEOUT_MS, hookProblems } from './hookGate';

describe('The training’s opening, games 501 to 750 of 1,000 (1.33, 1.46)', () => {
  it(
    'shocks the bed within 2 s, then shows the blaze, and the Wyrm by 16 s, whatever the first move',
    () => {
      expect(hookProblems(501, 750)).toEqual([]);
    },
    GATE_TIMEOUT_MS,
  );
});
