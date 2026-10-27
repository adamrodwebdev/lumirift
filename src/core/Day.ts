/** A local date as YYYYMMDD: the key of a day (daily challenge, objectives, streak). */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

/** What is left until `end`, from `now`: whole days, hours and minutes, never negative. */
export function timeLeft(
  end: Date,
  now: Date,
): { readonly days: number; readonly hours: number; readonly minutes: number } {
  const minutes = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60_000));
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor(minutes / 60) % 24,
    minutes: minutes % 60,
  };
}

/** The local date of a day's key, at noon (no change of hour moves it to another day). */
export function dateOf(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6)), 12);
}

/** Whole days from one day's key to another's (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000);
}

/** The key of the day before, across months and years. */
export function previousDay(key: string): string {
  const date = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6)));
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}
