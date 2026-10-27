import type { ElementName } from '@/session/Elements';
import { SEASONS, type SeasonData, type SeasonId } from './SeasonData';

/*
 * The events' calendar (1.36), from the date alone, with no server: weeks
 * run from Monday midnight UTC, so that every device, in every time zone,
 * is in the same week and the same season at the same moment.
 */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Midnight UTC of a day's key (YYYYMMDD). */
export function utcDate(key: string): Date {
  return new Date(
    Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6))),
  );
}

/** The UTC day of a moment, as a key (YYYYMMDD). */
export function utcDayKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}${month}${day}`;
}

/** The Monday, midnight UTC, that starts the week of a moment. */
export function weekStartUtc(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnight - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

/** A season in time: its data, when it starts and when it ends (exclusive). */
export interface SeasonSpan {
  readonly season: SeasonData & { readonly id: SeasonId };
  readonly startsAt: Date;
  readonly endsAt: Date;
}

const spanOf = (season: (typeof SEASONS)[number]): SeasonSpan => {
  const startsAt = utcDate(season.start);
  return {
    season,
    startsAt,
    endsAt: new Date(startsAt.getTime() + season.weeks.length * WEEK_MS),
  };
};

/** Every season in time, in order. */
export const SEASON_SPANS: readonly SeasonSpan[] = SEASONS.map(spanOf);

/** The season running at a moment, or null (before the first, after the last). */
export function seasonAt(date: Date): SeasonSpan | null {
  const t = date.getTime();
  return (
    SEASON_SPANS.find(({ startsAt, endsAt }) => t >= startsAt.getTime() && t < endsAt.getTime()) ??
    null
  );
}

/** The next season to start after a moment, or null. */
export function nextSeasonAfter(date: Date): SeasonSpan | null {
  return SEASON_SPANS.find(({ startsAt }) => startsAt.getTime() > date.getTime()) ?? null;
}

/** Whether a season has started by a moment (its looks show from then on). */
export function seasonStarted(id: SeasonId, at: Date): boolean {
  const span = SEASON_SPANS.find((each) => each.season.id === id);
  return span !== undefined && span.startsAt.getTime() <= at.getTime();
}

/** The season a look belongs to (`kind.id`), or null for the game's own. */
export function seasonOfLook(key: string): SeasonId | null {
  return (
    SEASONS.find((season) => season.looks.some((look) => `${look.kind}.${look.id}` === key))?.id ??
    null
  );
}

/**
 * A look shows in the Atelier: the game's always, a season's once its
 * season has started (or once the player has it): no look months ahead.
 */
export function lookShown(key: string, at: Date, owned: boolean): boolean {
  const season = seasonOfLook(key);
  return season === null || owned || seasonStarted(season, at);
}

/** The seasons over by a moment, the latest first. */
export function seasonsOverAt(date: Date): readonly SeasonSpan[] {
  return SEASON_SPANS.filter(({ endsAt }) => endsAt.getTime() <= date.getTime()).reverse();
}

/**
 * The looks of the seasons over by a moment (`kind.id`), the latest season
 * first: their tracks' (never a crown, which its set brings). The day-7 gift
 * gives them before any other, so that a player who missed one still gets it.
 */
export function seasonLooksOverAt(date: Date): readonly string[] {
  return seasonsOverAt(date).flatMap(({ season }) => Object.values(season.track.looks));
}

/** The week's event: its element, in the week of a season. */
export interface WeekEvent {
  readonly span: SeasonSpan;
  /** The week's key: its Monday, UTC (YYYYMMDD). */
  readonly key: string;
  /** Its place in the season, from 0. */
  readonly index: number;
  readonly element: ElementName;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** The week's event at a moment, or null outside the seasons. */
export function weekEventAt(date: Date): WeekEvent | null {
  const span = seasonAt(date);
  if (!span) return null;
  const startsAt = weekStartUtc(date);
  const index = Math.round((startsAt.getTime() - span.startsAt.getTime()) / WEEK_MS);
  const element = span.season.weeks[index];
  if (element === undefined) return null;
  return {
    span,
    key: utcDayKey(startsAt),
    index,
    element,
    startsAt,
    endsAt: new Date(startsAt.getTime() + WEEK_MS),
  };
}
