/**
 * Playwright's Firefox, playing a touch screen, sends the mouse's events
 * without the pointer events the game listens to (a piece lifted, a page
 * swiped, a cell tapped on the board; seen in the CI, 3 November 2026): the
 * tests that press and drag with the mouse play Firefox at the desktop only.
 * Chrome and WebKit play them on the phone, Firefox's clicks still count.
 */
export const FIREFOX_TOUCH_MOUSE = 'Firefox as a touch screen: the mouse sends no pointer events';
