import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import { timeLeft } from '@/core/Day';
import { findCosmeticByKey } from '@/progression/Cosmetics';
import type { SeasonSpan } from '@/seasons/EventCalendar';
import type { SeasonReward } from '@/seasons/SeasonTrack';
import type { WeekView } from '@/services/SeasonService';
import type { ElementName } from '@/session/Elements';
import { useProgressText } from './useProgressText';

/** Each element's tone (tokens.css): the week's event wears its element's colour. */
export const ELEMENT_TINTS: Readonly<Record<ElementName, string>> = {
  water: 'var(--tone-13)',
  fire: 'var(--tone-14)',
  oil: 'var(--tone-21)',
  ice: 'var(--tone-16)',
  lightning: 'var(--tone-9)',
  seed: 'var(--tone-18)',
  acid: 'var(--tone-19)',
};

/** Words for the seasons and the week's event (1.36). */
export function useSeasonText() {
  const { t } = useI18n();
  const format = useFormat();
  const text = useProgressText();

  const weekName = (week: WeekView): string => t(`events.week.${week.event.element}`);

  /** The week's goal, its number agreeing with its words. */
  const goal = (week: WeekView): string =>
    t(`events.goal.${week.event.element}`, { n: format.number(week.target) }, week.target);

  /** What is left of the week: days, or its last day. */
  const weekLeft = (week: WeekView, now: Date): string => {
    const { days } = timeLeft(week.event.endsAt, now);
    return days > 0 ? t('events.left', { d: format.number(days) }) : t('events.lastDay');
  };

  /** What is left of the season: days, or days and hours near its end. */
  const seasonLeft = (span: SeasonSpan, now: Date): string => {
    const { days, hours } = timeLeft(span.endsAt, now);
    return days >= 2
      ? t('seasons.daysLeft', { n: format.number(days) }, days)
      : t('seasons.left', { d: format.number(days), h: format.number(hours) });
  };

  const title = (span: SeasonSpan): string => text.seasonTitle(span.season.id);

  /** A tier's reward in words: its experience, or its look's name. */
  const reward = (given: SeasonReward): string =>
    given.kind === 'xp'
      ? t('seasons.xp', { n: format.number(given.amount) })
      : text.cosmeticName(findCosmeticByKey(given.key)!);

  return { weekName, goal, weekLeft, seasonLeft, title, reward };
}
