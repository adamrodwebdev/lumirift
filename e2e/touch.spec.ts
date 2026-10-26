import { expect, test, type Page } from '@playwright/test';

/*
 * The phone controls (1.32), played with real touch events on a phone screen
 * (the browser's own touch input): a flick drops the piece at once, and only
 * once a touch; a tap does not drop; a flick up holds. The buttons alone, or
 * with the gestures; the left-handed mirror; the touch controls' window.
 */
test.skip(({ isMobile }) => !isMobile, 'Touch screens only');

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A touch screen samples the finger every 8 ms (120 Hz). */
const SAMPLE_MS = 8;

/**
 * A finger on the screen, through the browser's touch input. The events
 * carry the touch screen's own times, a sample every 8 ms from the moment
 * the finger lands, however slowly a busy machine sends them: on a phone,
 * the time of a touch is the screen's, never the page's.
 */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  /** The touch screen's clock (seconds since 1970, as the protocol counts). */
  let clock = 0;
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: readonly Point[]) => {
    clock = type === 'touchStart' ? Date.now() / 1000 : clock + SAMPLE_MS / 1000;
    return cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(({ x, y }) => ({ x, y, id: 1 })),
      timestamp: clock,
    });
  };
  return {
    down: (point: Point) => send('touchStart', [point]),
    move: (point: Point) => send('touchMove', [point]),
    up: () => send('touchEnd', []),
    /** Down at the first point, through the others, up. */
    async stroke(points: readonly Point[]) {
      await send('touchStart', points.slice(0, 1));
      for (const point of points.slice(1)) await send('touchMove', [point]);
      await send('touchEnd', []);
    },
  };
}

/** Points from `from`, `count` steps of (dx, dy). */
const line = (from: Point, dx: number, dy: number, count: number): Point[] =>
  Array.from({ length: count + 1 }, (_, i) => ({ x: from.x + dx * i, y: from.y + dy * i }));

/** The Classic mode with these settings, past the first game's guide; its gestures loaded. */
async function playClassic(page: Page, settings: Record<string, unknown> = {}) {
  await page.goto('/');
  await page.evaluate((saved) => {
    localStorage.setItem('stackrift:settings', JSON.stringify(saved));
    localStorage.setItem('stackrift:profile', JSON.stringify({ games: 3, playedMs: 600_000 }));
  }, settings);
  await page.reload();
  await page.locator('main').waitFor();
  await page.getByRole('tab', { name: 'Modes' }).click();
  await page
    .getByRole('tabpanel', { name: 'Modes' })
    .getByRole('button', { name: 'Classique', exact: true })
    .click();
  await page
    .getByRole('tabpanel', { name: 'Modes' })
    .getByRole('button', { name: 'Jouer' })
    .click();
  // The game's own well (the menu's showcase keeps canvases of its own, out of sight).
  const well = page.locator('.game .stage__canvas');
  await expect(well).toBeVisible();
  // The gestures' module comes once the game is on screen.
  await page.waitForLoadState('networkidle');
  const box = (await well.boundingBox())!;
  return { centre: { x: box.x + box.width / 2, y: box.y + box.height * 0.45 } };
}

const score = (page: Page) => page.locator('.hud__item').first().locator('dd');

test('a flick drops at once, only once a touch; a tap never drops', async ({ page }) => {
  const { centre } = await playClassic(page);
  const touch = await finger(page);
  await expect(score(page)).toHaveText('0');

  // A tap turns the piece: nothing lands.
  await touch.stroke([centre]);
  await page.waitForTimeout(300);
  await expect(score(page)).toHaveText('0');

  // A flick down: the piece drops before the finger lifts.
  await touch.down(centre);
  for (const point of line(centre, 0, 30, 5).slice(1)) await touch.move(point);
  await expect(score(page)).not.toHaveText('0');
  const dropped = await score(page).textContent();
  // The same touch flicks again, up then down: the next piece stays where it is.
  for (const point of line({ x: centre.x, y: centre.y + 150 }, 0, -12, 10).slice(1))
    await touch.move(point);
  for (const point of line(centre, 0, 30, 5).slice(1)) await touch.move(point);
  await touch.up();
  await page.waitForTimeout(400);
  await expect(score(page)).toHaveText(dropped!);
});

test('a flick up keeps the piece in reserve', async ({ page }) => {
  const { centre } = await playClassic(page);
  const touch = await finger(page);
  await touch.stroke(line({ x: centre.x, y: centre.y + 120 }, 0, -30, 5));
  await expect(page.locator('.stage__box--hold')).toHaveClass(/stage__box--used/);
});

test('the buttons alone play; the gestures then do nothing', async ({ page }) => {
  const { centre } = await playClassic(page, { controls: 'buttons' });
  const touch = await finger(page);
  await expect(page.getByRole('group', { name: 'Déplacer et descendre' })).toBeVisible();
  await touch.stroke(line(centre, 0, 20, 2));
  await page.waitForTimeout(300);
  await expect(score(page)).toHaveText('0');
  await page.getByRole('button', { name: 'Chute instantanée' }).click();
  await expect(score(page)).not.toHaveText('0');
});

test('with both, the buttons drop and the gestures only move', async ({ page }) => {
  const { centre } = await playClassic(page, { controls: 'both' });
  const touch = await finger(page);
  await expect(page.getByRole('group', { name: 'Déplacer et descendre' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Tourner et faire tomber' })).toBeVisible();
  // A flick that would drop with the gestures alone (too short to soft drop).
  await touch.stroke(line(centre, 0, 20, 2));
  await page.waitForTimeout(300);
  await expect(score(page)).toHaveText('0');
  await page.getByRole('button', { name: 'Chute instantanée' }).click();
  await expect(score(page)).not.toHaveText('0');
});

test('left-handed, the Hold box and the coming pieces swap sides', async ({ page }) => {
  await playClassic(page, { leftHanded: true });
  await expect(page.locator('.game')).toHaveAttribute('data-hand', 'left');
  const hold = (await page.locator('.stage__hold').boundingBox())!;
  const next = (await page.locator('.stage__next').boundingBox())!;
  expect(hold.x).toBeGreaterThan(next.x);
});

test('the touch controls have their window, and the gestures their guide', async ({ page }) => {
  await page.goto('/');
  await page.locator('main').waitFor();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page
    .getByRole('dialog', { name: 'Réglages' })
    .getByRole('button', { name: 'Régler' })
    .click();
  const touch = page.getByRole('dialog', { name: 'Commandes tactiles' });
  await expect(touch).toBeVisible();
  await touch.getByRole('radio', { name: 'Boutons' }).check();
  // The buttons alone: no drag to set, no gesture to see.
  await expect(touch.getByRole('slider')).toBeDisabled();
  await expect(touch.getByRole('button', { name: 'Voir les gestes' })).toBeDisabled();
  await touch.getByRole('radio', { name: 'Gestes' }).check();
  await touch.getByRole('button', { name: 'Voir les gestes' }).click();
  const guide = page.getByRole('dialog', { name: 'Les gestes' });
  await expect(guide.getByRole('list', { name: 'Gestes' })).toBeVisible();
  await expect(guide.getByText('Toucher la moitié gauche')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('stackrift:settings'));
  expect(JSON.parse(saved!)).toMatchObject({ controls: 'gestures' });
});
