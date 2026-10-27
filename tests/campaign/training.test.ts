import { describe, expect, it } from 'vitest';
import { nextTrainingStep, TRAINING } from '@/campaign/Training';

describe('The portals’ training (1.29, one game since 1.33)', () => {
  it('teaches the Sand’s elements and the Dune Wyrm in one game: no window in between', () => {
    expect(TRAINING.map((step) => [step.id, step.modeId, step.stage])).toEqual([
      ['firstEncounter', 'sand', 'hook'],
    ]);
    // One hit drives the Wyrm away, which then leaves the well.
    expect(TRAINING[0]!.goal).toEqual({ kind: 'boss', target: 1 });
    expect(TRAINING[0]!.boss).toBe('duneWorm');
    expect(TRAINING[0]!.teaser).toBe('duneWorm');
  });

  it('ends after its step, even handed back as a copy (the screen’s reactive state wraps it)', () => {
    expect(nextTrainingStep(TRAINING[0]!)).toBeNull();
    expect(nextTrainingStep({ ...TRAINING[0]! })).toBeNull();
  });
});
