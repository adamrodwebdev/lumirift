import type { Page } from '@playwright/test';

/** The gift calendar's window, in every language of the game. */
export const giftDialog = (page: Page) =>
  page.getByRole('dialog', { name: /^(Cadeau du jour|Daily gift|Подарок дня|Hadiah harian)$/ });

/**
 * The gift calendar (1.35) opens by itself on the first menu visit of a day,
 * once a game was played: the journeys about something else close it as a
 * player would, whenever it rises over the menu.
 */
export async function closeDailyGift(page: Page): Promise<void> {
  await page.addLocatorHandler(giftDialog(page), async (dialog) => {
    // A window closed already only fades away (1.42): nothing to do but let it go.
    if (!(await dialog.evaluate((element) => (element as HTMLDialogElement).open))) return;
    await dialog.getByRole('button', { name: /^(Fermer|Close|Закрыть|Tutup)$/ }).click();
  });
}
