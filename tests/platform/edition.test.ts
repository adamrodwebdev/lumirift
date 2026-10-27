import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/campaign/Levels';
import {
  allowsLevel,
  allowsMode,
  DEMO_EDITION,
  FULL_EDITION,
  nextPlay,
  soloEdition,
} from '@/platform/Edition';
import { DemoPlatform, WebPlatform } from '@/platform/Platform';
import { MODE_IDS } from '@/session/ModeId';

describe('Editions', () => {
  it('open the whole game in the full edition, but the modes on test (Dunes, 1.37)', () => {
    expect(MODE_IDS.filter((id) => !allowsMode(FULL_EDITION, id))).toEqual(['dunes']);
    expect(LEVELS.every((level) => allowsLevel(FULL_EDITION, level))).toBe(true);
  });

  it('open one mode alone in a test build, where Play starts it (1.37)', () => {
    for (const solo of ['dunes', 'sand'] as const) {
      const edition = soloEdition(solo);
      expect(MODE_IDS.filter((id) => allowsMode(edition, id))).toEqual([solo]);
      expect(LEVELS.some((level) => allowsLevel(edition, level))).toBe(false);
      expect(nextPlay(edition, LEVELS[0]!)).toEqual({ kind: 'mode', modeId: solo });
    }
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
    // Our site and the demo keep their title screen: the training is the portals'.
    expect(new WebPlatform().firstRun).toBe('title');
    expect(demo.firstRun).toBe('title');
  });
});
