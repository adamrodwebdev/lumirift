import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { CampaignLevel, StarRule } from '@/campaign/Levels';
import { upgradeById, type UpgradeId } from '@/campaign/Upgrades';

type StarRuleOf<K extends StarRule['kind']> = Extract<StarRule, { kind: K }>;

/** Words for the campaign: goals, star rules, upgrades. */
export function useCampaignText() {
  const { t } = useI18n();
  const format = useFormat();
  const duration = format.duration;

  // In Sand, what clears is a region linking both walls, not a line. A
  // Guardian's goal is a sentence of its own: its name takes an article
  // (l’Œil) or a case (Песчаного червя) that no placeholder could give it.
  const goal = ({ goal, variant, modeId, boss }: CampaignLevel): string => {
    const { kind } = goal;
    if (kind === 'boss') return boss ? t(`bosses.${boss}.defeat`) : '';
    return t(
      `campaign.goal.${kind === 'lines' && modeId === 'sand' ? 'regions' : kind}`,
      {
        n: format.number(goal.target),
        time: duration(goal.target),
        ai: variant ? t(`variants.duel.${variant}`) : '',
      },
      goal.target,
    );
  };

  /** The words of each star rule (the rules themselves: CampaignRun's STAR_RULES). */
  const STAR_TEXT: { readonly [K in StarRule['kind']]: (rule: StarRuleOf<K>) => string } = {
    timeLeft: () => t('campaign.starRule.timeLeft'),
    lines: (rule) => t('campaign.starRule.lines', { two: rule.two, three: rule.three }),
    fast: (rule) =>
      t('campaign.starRule.fast', { two: duration(rule.twoMs), three: duration(rule.threeMs) }),
  };
  const stars = ({ stars: rule }: CampaignLevel): string =>
    (STAR_TEXT[rule.kind] as (rule: StarRule) => string)(rule);

  const upgradeName = (id: UpgradeId) => t(`upgrades.${id}.name`);
  // The value also picks the plural of the words that count (1 joker, 2 jokers).
  const upgradeEffect = (id: UpgradeId, rank: number) => {
    const value = upgradeById(id).value(rank);
    return t(`upgrades.${id}.effect`, { value }, value);
  };

  return { goal, stars, upgradeName, upgradeEffect, duration };
}
