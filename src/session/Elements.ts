/**
 * The Sand's elements by name (1.36), as the common contract speaks of them:
 * the week's featured element, its goal, what a game counts of each. A family
 * maps them to its own matter (the Sand, to its tones).
 */
export const ELEMENT_NAMES = ['water', 'fire', 'oil', 'ice', 'lightning', 'seed', 'acid'] as const;
export type ElementName = (typeof ELEMENT_NAMES)[number];
