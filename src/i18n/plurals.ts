/**
 * Which form of a message "a | b | c" a number takes. vue-i18n's own rule
 * fits English (two forms: one | other; three: zero | one | other); French
 * and Russian count differently.
 */
export type PluralRule = (choice: number, choicesLength: number) => number;

/**
 * French: 0 and 1 are singular ("0 étoile disponible"). A three-form message
 * reads zero | one | other, as in English.
 */
export const frenchPlural: PluralRule = (choice, choicesLength) => {
  const whole = Math.floor(Math.abs(choice));
  if (choicesLength >= 3) return whole === 0 ? 0 : whole === 1 ? 1 : 2;
  return whole <= 1 ? 0 : Math.min(1, choicesLength - 1);
};

/**
 * Russian: one (1, 21, 101…), few (2–4, 22–24…), many (0, 5–20, 25…). A
 * message has these three forms, or four with a zero form first ("Нет звёзд").
 * A fraction takes the "few" form (1,5 звезды).
 */
export const russianPlural: PluralRule = (choice, choicesLength) => {
  const n = Math.abs(choice);
  const zero = choicesLength >= 4;
  if (zero && n === 0) return 0;
  const offset = zero ? 1 : 0;
  let form: number;
  if (!Number.isInteger(n)) form = 1;
  else {
    const ten = n % 10;
    const hundred = n % 100;
    if (ten === 1 && hundred !== 11) form = 0;
    else if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) form = 1;
    else form = 2;
  }
  return Math.min(offset + form, choicesLength - 1);
};
