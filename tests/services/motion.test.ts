import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { MotionController } from '@/services/MotionController';
import type { SettingsService } from '@/services/SettingsService';
import type { EffectsLevel } from '@/fx/EffectsProfile';

/** A controller over a stand-in page: the system's wish and the player's effects set by hand. */
function controller(systemCalm: boolean, effects: EffectsLevel = 'full') {
  const settings = { current: reactive({ effects }) } as unknown as Pick<
    SettingsService,
    'current'
  >;
  const root = { dataset: {} } as unknown as HTMLElement;
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const query = {
    matches: systemCalm,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
      listeners.push(listener),
  } as unknown as MediaQueryList;
  const motion = new MotionController(settings, root, () => query);
  return {
    motion,
    root,
    choose: (level: EffectsLevel) =>
      ((settings.current as { effects: EffectsLevel }).effects = level),
    systemAsks: (calm: boolean) => listeners.forEach((listener) => listener({ matches: calm })),
  };
}

describe('MotionController (1.42)', () => {
  it('moves by default, and says so to the page', () => {
    const { motion, root } = controller(false);
    expect(motion.style).toBe('move');
    expect(motion.fades).toBe(false);
    expect(root.dataset.transitions).toBe('move');
  });

  it('fades where the system asks for less motion', () => {
    const { motion, root } = controller(true);
    expect(motion.fades).toBe(true);
    expect(root.dataset.transitions).toBe('fade');
  });

  it('fades when the player turns the effects off; calm effects keep the motion', async () => {
    const { motion, root, choose } = controller(false, 'reduced');
    expect(motion.fades).toBe(false);
    choose('off');
    await nextTick();
    expect(motion.fades).toBe(true);
    expect(root.dataset.transitions).toBe('fade');
    choose('full');
    await nextTick();
    expect(root.dataset.transitions).toBe('move');
  });

  it('follows the system when its wish changes', async () => {
    const { motion, root, systemAsks } = controller(false);
    systemAsks(true);
    await nextTick();
    expect(motion.fades).toBe(true);
    expect(root.dataset.transitions).toBe('fade');
    systemAsks(false);
    await nextTick();
    expect(root.dataset.transitions).toBe('move');
  });
});
