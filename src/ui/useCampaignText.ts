import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { CampaignLevel } from '@/campaign/Levels';
import { upgradeById, type Upgrade, type UpgradeId } from '@/campaign/Upgrades';
import type { FamilyId, ModeId } from '@/session/ModeId';

/** Which upgrades help in a given mode. */
export function upgradeHelps(upgrade: Upgrade, modeId: ModeId, family: FamilyId): boolean {
  switch (upgrade.scope) {
    case 'all':
      return true;
    case 'falling':
      return family === 'falling' || family === 'volume' || family === 'sand';
    case 'sand':
      return modeId === 'sand';
    case 'mosaic':
      return modeId === 'mosaic';
    case 'rhythm':
      return modeId === 'rhythm';
    case 'duel':
      return modeId === 'duel';
  }
}

/** Words for the campaign: goals, star rules, upgrades. */
export function useCampaignText() {
  const { t } = useI18n();
  const format = useFormat();
  const duration = format.duration;

  const goal = ({ goal, variant }: CampaignLevel): string =>
    t(
      `campaign.goal.${goal.kind}`,
      {
        n: format.number(goal.target),
        time: duration(goal.target),
        ai: variant ? t(`variants.duel.${variant}`) : '',
      },
      goal.target,
    );

  const stars = ({ stars: rule }: CampaignLevel): string => {
    switch (rule.kind) {
      case 'timeLeft':
        return t('campaign.starRule.timeLeft');
      case 'lines':
        return t('campaign.starRule.lines', { two: rule.two, three: rule.three });
      case 'fast':
        return t('campaign.starRule.fast', {
          two: duration(rule.twoMs),
          three: duration(rule.threeMs),
        });
    }
  };

  const upgradeName = (id: UpgradeId) => t(`upgrades.${id}.name`);
  const upgradeEffect = (id: UpgradeId, rank: number) =>
    t(`upgrades.${id}.effect`, { value: upgradeById(id).value(rank) });

  return { goal, stars, upgradeName, upgradeEffect, duration };
}
