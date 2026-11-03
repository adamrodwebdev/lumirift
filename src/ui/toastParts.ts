/** A message over the well, as drawn: its headline and the rest, if any. */
export interface ToastParts {
  readonly head: string;
  readonly rest: string | null;
}

/** Up to its first exclamation mark (a no-break space before it in French), then the rest. */
const HEADLINE = /^([^!]+!)\s+(\S.*)$/su;

/**
 * A message that opens on an exclamation shows it as its headline, the rest
 * under it (1.46): « Shock! » over « 780 grains broken through the water ».
 * Any other message is a headline alone.
 */
export function toastParts(text: string): ToastParts {
  const match = HEADLINE.exec(text);
  return match ? { head: match[1]!, rest: match[2]! } : { head: text, rest: null };
}
