import type { IconName } from '../components/AppIcon.vue';

/** The menu's pages, in the order of their tabs. */
export const HUB_PAGES = ['home', 'modes', 'map', 'atelier'] as const;
export type HubPage = (typeof HUB_PAGES)[number];

export const HUB_ICONS: Readonly<Record<HubPage, IconName>> = {
  home: 'home',
  modes: 'modes',
  map: 'map',
  atelier: 'gem',
};
