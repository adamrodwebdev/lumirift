import { shallowRef, type Ref } from 'vue';
import { CampaignProgress, type CampaignData } from '@/campaign/CampaignProgress';
import type { CampaignOutcome } from '@/campaign/CampaignRun';
import type { UpgradeId } from '@/campaign/Upgrades';
import { SAVE_LIMITS } from '@/core/limits';
import type { KeyValueStorage } from './KeyValueStorage';
import { SaveSlot } from './SaveSlot';

export const CAMPAIGN_KEY = 'stackrift:campaign';

/**
 * The campaign, kept on the device only. The interface reads the reactive
 * snapshot, and `model` for the derived values; every change goes through
 * the progress, then is saved.
 */
export class CampaignService {
  private readonly slot: SaveSlot;
  private readonly progress: CampaignProgress;
  private readonly state: Ref<CampaignData>;

  constructor(storage: KeyValueStorage) {
    this.slot = new SaveSlot(storage, CAMPAIGN_KEY, SAVE_LIMITS.campaign);
    this.progress = CampaignProgress.read(this.slot.saved);
    this.state = shallowRef(this.progress.snapshot);
  }

  /** Reactive: read it in a computed to follow changes. */
  get current(): CampaignData {
    return this.state.value;
  }

  /** Derived values (stars, ranks, unlocks), reactive: rebuilt from the snapshot. */
  get model(): CampaignProgress {
    return new CampaignProgress(this.state.value);
  }

  /** Records a won level; returns the stars gained. */
  record(outcome: CampaignOutcome): number {
    if (!outcome.won) return 0;
    const gained = this.progress.record(outcome.levelId, outcome.stars);
    if (gained > 0) this.save();
    return gained;
  }

  buy(id: UpgradeId): boolean {
    const done = this.progress.buy(id);
    if (done) this.save();
    return done;
  }

  refund(): void {
    this.progress.refund();
    this.save();
  }

  private save(): void {
    this.state.value = this.progress.snapshot;
    this.slot.write(this.progress.snapshot);
  }
}
