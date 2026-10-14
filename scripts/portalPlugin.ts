import type { Plugin } from 'vite';

/** The official CrazyGames HTML5 SDK (v3), loaded in <head> before the game. */
export const CRAZYGAMES_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/**
 * The Playgama Bridge SDK (v2, current stable): the only external file a
 * Playgama build may load. It loads the adapter of the platform the game runs on.
 */
export const PLAYGAMA_BRIDGE = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';

/**
 * playgama-bridge-config.json, next to index.html: one interstitial placement
 * between two games, spaced by 2 minutes at least (Playgama's guides advise
 * 120 to 240 s); both orientations, no rotate overlay.
 */
export const PLAYGAMA_CONFIG = {
  advertisement: {
    minimumDelayBetweenInterstitial: 120,
    interstitial: {
      preloadOnStart: 'game_over',
      placementFallback: 'game_over',
      placements: [{ id: 'game_over' }],
    },
  },
  device: {
    useBuiltInOrientationPopup: false,
    supportedOrientations: ['portrait', 'landscape'],
  },
};

/** The SDK each portal build loads in <head>, before the game. */
const SDKS: Readonly<Record<string, string>> = {
  crazygames: CRAZYGAMES_SDK,
  playgama: PLAYGAMA_BRIDGE,
};

/** Tags only our own site needs: the portal's page carries its own. */
const SITE_ONLY: readonly RegExp[] = [
  /\s*<link rel="manifest"[^>]*>/g,
  /\s*<link rel="apple-touch-icon"[^>]*>/g,
  /\s*<meta\s+(property="og:|name="twitter:)[\s\S]*?\/>/g,
  /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
];

/**
 * What a portal or demo build changes: the portal's SDK, loaded before the
 * game, its configuration file (Playgama), and none of our site's social,
 * search or install tags (the page that embeds the game carries its own).
 */
export function portalPlugin(platform: string | undefined): Plugin {
  return {
    name: 'stackrift-portal',
    transformIndexHtml(html) {
      if (!platform) return html;
      const sdk = SDKS[platform];
      const withSdk = sdk
        ? html.replace('</title>', `</title>\n    <script src="${sdk}"></script>`)
        : html;
      return SITE_ONLY.reduce((page, pattern) => page.replace(pattern, ''), withSdk);
    },
    generateBundle() {
      if (platform !== 'playgama') return;
      this.emitFile({
        type: 'asset',
        fileName: 'playgama-bridge-config.json',
        source: `${JSON.stringify(PLAYGAMA_CONFIG, null, 2)}\n`,
      });
    },
  };
}
