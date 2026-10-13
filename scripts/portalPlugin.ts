import type { Plugin } from 'vite';

/** The official CrazyGames HTML5 SDK (v3), loaded in <head> before the game. */
export const CRAZYGAMES_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** Tags only our own site needs: the portal's page carries its own. */
const SITE_ONLY: readonly RegExp[] = [
  /\s*<link rel="manifest"[^>]*>/g,
  /\s*<link rel="apple-touch-icon"[^>]*>/g,
  /\s*<meta\s+(property="og:|name="twitter:)[\s\S]*?\/>/g,
  /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
];

/**
 * What a portal build changes in index.html: the portal's SDK, loaded before
 * the game, and none of our site's social, search or install tags.
 */
export function portalPlugin(platform: string | undefined): Plugin {
  return {
    name: 'stackrift-portal',
    transformIndexHtml(html) {
      if (platform !== 'crazygames') return html;
      const withSdk = html.replace(
        '</title>',
        `</title>\n    <script src="${CRAZYGAMES_SDK}"></script>`,
      );
      return SITE_ONLY.reduce((page, pattern) => page.replace(pattern, ''), withSdk);
    },
  };
}
