import type { AiLevel } from '@/families/falling/ai/AiPlayer';
import type { BossId } from '@/session/GameSession';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import type { ModeId } from '@/session/ModeId';
import type { Goal } from './Goals';

/**
 * How a won level earns its stars (one for winning, up to three):
 * - `timeLeft`: time left on the clock when the goal is met (40 % → 3, 15 % → 2);
 * - `lines`: lines cleared in the game;
 * - `fast`: how quickly it is won.
 */
export type StarRule =
  | { readonly kind: 'timeLeft' }
  | { readonly kind: 'lines'; readonly two: number; readonly three: number }
  | { readonly kind: 'fast'; readonly twoMs: number; readonly threeMs: number };

export interface CampaignLevel {
  /** `chapter-number`, such as `2-4`. */
  readonly id: string;
  readonly chapter: number;
  readonly modeId: ModeId;
  /** The AI of a duel. */
  readonly variant?: AiLevel;
  /** The gentle version of its mode, to teach it (no wind, water or fire in Sand). */
  readonly calm?: boolean;
  /** Opens on the mode's best moments, scripted: the campaign's crushing entrance. */
  readonly showcase?: boolean;
  /** Practises what the show showed: in Sand, its elements by chance, without wind. */
  readonly practice?: boolean;
  /** A Guardian of the rift to defeat: the level is a boss fight. */
  readonly boss?: BossId;
  /** A Guardian of a later chapter shows itself once this level is won (a teaser). */
  readonly teaser?: BossId;
  readonly timeLimitMs: number | null;
  readonly goal: Goal;
  readonly stars: StarRule;
}

export const CHAPTERS = [1, 2, 3, 4, 5] as const;
export type Chapter = (typeof CHAPTERS)[number];

const MIN = 60_000;
const TIME_LEFT: StarRule = { kind: 'timeLeft' };

const timed = (
  id: string,
  modeId: ModeId,
  minutes: number,
  goal: Goal,
  stars: StarRule = TIME_LEFT,
): CampaignLevel => ({
  id,
  chapter: Number(id.split('-')[0]),
  modeId,
  timeLimitMs: minutes * MIN,
  goal,
  stars,
});

const duel = (id: string, variant: AiLevel): CampaignLevel => ({
  id,
  chapter: Number(id.split('-')[0]),
  modeId: 'duel',
  variant,
  timeLimitMs: null,
  goal: { kind: 'win', target: 1 },
  stars: { kind: 'fast', twoMs: 2.5 * MIN, threeMs: 1.5 * MIN },
});

/**
 * The campaign: five chapters of six levels, every mode of the game, each
 * chapter ending with a duel against a stronger AI; from chapter 2, a Guardian
 * of the rift (a boss) guards the way out after the duel. Played in order.
 */
export const LEVELS: readonly CampaignLevel[] = [
  // 1. Premiers blocs
  // Sand first, as a show: one idea to learn (link the walls), and within a
  // minute the elements no other game has (lightning through water, a blaze,
  // a vine); no wind and no random element yet: the elements come by chance
  // in 1-2, the wind in chapter 2.
  // Won, it ends on a promise: the Dune Wyrm's shadow passes under the sand.
  {
    ...timed('1-1', 'sand', 3, { kind: 'lines', target: 2 }),
    calm: true,
    showcase: true,
    teaser: 'duneWorm',
  },
  // Then the player tries those elements alone: what no other game has stays
  // first, for three to four minutes, before the falling basics.
  { ...timed('1-2', 'sand', 3, { kind: 'lines', target: 3 }), practice: true },
  timed('1-3', 'classic', 2.5, { kind: 'lines', target: 10 }),
  timed('1-4', 'mirror', 3, { kind: 'lines', target: 12 }),
  timed('1-5', 'classic', 3, { kind: 'bigClear', target: 4 }),
  duel('1-6', 'rookie'),
  // 2. Courants
  timed(
    '2-1',
    'tide',
    1.5,
    { kind: 'survive', target: 1.5 * MIN },
    {
      kind: 'lines',
      two: 6,
      three: 12,
    },
  ),
  timed('2-2', 'flip', 3, { kind: 'lines', target: 15 }),
  timed('2-3', 'fusion', 3, { kind: 'lines', target: 10 }),
  timed('2-4', 'sand', 3, { kind: 'lines', target: 3 }),
  timed('2-5', 'sand', 3, { kind: 'lines', target: 5 }),
  duel('2-6', 'easy'),
  // The first Guardian: the Dune Wyrm, fought with the elements met in this chapter.
  {
    ...timed('2-7', 'sand', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'duneWorm',
  },
  // 3. Mosaïques
  timed('3-1', 'mosaic', 2.5, { kind: 'lines', target: 8 }),
  timed('3-2', 'mosaic', 3, { kind: 'score', target: 400 }),
  timed('3-3', 'mosaic', 3, { kind: 'bigClear', target: 3 }),
  {
    id: '3-4',
    chapter: 3,
    modeId: 'silhouette',
    timeLimitMs: null,
    goal: { kind: 'shape', target: 1 },
    stars: { kind: 'fast', twoMs: 2 * MIN, threeMs: 1.2 * MIN },
  },
  timed('3-5', 'chroma', 4, { kind: 'lines', target: 20 }),
  duel('3-6', 'normal'),
  // The second Guardian: the Ceramic Golem, whose armour is the Mosaic's board.
  {
    ...timed('3-7', 'mosaic', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'ceramicGolem',
  },
  // 4. Vertiges
  timed('4-1', 'tilt', 3, { kind: 'lines', target: 15 }),
  timed('4-2', 'rhythm', 3, { kind: 'lines', target: 12 }),
  timed('4-3', 'tower', 3, { kind: 'lines', target: 5 }),
  timed('4-4', 'tower', 4, { kind: 'lines', target: 10 }),
  timed('4-5', 'sand', 4, { kind: 'lines', target: 7 }),
  duel('4-6', 'hard'),
  // The third Guardian: the Eye of the Tower, blinded by the bombs of its gaze.
  {
    ...timed('4-7', 'tower', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'towerEye',
  },
  // 5. Le Rift
  timed('5-1', 'fusion', 4, { kind: 'lines', target: 22 }),
  timed('5-2', 'mirror', 4, { kind: 'lines', target: 28 }),
  timed('5-3', 'mosaic', 4, { kind: 'lines', target: 20 }),
  timed('5-4', 'tower', 4, { kind: 'lines', target: 14 }),
  timed(
    '5-5',
    'tide',
    3,
    { kind: 'survive', target: 3 * MIN },
    {
      kind: 'lines',
      two: 15,
      three: 25,
    },
  ),
  duel('5-6', 'expert'),
  // The last Guardian: the Heart of the Rift, wounded by its own shards.
  {
    ...timed('5-7', 'classic', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'riftHeart',
  },
];

export const MAX_STARS = LEVELS.length * 3;

/** The level where a Guardian waits. */
export function guardianLevel(boss: BossId): CampaignLevel | undefined {
  return LEVELS.find((level) => level.boss === boss);
}

export function levelById(id: string): CampaignLevel | undefined {
  return LEVELS.find((level) => level.id === id);
}
