import { describe, expect, it, vi } from 'vitest';
import { TouchFeel } from '@/families/falling/fx/TouchFeel';
import { HAPTIC_BUDGET } from '@/families/falling/input/phone/GestureTuning';
import { Haptics } from '@/services/Haptics';

/** A phone, vibrating or not, the player's wish, and a clock to move. */
function setup({ vibrates = true, wanted = true } = {}) {
  const vibrate = vi.fn(() => true);
  const glow = vi.fn();
  let now = 0;
  const haptics = new Haptics(vibrates ? { vibrate } : {}, () => wanted);
  const feel = new TouchFeel(haptics, glow, () => now);
  return { feel, vibrate, glow, wait: (ms: number) => (now += ms) };
}

describe('TouchFeel', () => {
  it('ticks lightly for a cell and firmer for a turn', () => {
    const { feel, vibrate, wait } = setup();
    feel.moved();
    wait(60);
    feel.turned();
    expect(vibrate.mock.calls).toEqual([[HAPTIC_BUDGET.cellMs], [HAPTIC_BUDGET.turnMs]]);
    expect(HAPTIC_BUDGET.cellMs).toBeLessThanOrEqual(10);
  });

  it('never ticks twice within 50 ms', () => {
    const { feel, vibrate, wait } = setup();
    feel.moved();
    wait(30);
    feel.moved();
    wait(30);
    feel.moved();
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('stays still unless the player asks for it', () => {
    const { feel, vibrate, glow } = setup({ wanted: false });
    feel.moved();
    feel.turned();
    expect(vibrate).not.toHaveBeenCalled();
    expect(glow).not.toHaveBeenCalled();
  });

  it('glows instead where the phone cannot vibrate', () => {
    const { feel, glow, wait } = setup({ vibrates: false });
    feel.moved();
    wait(60);
    feel.turned();
    expect(glow).toHaveBeenCalledTimes(2);
  });
});
