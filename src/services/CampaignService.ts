import { shallowRef, type Ref } from 'vue';
import { CampaignProgress, type CampaignData } from '@/campaign/CampaignProgress';
import type { CampaignOutcome } from '@/campaign/CampaignRun';
import type { UpgradeId } from '@/campaign/Upgrades';
import { readJson, type KeyValueStorage } from './KeyValueStorage';

export const CAMPAIGN_KEY = 'stackrift:campaign';

/**
 * The campaign, kept on the device only. The interface reads the reactive
 * snapshot, and `model` for the derived values; every change goes through
 * the progress, then is saved.
 */
export class CampaignService {
  private readonly progress: CampaignProgress;
  private readonly state: Ref<CampaignData>;

  constructor(private readonly storage: KeyValueStorage) {
    this.progress = CampaignProgress.parse(readJson(storage, CAMPAIGN_KEY));
    this.state = shallowRef(this.progress.snapshot);
  }

  /** Reactive: read it in a computed to follow changes. */
  get current(): CampaignData {
    return this.state.value;
  }

  /** Derived values (stars, ranks, unlocks); read `current` too to stay reactive. */
  get model(): CampaignProgress {
    return this.progress;
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
    this.storage.set(CAMPAIGN_KEY, JSON.stringify(this.progress.snapshot));
  }
}
