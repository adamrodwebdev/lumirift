import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { loadEnv, searchForWorkspaceRoot } from 'vite';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import { bootPlugin } from './scripts/bootPlugin.ts';
import { portalPlugin } from './scripts/portalPlugin.ts';
import { seoPlugin } from './scripts/seoPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * What the dev server may serve (1.46.2): the project, and the real place of
 * its node_modules when that is a junction (a worktree that shares the main
 * checkout's): the fonts' files are there, and were refused, so the clip set
 * drew in a system font.
 */
const modules = fileURLToPath(new URL('./node_modules', import.meta.url));
const SERVABLE = [
  searchForWorkspaceRoot(process.cwd()),
  ...(existsSync(modules) ? [realpathSync(modules)] : []),
];

/** The portals' builds: a new player starts in the training, straight away (1.29). */
const PORTALS: readonly string[] = ['crazygames', 'playgama', 'yandex'];
/** The first game of a portal build: the training's Sand, or the mode of a test build (1.37). */
const FIRST_GAME: Readonly<Record<string, readonly string[]>> = {
  sand: ['src/families/sand/index.ts', 'src/families/sand/ui/SandStage.vue'],
  dunes: ['src/families/dunes/index.ts', 'src/families/dunes/ui/DunesStage.vue'],
};

/**
 * What a portal build's new player needs before anything shows (1.46): its
 * platform, the game screen and the first game. The boot fetches it with the
 * code, not after it.
 */
const firstRunOf = (platform: string | undefined, solo: string | undefined): string[] =>
  platform && PORTALS.includes(platform)
    ? [
        `src/platform/${platform}/`,
        'src/ui/screens/GameScreen.vue',
        ...(FIRST_GAME[solo ?? 'sand'] ?? []),
      ]
    : [];

// Relative base: the build can be served from any sub-folder or game portal.
// `--mode crazygames` builds the CrazyGames version into dist-crazygames/; a
// test build of one mode alone (1.37), `--mode playgama-dunes`, into dist-playgama-dunes/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const platform = env.VITE_PLATFORM;
  return {
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [
      vue(),
      // Messages are precompiled at build time: no runtime message compiler,
      // no `eval`, a smaller bundle and a strict CSP stays possible.
      VueI18nPlugin({
        include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
        runtimeOnly: true,
        compositionOnly: true,
        fullInstall: false,
        strictMessage: false,
      }),
      // Canonical URL and sitemap, when the site's address is known (SITE_URL).
      seoPlugin(platform ? undefined : process.env.SITE_URL),
      portalPlugin(platform),
      // The first screen without waiting: inline styles, the player's language fetched early.
      bootPlugin({ firstRun: firstRunOf(platform, env.VITE_SOLO) }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { fs: { allow: SERVABLE } },
    build: {
      outDir: ['dist', platform, env.VITE_SOLO].filter(Boolean).join('-'),
      target: 'es2022',
      cssCodeSplit: true,
      reportCompressedSize: true,
    },
    test: {
      environment: 'node',
      projects: [
        {
          extends: true,
          test: { name: 'unit', include: ['tests/**/*.test.ts'], exclude: ['tests/curve/**'] },
        },
        // The campaign's curve (1.33): bots play every level, minutes of games; a step of its own.
        { extends: true, test: { name: 'curve', include: ['tests/curve/**/*.test.ts'] } },
        // The level generator (1.38): a tool run by hand (`npm run generate:levels`), never in CI.
        { extends: true, test: { name: 'generate', include: ['tests/generate/**/*.gen.ts'] } },
      ],
    },
  };
});
