import type { IconName } from '../components/AppIcon.vue';

import type { Edition } from '@/platform/Edition';

/** The menu's pages, in the order of their tabs. */
export const HUB_PAGES = ['home', 'modes', 'map', 'atelier'] as const;
export type HubPage = (typeof HUB_PAGES)[number];

/**
 * The pages of a build's menu: all four, or in a test build of one mode
 * (1.37) the home and the Atelier only (no other mode, no campaign).
 */
export const hubPagesOf = (edition: Edition): readonly HubPage[] =>
  edition.solo ? ['home', 'atelier'] : HUB_PAGES;

export const HUB_ICONS: Readonly<Record<HubPage, IconName>> = {
  home: 'home',
  modes: 'modes',
  map: 'map',
  atelier: 'gem',
};
