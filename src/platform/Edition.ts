import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { isPrototype } from '@/session/ModeCatalog';
import type { ModeId } from '@/session/ModeId';

/**
 * What a build lets the player reach: the whole game, the demo shown on the
 * portfolio, or one mode alone (a sandbox test, 1.37). Free play is limited
 * to some modes; the campaign to its first levels (which may visit other
 * modes: they are part of the taste).
 */
export interface Edition {
  readonly id: 'full' | 'demo' | 'solo';
  /** Modes open in free play, or null for all (but the modes on test). */
  readonly modes: readonly ModeId[] | null;
  /** Campaign levels open, from the first, or null for all. */
  readonly campaignLevels: number | null;
  /** The one mode of a test build: Play starts it, the menus show nothing else; null elsewhere. */
  readonly solo: ModeId | null;
}

export const FULL_EDITION: Edition = { id: 'full', modes: null, campaignLevels: null, solo: null };

/** One mode per family, the duel, and the first chapter of the campaign. */
export const DEMO_EDITION: Edition = {
  id: 'demo',
  modes: ['classic', 'sand', 'mosaic', 'tower', 'duel'],
  campaignLevels: 6,
  solo: null,
};

/**
 * One mode alone, for a sandbox test of two builds (1.37, Dunes against the
 * Sand): no campaign, no other mode, Play starts it.
 */
export const soloEdition = (modeId: ModeId): Edition => ({
  id: 'solo',
  modes: [modeId],
  campaignLevels: 0,
  solo: modeId,
});

/** A test build of one mode has no daily challenge: the two builds of a test stay alike (1.37). */
export const offersDaily = (edition: Edition): boolean => edition.solo === null;

/** A mode on test (Dunes) is open only in a build that names it. */
export function allowsMode(edition: Edition, modeId: ModeId): boolean {
  return edition.modes === null ? !isPrototype(modeId) : edition.modes.includes(modeId);
}

export function allowsLevel(edition: Edition, level: CampaignLevel): boolean {
  return edition.campaignLevels === null || LEVELS.indexOf(level) < edition.campaignLevels;
}

/** Play's next game: a campaign level, or a free game of a mode. */
export type NextPlay =
  | { readonly kind: 'level'; readonly level: CampaignLevel }
  | { readonly kind: 'mode'; readonly modeId: ModeId };

/** Past the levels an edition opens (the demo's), Play starts a game of Sand, the game's hook. */
const FREE_PLAY: ModeId = 'sand';

/** Play goes on with the campaign's next level, if this edition opens it; a test build's mode alone. */
export function nextPlay(edition: Edition, nextLevel: CampaignLevel): NextPlay {
  if (edition.solo) return { kind: 'mode', modeId: edition.solo };
  return allowsLevel(edition, nextLevel)
    ? { kind: 'level', level: nextLevel }
    : { kind: 'mode', modeId: FREE_PLAY };
}
