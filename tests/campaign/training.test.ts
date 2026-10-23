import { describe, expect, it } from 'vitest';
import { nextTrainingStep, TRAINING, trainingRank } from '@/campaign/Training';

describe('The portals’ training (1.29)', () => {
  it('teaches the Sand’s elements, then the Dune Wyrm, in two steps', () => {
    expect(TRAINING.map((step) => [step.id, step.modeId, step.stage])).toEqual([
      ['livingSand', 'sand', 'elements'],
      ['firstEncounter', 'sand', 'wyrm'],
    ]);
    // Two zones linked; one hit drives the Wyrm away, which then leaves the well.
    expect(TRAINING[0]!.goal).toEqual({ kind: 'lines', target: 2 });
    expect(TRAINING[1]!.goal).toEqual({ kind: 'boss', target: 1 });
    expect(TRAINING[1]!.teaser).toBe('duneWorm');
  });

  it('goes from one step to the next, then ends', () => {
    expect(nextTrainingStep(TRAINING[0]!)).toBe(TRAINING[1]);
    expect(nextTrainingStep(TRAINING[1]!)).toBeNull();
    expect(TRAINING.map(trainingRank)).toEqual([1, 2]);
  });

  it('knows a step handed back as a copy (the screen’s reactive state wraps it)', () => {
    const last = { ...TRAINING[1]! };
    expect(trainingRank(last)).toBe(2);
    expect(nextTrainingStep(last)).toBeNull();
    expect(nextTrainingStep({ ...TRAINING[0]! })).toBe(TRAINING[1]);
  });
});
