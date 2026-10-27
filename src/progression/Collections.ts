import type { AmbianceId } from './Cosmetics';

/** The collections of looks (1.35). */
export const COLLECTION_IDS = ['arcade', 'garden', 'treasure', 'trophies'] as const;
export type CollectionId = (typeof COLLECTION_IDS)[number];

/** A themed set of looks earned in play (`kind.id`), and the ambiance it unlocks once complete. */
export interface Collection {
  readonly id: CollectionId;
  readonly items: readonly string[];
  readonly reward: AmbianceId;
}

/**
 * The collections (1.35): sets of the looks the game already has, every one
 * earned in play, each completed into an ambiance of its own. The Guardians'
 * trophies are the long one: all four Guardians beaten.
 */
export const COLLECTIONS: readonly Collection[] = [
  {
    id: 'arcade',
    items: ['material.neon', 'material.pixel', 'shatter.confetti', 'ambiance.cosmos'],
    reward: 'synthwave',
  },
  {
    id: 'garden',
    items: ['material.paper', 'shatter.petals', 'ambiance.aurora', 'ambiance.sakura'],
    reward: 'lantern',
  },
  {
    id: 'treasure',
    items: ['material.obsidian', 'material.gold', 'shatter.gold', 'ambiance.forge'],
    reward: 'gilded',
  },
  {
    id: 'trophies',
    items: ['material.dunes', 'material.kintsugi', 'shatter.iris', 'ambiance.rift'],
    reward: 'sanctum',
  },
];

export function collectionById(id: CollectionId): Collection {
  const collection = COLLECTIONS.find((each) => each.id === id);
  if (!collection) throw new Error(`Unknown collection "${id}"`);
  return collection;
}
