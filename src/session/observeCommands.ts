import type { Command, GameSession } from './GameSession';

/**
 * The same session, reporting each command that took effect (the first
 * game's guide listens to them). Every other member is the session's own,
 * bound to it, so the stages see no difference.
 */
export function observeCommands<S extends GameSession>(
  session: S,
  onCommand: (type: string) => void,
): S {
  return new Proxy(session, {
    get(target, key) {
      if (key === 'execute') {
        return (command: Command) => {
          const done = target.execute(command);
          if (done) onCommand(command.type);
          return done;
        };
      }
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
}
