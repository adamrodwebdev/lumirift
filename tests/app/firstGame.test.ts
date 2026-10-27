import { describe, expect, it } from 'vitest';
import { firstGameOf } from '@/app/firstGame';
import { TRAINING } from '@/campaign/Training';
import { FULL_EDITION, soloEdition } from '@/platform/Edition';

describe('the first game of a new player', () => {
  it('is the training on a portal, and a test build’s one mode there instead (1.37)', () => {
    const portal = { firstRun: 'training', edition: FULL_EDITION } as const;
    expect(firstGameOf(portal, true)).toEqual({ modeId: 'sand', training: TRAINING[0] });
    for (const solo of ['dunes', 'sand'] as const) {
      const test = { firstRun: 'training', edition: soloEdition(solo) } as const;
      expect(firstGameOf(test, true)).toEqual({ modeId: solo, training: null });
    }
  });

  it('waits for the title screen on our own site, and for a player who has played', () => {
    expect(firstGameOf({ firstRun: 'title', edition: soloEdition('dunes') }, true)).toBeNull();
    expect(firstGameOf({ firstRun: 'training', edition: FULL_EDITION }, false)).toBeNull();
  });
});
