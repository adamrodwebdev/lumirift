import type { InjectionKey, Ref } from 'vue';

/** What the stages see of the rift surge: its gauge, and the player's call. */
export interface SurgeControl {
  /** This game has a surge (not the Rhythm, the Duel or the Mosaic). */
  readonly enabled: Readonly<Ref<boolean>>;
  /** The gauge (0 to 1); during a surge, the time it has left. */
  readonly fill: Readonly<Ref<number>>;
  readonly ready: Readonly<Ref<boolean>>;
  readonly active: Readonly<Ref<boolean>>;
  /** The player triggers it (nothing happens unless it is ready). */
  trigger(): void;
}

/** Provided by the game screen to its stage (the surge's key and button). */
export const SURGE: InjectionKey<SurgeControl> = Symbol('surge');
