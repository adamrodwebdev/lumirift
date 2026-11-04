import { describe, expect, it } from 'vitest';
import { CLIP_WEEKS } from '../../media/clips';
import { ClipRecipesError, ON_SCREEN_MAX, parseClipWeek } from '../../media/clipRecipes';
import { SCENES } from '../../media/scenes';
import { ELEMENT_NAMES } from '@/session/Elements';
import { BOSS_IDS } from '@/session/GameSession';

const KNOWN = { scenes: Object.keys(SCENES), elements: ELEMENT_NAMES, guardians: BOSS_IDS };

/** A week of one clip, its recipe changed by `clip`, as the text of a recipes file. */
const fileWith = (clip: Record<string, unknown>, week: Record<string, unknown> = {}) =>
  JSON.stringify({
    element: 'water',
    guardian: 'duneWorm',
    clips: [
      {
        id: 'mon-water-rises',
        day: 'mon',
        scene: 'elements',
        variant: 1,
        peak: 'react.sprout',
        afterMs: 2500,
        ...clip,
      },
    ],
    ...week,
  });

/** The problems a recipes file's text is refused for (none: it is read). */
function problemsOf(text: string): readonly string[] {
  try {
    parseClipWeek(text, KNOWN);
    return [];
  } catch (error) {
    if (error instanceof ClipRecipesError) return error.problems;
    throw error;
  }
}

describe('a week of clips read from a recipes file', () => {
  it('is the week media/clips.ts holds when the file holds it', () => {
    const week = CLIP_WEEKS['2026-11-02'];
    expect(parseClipWeek(JSON.stringify(week), KNOWN)).toEqual(week);
  });

  it('carries each clip’s on-screen line and its height', () => {
    const week = parseClipWeek(fileWith({ onScreen: 'Fire meets oil', onScreenY: 0.3 }), KNOWN);
    expect(week.clips[0]).toMatchObject({ onScreen: 'Fire meets oil', onScreenY: 0.3 });
  });

  it('names every problem at once, by clip and field', () => {
    const problems = problemsOf(
      JSON.stringify({
        element: 'lava',
        guardian: 'duneWorm',
        clips: [
          {
            id: 'mon-a',
            day: 'monday',
            scene: 'elements',
            variant: 0,
            peak: 'react.blaze',
            afterms: 2500,
          },
          {
            id: 'mon-a',
            day: 'tue',
            scene: 'volcano',
            variant: 0,
            peak: 'react.blaze',
            afterMs: 2500,
          },
        ],
      }),
    );
    expect(problems).toEqual([
      expect.stringMatching(/^the week: "element" must be one of water, .*not "lava"$/),
      expect.stringMatching(/^clip "mon-a": unknown field "afterms"/),
      expect.stringMatching(/^clip "mon-a": "day" must be one of mon, .*not "monday"$/),
      'clip "mon-a": "afterMs" is missing; it must be a number of ms from 0 to 10000',
      expect.stringMatching(/^clip "mon-a": "scene" must be one of elements, .*not "volcano"$/),
      'clip "mon-a": two clips have this id',
    ]);
  });

  it('refuses a file that is not a week', () => {
    expect(problemsOf('{ "element": "water",')).toEqual([
      expect.stringMatching(/^the file is not JSON: /),
    ]);
    expect(problemsOf('[]')).toEqual(['the file must hold one week: { element, guardian, clips }']);
    expect(problemsOf(fileWith({}, { clips: [] }))).toEqual([
      'the week: "clips" must be a list of 1 to 14 recipes',
    ]);
    expect(problemsOf(fileWith({}, { season: 1 }))).toEqual([
      expect.stringMatching(/^the week: unknown field "season"/),
    ]);
  });

  it('takes a recipe’s numbers only in their range', () => {
    expect(problemsOf(fileWith({ variant: 1.5 }))).toEqual([
      expect.stringMatching(/"variant" must be a whole number from 0 to 99, not 1.5$/),
    ]);
    expect(problemsOf(fileWith({ nth: 0 }))).toEqual([
      expect.stringMatching(/"nth" must be a whole number from 1/),
    ]);
    expect(problemsOf(fileWith({ afterMs: -1 }))).toEqual([
      expect.stringMatching(/"afterMs" must be/),
    ]);
    expect(problemsOf(fileWith({ peak: 'blaze' }))).toEqual([
      expect.stringMatching(/"peak" must be an engine event/),
    ]);
    expect(problemsOf(fileWith({ challenge: 'question' }))).toEqual([
      expect.stringMatching(/"challenge" must be setup, answer, not "question"$/),
    ]);
    expect(problemsOf(fileWith({ id: 'Mon Water' }))).toEqual([
      expect.stringMatching(/^clip "Mon Water": "id" must be lower-case words with dashes/),
    ]);
  });

  it('takes an on-screen line of one line, single-spaced, at a height inside the safe area', () => {
    const wrong = [
      'Fire\nmeets oil',
      'Fire  meets oil',
      ' Fire meets oil',
      '',
      'x'.repeat(ON_SCREEN_MAX + 1),
      3,
    ];
    for (const onScreen of wrong) {
      expect(problemsOf(fileWith({ onScreen })), JSON.stringify(onScreen)).toEqual([
        expect.stringMatching(/"onScreen" must be one line of 1 to 60 characters/),
      ]);
    }
    expect(problemsOf(fileWith({ onScreen: 'x'.repeat(ON_SCREEN_MAX) }))).toEqual([]);
    expect(problemsOf(fileWith({ onScreen: 'Fire meets oil', onScreenY: 0.9 }))).toEqual([
      expect.stringMatching(
        /"onScreenY" must be a share of the frame's height between 0.1 and 0.78, not 0.9$/,
      ),
    ]);
    expect(problemsOf(fileWith({ onScreenY: 0.3 }))).toEqual([
      'clip "mon-water-rises": "onScreenY" places an "onScreen" line it does not have',
    ]);
  });
});
