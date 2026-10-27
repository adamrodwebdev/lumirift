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

  /** Reads saved data, keeping only what is valid. */
  static parse(value: unknown): SeasonProgress {
    if (typeof value !== 'object' || value === null) return new SeasonProgress();
    const record = value as Record<string, unknown>;
    const season = SEASONS.find((each) => each.id === record.season)?.id ?? null;
    const count = (n: unknown) =>
      typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    const tiers = season === null ? 0 : seasonById(season).track.tiers;
    const claimed = Array.isArray(record.claimed)
      ? [
          ...new Set(
            record.claimed.filter(
              (tier: unknown): tier is number =>
                typeof tier === 'number' && Number.isInteger(tier) && tier >= 1 && tier <= tiers,
            ),
          ),
        ]
      : [];
    const week =
      typeof record.week === 'string' && /^\d{8}$/.test(record.week) ? record.week : null;
    return new SeasonProgress({
      season,
      points: count(record.points),
      claimed,
      week,
      deeds: count(record.deeds),
      done: record.done === true,
    });
  }
}
