import {
  SEASON_AMBIANCES,
  SEASON_MATERIALS,
  SEASON_SHATTERS,
  SEASONS,
  type SeasonAmbianceId,
  type SeasonId,
  type SeasonMaterialId,
  type SeasonShatterId,
} from '@/seasons/SeasonData';
import type { BossId } from '@/session/GameSession';
import { collectionById, type CollectionId } from './Collections';

/** Everything a player can wear is cosmetic: none of it changes the game. */
export const COSMETIC_KINDS = ['material', 'ambiance', 'shatter'] as const;
export type CosmeticKind = (typeof COSMETIC_KINDS)[number];

/** Block skins of the falling family (the other families keep their own material). */
const BUILTIN_MATERIALS = [
  'crystal',
  'neon',
  'paper',
  'pixel',
  'obsidian',
  'gold',
  'dunes',
  'kintsugi',
] as const;
export type MaterialId = (typeof BUILTIN_MATERIALS)[number] | SeasonMaterialId;
/** The game's materials, then the seasons' (1.36, from their data). */
export const MATERIALS: readonly MaterialId[] = [
  ...BUILTIN_MATERIALS,
  ...SEASON_MATERIALS.map((look) => look.id),
];

/** Backdrops of the whole game: animated glows and a tinted well; four crown a collection. */
const BUILTIN_AMBIANCES = [
  'night',
  'aurora',
  'abyss',
  'forge',
  'cosmos',
  'sakura',
  'rift',
  'synthwave',
  'lantern',
  'gilded',
  'sanctum',
] as const;
export type AmbianceId = (typeof BUILTIN_AMBIANCES)[number] | SeasonAmbianceId;
export const AMBIANCES: readonly AmbianceId[] = [
  ...BUILTIN_AMBIANCES,
  ...SEASON_AMBIANCES.map((look) => look.id),
];

/** How a cleared line bursts, in the falling family and the Tower. */
const BUILTIN_SHATTERS = ['shards', 'confetti', 'petals', 'gold', 'iris'] as const;
export type ShatterId = (typeof BUILTIN_SHATTERS)[number] | SeasonShatterId;
export const SHATTERS: readonly ShatterId[] = [
  ...BUILTIN_SHATTERS,
  ...SEASON_SHATTERS.map((look) => look.id),
];

export type Equipment = {
  readonly material: MaterialId;
  readonly ambiance: AmbianceId;
  readonly shatter: ShatterId;
};

export const DEFAULT_EQUIPMENT: Equipment = {
  material: 'crystal',
  ambiance: 'night',
  shatter: 'shards',
};

/** What the unlock rules look at. */
export interface Achievements {
  readonly level: number;
  readonly bestStreak: number;
  readonly objectivesDone: number;
  /** The Guardians of the rift defeated. */
  readonly bosses: readonly BossId[];
  /** The looks given outright (`kind.id`): the gift calendar's (1.35), a season's (1.36). */
  readonly gifted: readonly string[];
}

/** How a cosmetic is earned; `value` is the level, days or objectives needed. */
export type Unlock =
  | { readonly by: 'default' }
  | { readonly by: 'level'; readonly value: number }
  | { readonly by: 'streak'; readonly value: number }
  | { readonly by: 'objectives'; readonly value: number }
  | { readonly by: 'boss'; readonly value: BossId }
  /** Every look of a collection earned (1.35). */
  | { readonly by: 'collection'; readonly value: CollectionId }
  /** A season's track gives it, or the day-7 gift once the season is over (1.36): only ever given. */
  | { readonly by: 'season'; readonly value: SeasonId };

export interface Cosmetic {
  readonly kind: CosmeticKind;
  readonly id: string;
  readonly unlock: Unlock;
}

const item = (kind: CosmeticKind, id: string, unlock: Unlock): Cosmetic => ({ kind, id, unlock });

/** The collection, in the order it is shown. */
export const COSMETICS: readonly Cosmetic[] = [
  item('material', 'crystal', { by: 'default' }),
  item('material', 'neon', { by: 'level', value: 3 }),
  item('material', 'paper', { by: 'level', value: 6 }),
  item('material', 'pixel', { by: 'level', value: 10 }),
  item('material', 'obsidian', { by: 'level', value: 15 }),
  item('material', 'gold', { by: 'streak', value: 7 }),
  item('material', 'dunes', { by: 'boss', value: 'duneWorm' }),
  item('material', 'kintsugi', { by: 'boss', value: 'ceramicGolem' }),
  item('ambiance', 'night', { by: 'default' }),
  item('ambiance', 'aurora', { by: 'level', value: 2 }),
  item('ambiance', 'abyss', { by: 'level', value: 5 }),
  item('ambiance', 'forge', { by: 'level', value: 8 }),
  item('ambiance', 'cosmos', { by: 'level', value: 12 }),
  item('ambiance', 'sakura', { by: 'objectives', value: 20 }),
  item('ambiance', 'rift', { by: 'boss', value: 'riftHeart' }),
  item('ambiance', 'synthwave', { by: 'collection', value: 'arcade' }),
  item('ambiance', 'lantern', { by: 'collection', value: 'garden' }),
  item('ambiance', 'gilded', { by: 'collection', value: 'treasure' }),
  item('ambiance', 'sanctum', { by: 'collection', value: 'trophies' }),
  item('shatter', 'shards', { by: 'default' }),
  item('shatter', 'confetti', { by: 'level', value: 4 }),
  item('shatter', 'petals', { by: 'level', value: 9 }),
  item('shatter', 'gold', { by: 'objectives', value: 30 }),
  item('shatter', 'iris', { by: 'boss', value: 'towerEye' }),
  ...seasonCosmetics(),
];

/**
 * The looks the seasons bring (1.36), from their data: the track's are only
 * ever given; the crown comes with its season's set, complete.
 */
function seasonCosmetics(): Cosmetic[] {
  return SEASONS.flatMap((season) =>
    season.looks.map((look) => {
      const key = `${look.kind}.${look.id}`;
      return item(
        look.kind,
        look.id,
        key === season.crown
          ? { by: 'collection', value: season.id }
          : { by: 'season', value: season.id },
      );
    }),
  );
}

export function isUnlocked(cosmetic: Cosmetic, achievements: Achievements): boolean {
  if (achievements.gifted.includes(cosmeticKey(cosmetic))) return true;
  const { unlock } = cosmetic;
  switch (unlock.by) {
    case 'default':
      return true;
    case 'level':
      return achievements.level >= unlock.value;
    case 'streak':
      return achievements.bestStreak >= unlock.value;
    case 'objectives':
      return achievements.objectivesDone >= unlock.value;
    case 'boss':
      return achievements.bosses.includes(unlock.value);
    case 'collection':
      return collectionById(unlock.value).items.every((key) => {
        const item = findCosmeticByKey(key);
        return item !== undefined && isUnlocked(item, achievements);
      });
    case 'season':
      return false;
  }
}

export const cosmeticKey = ({ kind, id }: Cosmetic): string => `${kind}.${id}`;

export function findCosmetic(kind: CosmeticKind, id: string): Cosmetic | undefined {
  return COSMETICS.find((cosmetic) => cosmetic.kind === kind && cosmetic.id === id);
}

/** The look of a key (`kind.id`), if there is one. */
export function findCosmeticByKey(key: string): Cosmetic | undefined {
  return COSMETICS.find((cosmetic) => cosmeticKey(cosmetic) === key);
}
