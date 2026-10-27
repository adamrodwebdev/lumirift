import { previousDay } from '@/core/Day';
import { achievementsOf } from './Achievements';
import { isUnlocked, type Cosmetic } from './Cosmetics';
import { GIFT_DAYS, giftOf, type Gift } from './DailyGifts';
import type { ProfileData } from './Profile';

/** Where a day of the calendar stands: given, today's, tomorrow's (today's claimed), to come. */
export type GiftDayState = 'claimed' | 'today' | 'tomorrow' | 'coming';

export interface GiftDay {
  /** Its place in the cycle, from 0. */
  readonly index: number;
  readonly gift: Gift;
  readonly state: GiftDayState;
}

/** The calendar as the player sees it on a day (1.35). */
export interface GiftCalendar {
  /** The player has played: the calendar has begun (it never shows before). */
  readonly started: boolean;
  readonly days: readonly GiftDay[];
  /** The day of the cycle given next (0 to 6). */
  readonly next: number;
  /** A gift waits today. */
  readonly ready: boolean;
  /** Back after a week away: a gift of welcome comes with the day's. */
  readonly welcome: boolean;
  /** Days in a row with the daily challenge, still alive today. */
  readonly streak: number;
}

/** A gift is there to claim on `day`: once the player has played, once a local day. */
export function giftReady(data: ProfileData, day: string): boolean {
  const { lastDay } = data.gifts;
  return data.games > 0 && (lastDay === null || day > lastDay);
}

/** The calendar opens by itself once a day, when its gift is there. */
export function giftOpensItself(data: ProfileData, day: string): boolean {
  return giftReady(data, day) && data.gifts.shownDay !== day;
}

/** Whether a look is the player's, in saved data. */
const owns =
  (data: ProfileData) =>
  (cosmetic: Cosmetic): boolean =>
    isUnlocked(cosmetic, achievementsOf(data));

/** The gift given next: the day of the cycle's (a look on the seventh). */
export function nextGift(data: ProfileData): Gift {
  return giftOf(data.gifts.next, owns(data));
}

/** The daily streak as it stands on `day`: broken once a day went by without the challenge. */
export function currentStreak(data: ProfileData, day: string): number {
  const { count, lastDay } = data.streak;
  return lastDay === day || lastDay === previousDay(day) ? count : 0;
}

/**
 * The calendar as its window keeps it right after a claim, until it closes:
 * the week still in view, the day's tile ticked and the next one tomorrow's
 * (the seventh day claimed, the new week waits for the next opening).
 */
export function justClaimed(calendar: GiftCalendar): GiftCalendar {
  const { next } = calendar;
  const stateOf = (day: GiftDay): GiftDayState =>
    day.index === next ? 'claimed' : day.index === next + 1 ? 'tomorrow' : day.state;
  return {
    ...calendar,
    ready: false,
    days: calendar.days.map((day) => ({ ...day, state: stateOf(day) })),
  };
}

/** The seven days, as the calendar shows them on `day`. */
export function giftCalendar(data: ProfileData, day: string): GiftCalendar {
  const { next } = data.gifts;
  const ready = giftReady(data, day);
  const look = owns(data);
  const stateOf = (index: number): GiftDayState =>
    index < next ? 'claimed' : index > next ? 'coming' : ready ? 'today' : 'tomorrow';
  return {
    started: data.games > 0,
    days: Array.from({ length: GIFT_DAYS }, (_, index) => ({
      index,
      gift: giftOf(index, look),
      state: stateOf(index),
    })),
    next,
    ready,
    welcome: data.welcomeBack,
    streak: currentStreak(data, day),
  };
}
