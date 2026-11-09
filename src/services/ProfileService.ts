import { shallowRef, type Ref } from 'vue';
import type { Cosmetic, CosmeticKind } from '@/progression/Cosmetics';
import type { GameReport } from '@/progression/GameReport';
import type { ObjectivePlace } from '@/progression/Objectives';
import {
  Profile,
  type GameProgress,
  type ObjectiveProgress,
  type ProfileData,
} from '@/progression/Profile';
import type { SeasonReward } from '@/seasons/SeasonTrack';
import { SAVE_LIMITS } from '@/core/limits';
import type { KeyValueStorage } from './KeyValueStorage';
import { SaveSlot } from './SaveSlot';

export const PROFILE_KEY = 'stackrift:profile';

/**
 * The player's progression, kept on the device only. The interface reads the
 * reactive snapshot; every change goes through the profile, then is saved:
 * written for the player's progress, noted for what the game marks by itself
 * (a visit, the day's objectives, a look seen), which never replaces a
 * profile it could not read.
 */
export class ProfileService {
  private readonly slot: SaveSlot;
  private readonly profile: Profile;
  private readonly state: Ref<ProfileData>;

  constructor(
    storage: KeyValueStorage,
    /** Where the objectives are played: the open modes, a daily challenge or not. */
    private readonly place: () => ObjectivePlace,
  ) {
    this.slot = new SaveSlot(storage, PROFILE_KEY, SAVE_LIMITS.profile);
    this.profile = Profile.read(this.slot.saved);
    this.state = shallowRef(this.profile.snapshot);
  }

  /** Read-only and reactive. */
  get current(): ProfileData {
    return this.state.value;
  }

  get level(): number {
    return this.profile.level;
  }

  /** A new player on a portal starts with the training. */
  get needsTraining(): boolean {
    return this.profile.needsTraining;
  }

  /** The training is over: its last step won, or passed. */
  finishTraining(): void {
    if (this.profile.finishTraining()) this.save();
  }

  /** Whether a cosmetic is the player's (worn, or there to wear). */
  isUnlocked(cosmetic: Cosmetic): boolean {
    return this.profile.isUnlocked(cosmetic);
  }

  /** The player comes to the menu on `day` (1.35): a week away brings a gift of welcome. */
  visit(day: string): void {
    this.profile.visit(day);
    this.note();
  }

  /** The gift calendar opened by itself on `day`. */
  markGiftShown(day: string): void {
    this.profile.markGiftShown(day);
    this.note();
  }

  /** The gift of `day` is claimed: its experience twice when an ad was watched. */
  claimGift(day: string, doubled: boolean): void {
    this.profile.claimGift(day, doubled);
    this.save();
  }

  /** A season's reward is the player's (1.36): its experience or its look. */
  receive(reward: SeasonReward): void {
    this.profile.receive(reward);
    this.save();
  }

  objectivesFor(day: string): readonly ObjectiveProgress[] {
    const objectives = this.profile.objectivesFor(day, this.place());
    this.note();
    return objectives;
  }

  recordGame(report: GameReport, day: string): GameProgress {
    const progress = this.profile.recordGame(report, day, this.place());
    this.save();
    return progress;
  }

  /** A rewarded ad was watched: the game's experience counts twice. */
  doubleExperience(progress: GameProgress): GameProgress {
    const doubled = this.profile.doubleExperience(progress);
    if (doubled !== progress) this.save();
    return doubled;
  }

  equip(kind: CosmeticKind, id: string): boolean {
    const done = this.profile.equip(kind, id);
    if (done) this.save();
    return done;
  }

  /** The player has looked at these cosmetics in the Atelier. */
  markSeen(cosmetics: readonly Cosmetic[]): void {
    if (this.profile.markSeen(cosmetics)) this.note();
  }

  /** The player's progress: saved, even over a profile that could not be read. */
  private save(): void {
    this.state.value = this.profile.snapshot;
    this.slot.write(this.profile.snapshot);
  }

  /** What the game marks by itself: saved, never over a profile that could not be read. */
  private note(): void {
    this.state.value = this.profile.snapshot;
    this.slot.note(this.profile.snapshot);
  }
}
