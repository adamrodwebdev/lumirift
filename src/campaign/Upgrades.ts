import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import type { FamilyId, ModeId } from '@/session/ModeId';
import type { CampaignLevel } from './Levels';

export const UPGRADE_IDS = [
  'hourglass',
  'feather',
  'spyglass',
  'anchor',
  'prism',
  'phoenix',
  'satchel',
  'ember',
  'metronome',
  'rampart',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const MAX_RANK = 3;
/** Stars a rank costs: the first, the second, the third. */
export const RANK_COSTS: readonly number[] = [2, 3, 5];

/** Which families an upgrade helps, for the shop's labels. */
export type UpgradeScope = 'all' | 'falling' | 'sand' | 'mosaic' | 'rhythm' | 'duel';

/** Where each scope helps: every mode, the families with a fall, or one mode. */
const SCOPE_HELPS: Readonly<Record<UpgradeScope, (modeId: ModeId, family: FamilyId) => boolean>> = {
  all: () => true,
  falling: (_, family) => family === 'falling' || family === 'volume' || family === 'sand',
  sand: (modeId) => modeId === 'sand',
  mosaic: (modeId) => modeId === 'mosaic',
  rhythm: (modeId) => modeId === 'rhythm',
  duel: (modeId) => modeId === 'duel',
};

export interface Upgrade {
  readonly id: UpgradeId;
  readonly scope: UpgradeScope;
  /** What a rank (1 to 3) changes; rank 0 changes nothing. */
  apply(boosts: Boosts, rank: number): Boosts;
  /** The value of a rank, for the shop's text (seconds, percent, count…). */
  value(rank: number): number;
}

const upgrade = (
  id: UpgradeId,
  scope: UpgradeScope,
  values: readonly [number, number, number],
  apply: (boosts: Boosts, value: number) => Boosts,
): Upgrade => ({
  id,
  scope,
  value: (rank) => (rank <= 0 ? 0 : values[Math.min(rank, MAX_RANK) - 1]!),
  apply(boosts, rank) {
    return rank <= 0 ? boosts : apply(boosts, this.value(rank));
  },
});

/**
 * The ten campaign upgrades, three ranks each, bought with stars. They help,
 * they never play for the player; none of them exists outside the campaign.
 * The hourglass adds time to the clock, the others become `Boosts`.
 */
export const UPGRADES: readonly Upgrade[] = [
  upgrade('hourglass', 'all', [15, 30, 45], (boosts) => boosts),
  upgrade('feather', 'falling', [10, 20, 30], (b, v) => ({ ...b, gravityScale: 1 - v / 100 })),
  upgrade('spyglass', 'falling', [1, 2, 3], (b, v) => ({ ...b, extraPreview: v })),
  upgrade('anchor', 'falling', [100, 200, 300], (b, v) => ({ ...b, extraLockDelayMs: v })),
  upgrade('prism', 'all', [10, 20, 30], (b, v) => ({ ...b, scoreBonus: v / 100 })),
  upgrade('phoenix', 'all', [4, 6, 8], (b, v) => ({ ...b, rescueRows: v })),
  upgrade('satchel', 'mosaic', [1, 2, 3], (b, v) => ({ ...b, startJokers: v })),
  upgrade('ember', 'sand', [3, 6, 9], (b, v) => ({ ...b, fireBonus: v / 100 })),
  upgrade('metronome', 'rhythm', [40, 80, 120], (b, v) => ({ ...b, rhythmWindowMs: v })),
  upgrade('rampart', 'duel', [1, 2, 3], (b, v) => ({ ...b, garbageDelayMs: v * 1000 })),
];

export type UpgradeRanks = Readonly<Partial<Record<UpgradeId, number>>>;

export const upgradeById = (id: UpgradeId): Upgrade => UPGRADES.find((u) => u.id === id)!;

/** The help a set of ranks brings into a game. */
export function boostsFor(ranks: UpgradeRanks): Boosts {
  return UPGRADES.reduce((boosts, u) => u.apply(boosts, ranks[u.id] ?? 0), NO_BOOSTS);
}

/** Seconds the hourglass adds to a timed level. */
export function timeBonusMs(ranks: UpgradeRanks): number {
  return upgradeById('hourglass').value(ranks.hourglass ?? 0) * 1000;
}

/** The clock of a campaign level, hourglass included (null: untimed). */
export function levelTimeMs(level: CampaignLevel, ranks: UpgradeRanks): number | null {
  return level.timeLimitMs === null ? null : level.timeLimitMs + timeBonusMs(ranks);
}

/** Whether an upgrade helps in a mode (the level's shop shows the ones that do). */
export function upgradeHelps(upgrade: Upgrade, modeId: ModeId, family: FamilyId): boolean {
  return SCOPE_HELPS[upgrade.scope](modeId, family);
}

/** Stars the next rank costs, or null at the top. */
export function nextRankCost(rank: number): number | null {
  return rank >= MAX_RANK ? null : RANK_COSTS[rank]!;
}
