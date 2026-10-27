import { daysBetween, previousDay } from '@/core/Day';
import { achievementsOf } from './Achievements';
import { BOSS_IDS, type BossId } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import {
  AMBIANCES,
  COSMETICS,
  cosmeticKey,
  DEFAULT_EQUIPMENT,
  findCosmetic,
  isUnlocked,
  MATERIALS,
  SHATTERS,
  type Achievements,
  type Cosmetic,
  type CosmeticKind,
  type Equipment,
} from './Cosmetics';
import { GIFT_DAYS, WELCOME_BACK_DAYS, WELCOME_BACK_XP } from './DailyGifts';
import {
  DAILY_XP,
  experienceFor,
  GUARDIAN_XP,
  levelProgress,
  streakBonus,
  type XpLine,
} from './Experience';
import { giftReady, nextGift } from './GiftCalendar';
import type { GameReport } from './GameReport';
import type { SeasonReward } from '@/seasons/SeasonTrack';
import {
  advance,
  OBJECTIVE_KINDS,
  OBJECTIVE_TIERS,
  OBJECTIVE_XP,
  objectivesOfDay,
  type Objective,
} from './Objectives';

export interface ObjectiveProgress {
  readonly objective: Objective;
  readonly progress: number;
  readonly done: boolean;
}

/** Days in a row with a daily challenge finished. */
export interface Streak {
  readonly count: number;
  readonly best: number;
  readonly lastDay: string | null;
}

/**
 * The gift calendar (1.35): the day of its cycle given next (0 to 6), the
 * last day a gift was claimed, and the last day the calendar opened by itself.
 */
export interface GiftCycle {
  readonly next: number;
  readonly lastDay: string | null;
  readonly shownDay: string | null;
}

/** Everything the player has earned, as saved on the device. */
export interface ProfileData {
  readonly xp: number;
  readonly games: number;
  readonly objectivesDone: number;
  readonly streak: Streak;
  readonly objectivesDay: string | null;
  readonly objectives: readonly ObjectiveProgress[];
  readonly equipment: Equipment;
  /** The cosmetics the player has looked at in the Atelier (`kind.id`): the others earned are new. */
  readonly seen: readonly string[];
  /** The Guardians of the rift the player has defeated. */
  readonly bosses: readonly BossId[];
  /** The last day a Guardian challenge was played (its first attempt of a day earns a bonus). */
  readonly guardianDay: string | null;
  /** The portals' training is over (won or passed): a portal opens on its menus. */
  readonly trained: boolean;
  /** Real play since the first launch (ms, pauses and menus excluded): the ads' grace reads it. */
  readonly playedMs: number;
  /** The gift calendar (1.35). */
  readonly gifts: GiftCycle;
  /** The looks given outright (`kind.id`): the calendar's, a season's (1.36); the player's whatever their rule. */
  readonly gifted: readonly string[];
  /** The last day the player came to the menu. */
  readonly lastVisit: string | null;
  /** Back after a week away: a gift of welcome waits with the day's. */
  readonly welcomeBack: boolean;
  /** The play when the player came back after a week away: the ads' grace counts from it again. */
  readonly graceFromMs: number;
}

/** What a game brought, for the end-of-game dialog. */
export interface GameProgress {
  readonly xp: readonly XpLine[];
  readonly total: number;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly completed: readonly Objective[];
  readonly unlocked: readonly Cosmetic[];
  readonly streak: number;
}

export const EMPTY_PROFILE: ProfileData = {
  xp: 0,
  games: 0,
  objectivesDone: 0,
  streak: { count: 0, best: 0, lastDay: null },
  objectivesDay: null,
  objectives: [],
  equipment: DEFAULT_EQUIPMENT,
  // What a new player starts with is not news.
  seen: COSMETICS.filter((cosmetic) => cosmetic.unlock.by === 'default').map(cosmeticKey),
  bosses: [],
  guardianDay: null,
  trained: false,
  playedMs: 0,
  gifts: { next: 0, lastDay: null, shownDay: null },
  gifted: [],
  lastVisit: null,
  welcomeBack: false,
  graceFromMs: 0,
};

const COSMETIC_KEYS = new Set(COSMETICS.map(cosmeticKey));

/**
 * The cosmetics earned and not looked at yet: the Atelier marks them new.
 * What every player starts with is never news.
 */
