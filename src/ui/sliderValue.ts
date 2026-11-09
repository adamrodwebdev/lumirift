import { orElse, parseNumber, type NumberRule } from '@/core/input';

/** A volume slider's steps: 0 to 100 per cent. */
export const PERCENT = { min: 0, max: 100, integer: true } as const;

/**
 * A slider's value, read at the door (9 Nov 2026): the text the browser
 * gives, parsed whole and strictly, within the slider's range; null when it
 * is not one, and the setting stays as it was.
 */
export function sliderValue(event: Event, rule: NumberRule): number | null {
  const slider = event.target;
  if (!(slider instanceof HTMLInputElement)) return null;
  return orElse(() => parseNumber(slider.value, rule, 'slider'), null);
}
