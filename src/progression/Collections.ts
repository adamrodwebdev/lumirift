import { SEASONS, type SeasonId } from '@/seasons/SeasonData';

/** The collections of looks (1.35), and the seasons' sets (1.36). */
export const COLLECTION_IDS = ['arcade', 'garden', 'treasure', 'trophies'] as const;
export type CollectionId = (typeof COLLECTION_IDS)[number] | SeasonId;

/** A themed set of looks (`kind.id`), and the look it brings once complete. */
export interface Collection {
  readonly id: CollectionId;
  readonly items: readonly string[];
  /** The look it brings (`kind.id`): an ambiance, a season's crown. */
  readonly reward: string;
  /** A season's set: shown from the season's start (1.36). */
  readonly season?: SeasonId;
}

/**
 * The collections (1.35): sets of the looks the game already has, every one
 * earned in play, each completed into an ambiance of its own. The Guardians'
 * trophies are the long one: all four Guardians beaten. Then each season's
 * set (1.36): the looks of its track, gathered on the track or from the
 * day-7 gift once the season is over, completed into the season's crown.
 */
export const COLLECTIONS: readonly Collection[] = [
  {
    id: 'arcade',
    items: ['material.neon', 'material.pixel', 'shatter.confetti', 'ambiance.cosmos'],
    reward: 'ambiance.synthwave',
  },
  {
    id: 'garden',
    items: ['material.paper', 'shatter.petals', 'ambiance.aurora', 'ambiance.sakura'],
    reward: 'ambiance.lantern',
  },
  {
    id: 'treasure',
    items: ['material.obsidian', 'material.gold', 'shatter.gold', 'ambiance.forge'],
    reward: 'ambiance.gilded',
  },
  {
    id: 'trophies',
    items: ['material.dunes', 'material.kintsugi', 'shatter.iris', 'ambiance.rift'],
    reward: 'ambiance.sanctum',
  },
  ...SEASONS.flatMap((season): Collection[] =>
    season.crown === null
      ? []
      : [
          {
            id: season.id,
            items: Object.values(season.track.looks),
            reward: season.crown,
            season: season.id,
          },
        ],
  ),
];

export function collectionById(id: CollectionId): Collection {
  const collection = COLLECTIONS.find((each) => each.id === id);
  if (!collection) throw new Error(`Unknown collection "${id}"`);
  return collection;
}
