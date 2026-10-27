import { dayKey } from '@/core/Day';
import { giftCalendar, giftOpensItself, type GiftCalendar } from '@/progression/GiftCalendar';
import type { ProfileService } from './ProfileService';

/**
 * The gift calendar on the injected clock (1.35): the visit of the menu, the
 * day's gift and its claim, one a local day. The screens read `calendar`,
 * which follows the saved profile; the day is the clock's at each call, so a
 * calendar left open past midnight claims the new day's gift.
 */
export class GiftService {
  constructor(
    private readonly profile: ProfileService,
    private readonly clock: () => Date,
  ) {}

  /** The calendar on the player's day. */
  get calendar(): GiftCalendar {
    return giftCalendar(this.profile.current, this.today());
  }

  /** The calendar opens by itself: its gift waits, and it has not opened today. */
  get opensItself(): boolean {
    return giftOpensItself(this.profile.current, this.today());
  }

  /** The player comes to the menu: a week away brings its gift of welcome. */
  visit(): void {
    this.profile.visit(this.today());
  }

  /** The calendar opened by itself: not again today. */
  markShown(): void {
    this.profile.markGiftShown(this.today());
  }

  /** The day's gift is claimed: its experience twice when an ad was watched. */
  claim(doubled: boolean): void {
    this.profile.claimGift(this.today(), doubled);
  }

  private today(): string {
    return dayKey(this.clock());
  }
}