export function newCosmetics(data: ProfileData): readonly Cosmetic[] {
  const achievements = achievementsOf(data);
  const seen = new Set(data.seen);
  return COSMETICS.filter(
    (cosmetic) =>
      cosmetic.unlock.by !== 'default' &&
      isUnlocked(cosmetic, achievements) &&
      !seen.has(cosmeticKey(cosmetic)),
  );
}

/** The day's first Guardian challenge is still to play: it earns its bonus (every day of the week). */
export function guardianBonusOpen(data: ProfileData, day: string): boolean {
  return data.guardianDay !== day;
}

/**
 * The player's progression: experience and level, objectives of the day,
 * streak of daily challenges, and the cosmetics they wear. Changes only
 * through intentions (`recordGame`, `equip`…), which keep it consistent.
 */
export class Profile {
  private data: ProfileData;

  constructor(data: ProfileData = EMPTY_PROFILE) {
    this.data = data;
  }

  get snapshot(): ProfileData {
    return this.data;
  }

  get level(): number {
    return levelProgress(this.data.xp).level;
  }

  get achievements(): Achievements {
    return achievementsOf(this.data);
  }

  isUnlocked(cosmetic: Cosmetic): boolean {
    return isUnlocked(cosmetic, this.achievements);
  }

  /** A new player on a portal starts with the training: no game played, the training not done. */
  get needsTraining(): boolean {
    return !this.data.trained && this.data.games === 0;
  }

  /** The training is over (its last step won, or passed); false when it already was. */
  finishTraining(): boolean {
    if (this.data.trained) return false;
    this.data = { ...this.data, trained: true };
    return true;
  }

  /**
   * The player comes to the menu on `day` (1.35): a player who has played,
   * back after a week or more away, gets a gift of welcome and the ads' grace
   * again. A day earlier than the last visit (a clock turned back, a flight
   * west) changes nothing.
   */
  visit(day: string): void {
    const last = this.data.lastVisit;
    if (last !== null && day <= last) return;
    const away =
      last !== null && this.data.games > 0 && daysBetween(last, day) >= WELCOME_BACK_DAYS;
    this.data = {
      ...this.data,
      lastVisit: day,
      ...(away ? { welcomeBack: true, graceFromMs: this.data.playedMs } : {}),
    };
  }

  /** The calendar opened by itself on `day`: not again that day. */
  markGiftShown(day: string): void {
    this.data = { ...this.data, gifts: { ...this.data.gifts, shownDay: day } };
  }

  /**
   * The gift of `day` is claimed: its experience (twice, an ad watched) or
   * its look, and the gift of welcome waiting; the cycle moves on a day.
   * Nothing on a day already claimed: one gift a local day, whatever the
   * clock does.
   */
  claimGift(day: string, doubled: boolean): void {
    if (!giftReady(this.data, day)) return;
    const gift = nextGift(this.data, day);
    const welcome = this.data.welcomeBack ? WELCOME_BACK_XP : 0;
    const xp = gift.kind === 'xp' ? gift.amount * (doubled ? 2 : 1) : 0;
    const { gifts } = this.data;
    this.data = {
      ...this.data,
      xp: this.data.xp + xp + welcome,
      gifted:
        gift.kind === 'look' ? [...this.data.gifted, cosmeticKey(gift.cosmetic)] : this.data.gifted,
      welcomeBack: false,
      gifts: { ...gifts, next: (gifts.next + 1) % GIFT_DAYS, lastDay: day },
    };
  }

  /**
   * A season's reward is the player's (1.36): its experience, or its look,
   * given outright like the calendar's (`gifted`). A look given twice stays one.
   */
  receive(reward: SeasonReward): void {
    if (reward.kind === 'xp') {
      this.data = { ...this.data, xp: this.data.xp + reward.amount };
    } else if (!this.data.gifted.includes(reward.key)) {
      this.data = { ...this.data, gifted: [...this.data.gifted, reward.key] };
    }
  }

  /** The objectives of the day; a new day brings new ones. */
  objectivesFor(day: string, modes: readonly ModeId[]): readonly ObjectiveProgress[] {
    if (this.data.objectivesDay !== day) {
      this.data = {
        ...this.data,
        objectivesDay: day,
        objectives: objectivesOfDay(day, modes).map((objective) => ({
          objective,
          progress: 0,
          done: false,
        })),
      };
    }
    return this.data.objectives;
  }

