import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import { seoPlugin } from './scripts/seoPlugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// Relative base: the build can be served from any sub-folder or game portal.
export default defineConfig({
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
    seoPlugin(process.env.SITE_URL),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    reportCompressedSize: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
