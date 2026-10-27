import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/campaign/Levels';
import { bandProblems, CURVE_TIMEOUT_MS } from './campaignCurve';

describe('The curve of chapter 5 (1.33)', () => {
  it.each(LEVELS.filter((level) => level.chapter === 5))(
    'keeps $id in its band',
    (level) => {
      expect(bandProblems(level)).toEqual([]);
    },
    CURVE_TIMEOUT_MS,
  );
});
