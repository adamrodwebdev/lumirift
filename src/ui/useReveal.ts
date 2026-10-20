import { onBeforeUnmount, ref, type Ref } from 'vue';
import type { LevelProgress } from '@/progression/Experience';

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * A number that counts up to its target, fast then settling (ease-out), so
 * that a score is felt before it is read. Straight to the end with reduced
 * motion.
 */
export function useCountUp(durationMs = 750): {
  readonly value: Readonly<Ref<number>>;
  run(target: number, delayMs?: number): void;
} {
  const value = ref(0);
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (target: number, delayMs = 0) => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    if (still() || target <= 0) {
      value.value = target;
      return;
    }
    value.value = 0;
    timer = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        value.value = Math.round(target * (1 - (1 - progress) ** 3));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delayMs);
  };

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  });
  return { value, run };
}

/** How far into its level a player is, 0 to 1 (1 at the top level). */
export const levelShare = (progress: LevelProgress): number =>
  progress.needed === 0 ? 1 : progress.into / progress.needed;

/**
 * The experience bar of the end of a game: it fills from where the player
 * was to where the game brought them; past a level, it fills to the end,
 * the new level pops, and it fills again from empty.
 */
export function useXpReveal(): {
  /** The bar's fill, 0 to 1. */
  readonly fill: Readonly<Ref<number>>;
  /** The level shown beside the bar. */
  readonly level: Readonly<Ref<number>>;
  /** A level was passed: its badge pops. */
  readonly levelUp: Readonly<Ref<boolean>>;
  /** The fill jumps (no transition) while the bar resets. */
  readonly instant: Readonly<Ref<boolean>>;
  run(from: LevelProgress, to: LevelProgress, delayMs?: number): Promise<void>;
} {
  const fill = ref(0);
  const level = ref(1);
  const levelUp = ref(false);
  const instant = ref(true);
  /** Each run; a newer one (experience doubled) takes over. */
  let generation = 0;

  const run = async (from: LevelProgress, to: LevelProgress, delayMs = 0) => {
    const mine = ++generation;
    const current = () => mine === generation;
    const passed = to.level > from.level;
    instant.value = true;
    fill.value = levelShare(from);
    level.value = from.level;
    levelUp.value = false;
    if (still()) {
      fill.value = levelShare(to);
      level.value = to.level;
      levelUp.value = passed;
      return;
    }
    await nextFrame();
    await nextFrame();
    await wait(delayMs);
    if (!current()) return;
    instant.value = false;
    if (passed) {
      fill.value = 1;
      await wait(XP_FILL_MS);
      if (!current()) return;
      instant.value = true;
      fill.value = 0;
      level.value = to.level;
      levelUp.value = true;
      await nextFrame();
      await nextFrame();
      if (!current()) return;
      instant.value = false;
    }
    fill.value = levelShare(to);
  };

  return { fill, level, levelUp, instant, run };
}

/** How long the bar takes to fill (matches its CSS transition). */
export const XP_FILL_MS = 700;
