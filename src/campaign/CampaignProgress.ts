import { InputRecord, orElse } from '@/core/input';
import { LEVELS, type CampaignLevel } from './Levels';
import {
  MAX_RANK,
  nextRankCost,
  RANK_COSTS,
  UPGRADE_IDS,
  type UpgradeId,
  type UpgradeRanks,
} from './Upgrades';

/** What the campaign keeps: the best stars of each level, the ranks bought. */
export interface CampaignData {
  readonly stars: Readonly<Record<string, number>>;
  readonly ranks: UpgradeRanks;
}

export const EMPTY_CAMPAIGN: CampaignData = { stars: {}, ranks: {} };

/** Stars spent to reach a rank (1 to 3). */
const spentFor = (rank: number) => RANK_COSTS.slice(0, rank).reduce((sum, cost) => sum + cost, 0);

/** A level won keeps one to three stars; an upgrade bought, one rank to the top. */
const STARS = { min: 1, max: 3, integer: true } as const;
const RANK = { min: 1, max: MAX_RANK, integer: true } as const;

/**
 * The player's campaign: stars won level by level (the best result counts),
 * levels unlocked in order, and the upgrades bought with the stars. Changes
 * only through intentions (`record`, `buy`, `refund`).
 */
export class CampaignProgress {
  private data: CampaignData;

  constructor(data: CampaignData = EMPTY_CAMPAIGN) {
    this.data = data;
  }

  get snapshot(): CampaignData {
    return this.data;
  }

  starsOf(levelId: string): number {
    return this.data.stars[levelId] ?? 0;
  }

  get totalStars(): number {
    return Object.values(this.data.stars).reduce((sum, stars) => sum + stars, 0);
  }

  get spentStars(): number {
    return UPGRADE_IDS.reduce((sum, id) => sum + spentFor(this.rankOf(id)), 0);
  }

  /** Stars left to spend on upgrades. */
  get availableStars(): number {
    return this.totalStars - this.spentStars;
  }

  rankOf(id: UpgradeId): number {
    return this.data.ranks[id] ?? 0;
  }

  /** A level opens when the one before it is won (the first is always open). */
  isUnlocked(level: CampaignLevel): boolean {
    const index = LEVELS.indexOf(level);
    return index <= 0 || this.starsOf(LEVELS[index - 1]!.id) > 0;
  }

  /** The first level not won yet (where "Continue" leads), or the last one. */
  get nextLevel(): CampaignLevel {
    return LEVELS.find((level) => this.starsOf(level.id) === 0) ?? LEVELS[LEVELS.length - 1]!;
  }

  /** Keeps the best result of a level; returns the stars gained. */
  record(levelId: string, stars: number): number {
    const before = this.starsOf(levelId);
    if (stars <= before) return 0;
    this.data = { ...this.data, stars: { ...this.data.stars, [levelId]: stars } };
    return stars - before;
  }

  canBuy(id: UpgradeId): boolean {
    const cost = nextRankCost(this.rankOf(id));
    return cost !== null && cost <= this.availableStars;
  }

  /** Buys the next rank of an upgrade; false when at the top or too expensive. */
  buy(id: UpgradeId): boolean {
    if (!this.canBuy(id)) return false;
    this.data = { ...this.data, ranks: { ...this.data.ranks, [id]: this.rankOf(id) + 1 } };
    return true;
  }

  /** Gives every star back, to try other upgrades. */
  refund(): void {
    this.data = { ...this.data, ranks: {} };
  }

  /**
   * Reads a save by the levels and upgrades the game has: each a whole
   * number in its range, or left out (the others stay).
   */
  static read(save: InputRecord | null): CampaignProgress {
    const stars = save && orElse(() => save.record('stars'), null);
    const ranks = save && orElse(() => save.record('ranks'), null);
    const cleanStars: Record<string, number> = {};
    for (const { id } of LEVELS) {
      const n = stars && orElse(() => stars.number(id, STARS), null);
      if (n !== null) cleanStars[id] = n;
    }
    const cleanRanks: Partial<Record<UpgradeId, number>> = {};
    for (const id of UPGRADE_IDS) {
      const n = ranks && orElse(() => ranks.number(id, RANK), null);
      if (n !== null) cleanRanks[id] = n;
    }
    const progress = new CampaignProgress({ stars: cleanStars, ranks: cleanRanks });
    // Ranks bought with stars that are no longer there (corrupt save): give them back.
    if (progress.availableStars < 0) progress.refund();
    return progress;
  }

  /** Reads any value as a save (see `read`). */
  static parse(value: unknown): CampaignProgress {
    return CampaignProgress.read(orElse(() => InputRecord.from(value, 'campaign'), null));
  }
}
