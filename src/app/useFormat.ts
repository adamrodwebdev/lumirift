import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Indicator, ResultKind } from '@/session/GameSession';

/** Numbers, durations and dates in the current language. */
export function useFormat() {
  const { locale } = useI18n();
  const numbers = computed(() => new Intl.NumberFormat(locale.value));
  const twoDigits = computed(
    () => new Intl.NumberFormat(locale.value, { minimumIntegerDigits: 2 }),
  );
  const dates = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }));

  const number = (value: number): string => numbers.value.format(Math.round(value));

  /** "1:05" — minutes and seconds, rounded down like a stopwatch. */
  const duration = (ms: number): string => {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${numbers.value.format(Math.floor(seconds / 60))}:${twoDigits.value.format(seconds % 60)}`;
  };

  const indicator = (item: Indicator): string =>
    item.format === 'duration' ? duration(item.value) : number(item.value);

  const result = (kind: ResultKind, value: number): string =>
    kind === 'time' ? duration(value) : number(value);

  const date = (value: Date): string => dates.value.format(value);

  return { number, duration, indicator, result, date };
}
