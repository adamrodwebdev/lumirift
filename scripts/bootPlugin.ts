import { readFileSync } from 'node:fs';
import type { Plugin, Rollup } from 'vite';
import { LOCALES } from '../src/i18n/locales.ts';

type OutputBundle = Rollup.OutputBundle;
type OutputAsset = Rollup.OutputAsset;
type OutputChunk = Rollup.OutputChunk;

/** Where the settings are saved (see SettingsService): the language chosen, if any. */
const SETTINGS_KEY = 'stackrift:settings';

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
function startAfterFirstPaint(html: string, bundle: OutputBundle): string {
  const entry = ENTRY.exec(html)?.[1];
  if (!entry) throw new Error('bootPlugin: the entry script was not found');
  const modules = [...html.matchAll(MODULE_PRELOAD)].map((match) => match[1]!);
  const script =
    `<script type="module">const f=${JSON.stringify(localeFiles(bundle))};let l;` +
    `try{l=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||'{}').locale}catch(e){}` +
    `if(!f[l]){l='en';for(const t of navigator.languages||[navigator.language]){` +
    `let c=String(t).toLowerCase().split('-')[0];if(c==='in')c='id';if(f[c]){l=c;break}}}` +
    `const m=${JSON.stringify(modules)};let s=0;` +
    `const go=()=>{if(s)return;s=1;for(const h of [f[l],...m]){` +
    `const k=document.createElement('link');k.rel='modulepreload';k.crossOrigin='';k.href=h;` +
    `document.head.append(k)}import('${entry}')};` +
    `if(document.visibilityState==='hidden')go();` +
    `else if((PerformanceObserver.supportedEntryTypes||[]).includes('paint')){` +
    `new PerformanceObserver((p,o)=>{if(p.getEntriesByName('first-contentful-paint').length){` +
    `o.disconnect();go()}}).observe({type:'paint',buffered:true});setTimeout(go,${PAINT_TIMEOUT_MS})}` +
    `else requestAnimationFrame(()=>setTimeout(go))</script>`;
  return html.replace(MODULE_PRELOAD, '').replace(ENTRY, script);
}

/**
 * The first screen without waiting (1.19.1): its stylesheets inline, the title
 * card painted before anything else is fetched or run. Builds only.
 */
export function bootPlugin(): Plugin {
  return {
    name: 'lumirift-boot',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        return bundle ? startAfterFirstPaint(inlineStyles(html, bundle), bundle) : html;
      },
    },
  };
}
