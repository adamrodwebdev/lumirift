import type { ModeId } from '@/session/ModeId';
import type { CampaignProgress } from './CampaignProgress';
import { levelById, type CampaignLevel } from './Levels';

/**
 * The modes the campaign opens (1.34): reaching a level opens each. The
 * Rift Race opens once the player has played its three worlds: at 4-4, the
 * Tower's first level (4-3) won.
 */
const OPENS_AT: Readonly<Partial<Record<ModeId, string>>> = { race: '4-4' };

/** The level whose reach opens a mode, or null for a mode open from the start. */
export function levelOpening(modeId: ModeId): CampaignLevel | null {
  const id = OPENS_AT[modeId];
  return id === undefined ? null : (levelById(id) ?? null);
}

/** A mode is open from the start, or once the campaign has reached the level that opens it. */
export function modeOpen(modeId: ModeId, campaign: Pick<CampaignProgress, 'isUnlocked'>): boolean {
  const opening = levelOpening(modeId);
  return opening === null || campaign.isUnlocked(opening);
}
