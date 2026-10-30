import type { AiLevel } from '@/families/falling/ai/AiLevels';
import type { BossId } from '@/session/GameSession';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import type { ModeId } from '@/session/ModeId';
import type { Goal } from './Goals';
import { LEVEL_PACKS } from './packs';

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
  /** The Guardian's health, when not a full one: a rematch comes stronger (1.38). */
  readonly bossHealth?: number;
  /** A Guardian of a later chapter shows itself once this level is won (a teaser). */
  readonly teaser?: BossId;
  readonly timeLimitMs: number | null;
  readonly goal: Goal;
  readonly stars: StarRule;
}

export const CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Chapter = (typeof CHAPTERS)[number];

const MIN = 60_000;
/** The Dune Wyrm's first fight (2-7): a tenth weaker than a full Guardian since the 18-row Sand (1.43). */
const FIRST_WYRM_HEALTH = Math.round(GUARDIAN_HEALTH * 0.9);
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
 * The handmade chapters: five chapters of six levels, every mode of the
 * game, each chapter ending with a duel against a stronger AI; from chapter
 * 2, a Guardian of the rift (a boss) guards the way out after the duel.
 */
const HANDMADE: readonly CampaignLevel[] = [
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
  // Eight lines in the 18-row well (1.43): ten made a newcomer lose one game in three.
  timed('1-3', 'classic', 2.5, { kind: 'lines', target: 8 }),
  timed('1-4', 'mirror', 3, { kind: 'lines', target: 12 }),
  timed('1-5', 'classic', 3, { kind: 'bigClear', target: 2 }),
  duel('1-6', 'rookie'),
  // 2. Courants
  // A minute and three quarters (1.43): the tide, paced to the 18-row well, needs it to press.
  timed(
    '2-1',
    'tide',
    1.75,
    { kind: 'survive', target: 1.75 * MIN },
    {
      kind: 'lines',
      two: 7,
      three: 14,
    },
  ),
  timed('2-2', 'flip', 3, { kind: 'lines', target: 15 }),
  timed('2-3', 'fusion', 3, { kind: 'lines', target: 10 }),
  timed('2-4', 'sand', 3, { kind: 'lines', target: 3 }),
  timed('2-5', 'sand', 3, { kind: 'lines', target: 5 }),
  duel('2-6', 'easy'),
  // The first Guardian: the Dune Wyrm, fought with the elements met in this chapter.
  // A tenth weaker in the 18-row Sand (1.43), where its expert won only four games of six.
  {
    ...timed('2-7', 'sand', 4, { kind: 'boss', target: FIRST_WYRM_HEALTH }),
    boss: 'duneWorm',
    bossHealth: FIRST_WYRM_HEALTH,
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
    // Most of the shape: a perfect fill is a feat for the record (the Silhouette's bonus).
    goal: { kind: 'fill', target: 85 },
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
  timed('4-5', 'sand', 4, { kind: 'lines', target: 6 }),
  duel('4-6', 'normal'),
  // The third Guardian: the Eye of the Tower, blinded by the bombs of its gaze.
  {
    ...timed('4-7', 'tower', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'towerEye',
  },
  // 5. Le Rift
  timed('5-1', 'fusion', 3, { kind: 'lines', target: 15 }),
  timed('5-2', 'mirror', 4, { kind: 'lines', target: 28 }),
  timed('5-3', 'mosaic', 4, { kind: 'lines', target: 20 }),
  timed('5-4', 'tower', 4, { kind: 'lines', target: 14 }),
  timed(
    '5-5',
    'tide',
    2.5,
    { kind: 'survive', target: 2.5 * MIN },
    {
      kind: 'lines',
      two: 15,
      three: 25,
    },
  ),
  duel('5-6', 'hard'),
  // The last Guardian: the Heart of the Rift, wounded by its own shards.
  {
    ...timed('5-7', 'classic', 4, { kind: 'boss', target: GUARDIAN_HEALTH }),
    boss: 'riftHeart',
  },
];

/** A Guardian's rematch comes back with half its health again; the last fight with twice it. */
const REMATCH_HEALTH = Math.round(GUARDIAN_HEALTH * 1.5);
const FINALE_HEALTH = GUARDIAN_HEALTH * 2;

/** A Guardian's fight: its mode, its clock, its health (the level's goal). */
interface GuardianFight {
  readonly modeId: ModeId;
  readonly minutes: number;
  readonly boss: BossId;
  readonly health: number;
}

const rematch = (id: string, fight: GuardianFight): CampaignLevel => ({
  ...timed(id, fight.modeId, fight.minutes, { kind: 'boss', target: fight.health }),
  boss: fight.boss,
  bossHealth: fight.health,
});

/**
 * The Guardians' rematches (1.38), handmade: each generated chapter ends on
 * one, stronger and on a tighter clock than its first fight; the campaign
 * ends on the Heart of the Rift at full strength.
 */
const REMATCHES: readonly CampaignLevel[] = [
  rematch('6-7', { modeId: 'sand', minutes: 3.5, boss: 'duneWorm', health: REMATCH_HEALTH }),
  rematch('7-7', { modeId: 'mosaic', minutes: 3, boss: 'ceramicGolem', health: REMATCH_HEALTH }),
  rematch('8-7', { modeId: 'tower', minutes: 3, boss: 'towerEye', health: REMATCH_HEALTH }),
  rematch('9-7', { modeId: 'classic', minutes: 3.5, boss: 'riftHeart', health: REMATCH_HEALTH }),
  rematch('10-7', { modeId: 'classic', minutes: 4, boss: 'riftHeart', health: FINALE_HEALTH }),
];

/**
 * The campaign, played in order: the handmade chapters, then chapters 6 to
 * 10 (1.38), six levels drawn by the generators and a Guardian's rematch
 * each. Tuned by the curve bot (1.33): each level stays in the band its beat
 * chart sets (`BEAT_CHARTS`, `CurveBands`).
 */
export const LEVELS: readonly CampaignLevel[] = [
  ...HANDMADE,
  ...LEVEL_PACKS.flatMap((pack) => [
    ...pack.levels.map(({ level }) => level),
    ...REMATCHES.filter((level) => level.chapter === pack.chapter),
  ]),
];

export const MAX_STARS = LEVELS.length * 3;

/** The level where a Guardian waits first (its rematches come later). */
export function guardianLevel(boss: BossId): CampaignLevel | undefined {
  return LEVELS.find((level) => level.boss === boss);
}

export function levelById(id: string): CampaignLevel | undefined {
  return LEVELS.find((level) => level.id === id);
}
