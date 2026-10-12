/** A local date as YYYYMMDD: the key of a day (daily challenge, objectives, streak). */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

/** The key of the day before, across months and years. */
export function previousDay(key: string): string {
  const date = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6)));
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}
