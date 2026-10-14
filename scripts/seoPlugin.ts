import type { Plugin } from 'vite';

/**
 * What only a known address allows: canonical link, absolute share URLs
 * (social networks need them), and a sitemap referenced by robots.txt.
 * The site's address comes from SITE_URL at build time; without it the
 * build stays portable (portals, sub-folders) and nothing is added.
 */
export function seoPlugin(siteUrl: string | undefined): Plugin {
  const base = siteUrl ? siteUrl.replace(/\/?$/, '/') : null;
  return {
    name: 'lumirift-seo',
    transformIndexHtml(html) {
      if (!base) return html;
      return html
        .replace('content="./og-image.png"', `content="${base}og-image.png"`)
        .replace(
          '<meta property="og:type"',
          `<link rel="canonical" href="${base}" />\n    <meta property="og:url" content="${base}" />\n    <meta property="og:type"`,
        );
    },
    generateBundle() {
      if (!base) return;
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>
</urlset>
`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`,
      });
    },
  };
}
