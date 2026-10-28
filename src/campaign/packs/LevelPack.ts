import { isAiLevel } from '@/families/falling/ai/AiLevels';
import { MODE_IDS, type ModeId } from '@/session/ModeId';
import { GOAL_KINDS, type Goal, type GoalKind } from '../Goals';
import type { CampaignLevel, StarRule } from '../Levels';

/** A generated level, with the seed its generator drew it from. */
export interface PackedLevel {
  readonly seed: number;
  readonly level: CampaignLevel;
}

/** A generated chapter's levels (1.38), kept by the curve bot, shipped as data. */
export interface LevelPack {
  readonly chapter: number;
  readonly levels: readonly PackedLevel[];
}

type Fields = Readonly<Record<string, unknown>>;

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

class PackError extends Error {
  constructor(where: string, what: string) {
    super(`Level pack, ${where}: ${what}`);
  }
}

function fieldsOf(value: unknown, where: string): Fields {
  if (!isFields(value)) throw new PackError(where, 'not an object');
  return value;
}

function countOf(fields: Fields, key: string, where: string): number {
  const value = fields[key];
  if (!isCount(value)) throw new PackError(where, `"${key}" is not a count`);
  return value;
}

function goalOf(value: unknown, where: string): Goal {
  const fields = fieldsOf(value, `${where} goal`);
  const kind = fields.kind;
  if (!(GOAL_KINDS as readonly unknown[]).includes(kind)) {
    throw new PackError(where, `no goal ${JSON.stringify(kind)}`);
  }
  return { kind: kind as GoalKind, target: countOf(fields, 'target', where) };
}

/** How each kind of star rule is read: what it holds besides its kind. */
const STAR_RULES: Readonly<Record<StarRule['kind'], (fields: Fields, where: string) => StarRule>> =
  {
    timeLeft: () => ({ kind: 'timeLeft' }),
    lines: (fields, where) => ({
      kind: 'lines',
      two: countOf(fields, 'two', where),
      three: countOf(fields, 'three', where),
    }),
    fast: (fields, where) => ({
      kind: 'fast',
      twoMs: countOf(fields, 'twoMs', where),
      threeMs: countOf(fields, 'threeMs', where),
    }),
  };

function starsOf(value: unknown, where: string): StarRule {
  const fields = fieldsOf(value, `${where} stars`);
  const kind = fields.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(STAR_RULES, kind)) {
    throw new PackError(where, `no star rule ${JSON.stringify(kind)}`);
  }
  return STAR_RULES[kind as StarRule['kind']](fields, where);
}

function levelOf(value: unknown, chapter: number): CampaignLevel {
  const fields = fieldsOf(value, `chapter ${chapter}`);
  const { id, modeId, variant, timeLimitMs } = fields;
  if (typeof id !== 'string' || !id.startsWith(`${chapter}-`)) {
    throw new PackError(`chapter ${chapter}`, `the id ${JSON.stringify(id)} is not of the chapter`);
  }
  if (!(MODE_IDS as readonly unknown[]).includes(modeId)) {
    throw new PackError(id, `no mode ${JSON.stringify(modeId)}`);
  }
  if (timeLimitMs !== null && !isCount(timeLimitMs)) throw new PackError(id, 'a broken clock');
  if (variant !== undefined && !isAiLevel(variant)) {
    throw new PackError(id, `no AI ${JSON.stringify(variant)}`);
  }
  return {
    id,
    chapter,
    modeId: modeId as ModeId,
    ...(variant === undefined ? {} : { variant }),
    timeLimitMs,
    goal: goalOf(fields.goal, id),
    stars: starsOf(fields.stars, id),
  };
}

/**
 * A pack read from its data and checked (1.38). The packs ship inside the
 * game, written by the generator: a broken one is a defect of the build,
 * caught by the tests, never a map with a hole in it.
 */
export function parseLevelPack(data: unknown): LevelPack {
  const fields = fieldsOf(data, 'its root');
  const chapter = countOf(fields, 'chapter', 'its root');
  const levels = fields.levels;
  if (!Array.isArray(levels)) throw new PackError(`chapter ${chapter}`, 'no levels');
  return {
    chapter,
    levels: levels.map((entry: unknown) => {
      const packed = fieldsOf(entry, `chapter ${chapter}`);
      return {
        seed: countOf(packed, 'seed', `chapter ${chapter}`),
        level: levelOf(packed.level, chapter),
      };
    }),
  };
}
