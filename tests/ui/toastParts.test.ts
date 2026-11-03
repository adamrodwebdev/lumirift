import { describe, expect, it } from 'vitest';
import { toastParts } from '@/ui/toastParts';

describe('A message over the well, as drawn (1.46)', () => {
  it.each([
    ['Shock! 780 grains broken through the water', 'Shock!', '780 grains broken through the water'],
    [
      'Électrocution ! 780 grains brisés par l’eau',
      'Électrocution !',
      '780 grains brisés par l’eau',
    ],
    ['Разряд! Через воду разбито 780 песчинок', 'Разряд!', 'Через воду разбито 780 песчинок'],
    ['Sengatan! 780 butir hancur lewat air', 'Sengatan!', '780 butir hancur lewat air'],
    ['Close call! +120', 'Close call!', '+120'],
  ])('shows « %s » as its headline over the rest', (text, head, rest) => {
    expect(toastParts(text)).toEqual({ head, rest });
  });

  it.each([['Second chance!'], ['One region cleared · Combo ×2'], ['Level 3'], ['']])(
    'keeps « %s » whole: no exclamation to open on, or nothing after it',
    (text) => {
      expect(toastParts(text)).toEqual({ head: text, rest: null });
    },
  );
});
