import type { ModeId } from '@/session/ModeId';
import type { BeatChart, BeatEmotion, BeatRole, Intensity } from '../BeatCharts';
import type { GoalKind } from '../Goals';

/** The kinds of level the generators draw (1.38): a falling well, the Sand, the Mosaic, the Tower, a duel. */
export const LEVEL_KINDS = ['falling', 'sand', 'mosaic', 'tower', 'duel'] as const;
export type LevelKind = (typeof LEVEL_KINDS)[number];

/**
 * The parts of the rhythm a generated level plays; the Guardian at the
 * chapter's end stays handmade. The duels are finales: only those who beat
 * the hard AI of 5-6 come this far (measured: the regular bot never does).
 */
export type GeneratedRole = Extract<BeatRole, 'breather' | 'test' | 'spike' | 'finale'>;

/** A generated level's place: its id, its chapter, its part in the rhythm, its kind. */
export interface LevelSlot {
  readonly id: string;
  readonly chapter: number;
  readonly role: GeneratedRole;
  readonly kind: LevelKind;
  /** The modes it may draw, when its kind has several (the falling wells). */
  readonly modes?: readonly ModeId[];
  /** The goals it may draw, when not its kind's usual ones (the Sand's points). */
  readonly goals?: readonly GoalKind[];
}

/** What a part of the rhythm asks of its levels: the feeling, each third's intensity, the near misses. */
interface RoleBeat {
  readonly emotion: BeatEmotion;
  readonly intensity: Intensity;
  readonly nearMisses?: number;
}

/**
 * The beats of the generated chapters, as in the handmade ones: a calm
 * after each Guardian, tests of what was learnt, a spike where the player
 * nearly loses, the duel as the climb to the Guardian.
 */
export const ROLE_BEATS: Readonly<Record<GeneratedRole, RoleBeat>> = {
  breather: { emotion: 'calm', intensity: [3, 3, 4] },
  test: { emotion: 'focus', intensity: [3, 5, 6] },
  spike: { emotion: 'urgency', intensity: [4, 6, 8], nearMisses: 2 },
  finale: { emotion: 'rivalry', intensity: [4, 5, 6] },
};

/** What a step of the plan may narrow: the modes, or the goals, its kind draws. */
type PlanChoice = Pick<LevelSlot, 'modes' | 'goals'>;

/** A step of a chapter's plan: its role, its kind and what it narrows. */
type PlanStep = readonly [GeneratedRole, LevelKind, PlanChoice?];

/**
 * Chapters 6 to 10 (1.38): six generated levels each, then a Guardian's
 * rematch (handmade, in `LEVELS`). Each chapter plays every family, the
 * falling wells twice, in its own order; its sawtooth climbs to the duel.
 * The falling wells draw from two modes suited to their role, so that every
 * mode may come back over the five chapters: the tide and the tilt in the
 * spikes, the fusions and the silhouette in the calm. The spikes are the
 * tide, the tilt and the mirror: measured, the Tower never pressures a
 * regular past half its well, nor do the classic and the rhythm bring the
 * near misses a spike asks; by chapter 10, with every upgrade bought, only
 * the tilt still does, and the Sand's links are all taken: its Sand is a
 * test of points, its opener a calm Mosaic.
 */
const PLANS: Readonly<Record<number, readonly PlanStep[]>> = {
  6: [
    ['breather', 'sand'],
    ['test', 'mosaic'],
    ['spike', 'falling', { modes: ['mirror', 'tide'] }],
    ['breather', 'tower'],
    ['test', 'falling', { modes: ['chroma', 'flip'] }],
    ['finale', 'duel'],
  ],
  7: [
    ['breather', 'mosaic'],
    ['test', 'falling', { modes: ['classic', 'rhythm'] }],
    ['test', 'sand'],
    ['spike', 'falling', { modes: ['tilt', 'tide'] }],
    ['breather', 'tower'],
    ['finale', 'duel'],
  ],
  8: [
    ['breather', 'tower'],
    ['spike', 'falling', { modes: ['mirror', 'tilt'] }],
    ['breather', 'sand'],
    ['test', 'mosaic'],
    ['test', 'falling', { modes: ['flip', 'chroma'] }],
    ['finale', 'duel'],
  ],
  9: [
    ['breather', 'falling', { modes: ['fusion', 'silhouette'] }],
    ['test', 'tower'],
    ['test', 'mosaic'],
    ['breather', 'sand'],
    ['spike', 'falling', { modes: ['tide', 'mirror'] }],
    ['finale', 'duel'],
  ],
  10: [
    ['breather', 'mosaic'],
    ['test', 'tower'],
    ['spike', 'falling', { modes: ['tilt', 'tide'] }],
    ['test', 'sand', { goals: ['score'] }],
    ['test', 'falling', { modes: ['mirror'] }],
    ['finale', 'duel'],
  ],
};

/** The chapters made by the generators. */
export const GENERATED_CHAPTERS: readonly number[] = Object.keys(PLANS).map(Number);

/** The generated levels of a chapter, in order (none for a handmade chapter). */
export function slotsOf(chapter: number): readonly LevelSlot[] {
  return (PLANS[chapter] ?? []).map(([role, kind, choice], i) => ({
    id: `${chapter}-${i + 1}`,
    chapter,
    role,
    kind,
    ...choice,
  }));
}

/** The slot of a generated level, by its id. */
export function slotOf(id: string): LevelSlot | undefined {
  return slotsOf(Number(id.split('-')[0])).find((slot) => slot.id === id);
}

/** A generated level's beat chart: its role's beat, and its idea in words. */
export function chartOf(slot: LevelSlot, idea: string): BeatChart {
  const { emotion, intensity, nearMisses } = ROLE_BEATS[slot.role];
  return {
    idea,
    emotion,
    role: slot.role,
    intensity,
    ...(nearMisses === undefined ? {} : { nearMisses }),
  };
}
