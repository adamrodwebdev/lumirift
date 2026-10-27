import { findCosmeticByKey, type Cosmetic } from './Cosmetics';

/** The gift calendar (1.35): one gift a day of play, in a cycle of this many days. */
export const GIFT_DAYS = 7;

/** Experience on days 1 to 6; day 7 brings a look. */
export const GIFT_XP: readonly number[] = [50, 60, 70, 80, 90, 100];

/** Day 7 for a player who already has every look it could give: experience instead. */
export const LOOK_FALLBACK_XP = 250;

/**
 * The looks day 7 gives, in turn, skipping those the player has: the ones
 * earned in play by level or objectives, never a Guardian's trophy, the
 * streak's gold or a collection's ambiance. The first weeks give looks from
 * far ahead in the levels (a real treat, not the next level's), the kinds in
 * turn; the objectives' prizes come last. Each one still comes in play too.
 */
export const GIFT_LOOKS: readonly string[] = [
  'material.obsidian',
  'ambiance.cosmos',
  'shatter.petals',
  'material.pixel',
  'ambiance.forge',
  'shatter.confetti',
  'material.paper',
  'ambiance.abyss',
  'material.neon',
  'ambiance.aurora',
  'ambiance.sakura',
  'shatter.gold',
];

/** Back after this many days away: a gift of welcome with the day's, and the ads' grace again. */
export const WELCOME_BACK_DAYS = 7;
export const WELCOME_BACK_XP = 150;

/** What a day of the calendar gives. */
export type Gift =
  | { readonly kind: 'xp'; readonly amount: number }
  | { readonly kind: 'look'; readonly cosmetic: Cosmetic };

/**
 * The gift of a day of the cycle (0 to 6): its experience, or on the last
 * day the next look the player does not have yet: first the looks of the
 * seasons over (`seasonLooks`, 1.36), then the game's.
 */
export function giftOf(
  day: number,
  owns: (cosmetic: Cosmetic) => boolean,
  seasonLooks: readonly string[] = [],
): Gift {
  const amount = GIFT_XP[day];
  if (amount !== undefined) return { kind: 'xp', amount };
  const look = [...seasonLooks, ...GIFT_LOOKS]
    .map(findCosmeticByKey)
    .find((cosmetic): cosmetic is Cosmetic => cosmetic !== undefined && !owns(cosmetic));
  return look ? { kind: 'look', cosmetic: look } : { kind: 'xp', amount: LOOK_FALLBACK_XP };
}
