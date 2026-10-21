import type { BossId } from '@/session/GameSession';

/** Everything a player can wear is cosmetic: none of it changes the game. */
export const COSMETIC_KINDS = ['material', 'ambiance', 'shatter'] as const;
export type CosmeticKind = (typeof COSMETIC_KINDS)[number];

/** Block skins of the falling family (the other families keep their own material). */
export const MATERIALS = [
  'crystal',
  'neon',
  'paper',
  'pixel',
  'obsidian',
  'gold',
  'dunes',
] as const;
export type MaterialId = (typeof MATERIALS)[number];

/** Backdrops of the whole game: animated glows and a tinted well. */
export const AMBIANCES = ['night', 'aurora', 'abyss', 'forge', 'cosmos', 'sakura'] as const;
export type AmbianceId = (typeof AMBIANCES)[number];

/** How a cleared line bursts, in the falling family and the Tower. */
export const SHATTERS = ['shards', 'confetti', 'petals', 'gold'] as const;
export type ShatterId = (typeof SHATTERS)[number];

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
}

/** How a cosmetic is earned; `value` is the level, days or objectives needed. */
export type Unlock =
  | { readonly by: 'default' }
  | { readonly by: 'level'; readonly value: number }
  | { readonly by: 'streak'; readonly value: number }
  | { readonly by: 'objectives'; readonly value: number }
  | { readonly by: 'boss'; readonly value: BossId };

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
  item('ambiance', 'night', { by: 'default' }),
  item('ambiance', 'aurora', { by: 'level', value: 2 }),
  item('ambiance', 'abyss', { by: 'level', value: 5 }),
  item('ambiance', 'forge', { by: 'level', value: 8 }),
  item('ambiance', 'cosmos', { by: 'level', value: 12 }),
  item('ambiance', 'sakura', { by: 'objectives', value: 20 }),
  item('shatter', 'shards', { by: 'default' }),
  item('shatter', 'confetti', { by: 'level', value: 4 }),
  item('shatter', 'petals', { by: 'level', value: 9 }),
  item('shatter', 'gold', { by: 'objectives', value: 30 }),
];

export function isUnlocked({ unlock }: Cosmetic, achievements: Achievements): boolean {
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
  }
}

export const cosmeticKey = ({ kind, id }: Cosmetic): string => `${kind}.${id}`;

export function findCosmetic(kind: CosmeticKind, id: string): Cosmetic | undefined {
  return COSMETICS.find((cosmetic) => cosmetic.kind === kind && cosmetic.id === id);
}
