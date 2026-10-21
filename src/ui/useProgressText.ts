import { useI18n } from 'vue-i18n';
import type { Cosmetic } from '@/progression/Cosmetics';
import type { Objective } from '@/progression/Objectives';

/** Words for the progression: objectives, cosmetics and how to earn them. */
export function useProgressText() {
  const { t } = useI18n();

  const objective = (o: Objective): string =>
    t(
      `objectives.${o.kind}`,
      {
        n: o.target,
        size: o.size ?? 0,
        mode: o.mode ? t(`modes.${o.mode}.name`) : '',
      },
      o.target,
    );

  const cosmeticName = (c: Cosmetic): string => t(`cosmetics.${c.kind}.${c.id}`);

  const unlockRule = ({ unlock }: Cosmetic): string => {
    if (unlock.by === 'default') return t('cosmetics.unlock.default');
    if (unlock.by === 'boss') {
      return t('cosmetics.unlock.boss', { name: t(`bosses.${unlock.value}.name`) });
    }
    return t(`cosmetics.unlock.${unlock.by}`, { n: unlock.value }, unlock.value);
  };

  return { objective, cosmeticName, unlockRule };
}
