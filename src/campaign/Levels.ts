import type { AiLevel } from '@/families/falling/ai/AiPlayer';
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
 * chapter ending with a duel against a stronger AI. Played in order.
 */
export const LEVELS: readonly CampaignLevel[] = [
  // 1. Premiers blocs
  timed('1-1', 'classic', 2, { kind: 'lines', target: 5 }),
  timed('1-2', 'classic', 2.5, { kind: 'lines', target: 10 }),
  timed('1-3', 'chroma', 2.5, { kind: 'score', target: 2500 }),
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
  // 4. Vertiges
  timed('4-1', 'tilt', 3, { kind: 'lines', target: 15 }),
  timed('4-2', 'rhythm', 3, { kind: 'lines', target: 12 }),
  timed('4-3', 'tower', 3, { kind: 'lines', target: 5 }),
  timed('4-4', 'tower', 4, { kind: 'lines', target: 10 }),
  timed('4-5', 'sand', 4, { kind: 'lines', target: 7 }),
  duel('4-6', 'hard'),
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
];

export const MAX_STARS = LEVELS.length * 3;

export function levelById(id: string): CampaignLevel | undefined {
  return LEVELS.find((level) => level.id === id);
}
