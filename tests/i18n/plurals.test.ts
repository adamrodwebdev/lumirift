import { describe, expect, it } from 'vitest';
import { frenchPlural, russianPlural } from '@/i18n/plurals';

/** The form a message "a | b | c" shows for a number. */
const form = (rule: typeof russianPlural, forms: readonly string[], n: number) =>
  forms[rule(n, forms.length)];

describe('Russian plural', () => {
  const stars = ['звезда', 'звезды', 'звёзд'];

  it('takes one, few or many as Russian counts', () => {
    expect(form(russianPlural, stars, 1)).toBe('звезда');
    expect(form(russianPlural, stars, 2)).toBe('звезды');
    expect(form(russianPlural, stars, 4)).toBe('звезды');
    expect(form(russianPlural, stars, 5)).toBe('звёзд');
    expect(form(russianPlural, stars, 0)).toBe('звёзд');
    expect(form(russianPlural, stars, 11)).toBe('звёзд');
    expect(form(russianPlural, stars, 12)).toBe('звёзд');
    expect(form(russianPlural, stars, 14)).toBe('звёзд');
    expect(form(russianPlural, stars, 21)).toBe('звезда');
    expect(form(russianPlural, stars, 22)).toBe('звезды');
    expect(form(russianPlural, stars, 111)).toBe('звёзд');
    expect(form(russianPlural, stars, 101)).toBe('звезда');
  });

  it('agrees with the language’s own rules for every whole number up to 1000', () => {
    const rules = new Intl.PluralRules('ru');
    const index = { one: 0, few: 1, many: 2 } as Record<string, number>;
    for (let n = 0; n <= 1000; n++) {
      expect(russianPlural(n, 3), String(n)).toBe(index[rules.select(n)]);
    }
  });

  it('reads a fourth form, first, as the zero', () => {
    const won = ['Нет звёзд', 'звезда', 'звезды', 'звёзд'];
    expect(form(russianPlural, won, 0)).toBe('Нет звёзд');
    expect(form(russianPlural, won, 1)).toBe('звезда');
    expect(form(russianPlural, won, 3)).toBe('звезды');
    expect(form(russianPlural, won, 7)).toBe('звёзд');
  });

  it('gives a fraction the form after two (1,5 звезды), and never leaves the message', () => {
    expect(form(russianPlural, stars, 1.5)).toBe('звезды');
    expect(russianPlural(5, 1)).toBe(0);
    expect(russianPlural(-2, 3)).toBe(1);
  });
});

describe('French plural', () => {
  it('keeps 0 and 1 singular', () => {
    const stars = ['étoile disponible', 'étoiles disponibles'];
    expect(form(frenchPlural, stars, 0)).toBe('étoile disponible');
    expect(form(frenchPlural, stars, 1)).toBe('étoile disponible');
    expect(form(frenchPlural, stars, 2)).toBe('étoiles disponibles');
    expect(form(frenchPlural, stars, 1.5)).toBe('étoile disponible');
  });

  it('reads three forms as zero, one and many', () => {
    const won = ['Aucune étoile', 'étoile', 'étoiles'];
    expect(form(frenchPlural, won, 0)).toBe('Aucune étoile');
    expect(form(frenchPlural, won, 1)).toBe('étoile');
    expect(form(frenchPlural, won, 2)).toBe('étoiles');
    expect(frenchPlural(4, 1)).toBe(0);
  });
});