  /** Counts a finished game: experience, objectives, streak, unlocks. */
  recordGame(report: GameReport, day: string, modes: readonly ModeId[]): GameProgress {
    const before = this.data;
    const unlockedBefore = new Set(COSMETICS.filter((c) => this.isUnlocked(c)).map(cosmeticKey));
    const levelBefore = this.level;
    const xp = experienceFor(report);

    let streak = before.streak;
    if (report.daily && before.streak.lastDay !== day) {
      // The first daily challenge of the day: bonus, and the streak goes on.
      xp.push({ source: 'daily', amount: DAILY_XP });
      const count = before.streak.lastDay === previousDay(day) ? before.streak.count + 1 : 1;
      streak = { count, best: Math.max(before.streak.best, count), lastDay: day };
      // A step of the streak reached (1.35): its bonus, kept whatever comes next.
      const bonus = streakBonus(count);
      if (bonus > 0) xp.push({ source: 'streak', amount: bonus });
    }
    let guardianDay = before.guardianDay;
    if (report.guardian && guardianBonusOpen(before, day)) {
      // The first Guardian challenge of the day: every day of the week brings it back.
      xp.push({ source: 'guardian', amount: GUARDIAN_XP });
      guardianDay = day;
    }

    const completed: Objective[] = [];
    const objectives = this.objectivesFor(day, modes).map((entry) => {
      if (entry.done) return entry;
      const progress = Math.min(
        entry.objective.target,
        entry.progress + advance(entry.objective, report),
      );
      const done = progress >= entry.objective.target;
      if (done) {
        completed.push(entry.objective);
        xp.push({ source: 'objective', amount: OBJECTIVE_XP[entry.objective.tier] });
      }
      return { objective: entry.objective, progress, done };
    });

    const total = xp.reduce((sum, line) => sum + line.amount, 0);
    this.data = {
      ...this.data,
      xp: before.xp + total,
      games: before.games + 1,
      playedMs: before.playedMs + Math.max(0, Math.round(report.durationMs)),
      objectivesDone: before.objectivesDone + completed.length,
      streak,
      objectives,
      guardianDay,
      bosses:
        report.boss && !before.bosses.includes(report.boss)
          ? [...before.bosses, report.boss]
          : before.bosses,
    };
    const unlocked = COSMETICS.filter(
      (cosmetic) => this.isUnlocked(cosmetic) && !unlockedBefore.has(cosmeticKey(cosmetic)),
    );
    return {
      xp,
      total,
      levelBefore,
      levelAfter: this.level,
      completed,
      unlocked,
      streak: streak.count,
    };
  }

  /**
   * Doubles what a game brought (a rewarded ad watched): its experience once
   * more, as a `bonus` line. A game already doubled, or worth nothing, is
   * returned unchanged.
   */
  doubleExperience(progress: GameProgress): GameProgress {
    if (progress.total <= 0 || progress.xp.some((line) => line.source === 'bonus')) return progress;
    const unlockedBefore = new Set(COSMETICS.filter((c) => this.isUnlocked(c)).map(cosmeticKey));
    this.data = { ...this.data, xp: this.data.xp + progress.total };
    const unlocked = COSMETICS.filter(
      (cosmetic) => this.isUnlocked(cosmetic) && !unlockedBefore.has(cosmeticKey(cosmetic)),
    );
    return {
      ...progress,
      xp: [...progress.xp, { source: 'bonus', amount: progress.total }],
      total: progress.total * 2,
      levelAfter: this.level,
      unlocked: [...progress.unlocked, ...unlocked],
    };
  }

  /**
   * The player has looked at these cosmetics: they are not new any more.
   * Only earned ones count (one still locked will be new once earned).
   * Returns whether anything changed.
   */
  markSeen(cosmetics: readonly Cosmetic[]): boolean {
    const seen = new Set(this.data.seen);
    const fresh = cosmetics
      .filter((cosmetic) => this.isUnlocked(cosmetic))
      .map(cosmeticKey)
      .filter((key) => !seen.has(key));
    if (fresh.length === 0) return false;
    this.data = { ...this.data, seen: [...this.data.seen, ...new Set(fresh)] };
    return true;
  }

  /** Wears a cosmetic; refused when it is not unlocked (or does not exist). */
  equip(kind: CosmeticKind, id: string): boolean {
    const cosmetic = findCosmetic(kind, id);
    if (!cosmetic || !this.isUnlocked(cosmetic)) return false;
    this.data = { ...this.data, equipment: { ...this.data.equipment, [kind]: id } };
    return true;
  }

