import { readFileSync } from 'node:fs';
import type { Plugin, Rollup } from 'vite';
import { LOCALES } from '../src/i18n/locales.ts';

type OutputBundle = Rollup.OutputBundle;
type OutputAsset = Rollup.OutputAsset;
type OutputChunk = Rollup.OutputChunk;

/** Where the settings are saved (see SettingsService): the language chosen, if any. */
const SETTINGS_KEY = 'stackrift:settings';
/** Where the profile is saved (see ProfileService): whether the training is behind the player. */
const PROFILE_KEY = 'stackrift:profile';

const STYLESHEET = /<link rel="stylesheet"(?: crossorigin)? href="\.\/(assets\/[^"]+\.css)">/g;
const MODULE_PRELOAD = /\s*<link rel="modulepreload" crossorigin href="(\.\/assets\/[^"]+\.js)">/g;
const ENTRY = /<script type="module" crossorigin src="(\.\/assets\/[^"]+\.js)"><\/script>/;

/**
 * The stylesheets of the first screen, inline: the page paints without
 * waiting for them. Their urls (the fonts) were relative to the stylesheet,
 * in assets/; from the page, they are under assets/.
 */
function inlineStyles(html: string, bundle: OutputBundle): string {
  return html.replace(STYLESHEET, (tag, file: string) => {
    const asset = bundle[file] as OutputAsset | undefined;
    if (asset?.type !== 'asset') return tag;
    const css = String(asset.source).replace(/url\(\.\//g, 'url(./assets/');
    return `<style>${css}</style>`;
  });
}

/** A chunk's code with its escapes (ф, \u{1f600}, \xe9) read as the characters they stand for. */
const unescaped = (code: string): string =>
  code
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/**
 * The messages of each language become a chunk of their own (virtual modules
 * of the i18n plugin, `virtual:intlify-i18n-N`, which do not say whose they
 * are): each is told by its page title, read from the source, whatever the
 * script it is written in and however the minifier escapes it.
 */
function localeFiles(bundle: OutputBundle): Record<string, string> {
  const titles = LOCALES.map((locale) => {
    const source = new URL(`../src/i18n/locales/${locale}.json`, import.meta.url);
    const messages = JSON.parse(readFileSync(source, 'utf8')) as { meta: { title: string } };
    return [locale, messages.meta.title] as const;
  });
  const files: Record<string, string> = {};
  for (const output of Object.values(bundle)) {
    const chunk = output as OutputChunk;
    if (chunk.type !== 'chunk' || !chunk.isDynamicEntry) continue;
    const code = unescaped(chunk.code);
    const found = titles.filter(([, title]) => code.includes(title));
    if (found.length > 1) {
      throw new Error(`bootPlugin: ${chunk.fileName} holds several languages`);
    }
    if (found[0]) files[found[0][0]] = `./${chunk.fileName}`;
  }
  if (Object.keys(files).length !== LOCALES.length) {
    throw new Error(`bootPlugin: a chunk per language expected, found ${JSON.stringify(files)}`);
  }
  return files;
}

/** The longest wait for the browser's report of the first paint. */
const PAINT_TIMEOUT_MS = 1000;

/** What the boot fetches beyond the entry's own code. */
export interface BootOptions {
  /**
   * The modules a new player's first run needs before anything shows, as
   * paths from the project's root (a portal build: its platform, the game
   * screen, the training's family and stage). Their chunks, the chunks they
   * import and their stylesheets are fetched with the code, unless the
   * player's save says the training is behind them (1.46: they waited for the
   * code to run, a second on a slow phone).
   */
  readonly firstRun?: readonly string[];
}

/** The files a first run needs (scripts, then stylesheets), but those the page fetches already. */
function firstRunFiles(
  bundle: OutputBundle,
  modules: readonly string[],
  fetched: ReadonlySet<string>,
): { scripts: string[]; styles: string[] } {
  const chunks = Object.values(bundle).filter(
    (output): output is OutputChunk => output.type === 'chunk',
  );
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const visit = (chunk: OutputChunk) => {
    if (scripts.has(chunk.fileName)) return;
    scripts.add(chunk.fileName);
    chunk.viteMetadata?.importedCss.forEach((css) => styles.add(css));
    for (const file of chunk.imports) {
      const next = byFile.get(file);
      if (next) visit(next);
    }
  };
  for (const module of modules) {
    const root = chunks.find((chunk) =>
      (chunk.facadeModuleId ?? '').replaceAll('\\', '/').includes(`/${module}`),
    );
    if (!root) throw new Error(`bootPlugin: no chunk for the first run's ${module}`);
    visit(root);
  }
  const own = (file: string) => `./${file}`;
  return {
    scripts: [...scripts].map(own).filter((file) => !fetched.has(file)),
    styles: [...styles].map(own),
  };
}

/**
 * The game starts once the title card's first paint is reported (1.26.1):
 * its code and the messages of the player's language (the language saved,
 * else the browser's, else English, as detectLocale) are fetched then,
 * together, and the code runs. What the player sees first never waits for
 * any of it. A frame and a timer are not enough: the requests would start
 * after the frame is drawn but end before the browser reports it, and count
 * as needed for the first paint. A hidden page (a tab in the background)
 * starts at once; a browser without paint timing waits a frame; a report
 * that never comes, a second.
 */
function startAfterFirstPaint(html: string, bundle: OutputBundle, options: BootOptions): string {
  const entry = ENTRY.exec(html)?.[1];
  if (!entry) throw new Error('bootPlugin: the entry script was not found');
  const modules = [...html.matchAll(MODULE_PRELOAD)].map((match) => match[1]!);
  const first = firstRunFiles(bundle, options.firstRun ?? [], new Set([entry, ...modules]));
  const script =
    `<script type="module">const f=${JSON.stringify(localeFiles(bundle))};let l;` +
    `try{l=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||'{}').locale}catch(e){}` +
    `if(!f[l]){l='en';for(const t of navigator.languages||[navigator.language]){` +
    `let c=String(t).toLowerCase().split('-')[0];if(c==='in')c='id';if(f[c]){l=c;break}}}` +
    `let n=1;try{const p=JSON.parse(localStorage.getItem(${JSON.stringify(PROFILE_KEY)})||'{}');` +
    `n=p.trained!==true&&!(p.games>0)}catch(e){}` +
    `const m=${JSON.stringify(modules)},g=n?${JSON.stringify(first.scripts)}:[],` +
    `c=n?${JSON.stringify(first.styles)}:[];let s=0;` +
    // In the order they are needed: the language, the entry and what it imports, then the
    // first run's files, at a low priority, so that they never hold up the code before them.
    `const add=(r,h,p)=>{const k=document.createElement('link');k.rel=r;k.crossOrigin='';k.href=h;` +
    `if(r==='preload')k.as='style';if(p)k.fetchPriority='low';document.head.append(k)};` +
    `const go=()=>{if(s)return;s=1;for(const h of [f[l],'${entry}',...m])add('modulepreload',h);` +
    `for(const h of g)add('modulepreload',h,1);for(const h of c)add('preload',h,1);` +
    `import('${entry}')};` +
    `if(document.visibilityState==='hidden')go();` +
    `else if((PerformanceObserver.supportedEntryTypes||[]).includes('paint')){` +
    `new PerformanceObserver((p,o)=>{if(p.getEntriesByName('first-contentful-paint').length){` +
    `o.disconnect();go()}}).observe({type:'paint',buffered:true});setTimeout(go,${PAINT_TIMEOUT_MS})}` +
    `else requestAnimationFrame(()=>setTimeout(go))</script>`;
  return html.replace(MODULE_PRELOAD, '').replace(ENTRY, script);
}

/**
 * The first screen without waiting (1.19.1): its stylesheets inline, the title
 * card painted before anything else is fetched or run; with it, what a new
 * player's first run needs (1.46). Builds only.
 */
export function bootPlugin(options: BootOptions = {}): Plugin {
  return {
    name: 'lumirift-boot',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        return bundle ? startAfterFirstPaint(inlineStyles(html, bundle), bundle, options) : html;
      },
    },
  };
}
