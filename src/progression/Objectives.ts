import { SeededRandom, type RandomSource } from '@/core/Random';
import type { ElementName } from '@/session/Elements';
import type { ModeId } from '@/session/ModeId';
import { MIN_GAME_MS } from './Experience';
import type { GameReport } from './GameReport';

export const OBJECTIVE_TIERS = ['easy', 'medium', 'hard'] as const;
export type ObjectiveTier = (typeof OBJECTIVE_TIERS)[number];

/** Experience for an objective, by tier. */
export const OBJECTIVE_XP: Readonly<Record<ObjectiveTier, number>> = {
  easy: 40,
  medium: 70,
  hard: 110,
};

export const OBJECTIVE_KINDS = [
  'play',
  'playMode',
  'lines',
  'bigClear',
  'combo',
  'survive',
  'daily',
  'duel',
  'element',
] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

/** One objective of the day: what to do, how much of it, for how much experience. */
export interface Objective {
  readonly kind: ObjectiveKind;
  readonly tier: ObjectiveTier;
  readonly target: number;
  /** A mode to play (`playMode`), or the lines to clear at once (`bigClear`). */
  readonly mode?: ModeId;
  readonly size?: number;
  /** The element whose deeds count (`element`: the week's goal, 1.36). */
  readonly element?: ElementName;
}

/**
 * A kind of objective: which tiers it can fill, how it is set for the day,
 * and how much a game advances it. Adding a kind means adding a rule.
 */
/**
 * Where the day's objectives are played: the modes open to the player, and
 * whether a daily challenge exists (a test build of one mode has none, 1.37).
 */
export interface ObjectivePlace {
  readonly modes: readonly ModeId[];
  readonly daily: boolean;
}

interface ObjectiveRule {
  readonly kind: ObjectiveKind;
  readonly tiers: readonly ObjectiveTier[];
  /** It can be met there; absent: everywhere. */
  offered?(place: ObjectivePlace): boolean;
  create(tier: ObjectiveTier, random: RandomSource, modes: readonly ModeId[]): Objective;
  advance(report: GameReport, objective: Objective): number;
}

const counted = (report: GameReport) => report.durationMs >= MIN_GAME_MS;

const RULES: readonly ObjectiveRule[] = [
  {
    kind: 'play',
    tiers: ['easy', 'medium'],
    create: (tier) => ({ kind: 'play', tier, target: tier === 'easy' ? 3 : 6 }),
    advance: (report) => (counted(report) ? 1 : 0),
  },
  {
    kind: 'playMode',
    tiers: ['easy'],
    create: (tier, random, modes) => ({
      kind: 'playMode',
      tier,
      target: 1,
      mode: modes[random.nextInt(modes.length)]!,
    }),
    advance: (report, objective) => (counted(report) && report.modeId === objective.mode ? 1 : 0),
  },
  {
    kind: 'lines',
    tiers: ['medium', 'hard'],
    create: (tier) => ({ kind: 'lines', tier, target: tier === 'medium' ? 25 : 60 }),
    advance: (report) => report.lines,
  },
  {
    kind: 'bigClear',
    tiers: ['medium', 'hard'],
    create: (tier) => ({ kind: 'bigClear', tier, target: 1, size: tier === 'medium' ? 2 : 3 }),
    advance: (report, objective) => (report.bestAtOnce >= (objective.size ?? 2) ? 1 : 0),
  },
  {
    kind: 'combo',
    tiers: ['hard'],
    create: (tier) => ({ kind: 'combo', tier, target: 1, size: 3 }),
    advance: (report, objective) => (report.bestCombo >= (objective.size ?? 3) ? 1 : 0),
  },
  {
    kind: 'survive',
    tiers: ['medium'],
    create: (tier) => ({ kind: 'survive', tier, target: 1, size: 3 }),
    advance: (report, objective) => (report.durationMs >= (objective.size ?? 3) * 60_000 ? 1 : 0),
  },
  {
    kind: 'daily',
    tiers: ['easy'],
    offered: (place) => place.daily,
    create: (tier) => ({ kind: 'daily', tier, target: 1 }),
    advance: (report) => (report.daily ? 1 : 0),
  },
  {
    // The week's goal (1.36): never one of a day's; the season sets it (`weeklyObjective`).
    kind: 'element',
    tiers: [],
    create: (tier) => ({ kind: 'element', tier, target: 1, element: 'fire' }),
    advance: (report, objective) =>
      objective.element ? (report.elements?.[objective.element] ?? 0) : 0,
  },
  {
    kind: 'duel',
    tiers: ['hard'],
    offered: (place) => place.modes.includes('duel'),
    create: (tier) => ({ kind: 'duel', tier, target: 1 }),
    advance: (report) =>
      report.modeId === 'duel' &&
      report.reason === 'victory' &&
      !['rookie', 'easy'].includes(report.variant ?? '')
        ? 1
        : 0,
  },
];

const ruleOf = (kind: ObjectiveKind): ObjectiveRule => RULES.find((rule) => rule.kind === kind)!;

/** How much a game advances an objective. */
export function advance(objective: Objective, report: GameReport): number {
  return ruleOf(objective.kind).advance(report, objective);
}

/**
 * The three objectives of a day, one per tier, all of different kinds. The
 * same for everybody on a given day: they come from the day's key.
 */
export function objectivesOfDay(day: string, place: ObjectivePlace): Objective[] {
  const random = SeededRandom.fromString(`objectives:${day}`);
  const used = new Set<ObjectiveKind>();
  return OBJECTIVE_TIERS.map((tier) => {
    const choices = RULES.filter(
      (rule) =>
        rule.tiers.includes(tier) && !used.has(rule.kind) && (rule.offered?.(place) ?? true),
    );
    const rule = choices[random.nextInt(choices.length)]!;
    used.add(rule.kind);
    return rule.create(tier, random, place.modes);
  });
}
