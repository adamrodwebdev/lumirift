/**
 * The interface's transition times (1.42), the same as the tokens of
 * tokens.css (a test keeps them equal): what leaves, what arrives, a page of
 * the menu, a whole screen. Under the fade every one lasts `outMs`.
 */
export const MOTION = { outMs: 140, inMs: 220, pageMs: 260, screenMs: 280 } as const;

/** The time of a transition of `ms`, under the fade or not. */
export const transitionMs = (ms: number, fades: boolean): number => (fades ? MOTION.outMs : ms);
