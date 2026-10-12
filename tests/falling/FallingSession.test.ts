import { describe, expect, it, vi } from 'vitest';
import { createFallingSession } from '@/families/falling';
import { ConstantRandom } from './helpers';

const session = (modeId: Parameters<typeof createFallingSession>[0], timeLimitMs = null) =>
  createFallingSession(modeId, { random: new ConstantRandom(), timeLimitMs });

describe('FallingSession', () => {
  it('ignores commands until the game runs', () => {
    const game = session('classic');
    expect(game.state).toBe('ready');
    expect(game.execute({ type: 'move', direction: -1 })).toBe(false);
    game.start();
    expect(game.execute({ type: 'move', direction: -1 })).toBe(true);
    expect(game.view.active?.x).toBe(2);
  });

  it('routes every command to the engine', () => {
    const game = session('flip');
    game.start();
    expect(game.execute({ type: 'rotate', direction: 1 })).toBe(true);
    expect(game.execute({ type: 'hold' })).toBe(true);
    expect(game.view.held?.type).toBe('I');
    expect(game.execute({ type: 'softDrop', active: true })).toBe(true);
    expect(game.execute({ type: 'ability' })).toBe(true);
    expect(game.execute({ type: 'hardDrop' })).toBe(true);
    expect(game.view.active?.type).toBe('T');
  });

  it('lists the common indicators first, then the mode ones', () => {
    const game = session('flip');
    game.start();
    expect(game.indicators().map((item) => item.id)).toEqual([
      'score',
      'lines',
      'level',
      'charges',
      'nextCharge',
    ]);
    expect(game.ability).toBe('flip');
  });

  it('puts the time first in a mode ranked on time', () => {
    const game = session('tide');
    game.start();
    game.update(500);
    expect(game.indicators()[0]).toEqual({ id: 'time', value: 500, format: 'duration' });
    expect(game.result()).toEqual({ modeId: 'tide', kind: 'time', value: 500 });
  });

  it('republishes engine events in the shared vocabulary', () => {
    const game = session('classic');
    const onState = vi.fn();
    const onOver = vi.fn();
    game.events.on('state', onState);
    game.events.on('over', onOver);
    game.start();
    expect(onState).toHaveBeenCalledWith({ state: 'running' });
    game.pause();
    expect(game.state).toBe('paused');
    game.resume();
    game.dispose();
    game.pause();
    expect(onState).toHaveBeenCalledTimes(3);
    expect(onOver).not.toHaveBeenCalled();
  });

  it('applies the time limit given by the daily challenge', () => {
    const game = createFallingSession('classic', {
      random: new ConstantRandom(),
      timeLimitMs: 1000,
    });
    game.start();
    game.update(1000);
    game.update(16);
    expect(game.state).toBe('over');
  });

  it('rejects a mode of another family', () => {
    expect(() => session('nope' as 'classic')).toThrow();
  });
});
