import type { Page } from '@playwright/test';

/*
 * Saved data for the journeys (1.43). The game writes its own saves shortly
 * after a load: data written by the test between two loads (load, write,
 * reload) could be overwritten under load, and a full suite once lost a
 * season's points and a profile's gifts that way. Seeds are written before
 * the game's first script instead.
 */

/**
 * Writes these saves (`stackrift:*` keys and their values) before the game's
 * first script on the next load, then on no other: a later reload keeps what
 * the game saved since. Once per tab and per set of keys, so a second seed of
 * the same keys in one test does nothing.
 */
export async function seedStorage(page: Page, saves: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ flag, data }) => {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
      for (const [key, value] of Object.entries(data))
        localStorage.setItem(key, JSON.stringify(value));
    },
    { flag: `e2e:seeded:${Object.keys(saves).sort().join(',')}`, data: saves },
  );
}

/** A local day as the game stores it (`20261031`), `offset` days from today. */
export function localDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
