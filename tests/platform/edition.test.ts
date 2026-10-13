import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/campaign/Levels';
import { allowsLevel, allowsMode, DEMO_EDITION, FULL_EDITION } from '@/platform/Edition';
import { DemoPlatform, WebPlatform } from '@/platform/Platform';
import { MODE_IDS } from '@/session/ModeId';

describe('Editions', () => {
  it('open the whole game in the full edition', () => {
    expect(MODE_IDS.every((id) => allowsMode(FULL_EDITION, id))).toBe(true);
    expect(LEVELS.every((level) => allowsLevel(FULL_EDITION, level))).toBe(true);
  });

  it('open one mode per family and the duel, and the first chapter, in the demo', () => {
    const open = MODE_IDS.filter((id) => allowsMode(DEMO_EDITION, id));
    expect(open).toEqual(['classic', 'duel', 'sand', 'mosaic', 'tower']);
    const levels = LEVELS.filter((level) => allowsLevel(DEMO_EDITION, level));
    expect(levels.map((level) => level.chapter)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('come with the platform of the build', () => {
    expect(new WebPlatform().edition).toBe(FULL_EDITION);
    const demo = new DemoPlatform();
    expect(demo.id).toBe('demo');
    expect(demo.edition).toBe(DEMO_EDITION);
    expect(demo.allowsExternalLinks).toBe(true);
  });
});
