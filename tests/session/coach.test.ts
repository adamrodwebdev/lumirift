import { describe, expect, it, vi } from 'vitest';
import { Coach } from '@/session/Coach';
import type { GameSession } from '@/session/GameSession';
import { observeCommands } from '@/session/observeCommands';

describe('Coach', () => {
  it('goes through the steps as the player does them', () => {
    const coach = new Coach();
    expect(coach.step).toBe('move');
    expect(coach.command('rotate')).toBe(false);
    expect(coach.command('move')).toBe(true);
    expect(coach.step).toBe('rotate');
    coach.command('rotate');
    expect(coach.command('softDrop')).toBe(true);
    expect(coach.step).toBe('goal');
    expect(coach.command('move')).toBe(false);
    expect(coach.cleared()).toBe(true);
    expect(coach.step).toBeNull();
  });

  it('takes a row down by the finger for the drop step, never for a piece dropped (1.40)', () => {
    const coach = new Coach();
    coach.command('move');
    coach.command('rotate');
    expect(coach.command('softStep')).toBe(true);
    expect(coach.step).toBe('goal');
    // On the move step, rows down drop no piece: the guide stays.
    const learning = new Coach();
    learning.command('softStep');
    learning.command('softStep');
    learning.command('softStep');
    expect(learning.step).toBe('move');
  });

  it('moves on to the goal after two pieces dropped without doing the step shown', () => {
    const coach = new Coach();
    expect(coach.command('hardDrop')).toBe(false);
    expect(coach.step).toBe('move');
    expect(coach.command('hardDrop')).toBe(true);
    expect(coach.step).toBe('goal');
    // A step done resets the count: the drop step itself is done by a drop.
    const learning = new Coach();
    learning.command('hardDrop');
    learning.command('move');
    expect(learning.command('hardDrop')).toBe(false);
    expect(learning.step).toBe('rotate');
  });

  it('ends at the first clear, or when skipped', () => {
    const early = new Coach();
    early.cleared();
    expect(early.step).toBeNull();
    const skipped = new Coach();
    skipped.skip();
    expect(skipped.step).toBeNull();
    expect(skipped.cleared()).toBe(false);
  });
});

describe('observeCommands', () => {
  it('reports the commands that took effect and keeps the rest of the session', () => {
    class Session {
      private moves = 0;
      readonly modeId = 'classic';
      execute(command: { type: string }): boolean {
        if (command.type !== 'move') return false;
        this.moves++;
        return true;
      }
      count(): number {
        return this.moves;
      }
    }
    const seen = vi.fn();
    const session = observeCommands(new Session() as unknown as GameSession, seen);
    expect(session.execute({ type: 'move' })).toBe(true);
    expect(session.execute({ type: 'hold' })).toBe(false);
    expect(seen).toHaveBeenCalledExactlyOnceWith('move');
    expect(session.modeId).toBe('classic');
    expect((session as unknown as Session).count()).toBe(1);
  });
});
