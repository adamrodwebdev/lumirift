import { useI18n } from 'vue-i18n';
import type { Cosmetic } from '@/progression/Cosmetics';
import type { Objective } from '@/progression/Objectives';
import { SEASONS, type SeasonId } from '@/seasons/SeasonData';

/** Words for the progression: objectives, cosmetics and how to earn them. */
export function useProgressText() {
  const { t } = useI18n();

  // The words agree with the number the sentence counts: the size when there
  // is one (3 lines at once), the target otherwise (6 games). `n` goes as text:
  // vue-i18n would take a number named `n` for the plural, whatever is asked.
  const objective = (o: Objective): string =>
    t(
      `objectives.${o.kind}`,
      {
        n: String(o.target),
        size: o.size ?? 0,
        mode: o.mode ? t(`modes.${o.mode}.name`) : '',
      },
      o.size ?? o.target,
    );

  const cosmeticName = (c: Cosmetic): string => t(`cosmetics.${c.kind}.${c.id}`);

  /** A season's title (1.36): "Preseason", or "Season 1 · Embers". */
  const seasonTitle = (id: SeasonId): string => {
    const season = SEASONS.find((each) => each.id === id)!;
    return season.number === 0
      ? t('seasons.preseason.name')
      : t('seasons.title', { n: season.number, name: t(`seasons.${id}.name`) });
  };

  const unlockRule = ({ unlock }: Cosmetic): string => {
    if (unlock.by === 'default') return t('cosmetics.unlock.default');
    if (unlock.by === 'boss') return t(`bosses.${unlock.value}.defeat`);
    if (unlock.by === 'collection') {
      return t('cosmetics.unlock.collection', { name: t(`collections.${unlock.value}.name`) });
    }
    if (unlock.by === 'season') {
      return t('cosmetics.unlock.season', { name: seasonTitle(unlock.value) });
    }
    return t(`cosmetics.unlock.${unlock.by}`, { n: unlock.value }, unlock.value);
  };

  /** The rule on a small card: a Guardian's look names the Guardian, a season's its season. */
  const unlockHint = (cosmetic: Cosmetic): string =>
    cosmetic.unlock.by === 'boss'
      ? t(`bosses.${cosmetic.unlock.value}.name`)
      : cosmetic.unlock.by === 'season'
        ? seasonTitle(cosmetic.unlock.value)
        : unlockRule(cosmetic);

  return { objective, cosmeticName, seasonTitle, unlockRule, unlockHint };
}
