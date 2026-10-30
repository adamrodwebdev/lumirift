import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION, transitionMs } from '@/ui/motion';

/** Every style sheet of the game: the .css files and the components' <style> blocks. */
const SHEETS = (readdirSync(new URL('../../src', import.meta.url), { recursive: true }) as string[])
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => path.endsWith('.vue') || path.endsWith('.css'))
  .flatMap((path) => {
    const source = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
    if (path.endsWith('.css')) return [{ path: `src/${path}`, css: source, offset: 0 }];
    return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((style) => ({
      path: `src/${path}`,
      css: style[1]!,
      offset: source.slice(0, style.index + style[0].indexOf(style[1]!)).split('\n').length - 1,
    }));
  });

const TOKENS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
/** A transition token's time (ms), as tokens.css sets it outside the fade. */
const token = (name: string) =>
  Number(new RegExp(`--motion-${name}:\\s*(\\d+)ms`).exec(TOKENS)?.[1]);

/** Every animation and transition declared, its times resolved (ms). */
const DECLARATIONS = SHEETS.flatMap(({ path, css, offset }) =>
  [
    ...css.matchAll(
      /(animation|animation-duration|transition|transition-duration|transition-property)\s*:\s*([^;{}]*);/g,
    ),
  ].map((declaration) => {
    const value = declaration[2]!.replace(/\s+/g, ' ').trim();
    const times = [
      ...[...value.matchAll(/(?<![\w-])(\d*\.?\d+)(ms|s)\b/g)].map(
        ([, n, unit]) => Number(n) * (unit === 's' ? 1000 : 1),
      ),
      ...[...value.matchAll(/var\(--motion-(\w+)\)/g)].map(([, name]) => token(name!)),
    ];
    return {
      path,
      line: offset + css.slice(0, declaration.index).split('\n').length,
      property: declaration[1]!,
      value,
      times,
    };
  }),
);

/**
 * What runs longer than a transition, and is not one (§ 9 quater, lot 28): the
 * celebrations, the game's effects and the decor, which 1.41 tuned. By sheet,
 * then by animation; a loop (`infinite`) is decor too.
 */
const NOT_TRANSITIONS: Readonly<Record<string, string>> = {
  'src/families/race/ui/RaceClock.vue': 'the time won flies to the clock',
  'src/families/race/ui/RaceGuardianCard.vue': 'a Guardian enters the race',
  'src/families/race/ui/RaceMoments.vue': 'the moments of the race',
  'src/styles/ambiances.css': "the ambiance's light",
  'src/styles/stage.css': 'a mode turns the well',
  'src/ui/components/DangerLayer.vue': 'the danger',
  'src/ui/components/DefeatMatter.vue': 'the defeat',
  'src/ui/components/RecordBurst.vue': 'a record',
  'src/ui/components/SurgeLayer.vue': 'the rift surge',
  'src/ui/components/WellShatter.vue': 'the broken well',
};
const NOT_TRANSITION_ANIMATIONS: Readonly<Record<string, string>> = {
  pop: 'a level passed, at the end of a game',
  'close-fill': 'how close a game came',
  'best-beaten': 'a best beaten, in the dashboard',
  'day-stamp': "the day's gift, stamped",
  'tier-stamp': "a season's tier, stamped",
};
const exempt = ({ path, property, value }: (typeof DECLARATIONS)[number]) =>
  NOT_TRANSITIONS[path] !== undefined ||
  value.includes('infinite') ||
  (property === 'animation' && NOT_TRANSITION_ANIMATIONS[value.split(' ')[0]!] !== undefined);

/** Properties that move the layout: never animated (a transform or an opacity does the work). */
const LAYOUT =
  /^(width|height|inline-size|block-size|(min|max)-(width|height)|top|left|right|bottom|inset(-[a-z-]+)?|margin(-[a-z-]+)?|padding(-[a-z-]+)?|clip-path|all)$/;

describe('the transitions (1.42)', () => {
  it('finds the style sheets and their motion', () => {
    expect(SHEETS.length).toBeGreaterThan(40);
    expect(DECLARATIONS.length).toBeGreaterThan(80);
  });

  it('last 300 ms at most, outside the named celebrations, effects and decor', () => {
    const long = DECLARATIONS.filter(
      (declaration) => declaration.times.some((ms) => ms > 300) && !exempt(declaration),
    ).map(({ path, line, property, value }) => `${path}:${line} ${property}: ${value}`);
    expect(long).toEqual([]);
  });

  it('never animate the layout', () => {
    const transitioned = DECLARATIONS.filter(({ property }) =>
      ['transition', 'transition-property'].includes(property),
    ).filter(({ value }) =>
      value
        .split(',')
        .some(
          (part) => LAYOUT.test(part.trim().split(' ')[0]!) && !part.includes('allow-discrete'),
        ),
    );
    const framed = SHEETS.flatMap(({ path, css }) =>
      [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)]
        .filter(([, , body]) =>
          [...body!.matchAll(/(?<![\w-])([a-z-]+)\s*:/g)].some(([, name]) => LAYOUT.test(name!)),
        )
        .map(([, name]) => `${path} @keyframes ${name}`),
    );
    expect([
      ...transitioned.map(({ path, line, value }) => `${path}:${line} ${value}`),
      ...framed,
    ]).toEqual([]);
  });

  it('read their times from tokens equal to MOTION, all a fade of `out` under the fade', () => {
    expect([token('out'), token('in'), token('page'), token('screen')]).toEqual([
      MOTION.outMs,
      MOTION.inMs,
      MOTION.pageMs,
      MOTION.screenMs,
    ]);
    const fade = /:root\[data-transitions='fade'\]\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? '';
    for (const name of ['in', 'page', 'screen'])
      expect(fade).toMatch(new RegExp(`--motion-${name}:\\s*var\\(--motion-out\\)`));
    expect(fade).toMatch(/--move:\s*0/);
    expect(transitionMs(MOTION.screenMs, false)).toBe(280);
    expect(transitionMs(MOTION.screenMs, true)).toBe(MOTION.outMs);
  });
});
