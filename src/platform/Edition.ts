import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import type { ModeId } from '@/session/ModeId';

/**
 * What a build lets the player reach: the whole game, or the demo shown on
 * the portfolio. Free play is limited to some modes; the campaign to its
 * first levels (which may visit other modes: they are part of the taste).
 */
export interface Edition {
  readonly id: 'full' | 'demo';
  /** Modes open in free play, or null for all. */
  readonly modes: readonly ModeId[] | null;
  /** Campaign levels open, from the first, or null for all. */
  readonly campaignLevels: number | null;
}

export const FULL_EDITION: Edition = { id: 'full', modes: null, campaignLevels: null };

/** One mode per family, the duel, and the first chapter of the campaign. */
export const DEMO_EDITION: Edition = {
  id: 'demo',
  modes: ['classic', 'sand', 'mosaic', 'tower', 'duel'],
  campaignLevels: 6,
};

export function allowsMode(edition: Edition, modeId: ModeId): boolean {
  return edition.modes === null || edition.modes.includes(modeId);
}

export function allowsLevel(edition: Edition, level: CampaignLevel): boolean {
  return edition.campaignLevels === null || LEVELS.indexOf(level) < edition.campaignLevels;
}
