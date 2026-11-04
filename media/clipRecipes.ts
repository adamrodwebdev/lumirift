import type { ClipDay, ClipRecipe, ClipWeek } from './clips';

/**
 * A week's recipes read from a file (1.46.2): `npm run clips -- --week <monday>
 * --recipes <file>` films a week without a change to media/clips.ts. The file
 * has a week's shape there (`element`, `guardian`, `clips`) and is checked
 * field by field before any take: a misspelt field, an unknown scene or a
 * wrong value stops the render with every problem named, clip and field.
 */

/** What a recipes file may name: the set's scenes, the game's elements and its Guardians. */
export interface KnownNames {
  readonly scenes: readonly string[];
  readonly elements: readonly string[];
  readonly guardians: readonly string[];
}

/** The longest on-screen line (characters): it fits two short lines on a phone. */
export const ON_SCREEN_MAX = 60;
/** Where an on-screen line may sit (its middle, as a share of the frame's height): the apps' safe area. */
export const ON_SCREEN_BAND = { top: 0.1, bottom: 0.78 } as const;

const DAYS: readonly ClipDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CHALLENGES: readonly string[] = ['setup', 'answer'];
const WEEK_FIELDS: readonly string[] = ['element', 'guardian', 'clips'];
const CLIP_FIELDS: readonly string[] = [
  'id',
  'day',
  'scene',
  'variant',
  'peak',
  'nth',
  'afterMs',
  'challenge',
  'onScreen',
  'onScreenY',
];
/** A clip's file name: lower-case words joined by dashes. */
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An engine event, as the media page names it (`react.blaze`, `heart.hurt.shard`…). */
const EVENT = /^[a-z]+(?:\.[a-zA-Z0-9]+)+$/;
/** A week holds a clip a day at most, twice: a week's posts and their spares. */
const MAX_CLIPS = 14;
/** A variant picks a scene's seed and staging; the scenes take any, in turn. */
const MAX_VARIANT = 99;
/** The longest aftermath before a clip's replay (ms): a clip lasts 15 s at most. */
const MAX_AFTER_MS = 10_000;

/** A recipes file that cannot be filmed: every problem, by clip and field. */
export class ClipRecipesError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`The recipes cannot be filmed:\n- ${problems.join('\n- ')}`);
    this.name = 'ClipRecipesError';
  }
}

type Fields = Readonly<Record<string, unknown>>;

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const oneOf = (names: readonly string[]) => names.join(', ');
/** A field's problem: missing, or what it holds against what it `must` hold. */
const wrong = (where: string, name: string, value: unknown, must: string) =>
  value === undefined
    ? `${where}: "${name}" is missing; it ${must}`
    : `${where}: "${name}" ${must}, not ${JSON.stringify(value)}`;

/** The fields of `fields` that are not among `allowed`, each a problem of `where`. */
function strangers(fields: Fields, allowed: readonly string[], where: string): string[] {
  return Object.keys(fields)
    .filter((name) => !allowed.includes(name))
    .map((name) => `${where}: unknown field "${name}" (fields: ${oneOf(allowed)})`);
}

/** The problems of one clip's recipe (`where` names it). */
function clipProblems(clip: Fields, where: string, known: KnownNames): string[] {
  const problems = strangers(clip, CLIP_FIELDS, where);
  const field = (name: string, ok: boolean, must: string) => {
    if (!ok) problems.push(wrong(where, name, clip[name], must));
  };
  const has = (name: string) => clip[name] !== undefined;
  field(
    'id',
    typeof clip.id === 'string' && ID.test(clip.id),
    'must be lower-case words with dashes',
  );
  field('day', DAYS.includes(clip.day as ClipDay), `must be one of ${oneOf(DAYS)}`);
  field(
    'scene',
    known.scenes.includes(clip.scene as string),
    `must be one of ${oneOf(known.scenes)}`,
  );
  field(
    'variant',
    isWhole(clip.variant, 0, MAX_VARIANT),
    `must be a whole number from 0 to ${MAX_VARIANT}`,
  );
  field(
    'peak',
    typeof clip.peak === 'string' && EVENT.test(clip.peak),
    'must be an engine event like "react.blaze"',
  );
  if (has('nth')) field('nth', isWhole(clip.nth, 1, 99), 'must be a whole number from 1');
  field(
    'afterMs',
    typeof clip.afterMs === 'number' && clip.afterMs >= 0 && clip.afterMs <= MAX_AFTER_MS,
    `must be a number of ms from 0 to ${MAX_AFTER_MS}`,
  );
  if (has('challenge'))
    field(
      'challenge',
      CHALLENGES.includes(clip.challenge as string),
      `must be ${oneOf(CHALLENGES)}`,
    );
  if (has('onScreen')) {
    const line = clip.onScreen;
    field(
      'onScreen',
      typeof line === 'string' &&
        line.length > 0 &&
        line.length <= ON_SCREEN_MAX &&
        line === line.trim() &&
        !/\s\s|[\n\r\t]/.test(line),
      `must be one line of 1 to ${ON_SCREEN_MAX} characters, single spaces, none at its ends`,
    );
  }
  if (has('onScreenY')) {
    const y = clip.onScreenY;
    field(
      'onScreenY',
      typeof y === 'number' && y > ON_SCREEN_BAND.top && y < ON_SCREEN_BAND.bottom,
      `must be a share of the frame's height between ${ON_SCREEN_BAND.top} and ${ON_SCREEN_BAND.bottom}`,
    );
    if (!has('onScreen'))
      problems.push(`${where}: "onScreenY" places an "onScreen" line it does not have`);
  }
  return problems;
}

/**
 * The week of a recipes file's text, checked before any take; throws a
 * `ClipRecipesError` that lists every problem.
 */
export function parseClipWeek(text: string, known: KnownNames): ClipWeek {
  let week: unknown;
  try {
    week = JSON.parse(text);
  } catch (error) {
    throw new ClipRecipesError([`the file is not JSON: ${(error as Error).message}`]);
  }
  if (!isFields(week))
    throw new ClipRecipesError(['the file must hold one week: { element, guardian, clips }']);
  const problems = strangers(week, WEEK_FIELDS, 'the week');
  if (!known.elements.includes(week.element as string)) {
    problems.push(
      wrong('the week', 'element', week.element, `must be one of ${oneOf(known.elements)}`),
    );
  }
  if (!known.guardians.includes(week.guardian as string)) {
    problems.push(
      wrong('the week', 'guardian', week.guardian, `must be one of ${oneOf(known.guardians)}`),
    );
  }
  const clips = Array.isArray(week.clips) ? (week.clips as readonly unknown[]) : null;
  if (!clips || clips.length === 0 || clips.length > MAX_CLIPS) {
    problems.push(`the week: "clips" must be a list of 1 to ${MAX_CLIPS} recipes`);
  }
  const ids = new Set<string>();
  for (const [index, clip] of (clips ?? []).entries()) {
    const id = isFields(clip) && typeof clip.id === 'string' ? clip.id : null;
    const where = id ? `clip "${id}"` : `clip ${index + 1}`;
    if (!isFields(clip)) {
      problems.push(`${where}: a recipe must be an object`);
      continue;
    }
    problems.push(...clipProblems(clip, where, known));
    if (id && ids.has(id)) problems.push(`${where}: two clips have this id`);
    if (id) ids.add(id);
  }
  if (problems.length) throw new ClipRecipesError(problems);
  return {
    element: week.element as ClipWeek['element'],
    guardian: week.guardian as ClipWeek['guardian'],
    clips: (clips as readonly ClipRecipe[]).map((clip) => Object.freeze({ ...clip })),
  };
}
