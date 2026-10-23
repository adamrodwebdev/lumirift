import { shallowRef, type Ref } from 'vue';
import type { ModeId } from '@/session/ModeId';
import type { Cosmetic, CosmeticKind } from '@/progression/Cosmetics';
import type { GameReport } from '@/progression/GameReport';
import {
  Profile,
  type GameProgress,
  type ObjectiveProgress,
  type ProfileData,
} from '@/progression/Profile';
import { readJson, type KeyValueStorage } from './KeyValueStorage';

export const PROFILE_KEY = 'stackrift:profile';

/**
 * The player's progression, kept on the device only. The interface reads the
 * reactive snapshot; every change goes through the profile, then is saved.
 */
export class ProfileService {
  private readonly profile: Profile;
  private readonly state: Ref<ProfileData>;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly modes: () => readonly ModeId[],
  ) {
    this.profile = Profile.parse(readJson(storage, PROFILE_KEY));
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

  objectivesFor(day: string): readonly ObjectiveProgress[] {
    const objectives = this.profile.objectivesFor(day, this.modes());
    this.save();
    return objectives;
  }

  recordGame(report: GameReport, day: string): GameProgress {
    const progress = this.profile.recordGame(report, day, this.modes());
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
    if (this.profile.markSeen(cosmetics)) this.save();
  }

  private save(): void {
    this.state.value = this.profile.snapshot;
    this.storage.set(PROFILE_KEY, JSON.stringify(this.profile.snapshot));
  }
}
