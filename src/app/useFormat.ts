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
  const percents = computed(
    () => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }),
  );
  const dates = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }));
  const factors = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }));
  const millis = computed(
    () => new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'millisecond' }),
  );

  const number = (value: number): string => numbers.value.format(Math.round(value));

  /** "1:05" — minutes and seconds, rounded down like a stopwatch. */
  const duration = (ms: number): string => {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${numbers.value.format(Math.floor(seconds / 60))}:${twoDigits.value.format(seconds % 60)}`;
  };

  /** "90 %" — a share given from 0 to 100, rounded down. */
  const percent = (value: number): string => percents.value.format(Math.floor(value) / 100);

  /** "×1.4", a multiplier. */
  const factor = (value: number): string => `×${factors.value.format(value)}`;

  const indicator = (item: Indicator): string => {
    if (item.format === 'duration') return duration(item.value);
    if (item.format === 'percent') return percent(item.value);
    if (item.format === 'factor') return factor(item.value);
    return number(item.value);
  };

  const result = (kind: ResultKind, value: number): string =>
    kind === 'time' ? duration(value) : number(value);

  const date = (value: Date): string => dates.value.format(value);

  /** "170 ms" (a setting's timing). */
  const milliseconds = (value: number): string => millis.value.format(value);

  return { number, duration, percent, indicator, result, date, milliseconds, factor };
}
