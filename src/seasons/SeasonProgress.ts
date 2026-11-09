import { savedDay } from '@/core/Day';
import { InputRecord, orElse, readNumber } from '@/core/input';
import { COUNT, LIST_LIMITS } from '@/core/limits';
import { advance } from '@/progression/Objectives';
import type { GameReport } from '@/progression/GameReport';
import { seasonAt, weekEventAt } from './EventCalendar';
import { SEASONS, type SeasonId } from './SeasonData';
import { tierReached, tiersOf, type SeasonReward } from './SeasonTrack';
import { WEEKLY_GOAL_POINTS, weeklyObjective } from './WeeklyGoals';

/** A player's season, as saved: its points and the tiers claimed, the week's goal so far. */
export interface SeasonProgressData {
  /** The season these points belong to, or null (none yet). */
  readonly season: SeasonId | null;
  readonly points: number;
  /** The tiers whose reward was given. */
  readonly claimed: readonly number[];
  /** The week (its Monday, UTC) the goal counts for, or null. */
  readonly week: string | null;
  /** The week's element's deeds so far. */
  readonly deeds: number;
  /** The week's goal reached: its points given. */
  readonly done: boolean;
}

export const EMPTY_SEASON_PROGRESS: SeasonProgressData = {
  season: null,
  points: 0,
  claimed: [],
  week: null,
  deeds: 0,
  done: false,
};

const seasonById = (id: SeasonId) => SEASONS.find((season) => season.id === id)!;

const SEASON_IDS: readonly SeasonId[] = SEASONS.map((season) => season.id);

/** The tiers a save says were claimed, each one of the track's (one that is not is left out, once each). */
function claimedTiers(save: InputRecord, tiers: number): number[] {
  const tier = { min: 1, max: tiers, integer: true };
  const claimed = orElse(
    () =>
      save.list('claimed', {
        maxItems: LIST_LIMITS.seasonTiers,
        item: (value, field) => orElse(() => readNumber(value, tier, field), null),
      }),
    [],
  );
  return [...new Set(claimed.filter((each) => each !== null))];
}

/**
 * A player's season (1.36): the points of play climb its track; each tier
 * reached is claimed, once; the week's goal brings its points once. A new
 * season starts from zero (the tiers left unclaimed in the last are given:
 * nothing is lost), a new week from a fresh goal. Changes only through
 * intentions, each told the moment it happens.
 */
export class SeasonProgress {
  private data: SeasonProgressData;

  constructor(data: SeasonProgressData = EMPTY_SEASON_PROGRESS) {
    this.data = data;
  }

  get snapshot(): SeasonProgressData {
    return this.data;
  }

  /** The rewards of the tiers reached and never claimed in a season over by `at`. */
  leftBehind(at: Date): readonly SeasonReward[] {
    const { season } = this.data;
    if (season === null || seasonAt(at)?.season.id === season) return [];
    const track = seasonById(season).track;
    const reached = tierReached(track, this.data.points);
    return tiersOf(track)
      .filter(({ tier }) => tier <= reached && !this.data.claimed.includes(tier))
      .map(({ reward }) => reward);
  }

  /** The progress follows the calendar to `at`: a new season from zero, a new week's goal. */
  catchUp(at: Date): void {
    const span = seasonAt(at);
    const season = span?.season.id ?? null;
    if (season !== this.data.season) {
      this.data = { ...EMPTY_SEASON_PROGRESS, season };
    }
    const week = weekEventAt(at)?.key ?? null;
    if (week !== this.data.week) this.data = { ...this.data, week, deeds: 0, done: false };
  }

  /** A finished game at `at`: its experience as points, its deeds for the week's goal. */
  recordGame(report: GameReport, xp: number, at: Date): void {
    this.catchUp(at);
    const event = weekEventAt(at);
    if (this.data.season === null || !event) return;
    const objective = weeklyObjective(event.element);
    const deeds = this.data.deeds + advance(objective, report);
    const reached = !this.data.done && deeds >= objective.target;
    this.data = {
      ...this.data,
      points: this.data.points + Math.max(0, xp) + (reached ? WEEKLY_GOAL_POINTS : 0),
      deeds: Math.min(deeds, objective.target),
      done: this.data.done || reached,
    };
  }

  /** A tier's reward claimed at `at`: once, and only a tier reached in the season running. */
  claim(tier: number, at: Date): void {
    if (!this.claimable(tier, at)) return;
    this.data = { ...this.data, claimed: [...this.data.claimed, tier] };
  }

  /** Whether a tier can be claimed at `at`: reached in the season running, not claimed yet. */
  claimable(tier: number, at: Date): boolean {
    const { season } = this.data;
    if (season === null || seasonAt(at)?.season.id !== season) return false;
    return (
      tier >= 1 &&
      tier <= tierReached(seasonById(season).track, this.data.points) &&
      !this.data.claimed.includes(tier)
    );
  }

  /** Reads a save field by field: a field that does not fit falls back to its default, the rest stays. */
  static read(save: InputRecord | null): SeasonProgress {
    if (!save) return new SeasonProgress();
    const season = orElse(() => save.choice('season', SEASON_IDS), null);
    return new SeasonProgress({
      season,
      points: orElse(() => save.number('points', COUNT), 0),
      claimed: season === null ? [] : claimedTiers(save, seasonById(season).track.tiers),
      week: savedDay(save, 'week'),
      deeds: orElse(() => save.number('deeds', COUNT), 0),
      done: orElse(() => save.boolean('done'), false),
    });
  }

  /** Reads any value as a save (see `read`). */
  static parse(value: unknown): SeasonProgress {
    return SeasonProgress.read(orElse(() => InputRecord.from(value, 'season'), null));
  }
}
