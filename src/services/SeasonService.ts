import { shallowRef, type Ref } from 'vue';
import type { GameReport } from '@/progression/GameReport';
import {
  nextSeasonAfter,
  seasonAt,
  weekEventAt,
  type SeasonSpan,
  type WeekEvent,
} from '@/seasons/EventCalendar';
import {
  EMPTY_SEASON_PROGRESS,
  SeasonProgress,
  type SeasonProgressData,
} from '@/seasons/SeasonProgress';
import { tierProgress, tierReached, tiersOf, type SeasonTier } from '@/seasons/SeasonTrack';
import { WEEKLY_GOAL_POINTS, WEEKLY_TARGETS } from '@/seasons/WeeklyGoals';
import { readJson, type KeyValueStorage } from './KeyValueStorage';
import type { ProfileService } from './ProfileService';

export const SEASON_KEY = 'stackrift:season';

/** Where a tier stands: given, reached and waiting for its claim, or still ahead. */
export type SeasonTierState = 'claimed' | 'ready' | 'locked';

export interface SeasonTierView extends SeasonTier {
  readonly state: SeasonTierState;
}

/** The week's event as the player stands in it: its deeds so far, its target, its points. */
export interface WeekView {
  readonly event: WeekEvent;
  readonly deeds: number;
  readonly target: number;
  readonly points: number;
  readonly done: boolean;
}

/** The season as the player sees it, at a moment. */
export interface SeasonView {
  /** The season running, or null (before the first, after the last). */
  readonly span: SeasonSpan | null;
  /** The next season to start, or null. */
  readonly next: SeasonSpan | null;
  readonly points: number;
  /** The tier reached (0: none yet), and how far into the next. */
  readonly tier: number;
  readonly into: number;
  readonly needed: number;
  readonly tiers: readonly SeasonTierView[];
  /** Tiers reached and not claimed yet. */
  readonly ready: number;
  readonly week: WeekView | null;
}

/** The season at `at`, from a progress that may lag behind the calendar (a new season, a new week). */
export function seasonView(saved: SeasonProgressData, at: Date): SeasonView {
  const span = seasonAt(at);
  const event = weekEventAt(at);
  const data =
    span && saved.season === span.season.id ? saved : { ...EMPTY_SEASON_PROGRESS, season: null };
  const fresh = event?.key !== data.week;
  const next = nextSeasonAfter(at);
  if (!span) {
    return { span, next, points: 0, tier: 0, into: 0, needed: 0, tiers: [], ready: 0, week: null };
  }
  const { track } = span.season;
  const tier = tierReached(track, data.points);
  const tiers = tiersOf(track).map((each): SeasonTierView => ({
    ...each,
    state: data.claimed.includes(each.tier) ? 'claimed' : each.tier <= tier ? 'ready' : 'locked',
  }));
  return {
    span,
    next,
    points: data.points,
    tier,
    ...tierProgress(track, data.points),
    tiers,
    ready: tiers.filter((each) => each.state === 'ready').length,
    week: event
      ? {
          event,
          deeds: fresh ? 0 : data.deeds,
          target: WEEKLY_TARGETS[event.element],
          points: WEEKLY_GOAL_POINTS,
          done: !fresh && data.done,
        }
      : null,
  };
}

/**
 * The seasons on the injected clock (1.36): the points each game brings,
 * the week's goal, the claims of the track's rewards (given through the
 * profile). Kept on the device; the screens read `view`, which follows the
 * saved progress, the time read at each call.
 */
export class SeasonService {
  private readonly progress: SeasonProgress;
  private readonly state: Ref<SeasonProgressData>;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly profile: Pick<ProfileService, 'receive'>,
    private readonly clock: () => Date,
  ) {
    this.progress = SeasonProgress.parse(readJson(storage, SEASON_KEY));
    this.state = shallowRef(this.progress.snapshot);
  }

  /** The season now. */
  get view(): SeasonView {
    return seasonView(this.state.value, this.clock());
  }

  /** The season follows the calendar: a season over gives what was left unclaimed; a new one starts. */
  catchUp(): void {
    const now = this.clock();
    for (const reward of this.progress.leftBehind(now)) this.profile.receive(reward);
    this.progress.catchUp(now);
    this.save();
  }

  /** A finished game: its experience as season points, its deeds for the week's goal. */
  recordGame(report: GameReport, xp: number): void {
    this.catchUp();
    this.progress.recordGame(report, xp, this.clock());
    this.save();
  }

  /** A tier's reward claimed: given once, to the player's profile. */
  claim(tier: number): void {
    const now = this.clock();
    const span = seasonAt(now);
    if (!span || !this.progress.claimable(tier, now)) return;
    const reward = tiersOf(span.season.track)[tier - 1]!.reward;
    this.progress.claim(tier, now);
    this.profile.receive(reward);
    this.save();
  }

  /** Every tier reached and waiting, claimed at once. */
  claimAll(): void {
    for (const { tier, state } of this.view.tiers) if (state === 'ready') this.claim(tier);
  }

  private save(): void {
    this.state.value = this.progress.snapshot;
    this.storage.set(SEASON_KEY, JSON.stringify(this.progress.snapshot));
  }
}
