import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MessageQueue, READING, readingMs, ReadingHold } from '@/ui/readingTime';

interface GuideTexts {
  readonly coach: Readonly<Record<string, string>>;
  readonly training: { readonly guide: Readonly<Record<string, string>> };
}
/** A language's texts, read raw (the i18n plugin compiles imports). */
const texts = (code: string) =>
  JSON.parse(readFileSync(`src/i18n/locales/${code}.json`, 'utf8')) as GuideTexts;
const LOCALES = { en: texts('en'), fr: texts('fr'), id: texts('id'), ru: texts('ru') } as const;
const COACH = ['move', 'rotate', 'drop', 'goalSand', 'goalLines'] as const;

/** Every line a first game's coach or a training's guide may show, in a language. */
function guideLines(locale: GuideTexts): string[] {
  return [...COACH.map((step) => locale.coach[step]!), ...Object.values(locale.training.guide)];
}

describe('readingMs (1.40)', () => {
  it('gives a moment to notice, then time by the sign, between 1.5 and 7 s', () => {
    expect(readingMs('Go!')).toBe(READING.minMs);
    expect(readingMs('2 lines cleared · Combo ×3')).toBe(1200 + 55 * 26);
    expect(readingMs('x'.repeat(400))).toBe(READING.maxMs);
  });

  it.each(Object.entries(LOCALES))(
    'gives every guide line its full time in %s, longer than the 1.4 s it had',
    (_, locale) => {
      for (const line of guideLines(locale)) {
        const time = readingMs(line);
        expect(time, line).toBeGreaterThan(1400);
        // Never cut by the ceiling: each line gets all its time.
        expect(time, line).toBeLessThan(READING.maxMs);
      }
    },
  );

  it('gives a longer language its own time', () => {
    const french = readingMs(LOCALES.fr.training.guide.link!);
    const english = readingMs(LOCALES.en.training.guide.link!);
    expect(french).toBeGreaterThan(english);
  });
});

describe('ReadingHold (1.40)', () => {
  const hold = () => new ReadingHold<string>((line) => (line === 'long' ? 3000 : 1500));

  it('keeps a line its reading time even when the game moves on, then shows the latest', () => {
    const lines = hold();
    lines.update('long', 16);
    lines.update('next', 1000);
    expect(lines.line).toBe('long');
    lines.update('later', 1000);
    expect(lines.line).toBe('long');
    lines.update('later', 1000);
    expect(lines.line).toBe('later');
  });

  it('keeps the last line when the game has nothing new to say', () => {
    const lines = hold();
    lines.update('short', 16);
    lines.update(null, 5000);
    expect(lines.line).toBeNull();
    const kept = hold();
    kept.update('short', 16);
    kept.update(kept.line, 5000);
    expect(kept.line).toBe('short');
  });

  it('lets the player skip at once', () => {
    const lines = hold();
    lines.update('long', 16);
    lines.replace(null);
    expect(lines.line).toBeNull();
  });
});

describe('MessageQueue (1.40)', () => {
  /** A clock moved by hand, for the queue's delays. */
  function setup() {
    let now = 0;
    const timers: { at: number; run: () => void }[] = [];
    const shown: (string | null)[] = [];
    const queue = new MessageQueue<string>(
      (text) => (text.length > 5 ? 3000 : 1500),
      (run, ms) => {
        const timer = { at: now + ms, run };
        timers.push(timer);
        return () => timers.splice(timers.indexOf(timer), 1);
      },
      (text) => shown.push(text),
    );
    const wait = (ms: number) => {
      now += ms;
      for (const timer of timers.filter((each) => each.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
    };
    return { queue, shown, wait };
  }

  it('shows a message its reading time, then nothing', () => {
    const { queue, shown, wait } = setup();
    queue.add('Nice!');
    wait(1499);
    expect(shown).toEqual(['Nice!']);
    wait(1);
    expect(shown).toEqual(['Nice!', null]);
  });

  it('lets a newer message wait until the one shown is read; only the latest waits', () => {
    const { queue, shown, wait } = setup();
    queue.add('A longer one');
    queue.add('Two');
    queue.add('Three');
    wait(2999);
    expect(shown).toEqual(['A longer one']);
    wait(1);
    expect(shown).toEqual(['A longer one', 'Three']);
    wait(1500);
    expect(shown).toEqual(['A longer one', 'Three', null]);
  });

  it('clears at once for a new game', () => {
    const { queue, shown, wait } = setup();
    queue.add('Nice!');
    queue.add('Wait');
    queue.clear();
    wait(5000);
    expect(shown).toEqual(['Nice!', null]);
  });
});
