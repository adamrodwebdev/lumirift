import type { BossId } from '@/session/GameSession';
import type { ElementName } from '@/session/Elements';
import type { SceneName } from './scenes';

/** The day a clip is posted (the plan's weekly rhythm: Monday's element, Friday's Guardian…). */
export type ClipDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * A clip of the factory (scripts/clip-factory.mjs, 1.39): a scene, its
 * variant, and the engine event that marks its peak. The peak and its
 * aftermath open the clip; the clip then goes back to the scene's start and
 * plays up to the frame before the one it opened on, a loop without a seam.
 */
export interface ClipRecipe {
  /** Its file name in release/clips/<week>/, without extension. */
  readonly id: string;
  readonly day: ClipDay;
  readonly scene: SceneName;
  readonly variant: number;
  /** The event, as the media page names it (`react.blaze`, `strike.shock`, `heart.hurt.shard`…). */
  readonly peak: string;
  /** Which of those events (1, the first, by default). */
  readonly nth?: number;
  /** How long the clip goes on after its peak, before the replay (ms; longer if the clip would last under 7 s). */
  readonly afterMs: number;
  /** A challenge: the decision frozen with its A and B, or both answers side by side. */
  readonly challenge?: 'setup' | 'answer';
}

/** A week of clips: what the game features that week, and its clips. */
export interface ClipWeek {
  /** The week's element (the game's own calendar, src/seasons): Monday's clip. */
  readonly element: ElementName;
  /** The Guardian of the week's challenge (`GuardianChallenge`): Friday's clip. */
  readonly guardian: BossId;
  readonly clips: readonly ClipRecipe[];
}

/** The weeks of clips, by their Monday (YYYY-MM-DD), each built a week ahead. */
export const CLIP_WEEKS: Readonly<Record<string, ClipWeek>> = {
  '2026-11-02': {
    element: 'fire',
    guardian: 'riftHeart',
    clips: [
      {
        id: 'mon-fire-on-oil',
        day: 'mon',
        scene: 'fireOnOil',
        variant: 0,
        peak: 'react.blaze',
        afterMs: 2500,
      },
      {
        id: 'tue-fire-challenge',
        day: 'tue',
        scene: 'fireChoice',
        variant: 0,
        peak: 'spawn.fire',
        afterMs: 0,
        challenge: 'setup',
      },
      {
        id: 'thu-lightning-in-water',
        day: 'thu',
        scene: 'lightningInWater',
        variant: 0,
        peak: 'strike.shock',
        afterMs: 2500,
      },
      {
        id: 'fri-heart-of-the-rift',
        day: 'fri',
        scene: 'heart',
        variant: 0,
        peak: 'heart.hurt.shard',
        nth: 2,
        afterMs: 2500,
      },
      {
        id: 'sun-fire-challenge-answer',
        day: 'sun',
        scene: 'fireChoice',
        variant: 0,
        peak: 'react.blaze',
        afterMs: 2500,
        challenge: 'answer',
      },
    ],
  },
};
