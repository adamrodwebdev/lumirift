import type { SeasonTrackData } from './SeasonData';

/** What a tier of a season's track gives: experience, or a look (`kind.id`). */
export type SeasonReward =
  | { readonly kind: 'xp'; readonly amount: number }
  | { readonly kind: 'look'; readonly key: string };

/** A tier of a track: its number (from 1), the season points it takes, its reward. */
export interface SeasonTier {
  readonly tier: number;
  readonly points: number;
  readonly reward: SeasonReward;
}

/**
 * A season's track (1.36), from its data: a tier every `pointsPerTier`
 * points; each gives experience, climbing evenly from the first tier's to
 * the last's (rounded to tens), or the look its data names.
 */
export function tiersOf(track: SeasonTrackData): readonly SeasonTier[] {
  const [first, last] = track.xp;
  const step = track.tiers > 1 ? (last - first) / (track.tiers - 1) : 0;
  return Array.from({ length: track.tiers }, (_, index) => {
    const tier = index + 1;
    const look = track.looks[tier];
    return {
      tier,
      points: tier * track.pointsPerTier,
      reward: look
        ? { kind: 'look', key: look }
        : { kind: 'xp', amount: Math.round((first + step * index) / 10) * 10 },
    };
  });
}

/** The tier reached with so many points (0: none yet), at most the last. */
export function tierReached(track: SeasonTrackData, points: number): number {
  return Math.min(track.tiers, Math.floor(Math.max(0, points) / track.pointsPerTier));
}

/** How far into the next tier: its points so far and the points it takes (both 0 at the end). */
export function tierProgress(
  track: SeasonTrackData,
  points: number,
): { readonly into: number; readonly needed: number } {
  if (tierReached(track, points) >= track.tiers) return { into: 0, needed: 0 };
  return { into: Math.max(0, points) % track.pointsPerTier, needed: track.pointsPerTier };
}