  /** Reads saved data, keeping only what is valid. */
  static parse(value: unknown): Profile {
    if (typeof value !== 'object' || value === null) return new Profile();
    const record = value as Record<string, unknown>;
    const count = (key: string) => {
      const n = record[key];
      return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };
    const data: ProfileData = {
      xp: count('xp'),
      games: count('games'),
      objectivesDone: count('objectivesDone'),
      streak: parseStreak(record.streak),
      objectivesDay: typeof record.objectivesDay === 'string' ? record.objectivesDay : null,
      objectives: parseObjectives(record.objectives),
      equipment: parseEquipment(record.equipment),
      seen: [],
      bosses: parseBosses(record.bosses),
      guardianDay:
        typeof record.guardianDay === 'string' && /^\d{8}$/.test(record.guardianDay)
          ? record.guardianDay
          : null,
      trained: record.trained === true,
      playedMs: count('playedMs'),
      gifts: parseGifts(record.gifts),
      gifted: Array.isArray(record.gifted)
        ? [
            ...new Set(
              record.gifted.filter(
                (key: unknown): key is string => typeof key === 'string' && COSMETIC_KEYS.has(key),
              ),
            ),
          ]
        : [],
      lastVisit: dayOrNull(record.lastVisit),
      welcomeBack: record.welcomeBack === true,
      graceFromMs: Math.min(count('graceFromMs'), count('playedMs')),
    };
    // Saved before the Atelier marked its new looks: what was earned then is not new.
    const seen = Array.isArray(record.seen)
      ? record.seen.filter(
          (key: unknown): key is string => typeof key === 'string' && COSMETIC_KEYS.has(key),
        )
      : COSMETICS.filter((cosmetic) => isUnlocked(cosmetic, achievementsOf(data))).map(cosmeticKey);
    return new Profile({ ...data, seen: [...new Set(seen)] });
  }
}

/** A day's key (YYYYMMDD), or null. */
function dayOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^\d{8}$/.test(value) ? value : null;
}

function parseGifts(value: unknown): GiftCycle {
  if (typeof value !== 'object' || value === null) return EMPTY_PROFILE.gifts;
  const { next, lastDay, shownDay } = value as Record<string, unknown>;
  return {
    next:
      typeof next === 'number' && Number.isInteger(next) && next >= 0 && next < GIFT_DAYS
        ? next
        : 0,
    lastDay: dayOrNull(lastDay),
    shownDay: dayOrNull(shownDay),
  };
}

function parseBosses(value: unknown): BossId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is BossId => BOSS_IDS.includes(id as BossId));
}

function parseStreak(value: unknown): Streak {
  if (typeof value !== 'object' || value === null) return EMPTY_PROFILE.streak;
  const { count, best, lastDay } = value as Record<string, unknown>;
  const ok = (n: unknown) => (typeof n === 'number' && n >= 0 ? Math.floor(n) : 0);
  return {
    count: ok(count),
    best: ok(best),
    lastDay: typeof lastDay === 'string' && /^\d{8}$/.test(lastDay) ? lastDay : null,
  };
}

function parseObjectives(value: unknown): ObjectiveProgress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { objective, progress, done } = entry as Record<string, unknown>;
    if (typeof objective !== 'object' || objective === null) return [];
    const o = objective as Record<string, unknown>;
    const kind = OBJECTIVE_KINDS.find((k) => k === o.kind);
    const tier = OBJECTIVE_TIERS.find((t) => t === o.tier);
    if (!kind || !tier || typeof o.target !== 'number') return [];
    return [
      {
        objective: {
          kind,
          tier,
          target: o.target,
          ...(typeof o.mode === 'string' ? { mode: o.mode as ModeId } : {}),
          ...(typeof o.size === 'number' ? { size: o.size } : {}),
        },
        progress: typeof progress === 'number' ? progress : 0,
        done: done === true,
      },
    ];
  });
}

function parseEquipment(value: unknown): Equipment {
  if (typeof value !== 'object' || value === null) return DEFAULT_EQUIPMENT;
  const { material, ambiance, shatter } = value as Record<string, unknown>;
  return {
    material: MATERIALS.find((id) => id === material) ?? DEFAULT_EQUIPMENT.material,
    ambiance: AMBIANCES.find((id) => id === ambiance) ?? DEFAULT_EQUIPMENT.ambiance,
    shatter: SHATTERS.find((id) => id === shatter) ?? DEFAULT_EQUIPMENT.shatter,
  };
}
