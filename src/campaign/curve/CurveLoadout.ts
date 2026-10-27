import { RANK_COSTS, MAX_RANK, type UpgradeId, type UpgradeRanks } from '../Upgrades';

/**
 * Stars a regular player has to spend at the start of each chapter: about
 * two for each level of the chapters before (six levels in the first,
 * seven in the others).
 */
export const STARS_BY_CHAPTER: readonly number[] = [0, 12, 26, 40, 54];

/**
 * The order a player buys in, a rank at a time: what saves a game first
 * (the second chance, a slower fall, more time), then what helps a mode.
 */
export const PURCHASES: readonly UpgradeId[] = [
  'phoenix',
  'feather',
  'hourglass',
  'anchor',
  'rampart',
  'spyglass',
  'satchel',
  'ember',
  'metronome',
  'prism',
  'phoenix',
  'feather',
  'hourglass',
  'anchor',
  'rampart',
  'spyglass',
  'rampart',
  'phoenix',
  'feather',
  'hourglass',
];

/**
 * The upgrades a regular player owns at the start of a chapter (1.33): the
 * stars earned so far, spent in the order above until one is too dear. The
 * curve bot plays each level with them, as the campaign is meant to be played.
 */
export function loadoutFor(chapter: number): UpgradeRanks {
  let stars = STARS_BY_CHAPTER[chapter - 1] ?? STARS_BY_CHAPTER.at(-1)!;
  const ranks: Partial<Record<UpgradeId, number>> = {};
  for (const id of PURCHASES) {
    const rank = ranks[id] ?? 0;
    if (rank >= MAX_RANK) continue;
    const cost = RANK_COSTS[rank]!;
    if (cost > stars) break;
    stars -= cost;
    ranks[id] = rank + 1;
  }
  return ranks;
}
