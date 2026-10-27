import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { FamilyId, ModeId } from '@/session/ModeId';

/**
 * Where the game screen puts the parts: one well, a duel's two, the Mosaic's
 * board and hand, or the race's world with its clock.
 */
export type GameLayout = 'well' | 'duel' | 'mosaic' | 'race';

/** What a first game's guide aims at: lines, or the Sand's regions. */
export type CoachGoal = 'lines' | 'sand';

/**
 * How a family shows itself on the game screen (1.28): the layout of its
 * parts, its touch help in words, the guide of a first game, the word for a
 * clear. A mode may change the layout (the duel). Next to `stages.ts`, which
 * gives each family its play area.
 */
export interface Presentation {
  readonly layout: GameLayout;
  /**
   * Touch help in words (translation keys), shown in the pause where no
   * drawing says it: the Mosaic's (the others' gestures are drawn, 1.32).
   */
  readonly touchHelp: readonly string[];
  /** The very first game is guided toward this goal (the falling controls), or not at all. */
  readonly coachGoal: CoachGoal | null;
  /** The notice of a clear (a translation key): lines, or the Sand's regions linking the walls. */
  readonly clearNotice: string;
  /** Indicators the stage draws itself, which the HUD leaves out (the race's clock ring). */
  readonly stageShows: readonly string[];
}

const FAMILY_PRESENTATIONS: Readonly<Record<FamilyId, Presentation>> = {
  falling: {
    layout: 'well',
    touchHelp: [],
    coachGoal: 'lines',
    clearNotice: 'notice.lines',
    stageShows: [],
  },
  sand: {
    layout: 'well',
    touchHelp: [],
    coachGoal: 'sand',
    clearNotice: 'notice.regions',
    stageShows: [],
  },
  placement: {
    layout: 'mosaic',
    touchHelp: ['mosaic.helpTouch'],
    coachGoal: null,
    clearNotice: 'notice.lines',
    stageShows: [],
  },
  volume: {
    layout: 'well',
    touchHelp: [],
    coachGoal: 'lines',
    clearNotice: 'notice.lines',
    stageShows: [],
  },
  // The race: each world's own words for a clear (`boardFamily`); its stage draws the clock.
  rift: {
    layout: 'race',
    touchHelp: [],
    coachGoal: null,
    clearNotice: 'notice.lines',
    stageShows: ['timeLeft'],
  },
};

/** The modes laid out their own way: the duel shows the opponent's well beside the player's. */
const MODE_LAYOUTS: Readonly<Partial<Record<ModeId, GameLayout>>> = { duel: 'duel' };

/** How a family's board shows itself (the race's worlds take their own words for a clear). */
export function familyPresentation(family: FamilyId): Presentation {
  return FAMILY_PRESENTATIONS[family];
}

export function presentationFor({ id, family }: ModeDescriptor): Presentation {
  const presentation = FAMILY_PRESENTATIONS[family];
  const layout = MODE_LAYOUTS[id];
  return layout ? { ...presentation, layout } : presentation;
}
