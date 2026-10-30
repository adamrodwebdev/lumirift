/**
 * The weight of each moment (lot 27, 1.41), read by the effects, the sounds
 * and the vibrations: a small event stays small, a big one hits. Pure rules:
 * the painters never set a number of their own.
 */

/** What a big moment holds still (1.41): the game's clock (`FrameClock.hold`). */
export interface TimeHolder {
  hold(ms: number): void;
}

/** What a moment does to the game and the screen. */
export interface Impact {
  /** Hit-stop: the game's time stands still this long (ms). */
  readonly holdMs: number;
  /** Trauma added to the camera's shake (0 to 1). */
  readonly trauma: number;
  /** The well tilts as well (the biggest moments). */
  readonly tilt: boolean;
  /** The camera dips (cells). */
  readonly dip: number;
  /** The landed piece squashes, as a share of its height. */
  readonly squash: number;
  /** The stack under it dips (cells, its top row). */
  readonly stack: number;
  /** The well's light: its peak, then how long it fades after the hold (ms). */
  readonly flash: number;
  readonly flashMs: number;
  /** The vibration: one pulse (ms), or a pattern. */
  readonly vibrate: number | readonly number[];
}

const NONE: Impact = {
  holdMs: 0,
  trauma: 0,
  tilt: false,
  dip: 0,
  squash: 0,
  stack: 0,
  flash: 0,
  flashMs: 0,
  vibrate: 0,
};

/** The longest fall of a classic well (rows): the heaviest landing. */
const FULL_DROP = 18;
/** A hard drop this long or longer dips the camera (rows). */
const DIP_FROM = 3;

/**
 * A piece landing. By gravity or brought down by the player, it barely
 * squashes, nothing else: the most frequent moment stays the quietest. A
 * hard drop weighs with its height: squash, the stack, the camera, a pulse.
 */
export function landingImpact(hard: boolean, distance: number): Impact {
  if (!hard) return { ...NONE, squash: 0.04, stack: 0.03 };
  const weight = Math.min(1, Math.max(0, distance) / FULL_DROP);
  const dipWeight = Math.min(1, (distance - DIP_FROM) / (FULL_DROP - DIP_FROM));
  return {
    ...NONE,
    squash: 0.04 + 0.06 * weight,
    stack: 0.03 + 0.05 * weight,
    dip: distance >= DIP_FROM ? 0.04 + 0.08 * dipWeight : 0,
    vibrate: Math.round(10 + 10 * weight),
  };
}

/** Lines cleared at once, 0 to 4 (4: a RIFT!): the hold and the shake they bring. */
const HOLD_MS = [0, 0, 35, 60, 100] as const;
const TRAUMA = [0, 0.15, 0.25, 0.4, 0.65] as const;
/** The RIFT!'s pulses, as since 1.32. */
const RIFT_PULSES = [30, 40, 80] as const;

/**
 * Lines cleared, `combo` the engine's count of the chain (0 at its first
 * clear: ×(combo + 1) on screen). One line keeps the game flowing; two hold
 * it 35 ms, three 60, a RIFT! 100; from ×3, 10 ms more a step (40 at most).
 */
export function clearImpact(lines: number, combo: number): Impact {
  const size = Math.max(0, Math.min(4, lines));
  const times = combo + 1;
  const holdMs = (HOLD_MS[size] ?? 0) + (times >= 3 ? Math.min(40, 10 * (times - 2)) : 0);
  const trauma = Math.min(1, (TRAUMA[size] ?? 0) + 0.05 * Math.max(0, combo));
  const rift = size === 4;
  const pulse = Math.max(18 + 8 * size, combo >= 1 ? Math.min(60, 20 + 6 * combo) : 0);
  return {
    ...NONE,
    holdMs: Math.min(140, holdMs),
    trauma,
    tilt: rift,
    // The first hit goes down.
    dip: 0.12 * trauma,
    flash: rift ? 0.35 : size === 3 ? 0.15 : 0,
    flashMs: rift ? 220 : size === 3 ? 120 : 0,
    vibrate: rift ? RIFT_PULSES : pulse,
  };
}

/** Sand's regions cleared at once: two hold the game 35 ms, three and more 60. */
export function sandClearHoldMs(regions: number): number {
  return regions >= 3 ? 60 : regions === 2 ? 35 : 0;
}

/** The colour a combo's word heats to, from ×2 to ×8 and beyond. */
export type ComboHeat = 'gold' | 'orange' | 'red' | 'white';

/** The words of heat at a combo's milestones (their keys in the locales: `combo.shout.*`). */
export const COMBO_SHOUTS: Readonly<Record<number, string>> = {
  3: 'hot',
  5: 'blazing',
  8: 'inferno',
  10: 'riftbreaker',
};

/** How a combo of ×`times` looks: the size of its word (cells), its heat, its shout. */
export interface ComboLook {
  readonly size: number;
  readonly heat: ComboHeat;
  readonly shout: string | null;
}

/** ×2 is 1.05 cells and gold; each step 0.08 more (1.6 at most), hotter at ×3, ×5, ×8. */
export function comboLook(times: number): ComboLook {
  return {
    size: Math.round(100 * Math.min(1.6, 1.05 + 0.08 * Math.max(0, times - 2))) / 100,
    heat: times >= 8 ? 'white' : times >= 5 ? 'red' : times >= 3 ? 'orange' : 'gold',
    shout: COMBO_SHOUTS[times] ?? null,
  };
}

/** A broken combo is heard from ×3 (a small one lost stays silent). */
export function comboBreakHeard(times: number): boolean {
  return times >= 3;
}
